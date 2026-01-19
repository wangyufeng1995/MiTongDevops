"""
WebSocket 事件注册
注册所有 WebSocket 事件处理器
优化的 xterm.js + Flask-SocketIO + Paramiko + WebSocket 转发桥接模式
"""
import logging
import uuid
from datetime import datetime
from flask import request, g
from flask_socketio import emit, disconnect
from app.extensions import socketio
from app.services.websocket_service import WebSocketEventHandler, connection_manager
from app.services.webshell_terminal_service import webshell_terminal_service
from app.services.ssh_terminal_bridge import ssh_terminal_bridge_manager
from app.services.k8s.pod_service import k8s_pod_shell_manager
from app.services.operation_log_service import operation_log_service

logger = logging.getLogger(__name__)


@socketio.on('connect')
def handle_connect(auth):
    """处理客户端连接"""
    logger.info(f"WebSocket connect attempt with auth: {auth}")
    
    # 如果没有认证数据，尝试从请求头获取 token
    if not auth:
        # 尝试从查询参数获取 token
        token = request.args.get('token')
        if token:
            auth = {'token': token}
        else:
            # 开发环境允许无认证连接（仅用于测试）
            logger.warning("WebSocket connection without authentication - allowing for development")
            # 在开发模式下，添加一个默认的连接信息
            socket_sid = request.sid
            connection_manager.add_connection(
                session_id=socket_sid,
                user_id=1,  # 默认用户ID
                tenant_id=1,  # 默认租户ID
                user_info={
                    'username': 'dev_user',
                    'role': '超级管理员',
                    'dev_mode': True
                }
            )
            emit('connection_established', {
                'status': 'connected',
                'message': 'Connected without authentication (dev mode)',
                'connected_at': __import__('datetime').datetime.utcnow().isoformat()
            })
            return True
    
    # 使用事件处理器处理连接
    result = WebSocketEventHandler.handle_connect(auth)
    if not result:
        logger.warning("WebSocket connection rejected by handler")
    return result


@socketio.on('disconnect')
def handle_disconnect():
    """处理客户端断开连接"""
    logger.info("WebSocket disconnect")
    WebSocketEventHandler.handle_disconnect()


@socketio.on('ping')
def handle_ping():
    """处理心跳检测"""
    WebSocketEventHandler.handle_ping()


@socketio.on('join_room')
def handle_join_room(data):
    """处理加入房间"""
    WebSocketEventHandler.handle_join_room(data)


@socketio.on('leave_room')
def handle_leave_room(data):
    """处理离开房间"""
    WebSocketEventHandler.handle_leave_room(data)


@socketio.on('error')
def handle_error(error):
    """处理错误"""
    logger.error(f"WebSocket error: {error}")
    emit('error', {'message': 'An error occurred'})


# WebShell 终端相关事件处理器

@socketio.on('webshell_create_terminal')
def handle_webshell_create_terminal(data):
    """处理创建终端会话 - 优化版本，使用桥接模式"""
    try:
        webshell_session_id = data.get('session_id')
        cols = data.get('cols', 80)
        rows = data.get('rows', 24)
        use_bridge = data.get('use_bridge', True)  # 默认使用桥接模式
        
        if not webshell_session_id:
            emit('webshell_error', {'message': '缺少会话 ID'})
            return
        
        # 获取 WebShell 会话信息
        from app.services.webshell_service import webshell_service
        session = webshell_service.session_manager.get_session(webshell_session_id)
        if not session:
            emit('webshell_error', {'message': 'WebShell 会话不存在'})
            return
        
        # 获取客户端 IP 和 Socket.IO session ID
        ip_address = request.remote_addr
        socket_sid = request.sid  # 获取当前 Socket.IO 连接的 session ID
        
        logger.info(f"Creating terminal for session {webshell_session_id}, socket_sid: {socket_sid}")
        
        if use_bridge:
            # 使用优化的桥接模式
            success, message, bridge = ssh_terminal_bridge_manager.create_bridge(
                session_id=webshell_session_id,
                hostname=session.hostname,
                port=session.port,
                username=session.username,
                auth_type=session.auth_type,
                password=session.password,
                private_key=session.private_key,
                user_id=session.user_id,
                host_id=session.host_id,
                tenant_id=session.tenant_id,
                cols=cols,
                rows=rows,
                socket_sid=socket_sid,  # 传递 Socket.IO session ID
                ip_address=ip_address   # 传递客户端 IP 地址（用于审计日志）
            )
            
            if success:
                emit('webshell_terminal_created', {
                    'session_id': webshell_session_id,
                    'message': message,
                    'mode': 'bridge'
                })
            else:
                emit('webshell_error', {
                    'session_id': webshell_session_id,
                    'message': message
                })
        else:
            # 使用旧的终端服务
            success, message = webshell_terminal_service.create_terminal_session(
                webshell_session_id, cols, rows, ip_address
            )
            
            if success:
                emit('webshell_terminal_created', {
                    'session_id': webshell_session_id,
                    'message': message,
                    'mode': 'legacy'
                })
            else:
                emit('webshell_error', {
                    'session_id': webshell_session_id,
                    'message': message
                })
            
    except Exception as e:
        logger.error(f"Create terminal error: {e}")
        import traceback
        traceback.print_exc()
        emit('webshell_error', {'message': f'创建终端失败: {str(e)}'})


