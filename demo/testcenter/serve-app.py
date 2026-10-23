"""Local static demo installation. No API proxy and no request-data logging."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]/'dist'
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def end_headers(self):
  self.send_header('X-IQB-Local-Demo','1')
  if self.path=='/sw.js':self.send_header('Cache-Control','no-cache')
  super().end_headers()
 def log_message(self,*a):pass
ThreadingHTTPServer(('127.0.0.1',5190),Handler).serve_forever()
