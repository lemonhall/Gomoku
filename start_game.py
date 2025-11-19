import http.server
import socketserver
import webbrowser
import os
import mimetypes

# 强制设置 .js 文件的 MIME 类型
mimetypes.add_type('application/javascript', '.js')

PORT = 8080

web_dir = os.path.join(os.path.dirname(__file__))
os.chdir(web_dir)

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    webbrowser.open(f"http://localhost:{PORT}")
    httpd.serve_forever()