@socketio.on('webshell_input')
def handle_webshell_input(data):
    """处理终端输入 - 优化版本，使用桥接模式"""
    try:
        webshell_session_id = data.get('session_id')
        input_data = data.get('data', '')
        
        if not webshell_session_id:
            emit('webshell_error', {'message': '缺少会话 ID'})
            return
        
        # 优先使用桥接模式
        bridge = ssh_terminal_bridge_manager.get_bridge(webshell_session_id)
        if bridge:
            success, error = bridge.send_input(input_data)
            if not success:
                # 如果是命令被阻止，不发送 webshell_error（阻止消息已通过终端输出发送）
                # 只有真正的错误才发送 webshell_error
                if error and not error.startswith('命令被阻止'):
                    emit('webshell_error', {
                        'session_id': webshell_session_id,
                        'message': error or '发送输入失败'
                    })
            return
        
        # 回退到旧的终端服务
        success, message = webshell_terminal_service.send_input(webshell_session_id, input_data)
        
        if not success:
            # 同样，命令被阻止不发送 webshell_error
            if message and not message.startswith('命令被阻止'):
                emit('webshell_error', {
                    'session_id': webshell_session_id,
                    'message': message or '发送输入失败'
                })
            
    except Exception as e:
        logger.error(f"Terminal input error: {e}")
        emit('webshell_error', {'message': '处理输入失败'})


@socketio.on('webshell_execute_command')
def handle_webshell_execute_command(data):
    """处理执行命令"""
    try:
        webshell_session_id = data.get('session_id')
        command = data.get('command', '')
        timeout = data.get('timeout', 30)
        
        if not webshell_session_id or not command:
            emit('webshell_error', {'message': '缺少会话 ID 或命令'})
            return
        
        # 执行命令
        success, message, cmd_record = webshell_terminal_service.execute_command(
            webshell_session_id, command, timeout
        )
        
        if success:
            emit('webshell_command_result', {
                'session_id': webshell_session_id,
                'command_record': cmd_record,
                'message': message
            })
        else:
            emit('webshell_error', {
                'session_id': webshell_session_id,
                'message': message,
                'command_record': cmd_record
            })
            
    except Exception as e:
        logger.error(f"Execute command error: {e}")
        emit('webshell_error', {'message': '执行命令失败'})


@socketio.on('webshell_resize')
def handle_webshell_resize(data):
    """处理终端大小调整 - 优化版本"""
    try:
        webshell_session_id = data.get('session_id')
        cols = data.get('cols', 80)
        rows = data.get('rows', 24)
        
        if not webshell_session_id:
            emit('webshell_error', {'message': '缺少会话 ID'})
            return
        
        # 优先使用桥接模式
        bridge = ssh_terminal_bridge_manager.get_bridge(webshell_session_id)
        if bridge:
            success = bridge.resize(cols, rows)
            if success:
                emit('webshell_resized', {
                    'session_id': webshell_session_id,
                    'cols': cols,
                    'rows': rows
                })
            else:
                emit('webshell_error', {
                    'session_id': webshell_session_id,
                    'message': '调整终端大小失败'
                })
            return
        
        # 回退到旧的终端服务
        success = webshell_terminal_service.resize_terminal(webshell_session_id, cols, rows)
        
        if success:
            emit('webshell_resized', {
                'session_id': webshell_session_id,
                'cols': cols,
                'rows': rows
            })
        else:
            emit('webshell_error', {
                'session_id': webshell_session_id,
                'message': '调整终端大小失败'
            })
            
    except Exception as e:
        logger.error(f"Terminal resize error: {e}")
        emit('webshell_error', {'message': '调整终端大小失败'})


