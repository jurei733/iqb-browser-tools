import {build} from 'vite';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await build();
async function walk(path){const files=[];for(const entry of await readdir(path,{withFileTypes:true})){const name=path+'/'+entry.name;if(entry.isDirectory())files.push(...await walk(name));else files.push(name);}return files;}
const files=await walk('dist'),hash=createHash('sha256');
for(const path of files){hash.update(path);hash.update(await readFile(path));}
const cache='iqb-browser-'+hash.digest('hex').slice(0,16),urls=files.map(f=>'/'+f.slice(5));
// Only the application shell is cached. Testcenter requests and user files never enter this cache.
await writeFile('dist/sw.js',`const CACHE=${JSON.stringify(cache)},FILES=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('iqb-browser-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;}
if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(event.request)));});
`);
console.log('Offline shell prepared:',urls.length,'files');
