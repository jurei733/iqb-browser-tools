import {readDataFiles,normalizePeople} from './data.js';
import {parseJSON} from './json.js';
// The native SQLite JSON command imports each file and person in order.
// Its direct-output command instead collects unique identities first.
export async function importDatabaseFiles(db,files,{windows=false,merge=true,options={},onWarning=()=>{}}={}){
 const readOptions={...options,windows,csvTarget:'database',onWarning};
 if(!windows)return db.import(await readDataFiles(files,readOptions),{merge});
 let imported=0,csv=[];
 const flush=async()=>{if(csv.length){const people=await readDataFiles(csv,readOptions);if(people.some(p=>p.booklets.some(b=>b.units.some(u=>u.chunks.some(c=>c.id==='all-error')&&u.subforms.some(sf=>sf.responses.some(r=>r.id==='ERROR'&&r.status==='ERROR'))))))throw new Error('CSV enthält nicht konvertierbare Antworten. Die fehlerhaften CSV-Daten wurden nicht übernommen.');imported+=db.import(people,{windows,merge}).imported;csv=[];}};
 for(const f of files){
  if(!/\.json$/i.test(f.name)){csv.push(f);continue;}
  await flush();const source=typeof f.text==='string'?f.text:new TextDecoder(options.encoding||'utf-8',{fatal:true}).decode(f.bytes??await f.arrayBuffer()),data=parseJSON(source);
  const people=Array.isArray(data)&&data.every(p=>p&&Array.isArray(p.booklets))?normalizePeople(data,{windows}):await readDataFiles([f],readOptions);
  for(const p of people)imported+=db.import([p],{windows,merge}).imported;
 }
 await flush();return {imported,...db.summary()};
}