@socketio.on('webshell_get_history')
def handle_webshell_get_history(data):
    """处理获取命令历史"""
    try:
        webshell_session_id = data.get('session_id')
        limit = data.get('limit', 100)
        
        if not webshell_session_id:
            emit('webshell_error', {'message': '缺少会话 ID'})
            return
        
        # 获取命令历史
        history = webshell_terminal_service.get_command_history(webshell_session_id, limit)
        
        emit('webshell_history', {
            'session_id': webshell_session_id,
            'history': history
        })
        
    except Exception as e:
        logger.error(f"Get history error: {e}")
        emit('webshell_error', {'message': '获取历史记录失败'})


@socketio.on('webshell_terminate_terminal')
def handle_webshell_terminate_terminal(data):
    """处理终止终端会话 - 优化版本"""
    try:
        webshell_session_id = data.get('session_id')
        
        if not webshell_session_id:
            emit('webshell_error', {'message': '缺少会话 ID'})
            return
        
        # 尝试移除桥接
        bridge_removed = ssh_terminal_bridge_manager.remove_bridge(
            webshell_session_id, 
            "User terminated"
        )
        
        # 尝试终止旧的终端服务
        legacy_removed = webshell_terminal_service.terminate_terminal_session(webshell_session_id)
        
        if bridge_removed or legacy_removed:
            emit('webshell_terminal_terminated', {
                'session_id': webshell_session_id,
                'message': '终端会话已终止'
            })
        else:
            emit('webshell_error', {
                'session_id': webshell_session_id,
                'message': '终止终端会话失败'
            })
            
    except Exception as e:
        logger.error(f"Terminate terminal error: {e}")
        emit('webshell_error', {'message': '终止终端失败'})


# K8S Pod Shell 相关事件处理器

def _check_pod_shell_permission():
    """
    检查用户是否有 Pod Shell 权限
    仅超级管理员和运维管理员可以使用 Pod Shell
    
    Returns:
        (has_permission, error_message)
    """
    try:
        # 从连接管理器获取用户信息
        socket_sid = request.sid
        connection_info = connection_manager.get_connection(socket_sid)
        
        if not connection_info:
            return False, "未找到连接信息，请重新连接"
        
        # 检查是否是开发模式连接
        user_info = connection_info.get('user_info', {})
        if user_info.get('dev_mode'):
            # 开发模式下，检查 user_info 中的角色
            dev_role = user_info.get('role', '')
            if dev_role in ['超级管理员', '运维管理员']:
                return True, ""
            return False, f"权限不足，当前角色 '{dev_role}' 无法使用 Pod Shell 功能"
        
        user_id = connection_info.get('user_id')
        if not user_id:
            return False, "未找到用户信息，请重新登录"
        
        # 获取用户角色
        from app.models.user import User
        user = User.query.get(user_id)
        if not user:
            return False, "用户不存在"
        
        # 检查角色权限 - 使用 has_role 方法
        allowed_roles = ['超级管理员', '运维管理员']
        has_permission = any(user.has_role(role) for role in allowed_roles)
        
        if not has_permission:
            # 获取用户当前角色名称用于错误提示
            user_roles = user.get_roles()
            role_names = [r.name for r in user_roles] if user_roles else ['无角色']
            return False, f"权限不足，当前角色 '{', '.join(role_names)}' 无法使用 Pod Shell 功能"
        
        return True, ""
        
    except Exception as e:
        logger.error(f"Error checking Pod Shell permission: {e}")
        import traceback
        traceback.print_exc()
        return False, f"权限检查失败: {str(e)}"


def _log_pod_shell_operation(action: str, cluster_id: int, namespace: str, 
                              pod_name: str, container: str, user_id: int,
                              tenant_id: int, session_id: str = None,
                              status: str = 'success', error: str = None):
    """
    记录 Pod Shell 操作审计日志
    
    Args:
        action: 操作类型 (create, terminate)
        cluster_id: 集群ID
        namespace: 命名空间
        pod_name: Pod名称
        container: 容器名称
        user_id: 用户ID
        tenant_id: 租户ID
        session_id: 会话ID
        status: 状态 (success, failed)
        error: 错误信息
    """
    try:
        details = {
            'cluster_id': cluster_id,
            'namespace': namespace,
            'pod_name': pod_name,
            'container': container,
            'session_id': session_id,
            'ip_address': request.remote_addr if request else None
        }
        
        if error:
            details['error'] = error
        
        # 设置 g 对象以便 operation_log_service 使用
        g.user_id = user_id
        g.tenant_id = tenant_id
        
        operation_log_service.log_operation(
            action=f'k8s_pod_shell_{action}',
            resource='k8s_pod',
            resource_id=f"{namespace}/{pod_name}",
            details=details,
            status=status
        )
        
        logger.info(f"Pod Shell audit log: action={action}, pod={namespace}/{pod_name}, "
                   f"container={container}, user={user_id}, status={status}")
        
    except Exception as e:
        logger.error(f"Failed to log Pod Shell operation: {e}")


