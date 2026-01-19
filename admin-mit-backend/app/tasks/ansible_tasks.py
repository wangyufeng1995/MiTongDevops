"""
Ansible Celery 任务
提供 Ansible Playbook 异步执行功能
"""
import logging
import uuid
from typing import Dict, Any, Optional
from celery import Task
from app.celery_app import celery

logger = logging.getLogger(__name__)

# 全局 Flask 应用实例（懒加载）
_flask_app = None


def get_flask_app():
    """获取 Celery 专用的轻量级 Flask 应用实例"""
    global _flask_app
    if _flask_app is None:
        from app.celery_flask_app import create_celery_flask_app
        _flask_app = create_celery_flask_app()
    return _flask_app


class AnsibleTask(Task):
    """Ansible 任务基类"""
    
    # 不自动重试，Ansible 执行失败需要人工处理
    autoretry_for = ()
    max_retries = 0
    
    # 任务时间限制（1小时软限制，2小时硬限制）
    soft_time_limit = 3600
    time_limit = 7200
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任务失败时的回调"""
        execution_id = kwargs.get('execution_id', 'unknown')
        logger.error(f"[Ansible] 任务失败: execution_id={execution_id}, error={exc}")
        
        # 更新执行状态为失败
        app = get_flask_app()
        with app.app_context():
            try:
                from app.extensions import db
                from app.models.ansible import PlaybookExecution
                
                execution = PlaybookExecution.query.get(execution_id)
                if execution and execution.status == 'running':
                    execution.finish_execution(success=False, error_message=str(exc))
                    db.session.commit()
            except Exception as e:
                logger.error(f"[Ansible] 更新失败状态异常: {e}")
    
    def on_success(self, retval, task_id, args, kwargs):
        """任务成功时的回调"""
        execution_id = kwargs.get('execution_id', 'unknown')
        logger.info(f"[Ansible] 任务完成: execution_id={execution_id}")


@celery.task(
    base=AnsibleTask,
    bind=True,
    name='app.tasks.ansible_tasks.execute_playbook',
    queue='ansible',
    priority=5
)
def execute_playbook(self, execution_id: int) -> Dict[str, Any]:
    """
    执行 Ansible Playbook 任务
    
    Args:
        execution_id: PlaybookExecution 记录 ID
        
    Returns:
        执行结果字典
    """
    app = get_flask_app()
    with app.app_context():
        from app.extensions import db
        from app.models.ansible import AnsiblePlaybook, PlaybookExecution
        from app.models.host import SSHHost
        from app.services.ansible_executor import AnsibleExecutionEnvironment, AnsibleExecutor
        
        execution = None
        executor = None
        
        try:
            # 获取执行记录
            execution = PlaybookExecution.query.get(execution_id)
            if not execution:
                raise ValueError(f"执行记录不存在: {execution_id}")
            
            # 获取 Playbook 和主机信息
            playbook = execution.playbook
            if not playbook:
                raise ValueError("Playbook 不存在")
            
            hosts = SSHHost.query.filter(SSHHost.id.in_(execution.host_ids)).all()
            if not hosts:
                raise ValueError("目标主机不存在")
            
            # 开始执行
            execution.start_execution()
            execution.execution_id = str(uuid.uuid4())
            db.session.commit()
            
            logger.info(f"[Ansible] 开始执行: execution_id={execution_id}, playbook={playbook.name}, hosts={len(hosts)}")
            
            # 创建执行器
            executor = AnsibleExecutor(execution.execution_id)
            
            # 设置执行环境
            with AnsibleExecutionEnvironment(execution.execution_id) as env:
                # 创建必要文件
                inventory_file = env.create_inventory(hosts)
                playbook_file = env.create_playbook(playbook.content)
                vars_file = env.create_vars_file(execution.variables) if execution.variables else None
                
                # 解析 Playbook 获取任务数量
                try:
                    import yaml
                    playbook_data = yaml.safe_load(playbook.content)
                    if isinstance(playbook_data, list) and len(playbook_data) > 0:
                        play = playbook_data[0]
                        tasks = play.get('tasks', [])
                        execution.total_tasks = len(tasks) * len(hosts)
                        db.session.commit()
                except Exception:
                    execution.total_tasks = len(hosts)
                    db.session.commit()
                
                # 执行 Playbook
                output, error, exit_code = executor.execute_playbook(
                    playbook_file=playbook_file,
                    inventory_file=inventory_file,
                    vars_file=vars_file
                )
                
                # 更新执行结果
                execution.output = output
                if error:
                    execution.error_message = error
                
                # 解析执行结果
                _parse_execution_results(execution, output)
                
                # 完成执行
                success = exit_code == 0 and not executor.is_cancelled
                execution.finish_execution(success=success, error_message=error if not success else None)
                
                # 更新 Playbook 的最后执行状态
                playbook.last_execution_status = 'success' if success else 'failed'
                playbook.last_executed_at = execution.finished_at
                playbook.execution_count = (playbook.execution_count or 0) + 1
                
                db.session.commit()
                
                status_icon = '[OK]' if success else '[FAIL]'
                logger.info(f"[Ansible] {status_icon} 执行完成: execution_id={execution_id}, status={execution.status}")
                
                return {
                    'success': success,
                    'execution_id': execution_id,
                    'execution_uuid': execution.execution_id,
                    'status': execution.status,
                    'output_lines': len(output.split('\n')) if output else 0,
                    'message': '执行成功' if success else f'执行失败: {error or "未知错误"}'
                }
                
        except Exception as e:
            logger.error(f"[Ansible] 执行异常: execution_id={execution_id}, error={str(e)}")
            
            if execution:
                execution.finish_execution(success=False, error_message=str(e))
                db.session.commit()
            
            return {
                'success': False,
                'execution_id': execution_id,
                'status': 'failed',
                'message': f'执行异常: {str(e)}'
            }


@celery.task(
    name='app.tasks.ansible_tasks.cancel_execution',
    queue='ansible',
    priority=8
)
def cancel_execution(execution_id: int, reason: str = "用户取消") -> Dict[str, Any]:
    """
    取消 Ansible 执行任务
    
    Args:
        execution_id: PlaybookExecution 记录 ID
        reason: 取消原因
        
    Returns:
        取消结果字典
    """
    app = get_flask_app()
    with app.app_context():
        from app.extensions import db
        from app.models.ansible import PlaybookExecution
        
        try:
            execution = PlaybookExecution.query.get(execution_id)
            if not execution:
                return {'success': False, 'message': '执行记录不存在'}
            
            if not execution.can_be_cancelled():
                return {'success': False, 'message': '该执行无法取消'}
            
            # 取消执行
            execution.cancel_execution(reason)
            db.session.commit()
            
            logger.info(f"[Ansible] 取消执行: execution_id={execution_id}, reason={reason}")
            
            return {
                'success': True,
                'execution_id': execution_id,
                'message': '执行已取消'
            }
            
        except Exception as e:
            logger.error(f"[Ansible] 取消执行失败: execution_id={execution_id}, error={str(e)}")
            return {'success': False, 'message': f'取消失败: {str(e)}'}


@celery.task(
    name='app.tasks.ansible_tasks.cleanup_stale_executions',
    queue='ansible',
    priority=1
)
def cleanup_stale_executions(timeout_hours: int = 2) -> Dict[str, Any]:
    """
    清理超时的执行记录
    
    Args:
        timeout_hours: 超时时间（小时）
        
    Returns:
        清理结果字典
    """
    from datetime import datetime, timedelta
    
    app = get_flask_app()
    with app.app_context():
        from app.extensions import db
        from app.models.ansible import PlaybookExecution
        
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=timeout_hours)
            
            # 查找超时的运行中任务
            stale_executions = PlaybookExecution.query.filter(
                PlaybookExecution.status == 'running',
                PlaybookExecution.started_at < cutoff_time
            ).all()
            
            cleaned_count = 0
            for execution in stale_executions:
                execution.finish_execution(
                    success=False, 
                    error_message=f'执行超时（超过 {timeout_hours} 小时）'
                )
                cleaned_count += 1
            
            if cleaned_count > 0:
                db.session.commit()
                logger.info(f"[Ansible] 清理超时执行: {cleaned_count} 个")
            
            return {
                'success': True,
                'cleaned_count': cleaned_count,
                'message': f'清理了 {cleaned_count} 个超时执行'
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"[Ansible] 清理超时执行失败: {str(e)}")
            return {'success': False, 'error': str(e)}


def _parse_execution_results(execution, output: str):
    """解析执行结果"""
    try:
        completed_tasks = 0
        failed_tasks = 0
        skipped_tasks = 0
        
        # 解析 Ansible 输出
        lines = output.split('\n')
        for line in lines:
            if 'ok=' in line and 'changed=' in line:
                # 解析 PLAY RECAP 行
                parts = line.split()
                for part in parts:
                    if part.startswith('ok='):
                        completed_tasks += int(part.split('=')[1])
                    elif part.startswith('failed='):
                        failed_tasks += int(part.split('=')[1])
                    elif part.startswith('skipped='):
                        skipped_tasks += int(part.split('=')[1])
        
        # 更新执行统计
        execution.update_progress(
            completed_tasks=completed_tasks,
            failed_tasks=failed_tasks,
            skipped_tasks=skipped_tasks
        )
        
    except Exception as e:
        logger.warning(f"[Ansible] 解析执行结果失败: {str(e)}")
