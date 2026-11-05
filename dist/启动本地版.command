#!/bin/zsh
# 固定端口，让同一浏览器下的阶段快照保持在同一个本地工作空间。
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
python3 - "$APP_DIR" <<'PY'
import functools
import http.server
import pathlib
import sys
import threading
import urllib.parse
import webbrowser

folder=pathlib.Path(sys.argv[1])
filename='志愿者分组-完整测试版.html'
if not (folder/filename).is_file():
    input('请将启动文件与完整测试版 HTML 放在同一文件夹。按回车退出。')
    raise SystemExit(1)
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(folder))
try:
    server=http.server.ThreadingHTTPServer(('127.0.0.1',8766),handler)
except OSError:
    input('本地端口 8766 已被使用。若已经启动本项目，请使用原窗口；否则关闭占用该端口的程序再试。按回车退出。')
    raise SystemExit(1)
url='http://127.0.0.1:8766/'+urllib.parse.quote(filename)
print('志愿者分组已启动，仅本机可访问。')
print(url)
print('请保持此窗口开启。结束前先保存并下载备份；按 Control+C 关闭。')
threading.Timer(0.5,lambda:webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
PY