@socketio.on('k8s_pod_shell_create')
def handle_k8s_pod_shell_create(data):
    """
    创建 K8S Pod Shell 会话
    
    权限要求：仅超级管理员和运维管理员可用
    
    data: {
        cluster_id: 集群ID,
        namespace: 命名空间,
        pod_name: Pod名称,
        container: 容器名称 (可选),
        cols: 终端列数 (默认80),
        rows: 终端行数 (默认24)
    }
    """
    try:
        # 检查权限
        has_permission, error_msg = _check_pod_shell_permission()
        if not has_permission:
            emit('k8s_pod_shell_error', {
                'error_code': 'PERMISSION_DENIED',
                'message': error_msg
            })
            return
        
        # 获取参数
        cluster_id = data.get('cluster_id')
        namespace = data.get('namespace')
        pod_name = data.get('pod_name')
        container = data.get('container')
        cols = data.get('cols', 80)
        rows = data.get('rows', 24)
        
        # 验证必需参数
        if not cluster_id:
            emit('k8s_pod_shell_error', {'message': '缺少集群ID'})
            return
        if not namespace:
            emit('k8s_pod_shell_error', {'message': '缺少命名空间'})
            return
        if not pod_name:
            emit('k8s_pod_shell_error', {'message': '缺少Pod名称'})
            return
        
        # 获取用户和租户信息
        socket_sid = request.sid
        connection_info = connection_manager.get_connection(socket_sid)
        
        if not connection_info:
            emit('k8s_pod_shell_error', {'message': '未找到连接信息'})
            return
        
        user_id = connection_info.get('user_id')
        tenant_id = connection_info.get('tenant_id')
        
        if not user_id or not tenant_id:
            emit('k8s_pod_shell_error', {'message': '未找到用户或租户信息'})
            return
        
        # 生成会话ID
        session_id = f"k8s-pod-shell-{uuid.uuid4().hex[:16]}"
        
        logger.info(f"Creating K8S Pod Shell: cluster={cluster_id}, namespace={namespace}, "
                   f"pod={pod_name}, container={container}, user={user_id}")
        
        # 设置 g 对象以便服务使用
        g.tenant_id = tenant_id
        g.user_id = user_id
        
        # 创建 Pod Shell 桥接
        success, message, bridge = k8s_pod_shell_manager.create_bridge(
            session_id=session_id,
            cluster_id=cluster_id,
            namespace=namespace,
            pod_name=pod_name,
            container=container,
            user_id=user_id,
            tenant_id=tenant_id,
            cols=cols,
            rows=rows,
            socket_sid=socket_sid
        )
        
        if success:
            # 设置输出回调 - 使用 socketio.emit 以支持从后台线程发送
            def on_output(output_data):
                socketio.emit('k8s_pod_shell_output', {
                    'session_id': session_id,
                    'data': output_data,
                    'timestamp': datetime.utcnow().isoformat()
                }, to=socket_sid)
            
            # 设置关闭回调 - 使用 socketio.emit 以支持从后台线程发送
            def on_close(reason):
                socketio.emit('k8s_pod_shell_closed', {
                    'session_id': session_id,
                    'reason': reason,
                    'timestamp': datetime.utcnow().isoformat()
                }, to=socket_sid)
            
            bridge.set_on_data_callback(on_output)
            bridge.set_on_close_callback(on_close)
            
            # 记录审计日志
            _log_pod_shell_operation(
                action='create',
                cluster_id=cluster_id,
                namespace=namespace,
                pod_name=pod_name,
                container=bridge.container,
                user_id=user_id,
                tenant_id=tenant_id,
                session_id=session_id,
                status='success'
            )
            
            emit('k8s_pod_shell_created', {
                'session_id': session_id,
                'cluster_id': cluster_id,
                'namespace': namespace,
                'pod_name': pod_name,
                'container': bridge.container,
                'message': message
            })
        else:
            # 记录失败的审计日志
            _log_pod_shell_operation(
                action='create',
                cluster_id=cluster_id,
                namespace=namespace,
                pod_name=pod_name,
                container=container or '',
                user_id=user_id,
                tenant_id=tenant_id,
                session_id=session_id,
                status='failed',
                error=message
            )
            
            emit('k8s_pod_shell_error', {
                'session_id': session_id,
                'error_code': 'SHELL_CONNECTION_FAILED',
                'message': message
            })
            
    except Exception as e:
        logger.error(f"K8S Pod Shell create error: {e}")
        import traceback
        traceback.print_exc()
        emit('k8s_pod_shell_error', {'message': f'创建 Pod Shell 失败: {str(e)}'})


