let worker,id=0;
const pending=new Map();
export function task(op,args={}) {
  if(!worker){worker=new Worker(new URL('./data.worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const promise=pending.get(data.id);if(!promise)return;pending.delete(data.id);data.error?promise.reject(new Error(data.error)):promise.resolve(data.result);};worker.onerror=event=>{for(const p of pending.values())p.reject(new Error('Die Dateiverarbeitung wurde beendet: '+event.message));pending.clear();worker.terminate();worker=null;};}
  return new Promise((resolve,reject)=>{const requestId=++id;pending.set(requestId,{resolve,reject});worker.postMessage({id:requestId,op,args});});
}
export async function fileData(files) {const result=[];for(const f of Array.from(files||[]))result.push({name:f.name,relativePath:f.webkitRelativePath||'',bytes:new Uint8Array(await f.arrayBuffer())});return result;}
export function cancelTasks(){if(worker){worker.terminate();worker=null;}for(const p of pending.values())p.reject(new Error('Verarbeitung abgebrochen.'));pending.clear();}
