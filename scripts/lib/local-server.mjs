import {createServer} from 'node:http';
import {readFile,writeFile,rename,mkdir,readdir,realpath,lstat,rm} from 'node:fs/promises';
import {resolve,relative,join,extname,basename,isAbsolute,sep} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {userInfo,platform} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run=promisify(execFile);
const readable=/\.(zip|xml|png|jpe?g|tiff?|bmp|gif|webp|result(?:-\d+)?|xlsx|csv|tsv|json|docx|sqlite|db|db3)$/i;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
const fail=(status,message)=>Object.assign(new Error(message),{status});
const inside=(root,path)=>{const rel=relative(root,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep));};
export async function systemIdentity({system=platform(),username=userInfo().username,execute=run}={}){
  if(system==='win32'){
    try{const {stdout}=await execute('whoami.exe',[],{windowsHide:true,timeout:5000});const account=stdout.trim();if(account)return {name:account.slice(account.indexOf('\\')+1),account,source:'Windows-Anmeldekonto'};}catch{/* Offline/local accounts still have an OS username. */}
  }
  return {name:username,account:username,source:'Lokales Betriebssystemkonto'};
}
async function body(req,limit=32*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw fail(413,'Die Datei ist zu groß (maximal 32 MiB).');chunks.push(chunk);}return Buffer.concat(chunks);}
export async function createLocalApp({dist,workspace,configFile,identity,port=0}={}){
  const staticRoot=await realpath(dist),token=randomBytes(32).toString('hex'),roots=new Map(),writes=new Map();
  identity??=await systemIdentity();
  async function connect(path,remember=false){
    if(typeof path!=='string'||!isAbsolute(path))throw fail(400,'Bitte einen absoluten Ordnerpfad angeben.');
    const root=await realpath(path).catch(()=>{throw fail(400,'Der Arbeitsordner wurde nicht gefunden.');});
    if(!(await lstat(root)).isDirectory())throw fail(400,'Der Pfad ist kein Ordner.');
    const id=createHash('sha256').update(root).digest('hex');roots.set(id,root);
    if(remember){if(!configFile)throw fail(400,'Dauerhafte Konfiguration ist hier nicht aktiviert.');await mkdir(resolve(configFile,'..'),{recursive:true,mode:0o700});await writeFile(configFile,JSON.stringify({workspace:root})+'\n',{mode:0o600});}
    return {id,path:root};
  }
  let initial=null,warning='';
  if(!workspace&&configFile){try{workspace=JSON.parse(await readFile(configFile,'utf8')).workspace;}catch(e){if(e.code!=='ENOENT')warning='Der gespeicherte Ordner konnte nicht gelesen werden.';}}
  if(workspace){try{initial=await connect(workspace);}catch(e){warning=e.message;}}
  async function checkedFile(root,path){
    if(typeof path!=='string'||!path||path.includes('\\')||path.includes('\0')||path.split('/').some(p=>!p||p==='.'||p==='..')||isAbsolute(path))throw fail(400,'Ungültiger relativer Dateipfad.');
    const target=resolve(root,...path.split('/'));if(!inside(root,target))throw fail(403,'Pfad außerhalb des Arbeitsordners.');
    let current=root;for(const part of path.split('/')){current=join(current,part);const stat=await lstat(current).catch(()=>{throw fail(404,'Die Datei wurde nicht gefunden.');});if(stat.isSymbolicLink())throw fail(403,'Symbolische Verknüpfungen werden nicht geöffnet.');}
    if(!inside(root,await realpath(target)))throw fail(403,'Pfad außerhalb des Arbeitsordners.');return target;
  }
  async function files(root){const result=[];async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const path=prefix+entry.name;if(entry.isDirectory())await walk(join(dir,entry.name),path+'/');else if(entry.isFile()&&readable.test(entry.name))result.push({name:entry.name,path});}}await walk(root);return result.sort((a,b)=>a.path.localeCompare(b.path));}
  let origin;
  const server=createServer(async(req,res)=>{
    const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
    try{
      if(req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')throw fail(403,'Nur Zugriffe aus der lokalen Anwendung sind erlaubt.');
      const url=new URL(req.url,origin);
      if(url.pathname.startsWith('/api/local/')){
        if(url.pathname==='/api/local/config'&&req.method==='GET'){json(200,{protocol:'iqb-local-v1',token,identity,workspace:initial,warning});return;}
        if(req.headers['x-iqb-local-token']!==token)throw fail(403,'Die lokale Verbindung ist nicht freigegeben. Bitte die Seite neu laden.');
        if(url.pathname==='/api/local/connect'&&req.method==='POST'){let value;try{value=JSON.parse((await body(req,8192)).toString());}catch(e){if(e.status)throw e;throw fail(400,'Ungültige Ordnerangabe.');}const connected=await connect(value.path,!!value.remember);if(value.remember)initial=connected;json(200,connected);return;}
        if(url.pathname==='/api/local/forget'&&req.method==='POST'){if(configFile)await rm(configFile,{force:true});initial=null;json(200,{ok:true});return;}
        const root=roots.get(url.searchParams.get('workspace'));if(!root)throw fail(403,'Diesen Arbeitsordner bitte zuerst verbinden.');
        if(url.pathname==='/api/local/files'&&req.method==='GET'){json(200,await files(root));return;}
        const path=url.searchParams.get('path');
        if(url.pathname==='/api/local/file'&&req.method==='GET'){
          if(!readable.test(path||''))throw fail(403,'Dieser Dateityp ist nicht freigegeben.');const target=await checkedFile(root,path);if(!(await lstat(target)).isFile())throw fail(400,'Der Pfad ist keine Datei.');res.writeHead(200,{'Content-Type':'application/octet-stream'});res.end(await readFile(target));return;
        }
        if(url.pathname==='/api/local/result'&&req.method==='PUT'){
          if(!/^[^<>:"/\\|?*\x00-\x1f]+\.result(?:-\d+)?$/i.test(basename(path||''))||!path||path.split('/').some(p=>!p||p==='.'||p==='..'))throw fail(400,'Nur Ergebnisdateien mit .result sind zum Schreiben freigegeben.');
          const parts=path.split('/'),name=parts.pop(),parent=parts.length?await checkedFile(root,parts.join('/')):root;
          const target=join(parent,name);if(!inside(root,target))throw fail(403,'Pfad außerhalb des Arbeitsordners.');
          try{const stat=await lstat(target);if(!stat.isFile()||stat.isSymbolicLink())throw fail(403,'Die Ergebnisdatei ist keine reguläre Datei.');}catch(e){if(e.code!=='ENOENT')throw e;}
          const bytes=await body(req);const key=root+'/'+path;
          const operation=(writes.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
            const temp=join(parent,'.iqb-'+randomBytes(12).toString('hex')+'.tmp');try{await writeFile(temp,bytes,{flag:'wx',mode:0o600});await rename(temp,target);}finally{await rm(temp,{force:true});}
          });writes.set(key,operation);try{await operation;}finally{if(writes.get(key)===operation)writes.delete(key);}json(200,{path});return;
        }
        throw fail(404,'Unbekannte lokale Funktion.');
      }
      if(req.method!=='GET'&&req.method!=='HEAD')throw fail(405,'Diese Methode ist nicht erlaubt.');
      const path=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).slice(1),target=resolve(staticRoot,path);
      if(!inside(staticRoot,target)||!inside(staticRoot,await realpath(target)))throw fail(404,'Datei nicht gefunden.');
      const bytes=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes);
    }catch(e){if(res.headersSent){res.destroy();return;}json(e.status||(['ENOENT','EISDIR'].includes(e.code)?404:500),{error:e.status?e.message:'Die lokale Dateioperation ist fehlgeschlagen.'});}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;
  return {url:origin,close:()=>new Promise((resolve,reject)=>{server.closeIdleConnections();server.close(e=>e?reject(e):resolve());})};
}
