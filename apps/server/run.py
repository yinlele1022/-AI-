import sys
from pathlib import Path

# 确保 opposite_game 包可被找到（gunicorn 从项目根目录加载 apps.server.run）
_server_dir = Path(__file__).resolve().parent
if str(_server_dir) not in sys.path:
    sys.path.insert(0, str(_server_dir))

from opposite_game import create_app
from opposite_game.extensions import socketio


app = create_app()


if __name__ == "__main__":
    port = app.config["PORT"]
    app.logger.info("《反着来》服务启动，端口 %s", port)
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=False,
        allow_unsafe_werkzeug=True,
    )
