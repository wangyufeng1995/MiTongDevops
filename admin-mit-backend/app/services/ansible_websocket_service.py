"""
Ansible WebSocket 服务
提供 Ansible 执行日志的实时推送功能
"""
import logging
from datetime import datetime
from typing import Dict, Set, Optional, Any
from flask import request
from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from app.extensions import socketio
from app.models.user import User
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)


def jwt_required_socketio(f):
    """WebSocket JWT 认证装饰器"""
    def decorated_function(*args, **kwargs):
        try:
            # 从请求中获取认证信息
            auth_data = args[0] if args else {}
            token = auth_data.get('token')
            
            if not token:
                emit('error', {'message': '缺少认证令牌'})
                return False
            
            # 解码 JWT token
            try:
                decoded_token = decode_token(token)
                user_id = decoded_token.get('sub')
                tenant_id = decoded_token.get('tenant_id')
                
                if not user_id or not tenant_id:
                    emit('error', {'message': '无效的认证令牌'})
                    return False
                
            except Exception as e:
                emit('error', {'message': f'令牌解析失败: {str(e)}'})
                return False
            
            # 验证用户
            user = User.query.filter_by(id=user_id, tenant_id=tenant_id, status=1).first()
            if not user:
                emit('error', {'message': '用户不存在或已禁用'})
                return False
            
            # 验证租户
            tenant = Tenant.query.filter_by(id=tenant_id, status=1).first()
            if not tenant:
                emit('error', {'message': '租户不存在或已禁用'})
                return False
            
            # 将用户信息添加到请求上下文
            request.current_user = {
                'user_id': user.id,
                'tenant_id': tenant.id,
                'username': user.username
            }
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f"WebSocket JWT 认证失败: {str(e)}")
            emit('error', {'message': '认证失败'})
            return False
    
    return decorated_function


class AnsibleWebSocketService:
    """Ansible WebSocket 服务类"""
    
    def __init__(self):
        # 存储连接的客户端
        self.connected_clients: Dict[str, Set[str]] = {}  # execution_id -> set of session_ids
        self.client_executions: Dict[str, str] = {}  # session_id -> execution_id
    
    def add_client(self, session_id: str, execution_id: str):
        """添加客户端连接"""
        try:
            if execution_id not in self.connected_clients:
                self.connected_clients[execution_id] = set()
            
            self.connected_clients[execution_id].add(session_id)
            self.client_executions[session_id] = execution_id
            
            logger.info(f"客户端 {session_id} 订阅执行 {execution_id}")
            
        except Exception as e:
            logger.error(f"添加客户端连接失败: {str(e)}")
    
    def remove_client(self, session_id: str):
        """移除客户端连接"""
        try:
            execution_id = self.client_executions.pop(session_id, None)
            if execution_id and execution_id in self.connected_clients:
                self.connected_clients[execution_id].discard(session_id)
                
                # 如果没有客户端订阅该执行，清理记录
                if not self.connected_clients[execution_id]:
                    del self.connected_clients[execution_id]
            
            logger.info(f"客户端 {session_id} 断开连接")
            
        except Exception as e:
            logger.error(f"移除客户端连接失败: {str(e)}")
    
    def broadcast_log(self, execution_id: str, log_data: Dict[str, Any]):
        """广播执行日志"""
        try:
            if execution_id in self.connected_clients:
                room = f"ansible_execution_{execution_id}"
                socketio.emit('ansible_log', log_data, room=room)
                logger.debug(f"广播执行日志到房间 {room}: {log_data.get('message', '')[:100]}")
                
        except Exception as e:
            logger.error(f"广播执行日志失败: {str(e)}")
    
    def broadcast_progress(self, execution_id: str, progress_data: Dict[str, Any]):
        """广播执行进度"""
        try:
            if execution_id in self.connected_clients:
                room = f"ansible_execution_{execution_id}"
                socketio.emit('ansible_progress', progress_data, room=room)
                logger.debug(f"广播执行进度到房间 {room}: {progress_data}")
                
        except Exception as e:
            logger.error(f"广播执行进度失败: {str(e)}")
    
    def broadcast_status(self, execution_id: str, status_data: Dict[str, Any]):
        """广播执行状态"""
        try:
            if execution_id in self.connected_clients:
                room = f"ansible_execution_{execution_id}"
                socketio.emit('ansible_status', status_data, room=room)
                logger.info(f"广播执行状态到房间 {room}: {status_data}")
                
        except Exception as e:
            logger.error(f"广播执行状态失败: {str(e)}")
    
    def get_connected_clients(self, execution_id: str) -> int:
        """获取连接的客户端数量"""
        return len(self.connected_clients.get(execution_id, set()))


