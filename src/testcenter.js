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
  for(let n=0;n<=Number(challenge.maxNumber);n++){if(signal?.aborted)throw new DOMException('Abgebrochen','AbortError');const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(challenge.salt+String(n))));const hex=Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');if(hex===target)return n;if(n%256===0)onProgress(n/Number(challenge.maxNumber));}
  throw new Error('Die Anmelde-Challenge konnte nicht gelöst werden.');
}
export class TestcenterClient {
  constructor(url,{fetch:fetcher=(...args)=>globalThis.fetch(...args),signal,onProgress}={}){this.base=apiBase(url);this.fetch=fetcher;this.signal=signal;this.onProgress=onProgress||(()=>{});this.token='';this.workspace=null;}
  disconnect(){this.token='';this.workspace=null;}
  async logout(){try{if(this.token)await this.request('/session',{method:'DELETE'});}finally{this.disconnect();}}
  async request(path,{method='GET',body,format='json',accept='application/json'}={}) {
    const headers={Accept:accept};if(body!==undefined)headers['Content-Type']='application/json';if(this.token)headers.AuthToken=this.token;
    let response;try{response=await this.fetch(this.base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:this.signal,credentials:'omit',redirect:'error'});}catch(error){if(error.name==='AbortError')throw error;throw new Error('Testcenter nicht erreichbar. Prüfe Adresse und Verbindung. Bei einem anderen Server muss dieser Browserzugriffe von dieser Anwendung erlauben (CORS für Content-Type und AuthToken). Alternativ die Browserfassung auf demselben Server bereitstellen.');}
    if(!response.ok){const message=await response.text();const error=new Error(`Testcenter-Anfrage fehlgeschlagen (HTTP ${response.status}).`);error.status=response.status;error.challengeRequired=response.status===400&&/Challenge|Brute Force/i.test(message);throw error;}
    if(format==='bytes')return new Uint8Array(await response.arrayBuffer());if(format==='text')return response.text();if([204,205].includes(response.status))return null;return parseJSON(await response.text());
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
  report(kind,group,csv=false){if(!['response','log','review'].includes(kind))throw new Error('Unbekannter Berichtstyp.');return this.request(this.route('/report/'+kind+'?dataIds='+encode(group)+(csv?'&useNewVersion=false':'')),{format:csv?'text':'json',accept:csv?'text/csv':'application/json'});}
  async results(groups){const responses=[],logs=[];for(const [i,g]of groups.entries()){this.onProgress(i/groups.length,`Gruppe ${g}`);logs.push(...await this.report('log',g));responses.push(...await this.report('response',g));}return {responses,logs};}
  async reviews(groups){const rows=[];for(const g of groups)rows.push(...await this.report('review',g));return rows;}
  async rawCSV(kind,groups){let header,rows=[];for(const g of groups){const data=parseCSV(await this.report(kind,g,true));if(!header)header=data.shift();else {const current=data.shift();if(JSON.stringify(current)!==JSON.stringify(header))throw new Error('Die Gruppen liefern unterschiedliche CSV-Köpfe.');}rows.push(...data);}return strToU8(csvString([header||[],...rows]));}
  async bookletSizes(){const all=await this.files(),dependencies=await this.dependencies(all.filter(f=>f.type==='Booklet').map(f=>f.name)),sizes=new Map(all.map(f=>[f.name,Number(f.size)||0])),result={};for(const b of dependencies){result[b.id]=Number(b.size)||0;const seen=new Set();for(const d of b.dependencies||[])if(['containsUnit','usesPlayer','isDefinedBy'].includes(d.relationship_type)&&!seen.has(d.object_name)){result[b.id]+=sizes.get(d.object_name)||0;seen.add(d.object_name);}}return result;}
  async content(){const files=await this.files(),units=await this.dependencies(files.filter(f=>f.type==='Unit').map(f=>f.name)),indexFiles=[...files.filter(f=>f.type!=='Unit'),...units],entries={};for(const [i,file]of files.entries()){this.onProgress(i/files.length,file.name);const name=String(file.name).replace(/\\/g,'/');if(name.startsWith('/')||name.split('/').includes('..'))throw new Error('Der Server liefert einen ungültigen Dateinamen.');const bytes=await this.file(file);const time=new Date(Math.max(Date.UTC(1980,0,1),Number(file.modificationTime||0)*1000));entries[name]=[bytes,{mtime:time}];}entries['index.html']=strToU8(contentIndex(indexFiles));return zipSync(entries);}
}
export function contentIndex(files){const sections=[['Booklet','Testhefte'],['Unit','Aufgaben'],['Testtakers','Testpersonen'],['SysCheck','Systemchecks']];const used=new Set();let body='';
  const row=file=>{used.add(file.name);const dependencies=(file.dependencies||[]).map(d=>`${text(d.relationship_type)}: <a href="${text(encode(d.object_name))}">${text(d.object_name)}</a>`).join('<br>');return `<tr><td>${text(file.id||'')}</td><td>${text(file.info?.label||'')}<small>${text(file.info?.description||'')}</small>${file.info?.testtakers!==undefined?`<small>${text(file.info.testtakers)} Logins</small>`:''}</td><td><a href="${text(encode(file.name))}">${text(file.name)}</a></td><td>${text(file.size||0)}</td><td>${dependencies}</td></tr>`;};
  for(const [type,title]of sections){const list=files.filter(f=>f.type===type).sort((a,b)=>String(a.id).localeCompare(String(b.id)));if(list.length)body+=`<h2>${title}</h2><table><tr><th>ID</th><th>Beschreibung</th><th>Datei</th><th>Bytes</th><th>Abhängigkeiten</th></tr>${list.map(row).join('')}</table>`;}
  const rest=files.filter(f=>!used.has(f.name));if(rest.length)body+=`<h2>Ressourcen</h2><table>${rest.map(row).join('')}</table>`;
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Testcenter-Inhalte</title><style>body{font:15px system-ui;max-width:1200px;margin:40px auto;padding:20px;color:#142952}table{width:100%;border-collapse:collapse}td,th{padding:12px;text-align:left;border-bottom:1px solid #ddd}small{display:block;color:#65748a;margin-top:6px}a{color:#235c97}</style><h1>Testcenter-Inhalte</h1>${body}</html>`;
}
