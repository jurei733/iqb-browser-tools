"""Serve the built integration page and retain its real browser exports locally."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote
import argparse, json
p=argparse.ArgumentParser()
p.add_argument('root',type=Path);p.add_argument('results',type=Path);p.add_argument('--port',type=int,default=5191)
args=p.parse_args();args.results.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(args.root.resolve()),**kw)
 def do_POST(self):
  size=int(self.headers.get('Content-Length','0'))
  if size>30000000:self.send_error(413);return
  body=self.rfile.read(size)
  if self.path=='/__report__':
   report=json.loads(body);agent=report.get('userAgent','')
   engine='firefox' if 'Firefox/' in agent else 'safari' if 'Safari/' in agent and 'Chrome/' not in agent else 'chromium'
   (args.results/('pilot-'+engine+'.json')).write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
  elif self.path.startswith('/__artifact__/'):
   name=unquote(self.path.removeprefix('/__artifact__/'))
   if not name or Path(name).name!=name or name in ('.','..'):self.send_error(400);return
   (args.results/name).write_bytes(body)
  else:self.send_error(404);return
  self.send_response(200);self.end_headers();self.wfile.write(b'OK')
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