# 全局 WebSocket 服务实例
ansible_websocket_service = AnsibleWebSocketService()


@socketio.on('join_ansible_execution')
def handle_join_ansible_execution(data):
    """处理加入 Ansible 执行房间"""
    try:
        # 简单的认证检查（在生产环境中应该使用更严格的认证）
        execution_id = data.get('execution_id')
        if not execution_id:
            emit('error', {'message': '缺少执行ID'})
            return
        
        # 验证执行记录是否存在
        from app.models.ansible import PlaybookExecution
        execution = PlaybookExecution.query.filter_by(execution_id=execution_id).first()
        if not execution:
            emit('error', {'message': '执行记录不存在'})
            return
        
        # 加入房间
        room = f"ansible_execution_{execution_id}"
        join_room(room)
        
        # 添加客户端连接
        session_id = request.sid
        ansible_websocket_service.add_client(session_id, execution_id)
        
        # 发送当前状态
        emit('ansible_status', {
            'execution_id': execution_id,
            'status': execution.status,
            'progress': execution.progress,
            'started_at': execution.started_at.isoformat() if execution.started_at else None,
            'finished_at': execution.finished_at.isoformat() if execution.finished_at else None
        })
        
        logger.info(f"客户端加入 Ansible 执行房间: {room}")
        
    except Exception as e:
        logger.error(f"加入 Ansible 执行房间失败: {str(e)}")
        emit('error', {'message': f'加入房间失败: {str(e)}'})


@socketio.on('leave_ansible_execution')
def handle_leave_ansible_execution(data):
    """处理离开 Ansible 执行房间"""
    try:
        execution_id = data.get('execution_id')
        if not execution_id:
            return
        
        # 离开房间
        room = f"ansible_execution_{execution_id}"
        leave_room(room)
        
        # 移除客户端连接
        session_id = request.sid
        ansible_websocket_service.remove_client(session_id)
        
        logger.info(f"客户端离开 Ansible 执行房间: {room}")
        
    except Exception as e:
        logger.error(f"离开 Ansible 执行房间失败: {str(e)}")


@socketio.on('disconnect')
def handle_disconnect():
    """处理客户端断开连接"""
    try:
        session_id = request.sid
        ansible_websocket_service.remove_client(session_id)
        
    except Exception as e:
        logger.error(f"处理客户端断开连接失败: {str(e)}")


def create_progress_callback(execution_id: str):
    """创建进度回调函数"""
    def progress_callback(log_line: str):
        """进度回调函数"""
        try:
            # 解析日志行并发送到客户端
            log_data = {
                'execution_id': execution_id,
                'message': log_line,
                'timestamp': datetime.now().isoformat(),
                'level': 'INFO'
            }
            
            # 广播日志
            ansible_websocket_service.broadcast_log(execution_id, log_data)
            
            # 解析特殊的进度信息
            if "TASK [" in log_line:
                task_name = log_line.split("TASK [")[1].split("]")[0]
                progress_data = {
                    'execution_id': execution_id,
                    'current_task': task_name,
                    'timestamp': datetime.now().isoformat()
                }
                ansible_websocket_service.broadcast_progress(execution_id, progress_data)
            
        except Exception as e:
            logger.error(f"进度回调处理失败: {str(e)}")
    
    return progress_callback