@socketio.on('k8s_pod_shell_input')
def handle_k8s_pod_shell_input(data):
    """
    处理 K8S Pod Shell 输入
    
    data: {
        session_id: 会话ID,
        data: 输入数据
    }
    """
    try:
        session_id = data.get('session_id')
        input_data = data.get('data', '')
        
        if not session_id:
            emit('k8s_pod_shell_error', {'message': '缺少会话ID'})
            return
        
        # 发送输入到 Pod Shell
        success, error = k8s_pod_shell_manager.send_input(session_id, input_data)
        
        if not success:
            emit('k8s_pod_shell_error', {
                'session_id': session_id,
                'message': error or '发送输入失败'
            })
            
    except Exception as e:
        logger.error(f"K8S Pod Shell input error: {e}")
        emit('k8s_pod_shell_error', {'message': '处理输入失败'})


@socketio.on('k8s_pod_shell_resize')
def handle_k8s_pod_shell_resize(data):
    """
    调整 K8S Pod Shell 终端大小
    
    data: {
        session_id: 会话ID,
        cols: 列数,
        rows: 行数
    }
    """
    try:
        session_id = data.get('session_id')
        cols = data.get('cols', 80)
        rows = data.get('rows', 24)
        
        if not session_id:
            emit('k8s_pod_shell_error', {'message': '缺少会话ID'})
            return
        
        # 调整终端大小
        success = k8s_pod_shell_manager.resize(session_id, cols, rows)
        
        if success:
            emit('k8s_pod_shell_resized', {
                'session_id': session_id,
                'cols': cols,
                'rows': rows
            })
        else:
            emit('k8s_pod_shell_error', {
                'session_id': session_id,
                'message': '调整终端大小失败'
            })
            
    except Exception as e:
        logger.error(f"K8S Pod Shell resize error: {e}")
        emit('k8s_pod_shell_error', {'message': '调整终端大小失败'})


@socketio.on('k8s_pod_shell_terminate')
def handle_k8s_pod_shell_terminate(data):
    """
    终止 K8S Pod Shell 会话
    
    data: {
        session_id: 会话ID
    }
    """
    try:
        session_id = data.get('session_id')
        
        if not session_id:
            emit('k8s_pod_shell_error', {'message': '缺少会话ID'})
            return
        
        # 获取桥接信息用于审计日志
        bridge = k8s_pod_shell_manager.get_bridge(session_id)
        
        if bridge:
            # 记录审计日志
            _log_pod_shell_operation(
                action='terminate',
                cluster_id=bridge.cluster_id,
                namespace=bridge.namespace,
                pod_name=bridge.pod_name,
                container=bridge.container,
                user_id=bridge.user_id,
                tenant_id=bridge.tenant_id,
                session_id=session_id,
                status='success'
            )
        
        # 移除桥接
        removed = k8s_pod_shell_manager.remove_bridge(session_id, "User terminated")
        
        if removed:
            emit('k8s_pod_shell_terminated', {
                'session_id': session_id,
                'message': 'Pod Shell 会话已终止'
            })
        else:
            emit('k8s_pod_shell_error', {
                'session_id': session_id,
                'message': '终止 Pod Shell 会话失败'
            })
            
    except Exception as e:
        logger.error(f"K8S Pod Shell terminate error: {e}")
        emit('k8s_pod_shell_error', {'message': '终止 Pod Shell 失败'})


def register_websocket_events():
    """注册 WebSocket 事件（用于确保事件被注册）"""
    # 导入 Ansible WebSocket 事件处理器以确保事件被注册
    from app.services.ansible_websocket_service import (
        handle_join_ansible_execution,
        handle_leave_ansible_execution,
        handle_disconnect as ansible_handle_disconnect
    )
    
    logger.info("WebSocket events registered")