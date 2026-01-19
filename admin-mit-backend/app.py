from app import create_app
from app.core.config_manager import config_manager
from app.extensions import socketio

app = create_app()

if __name__ == '__main__':
    app_config = config_manager.get_app_config()
    server_config = app_config.get('server', {})
    
    # 使用 socketio.run() 启动，支持 WebSocket
    socketio.run(
        app,
        host=server_config.get('host', '0.0.0.0'),
        port=server_config.get('port', 5000),
        debug=app_config.get('debug', False),
        allow_unsafe_werkzeug=True  # 开发环境允许
    )