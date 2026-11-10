import {windowsContentIndex} from './windows-content.js';
import {parseJSON} from './json.js';
import {zipSync,strToU8} from 'fflate';
import {text} from './xml.js';
import {parseCSV,csvString} from './toolbox.js';
import {normalizeServer} from './docx.js';
export const apiBase=input=>{const server=normalizeServer(input);return /\/api$/i.test(server)?server:server+'/api';};
const encode=encodeURIComponent;
const flatten=data=>Array.isArray(data)?data:Object.values(data||{}).flatMap(v=>Array.isArray(v)?v:[]);
export async function solveChallenge(challenge,{signal,onProgress=()=>{}}={}) {
  if(String(challenge.algorithm).toUpperCase().replace(/-/g,'')!=='SHA256')throw new Error('Der Server verwendet einen nicht unterstützten Challenge-Algorithmus.');
  if(!Number.isSafeInteger(Number(challenge.maxNumber))||Number(challenge.maxNumber)<0)throw new Error('Ungültige Challenge-Grenze.');
  const encoder=new TextEncoder(),target=String(challenge.challenge).toLowerCase();
  const maximum=Number(challenge.maxNumber),batchSize=64;
  for(let start=0;start<=maximum;start+=batchSize){
    if(signal?.aborted)throw new DOMException('Abgebrochen','AbortError');
    // Queue a small bounded batch instead of one native/browser round trip per
    // candidate. The signed challenge and its inclusive search range are intact.
    const numbers=Array.from({length:Math.min(batchSize,maximum-start+1)},(_,i)=>start+i);
    const hashes=await Promise.all(numbers.map(n=>crypto.subtle.digest('SHA-256',encoder.encode(challenge.salt+String(n)))));
    if(signal?.aborted)throw new DOMException('Abgebrochen','AbortError');
    for(let i=0;i<hashes.length;i++){const hex=Array.from(new Uint8Array(hashes[i]),b=>b.toString(16).padStart(2,'0')).join('');if(hex===target)return numbers[i];}
    if(start%256===0)onProgress(Math.min(1,(start+numbers.length)/Math.max(1,maximum)));
  }
  throw new Error('Die Anmelde-Challenge konnte nicht gelöst werden.');
}
export class TestcenterClient {
  constructor(url,{fetch:fetcher=(...args)=>globalThis.fetch(...args),signal,onProgress,requestTimeout=100000}={}){this.requestTimeout=requestTimeout;this.base=apiBase(url);this.fetch=fetcher;this.signal=signal;this.onProgress=onProgress||(()=>{});this.token='';this.workspace=null;}
  disconnect(){this.token='';this.workspace=null;}
  async logout(){try{if(this.token)await this.request('/session',{method:'DELETE'});}finally{this.disconnect();}}
  async request(path,{method='GET',body,format='json',accept='application/json'}={}) {
    const headers={Accept:accept};if(body!==undefined)headers['Content-Type']='application/json';if(this.token)headers.AuthToken=this.token;
    const control=new AbortController(),upstream=this.signal,relay=()=>control.abort(upstream?.reason);let timedOut=false;
    if(upstream?.aborted)relay();else upstream?.addEventListener('abort',relay,{once:true});
    const timer=setTimeout(()=>{timedOut=true;control.abort();},this.requestTimeout);
    try {
      let response;
      try{response=await this.fetch(this.base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:control.signal,credentials:'omit',redirect:'error'});}
      catch(error){if(error.name==='AbortError')throw error;throw new Error('Testcenter nicht erreichbar. Prüfe Adresse und Verbindung. Bei einem anderen Server muss dieser Browserzugriffe von dieser Anwendung erlauben (CORS für Content-Type und AuthToken). Alternativ die Browserfassung auf demselben Server bereitstellen.');}
      if(!response.ok){const message=await response.text();if(response.status===401)this.disconnect();const error=new Error(`Testcenter-Anfrage fehlgeschlagen (HTTP ${response.status}).`+(response.status===401?' Bitte erneut anmelden.':''));error.status=response.status;error.challengeRequired=response.status===400&&/Challenge|Brute Force/i.test(message);throw error;}
      if(format==='bytes')return new Uint8Array(await response.arrayBuffer());if(format==='text')return await response.text();if([204,205].includes(response.status))return null;return parseJSON(await response.text());
    } catch(error){if(timedOut){const timeout=new Error('Zeitüberschreitung der Testcenter-Anfrage. Bitte Verbindung prüfen und erneut versuchen.');timeout.name='TimeoutError';throw timeout;}throw error;}
    finally{clearTimeout(timer);upstream?.removeEventListener('abort',relay);}
  }
  async login(name,password) {
    this.disconnect();let session;
    try{session=await this.request('/session/admin',{method:'PUT',body:{name,password}});}catch(error){if(!error.challengeRequired)throw error;const challenge=await this.request('/session/challenge',{method:'POST',body:{loginType:'admin',name,password}});const number=await solveChallenge(challenge,{signal:this.signal,onProgress:this.onProgress});session=await this.request('/session',{method:'PUT',body:{algorithm:challenge.algorithm,challenge:challenge.challenge,salt:challenge.salt,signature:challenge.signature,number}});}
    if(!session?.token)throw new Error('Die Anmeldung hat keinen Sitzungsschlüssel geliefert.');this.token=session.token;
    const ids=session.access?.workspaceAdmin||[],workspaces=[];
    try{for(const id of ids){const info=await this.request('/workspace/'+encode(id));workspaces.push({id,name:info.name||'Workspace '+id});}}catch(e){this.disconnect();throw e;}
    return workspaces;
  }
  route(suffix){if(this.workspace===null)throw new Error('Bitte einen Arbeitsbereich auswählen.');return '/workspace/'+encode(this.workspace)+suffix;}
  groups(){return this.request(this.route('/results'));}
  async files(){return flatten(await this.request(this.route('/files')));}
  async dependencies(names){const result=[];for(let i=0;i<names.length;i+=600)result.push(...flatten(await this.request(this.route('/files-dependencies'),{method:'POST',body:{body:names.slice(i,i+600)}})));return result;}
  file(file){return this.request(this.route('/file/'+encode(file.type)+'/'+encode(file.name)),{format:'bytes',accept:'application/octet-stream'});}
  report(kind,group,csv=false){if(!['response','log','review'].includes(kind))throw new Error('Unbekannter Berichtstyp.');const route=this.route('/report/'+kind+'?dataIds='+encode(group)+(csv?'&useNewVersion=false':''));return this.request(route,{format:'text',accept:csv?'text/csv':'application/json'}).then(body=>csv?body:body.trim()?parseJSON(body):[]);}
  async results(groups){const responses=[],logs=[];for(const [i,g]of groups.entries()){this.onProgress(i/groups.length,`Gruppe ${g}`);logs.push(...await this.report('log',g));responses.push(...await this.report('response',g));}return {responses,logs};}
  async reviews(groups,{windows=false,onWarning=()=>{}}={}){const rows=[],required=['bookletname','code','entry','groupname','loginname','priority','reviewtime','unitname','category: design','category: tech','category: content'];for(const g of groups){const data=await this.report('review',g);if(!Array.isArray(data))throw new Error('Ungültiger Review-Bericht.');if(windows&&data.some(row=>required.some(key=>!Object.hasOwn(row,key)))){onWarning(`Problem bei Logingruppe '${g}': Der angegebene Schlüssel war nicht im Wörterbuch angegeben. (Logs)`);continue;}rows.push(...data);}return rows;}
  async rawCSV(kind,groups,{windows=false}={}){
    if(!windows){let header,rows=[];for(const g of groups){const data=parseCSV(await this.report(kind,g,true));if(!header)header=data.shift();else {const current=data.shift();if(JSON.stringify(current)!==JSON.stringify(header))throw new Error('Die Gruppen liefern unterschiedliche CSV-Köpfe.');}rows.push(...data);}return strToU8(csvString([header||[],...rows]));}
    let header,output='';
    for(const g of groups){
      const source=(await this.report(kind,g,true)).replace(/^\uFEFF/,''),newline=source.indexOf('\n');
      const current=parseCSV(newline<0?source:source.slice(0,newline))[0];
      if(header===undefined){header=current;output=source;}
      else{
        if(JSON.stringify(current)!==JSON.stringify(header))throw new Error('Die Gruppen liefern unterschiedliche CSV-Köpfe.');
        // The original appends the next server report starting at its LF,
        // keeping every body byte rather than decoding/re-encoding CSV rows.
        if(newline>0)output+=source.slice(newline);
      }
    }
    return strToU8('\uFEFF'+output);
  }
  async bookletSizes(){const all=await this.files(),dependencies=await this.dependencies(all.filter(f=>f.type==='Booklet').map(f=>f.name)),sizes=new Map(all.map(f=>[f.name,Number(f.size)||0])),result={};for(const b of dependencies){result[b.id]=Number(b.size)||0;const seen=new Set();for(const d of b.dependencies||[])if(['containsUnit','usesPlayer','isDefinedBy'].includes(d.relationship_type)&&!seen.has(d.object_name)){result[b.id]+=sizes.get(d.object_name)||0;seen.add(d.object_name);}}return result;}
  async content({windows=false,workspaceName=''}={}){const files=await this.files(),units=await this.dependencies(files.filter(f=>f.type==='Unit').map(f=>f.name)),indexFiles=[...files.filter(f=>f.type!=='Unit'),...units],entries={};for(const [i,file]of files.entries()){this.onProgress(i/files.length,file.name);const name=String(file.name).replace(/\\/g,'/');if(name.startsWith('/')||name.split('/').includes('..'))throw new Error('Der Server liefert einen ungültigen Dateinamen.');const bytes=await this.file(file);const time=new Date(Math.max(Date.UTC(1980,0,1),Number(file.modificationTime||0)*1000));entries[name]=[bytes,{mtime:time}];}entries['index.html']=strToU8(windows?windowsContentIndex(indexFiles,{url:this.base,workspaceName}):contentIndex(indexFiles));return zipSync(entries);}
}
export function contentIndex(files){const sections=[['Booklet','Testhefte'],['Unit','Aufgaben'],['Testtakers','Testpersonen'],['SysCheck','Systemchecks']];const used=new Set();let body='';
  const row=file=>{used.add(file.name);const dependencies=(file.dependencies||[]).map(d=>`${text(d.relationship_type)}: <a href="${text(encode(d.object_name))}">${text(d.object_name)}</a>`).join('<br>');return `<tr><td>${text(file.id||'')}</td><td>${text(file.info?.label||'')}<small>${text(file.info?.description||'')}</small>${file.info?.testtakers!==undefined?`<small>${text(file.info.testtakers)} Logins</small>`:''}</td><td><a href="${text(encode(file.name))}">${text(file.name)}</a></td><td>${text(file.size||0)}</td><td>${dependencies}</td></tr>`;};
  for(const [type,title]of sections){const list=files.filter(f=>f.type===type).sort((a,b)=>String(a.id).localeCompare(String(b.id)));if(list.length)body+=`<h2>${title}</h2><table><tr><th>ID</th><th>Beschreibung</th><th>Datei</th><th>Bytes</th><th>Abhängigkeiten</th></tr>${list.map(row).join('')}</table>`;}
  const rest=files.filter(f=>!used.has(f.name));if(rest.length)body+=`<h2>Ressourcen</h2><table>${rest.map(row).join('')}</table>`;
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Testcenter-Inhalte</title><style>body{font:15px system-ui;max-width:1200px;margin:40px auto;padding:20px;color:#142952}table{width:100%;border-collapse:collapse}td,th{padding:12px;text-align:left;border-bottom:1px solid #ddd}small{display:block;color:#65748a;margin-top:6px}a{color:#235c97}</style><h1>Testcenter-Inhalte</h1>${body}</html>`;
}
