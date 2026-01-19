"""
Ansible 相关模型
"""
from datetime import datetime
from app.extensions import db
from .base import BaseModel
import yaml
import json


class AnsiblePlaybook(BaseModel):
    """Ansible Playbook 模型"""
    __tablename__ = 'ansible_playbooks'
    
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    content = db.Column(db.Text, nullable=False)  # YAML 内容
    variables = db.Column(db.JSON)  # 默认变量
    version = db.Column(db.String(20), default='1.0')
    tags = db.Column(db.JSON)  # 标签列表
    is_active = db.Column(db.Boolean, default=True)  # 是否激活
    category = db.Column(db.String(50))  # 分类
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 版本管理
    parent_id = db.Column(db.Integer, db.ForeignKey('ansible_playbooks.id'), nullable=True)  # 父版本ID
    is_history = db.Column(db.Boolean, default=False)  # 是否为历史版本
    
    # 执行状态相关字段
    last_execution_status = db.Column(db.String(20))  # 上一次执行状态: success, failed, running, pending
    last_executed_at = db.Column(db.DateTime)  # 上一次执行时间
    execution_count = db.Column(db.Integer, default=0)  # 执行次数
    
    # 关联关系
    # creator 关系通过 User 模型的 backref 定义
    executions = db.relationship('PlaybookExecution', backref='playbook', lazy='dynamic', cascade='all, delete-orphan')
    history_versions = db.relationship('AnsiblePlaybook', backref=db.backref('parent', remote_side='AnsiblePlaybook.id'), lazy='dynamic')
    
    def validate_yaml_content(self):
        """验证YAML内容格式"""
        try:
            yaml.safe_load(self.content)
            return True, "YAML格式正确"
        except yaml.YAMLError as e:
            return False, f"YAML格式错误: {str(e)}"
    
    def get_playbook_tasks(self):
        """解析并获取Playbook中的任务列表"""
        try:
            playbook_data = yaml.safe_load(self.content)
            if isinstance(playbook_data, list) and len(playbook_data) > 0:
                play = playbook_data[0]
                return play.get('tasks', [])
            return []
        except Exception:
            return []
    
    def get_required_variables(self):
        """获取Playbook中需要的变量"""
        try:
            # 简单的变量提取，查找 {{ variable_name }} 模式
            import re
            variables = set()
            pattern = r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}'
            matches = re.findall(pattern, self.content)
            variables.update(matches)
            return list(variables)
        except Exception:
            return []
    
    def increment_version(self):
        """自动递增版本号"""
        try:
            parts = self.version.split('.')
            if len(parts) >= 2:
                major, minor = int(parts[0]), int(parts[1])
                patch = int(parts[2]) if len(parts) > 2 else 0
                patch += 1
                self.version = f"{major}.{minor}.{patch}"
            else:
                # 如果版本格式不标准，直接递增
                try:
                    version_num = float(self.version)
                    self.version = str(version_num + 0.1)
                except ValueError:
                    self.version = "1.1"
        except Exception:
            self.version = "1.1"
    
    def create_version_copy(self):
        """创建当前版本的副本（用于版本管理）"""
        copy_data = {
            'name': self.name,  # 名称保持不变
            'description': self.description,
            'content': self.content,
            'variables': self.variables,
            'version': self.version,  # 保存当前版本号
            'tags': self.tags,
            'category': self.category,
            'created_by': self.created_by,
            'tenant_id': self.tenant_id,
            'is_active': False,  # 历史版本设为非激活
            'is_history': True,  # 标记为历史版本
            'parent_id': self.id  # 关联到当前 Playbook
        }
        return AnsiblePlaybook(**copy_data)
    
    def cleanup_old_versions(self, keep_count=5):
        """清理旧的历史版本，只保留最近的 keep_count 个"""
        history = self.history_versions.filter_by(is_history=True).order_by(
            AnsiblePlaybook.created_at.desc()
        ).all()
        
        if len(history) > keep_count:
            for old_version in history[keep_count:]:
                db.session.delete(old_version)
    
    def get_history_versions(self):
        """获取历史版本列表"""
        return self.history_versions.filter_by(is_history=True).order_by(
            AnsiblePlaybook.created_at.desc()
        ).limit(5).all()
    
    def get_execution_stats(self):
        """获取执行统计信息"""
        total_executions = self.executions.count()
        successful_executions = self.executions.filter_by(status='success').count()
        failed_executions = self.executions.filter_by(status='failed').count()
        running_executions = self.executions.filter_by(status='running').count()
        
        success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0
        
        return {
            'total_executions': total_executions,
            'successful_executions': successful_executions,
            'failed_executions': failed_executions,
            'running_executions': running_executions,
            'success_rate': round(success_rate, 2)
        }
    
    def to_dict(self, include_content=True, include_stats=False):
        """转换为字典格式"""
        result = {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'name': self.name,
            'description': self.description,
            'variables': self.variables or {},
            'version': self.version,
            'tags': self.tags or [],
            'is_active': self.is_active,
            'category': self.category,
            'created_by': self.created_by,
            'creator': {
                'id': self.creator.id,
                'username': self.creator.username,
                'full_name': self.creator.full_name
            } if self.creator else None,
            'last_execution_status': self.last_execution_status,
            'last_executed_at': self.last_executed_at.isoformat() if self.last_executed_at else None,
            'execution_count': self.execution_count or 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_content:
            result['content'] = self.content
            
        if include_stats:
            result['execution_stats'] = self.get_execution_stats()
            result['required_variables'] = self.get_required_variables()
            result['task_count'] = len(self.get_playbook_tasks())
        
        return result
    
    def __repr__(self):
        return f'<AnsiblePlaybook {self.name} v{self.version}>'


class PlaybookExecution(BaseModel):
    """Playbook 执行记录模型"""
    __tablename__ = 'playbook_executions'
    
    playbook_id = db.Column(db.Integer, db.ForeignKey('ansible_playbooks.id'), nullable=False)
    host_ids = db.Column(db.JSON, nullable=False)  # 目标主机 ID 数组
    variables = db.Column(db.JSON)  # 执行时变量
    status = db.Column(db.String(20), default='pending')  # pending, running, success, failed, cancelled
    output = db.Column(db.Text)  # 执行输出
    error_message = db.Column(db.Text)
    started_at = db.Column(db.DateTime)
    finished_at = db.Column(db.DateTime)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 新增字段
    execution_id = db.Column(db.String(100))  # 外部执行ID（如Ansible执行ID）
    progress = db.Column(db.Integer, default=0)  # 执行进度 (0-100)
    total_tasks = db.Column(db.Integer, default=0)  # 总任务数
    completed_tasks = db.Column(db.Integer, default=0)  # 已完成任务数
    failed_tasks = db.Column(db.Integer, default=0)  # 失败任务数
    skipped_tasks = db.Column(db.Integer, default=0)  # 跳过任务数
    
    # 注意: executor 关系已在 User 模型中通过 backref 定义
    
    def start_execution(self):
        """开始执行"""
        self.status = 'running'
        self.started_at = datetime.utcnow()
        self.progress = 0
    
    def finish_execution(self, success=True, error_message=None):
        """完成执行"""
        self.finished_at = datetime.utcnow()
        self.status = 'success' if success else 'failed'
        self.progress = 100
        if error_message:
            self.error_message = error_message
    
    def cancel_execution(self, reason=None):
        """取消执行"""
        self.status = 'cancelled'
        self.finished_at = datetime.utcnow()
        if reason:
            self.error_message = f"执行被取消: {reason}"
    
    def update_progress(self, completed_tasks=None, failed_tasks=None, skipped_tasks=None):
        """更新执行进度"""
        if completed_tasks is not None:
            self.completed_tasks = completed_tasks
        if failed_tasks is not None:
            self.failed_tasks = failed_tasks
        if skipped_tasks is not None:
            self.skipped_tasks = skipped_tasks
            
        # 计算进度百分比
        if self.total_tasks > 0:
            total_processed = self.completed_tasks + self.failed_tasks + self.skipped_tasks
            self.progress = min(int((total_processed / self.total_tasks) * 100), 100)
    
    def get_host_names(self):
        """获取目标主机名称列表"""
        try:
            from .host import SSHHost
            hosts = SSHHost.query.filter(SSHHost.id.in_(self.host_ids)).all()
            return [host.name for host in hosts]
        except Exception:
            return []
    
    def get_execution_summary(self):
        """获取执行摘要"""
        return {
            'total_hosts': len(self.host_ids) if self.host_ids else 0,
            'total_tasks': self.total_tasks or 0,
            'completed_tasks': self.completed_tasks or 0,
            'failed_tasks': self.failed_tasks or 0,
            'skipped_tasks': self.skipped_tasks or 0,
            'success_rate': self._calculate_success_rate(),
            'duration': self._calculate_duration(),
            'status': self.status or 'pending',
            'progress': self.progress or 0
        }
    
    def _calculate_success_rate(self):
        """计算成功率"""
        if self.total_tasks > 0:
            return round((self.completed_tasks / self.total_tasks) * 100, 2)
        return 0.0
    
    def is_running(self):
        """检查是否正在执行"""
        return self.status == 'running'
    
    def is_finished(self):
        """检查是否已完成"""
        return self.status in ['success', 'failed', 'cancelled']
    
    def can_be_cancelled(self):
        """检查是否可以取消"""
        return (self.status or 'pending') in ['pending', 'running']
    
    def to_dict(self, include_output=True, include_hosts=False):
        """转换为字典格式"""
        result = {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'playbook_id': self.playbook_id,
            'host_ids': self.host_ids or [],
            'variables': self.variables or {},
            'status': self.status or 'pending',
            'error_message': self.error_message,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'finished_at': self.finished_at.isoformat() if self.finished_at else None,
            'created_by': self.created_by,
            'execution_id': self.execution_id,
            'progress': self.progress or 0,
            'total_tasks': self.total_tasks or 0,
            'completed_tasks': self.completed_tasks or 0,
            'failed_tasks': self.failed_tasks or 0,
            'skipped_tasks': self.skipped_tasks or 0,
            'execution_summary': self.get_execution_summary(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            # 关联的 playbook 信息
            'playbook': {
                'id': self.playbook.id,
                'name': self.playbook.name,
                'version': self.playbook.version,
                'description': self.playbook.description
            } if self.playbook else None,
            # 执行者信息
            'creator': {
                'id': self.executor.id,
                'username': self.executor.username,
                'full_name': getattr(self.executor, 'full_name', None) or self.executor.username
            } if self.executor else None
        }
        
        if include_output:
            result['output'] = self.output
            
        if include_hosts:
            result['host_names'] = self.get_host_names()
        
        return result
    
    def _calculate_duration(self):
        """计算执行时长（秒）"""
        if self.started_at and self.finished_at:
            return int((self.finished_at - self.started_at).total_seconds())
        elif self.started_at and not self.finished_at:
            # 正在执行中，计算已运行时间
            return int((datetime.utcnow() - self.started_at).total_seconds())
        return None
    
    def __repr__(self):
        return f'<PlaybookExecution {self.playbook_id} {self.status}>'