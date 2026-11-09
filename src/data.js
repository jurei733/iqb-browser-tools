import Excel from 'exceljs';
import {parseCSV,csvString} from './toolbox.js';
import {parseJSON,stringifyJSON} from './json.js';
import {parseWindowsChunk} from './windows-responses.js';
import {parseWindowsJSON,isContainer,orderedEntries,windowsTokenText} from './windows-tokens.js';
import {parseWindowsLogCSV,parseWindowsLegacyResponses,splitWindowsLog} from './windows-csv.js';
import {exactTime,compareTime,maxTime,minTime} from './timestamps.js';

export const STATUS=['UNSET','NOT_REACHED','DISPLAYED','VALUE_CHANGED','DERIVE_ERROR','CODING_COMPLETE','NO_CODING','INVALID','CODING_INCOMPLETE','CODING_ERROR','PARTLY_DISPLAYED','DERIVE_PENDING','INTENDED_INCOMPLETE','CODE_SELECTION_PENDING'];
export const asText=v=>v===null?'#null#':typeof v==='object'?stringifyJSON(v):String(v??'');
const json=v=>typeof v==='string'?parseJSON(v):v;
const key=(...parts)=>JSON.stringify(parts);
const stable=value=>stringifyJSON(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const nullableNumeric=v=>v===null?null:typeof v==='string'&&/^[+-]?\d+$/.test(v)&&!Number.isSafeInteger(Number(v))?v:numeric(v);
const numeric=v=>Number.isFinite(Number(v))?Number(v):0;
const responseTime=(u,sf,id)=>u.chunks.reduce((t,c)=>c.variables.includes(sf?sf+'##'+id:id)?maxTime(t,c.ts):t,0);
function mergeUnit(unit,incoming){
  for(const sf of incoming.subforms){let sub=unit.subforms.find(v=>v.id===sf.id);if(!sub){unit.subforms.push(structuredClone(sf));continue;}for(const r of sf.responses){const i=sub.responses.findIndex(v=>v.id===r.id);if(i<0)sub.responses.push(structuredClone(r));else if(compareTime(responseTime(incoming,sf.id,r.id),responseTime(unit,sf.id,r.id))>=0)sub.responses[i]=structuredClone(r);}}
  if(incoming.laststate.length)unit.laststate=structuredClone(incoming.laststate);
  for(const field of ['logs','chunks']){const seen=new Set(unit[field].map(stable));for(const item of incoming[field])if(!seen.has(stable(item))){unit[field].push(structuredClone(item));seen.add(stable(item));}}
  unit.chunks.sort((a,b)=>compareTime(a.ts,b.ts));
  if(unit.id===unit.alias&&incoming.id!==incoming.alias)unit.id=incoming.id;
}
const sameUnit=(a,b)=>a.alias===b.alias&&(a.id===b.id||a.id===a.alias||b.id===b.alias);

export function parseChunk(content,type='',{windows=false}={}) {
  if(windows)return parseWindowsChunk(content,type,{bits:windows==='64'?64:32});
  const forms=new Map();
  const add=(subform,id,value,status='UNSET',code=0,score=0)=>{
    if(!forms.has(String(subform??'')))forms.set(String(subform??''),[]);
    forms.get(String(subform??'')).push({id:String(id),value:typeof value==='boolean'&&type!=='unknown'?(value?'True':'False'):asText(value),status:String(status||'UNSET'),code:nullableNumeric(code),score:nullableNumeric(score)});
  };
  try {
    let data=json(content);
    if(['iqb-aspect-player@0.1.1','iqb-standard@1.0.0','iqb-standard@1.0','iqb-standard@1.1'].includes(type)) {
      for(const entry of Array.isArray(data)?data:[data]) {
        if(!entry||entry.id===undefined||!Object.hasOwn(entry,'value'))throw new Error('Standard-Antwort ohne id/value.');
        add(entry.subform??'',entry.id,entry.value,entry.status,entry.code,entry.score);
      }
    }else {
      if(type==='iqb-simple-player@1.0.0')data=data?.answers||{};
      if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Erwartet wird ein Schlüssel-Wert-Objekt.');
      for(const [id,value]of Object.entries(data)) {
        if(type==='IQBVisualUnitPlayerV2.1.0'&&['responsesGiven','pagesViewed'].includes(id))continue;
        if(type==='unknown') {
          const split=id.lastIndexOf('_'),suffix=id.slice(split+1).trim(),number=/^[+-]?\d+$/.test(suffix)?Number(suffix):0;
          if(split>1&&number>0&&number<=2147483647) {
            const form=String(number),variable=id.slice(0,split);
            if(!forms.get(form)?.some(r=>r.id===variable))add(form,variable,value);
          }else add('',id,value);
        }
        else add('',id,value);
      }
    }
  } catch(error) {add('','ERROR',`Konvertierung (${type||'KeyValue'}): ${error.message}`,'ERROR');}
  return [...forms].sort(type==='unknown'?([a],[b])=>a===''?-1:b===''?1:0:()=>0).map(([id,responses])=>({id,responses}));
}
function lastState(raw,{windows=false}={}) {
  if(!raw)return [];
  if(Array.isArray(raw))return raw.map(v=>({key:String(v.key??''),value:windows&&v.value===null?null:asText(v.value)}));
  if(windows){const source=typeof raw==='string'?raw.replace(/""/g,'"'):stringifyJSON(raw);try{const data=parseWindowsJSON(source,{stringsOnly:true});if(!isContainer(data)||Array.isArray(data)||Object.values(data).some(isContainer))throw new Error();return orderedEntries(data).map(([key,value])=>({key,value:value===null?null:windowsTokenText(value,{stringsOnly:true})}));}catch{return [{key:'state',value:source}];}}
  if(Array.isArray(raw))return raw.map(v=>({key:String(v.key),value:asText(v.value)}));
  try {let data;try{data=json(raw);}catch{data=JSON.parse(String(raw).replace(/""/g,'"'));}if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();return Object.entries(data).map(([key,value])=>({key,value:asText(value)}));}
  catch{return [{key:'state',value:String(raw)}];}
}
export function responseUnit(dto,{windows=false}={}) {
  const unit={id:String(dto.originalUnitId||dto.unitname||''),alias:String(dto.unitname||''),laststate:lastState(dto.laststate,{windows}),logs:[],subforms:[],chunks:[]};
  let chunks=dto.responses||[];
  if(typeof chunks==='string'){try{chunks=parseJSON(chunks);}catch(error){chunks=[{id:'all-error',content:JSON.stringify({ERROR:String(chunks)}),responseType:'?',ts:0}];}}
  if(!Array.isArray(chunks))throw new Error('Antwort-Chunks müssen ein Array sein.');
  const latest=new Map(),originalForms=[];
  for(const ch of windows?chunks:[...chunks].sort((a,b)=>compareTime(a.ts,b.ts))) {
    const type=ch.responseType??ch.type??'',forms=parseChunk(ch.content,type,{windows}),variables=[];if(windows)originalForms.push(...forms);
    for(const sf of forms)for(const response of sf.responses){latest.set(windows?String(latest.size):key(sf.id,response.id),{subform:sf.id,response});variables.push(sf.id?sf.id+'##'+response.id:response.id);}
    unit.chunks.push({id:String(ch.id??''),type,ts:String(ch.ts??0),variables});
  }
  const forms=new Map();for(const {subform,response}of latest.values()){if(!forms.has(subform))forms.set(subform,[]);forms.get(subform).push(response);}
  unit.subforms=windows?originalForms:[...forms].map(([id,responses])=>({id,responses}));return unit;
}
export function splitLog(logentry) {
  let str=String(logentry??''),position=str.indexOf(' : ');if(position<0)position=str.indexOf(' = ');
  if(position<0)return {key:str,parameter:''};
  const result={key:str.slice(0,position),parameter:str.slice(position+3)};
  if(result.parameter.startsWith('"')&&result.parameter.endsWith('"')){
    // Current Testcenter reports contain JSON-encoded strings, including Unicode
    // and newline escapes. Older CSV reports used doubled quotation marks.
    try{result.parameter=JSON.parse(result.parameter);}catch{result.parameter=result.parameter.slice(1,-1).replace(/""/g,'"').replace(/\\\\/g,'\\');}
  }
  return result;
}
export function normalizePeople(input,{windows=false}={}) {
  if(!Array.isArray(input))throw new Error('Erwartet wird eine Liste von Testpersonen.');
  return input.map(p=>({group:String(p.group??''),login:String(p.login??''),code:String(p.code??''),booklets:(p.booklets||[]).map(b=>({id:String(b.id??''),firstTS:exactTime(b.firstTS),lastTS:exactTime(b.lastTS),sessions:(b.sessions||[]).map(s=>({...s,ts:exactTime(s.ts),loadCompleteMS:exactTime(s.loadCompleteMS)})),logs:(b.logs||[]).map(l=>({...l,ts:exactTime(l.ts)})),units:(b.units||[]).map(u=>({id:String(u.id??u.alias??''),alias:String(u.alias??u.id??''),laststate:lastState(u.laststate,{windows}),chunks:(u.chunks||[]).map(c=>({...c,ts:String(c.ts??0),variables:c.variables||[]})),logs:(u.logs||[]).map(l=>({...l,ts:exactTime(l.ts)})),subforms:(u.subforms||[]).map(sf=>({id:String(sf.id??''),responses:(sf.responses||[]).map(r=>({...r,id:String(r.id),value:windows&&r.value===null?null:asText(r.value),status:String(r.status||'UNSET'),code:nullableNumeric(r.code),score:nullableNumeric(r.score)}))}))}))}))}));
}
export function refreshTimes(people,{windows=false}={}) {
  for(const p of people)for(const b of p.booklets){for(const l of [...b.sessions,...b.logs,...b.units.flatMap(u=>[...u.logs,...u.chunks])]){const t=exactTime(l.ts);if(windows||t>0){b.firstTS=b.firstTS?minTime(b.firstTS,t):t;b.lastTS=maxTime(b.lastTS||0,t);}}}
  return people;
}
export function peopleFromDTO(responses=[],logs=[],{windows=false}={}) {
  const people=new Map();
  function location(d){const group=String(d.groupname??''),login=String(d.loginname??''),code=String(d.code??''),booklet=String(d.bookletname??''),pk=windows?group+login+code:key(group,login,code);if(!people.has(pk))people.set(pk,{group,login,code,booklets:[]});const p=people.get(pk);let b=p.booklets.find(b=>b.id===booklet);if(!b){b={id:booklet,sessions:[],logs:[],units:[],firstTS:0,lastTS:0};p.booklets.push(b);}return b;}
  for(const d of responses){const b=location(d),u=responseUnit(d,{windows});const old=b.units.find(v=>sameUnit(v,u));if(old&&(!windows||!old.subforms.length&&!old.laststate.length&&!old.chunks.length)){if(windows)Object.assign(old,{chunks:u.chunks,laststate:u.laststate,subforms:u.subforms});else mergeUnit(old,u);}else b.units.push(u);}
  for(const d of logs){const b=location(d),event={ts:exactTime(d.timestamp),...(windows?splitWindowsLog(d.logentry):splitLog(d.logentry))};
    if(d.unitname){let u=b.units.find(v=>v.alias===d.unitname&&(!d.originalUnitId||v.id===d.originalUnitId||v.id===v.alias));if(!u){u={id:d.originalUnitId||d.unitname,alias:d.unitname,laststate:[],chunks:[],subforms:[],logs:[]};b.units.push(u);}else if(d.originalUnitId&&u.id===u.alias)u.id=d.originalUnitId;u.logs.push(event);}
    else {b.logs.push(event);if(event.key==='LOADCOMPLETE'){let info={};try{info=JSON.parse(event.parameter.replace(/\\"/g,'"'));}catch{}b.sessions.push({ts:event.ts,loadCompleteMS:numeric(info.loadTime),browser:info.browser||[info.browserName,info.browserVersion].filter(Boolean).join(' ')||'?',os:String(info.os??info.osName??'?'),screen:info.screen||(info.screenSizeWidth?`${info.screenSizeWidth} x ${info.screenSizeHeight}`:'?')});}}
  }
  return refreshTimes([...people.values()],{windows});
}
export function importCSV(source,delimiter='auto',options={}) {
  // PersonList.AddUnitData/AddLogEntry in the native CSV dialog uses the
  // alias for both fields, even when the CSV parser reads originalUnitId.
  if(options.windows&&String(source).split(/\r\n|\n|\r/,1)[0].replace(/"/g,'').endsWith(';logentry'))return peopleFromDTO([],parseWindowsLogCSV(source,options).map(d=>({...d,originalUnitId:d.unitname})),options);
  if(options.windows&&String(source).split(/\r\n|\n|\r/,1)[0].replace(/^\uFEFF/,'').replace(/"/g,'')==='groupname;loginname;code;bookletname;unitname;responses;restorePoint;responseType;response-ts;restorePoint-ts;laststate')return peopleFromDTO(parseWindowsLegacyResponses(source),[],options);
  const table=parseCSV(source,delimiter),headers=table.shift().map(h=>h.trim().replace(/^\uFEFF/,'')),data=table.filter(r=>r.some(Boolean)).map((r,i)=>{if(r.length!==headers.length)throw new Error(`CSV-Zeile ${i+2}: ${r.length} statt ${headers.length} Felder.`);return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));});
  for(const h of ['groupname','loginname','bookletname','unitname'])if(!headers.includes(h))throw new Error(`CSV-Kopf „${h}“ fehlt.`);
  if(headers.includes('logentry'))return peopleFromDTO([],data,options);
  if(!headers.includes('responses'))throw new Error('Keine Testcenter-Antwort- oder Log-CSV.');
  if(headers.includes('responseType'))for(const d of data){try{const chunks=JSON.parse(d.responses);if(Array.isArray(chunks)&&chunks.length&&chunks.every(c=>Object.hasOwn(c,'content')))continue;}catch{}d.responses=JSON.stringify([{id:'all',content:d.responses,responseType:d.responseType,ts:d['response-ts']}]);}
  return peopleFromDTO(options.windows?data.map(d=>({...d,originalUnitId:d.unitname})):data,[],options);
}
export function mergePeople(...groups) {
  const people=new Map();
  for(const p of groups.flat()) {
    const k=key(p.group,p.login,p.code);if(!people.has(k)){people.set(k,structuredClone(p));continue;}
    const target=people.get(k);
    for(const b of p.booklets){let existing=target.booklets.find(v=>v.id===b.id);if(!existing){target.booklets.push(structuredClone(b));continue;}
      for(const field of ['logs','sessions']){const seen=new Set(existing[field].map(stable));for(const item of b[field])if(!seen.has(stable(item))){existing[field].push(structuredClone(item));seen.add(stable(item));}}
      for(const u of b.units){let unit=existing.units.find(v=>sameUnit(v,u));if(!unit){existing.units.push(structuredClone(u));continue;}mergeUnit(unit,u);}
    }
  }
  return refreshTimes([...people.values()]);
}
export async function readDataFiles(files,{encoding='utf-8',delimiter='auto',windows=false,csvTarget='output',onWarning=()=>{}}={}) {
  const batches=[];for(const f of files){const source=typeof f.text==='string'?f.text:new TextDecoder(encoding,{fatal:true}).decode(f.bytes??await f.arrayBuffer());
    if(/\.json$/i.test(f.name)){const data=parseJSON(source);if(Array.isArray(data)&&data[0]?.booklets!==undefined)batches.push(normalizePeople(data,{windows}));else if(Array.isArray(data)&&data[0]?.groupname!==undefined)batches.push(data[0].logentry!==undefined?peopleFromDTO([],data,{windows}):peopleFromDTO(data,[],{windows}));else if(Array.isArray(data)&&!data.length)batches.push([]);else throw new Error(`${f.name}: Unbekanntes JSON-Format.`);}
    else {
      const header=source.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/,1)[0].replace(/"/g,'');
      // LoadDataFromCsvPage2Result skips log files when WriteToXls is false.
      // Keep this original behaviour limited to Windows database imports.
      if(windows&&csvTarget==='database'&&['groupname;loginname;code;bookletname;unitname;timestamp;logentry','groupname;loginname;code;bookletname;unitname;originalUnitId;timestamp;logentry'].includes(header)){
        batches.push([]);onWarning(`${f.name}: Logdatei wie im Windows-SQLite-Import übersprungen.`);
      }else batches.push(importCSV(source,delimiter,{windows,onWarning:message=>onWarning(`${f.name}: ${message}`)}));
    }
  }
  if(windows){const map=new Map();for(const [index,batch]of batches.entries())for(const p of batch){const k=p.group+p.login+p.code;if(!map.has(k)){map.set(k,structuredClone(p));continue;}if(/\.json$/i.test(files[index].name)){onWarning(`${files[index].name}: Personenkennung doppelt (${k}); übrige Personen dieser Datei wie im Original übersprungen.`);break;}const target=map.get(k);for(const b of p.booklets){let old=target.booklets.find(v=>v.id===b.id);if(!old){target.booklets.push(structuredClone(b));continue;}old.logs.push(...b.logs);old.sessions.push(...b.sessions);for(const u of b.units){const unit=old.units.find(v=>v.alias===u.alias);if(unit&&!u.subforms.length&&!u.chunks.length&&!u.laststate.length)unit.logs.push(...u.logs);else if(unit&&!unit.subforms.length&&!unit.chunks.length&&!unit.laststate.length)Object.assign(unit,{chunks:u.chunks,laststate:u.laststate,subforms:u.subforms});else old.units.push(structuredClone(u));}}}return refreshTimes([...map].sort(([a],[b])=>a.localeCompare(b,'de')).map(([,p])=>p),{windows});}
  return mergePeople(...batches);
}
export function responseRecords(people,{ignoreDisplayed=false,ignoreNotReached=false}={}) {
  const records=[];for(const p of people)for(const b of p.booklets)for(const u of b.units)for(const sf of u.subforms)for(const r of sf.responses){if((ignoreDisplayed&&r.status==='DISPLAYED')||(ignoreNotReached&&r.status==='NOT_REACHED'))continue;
    const ref=sf.id?sf.id+'##'+r.id:r.id,ts=[...u.chunks].reverse().find(c=>c.variables.includes(ref))?.ts||'?';
    records.push({group:p.group,login:p.login,code:p.code,booklet:b.id,unitName:u.id,unitAlias:u.alias,responseId:r.id,responseStatus:r.status,responseValue:r.value,responseSubform:sf.id,responseCode:r.code,responseScore:r.score,ts});}
  return records;
}
export const LONG_HEADERS=['Group','Login','Code','Booklet','Unit-Name','Unit-Alias','Response-Id','Response-Status','Response-Value','Response-Subform','Response-Code','Response-Score','Response-Timestamp','Response-Timestamp-String'];
const LONG_FIELDS=['group','login','code','booklet','unitName','unitAlias','responseId','responseStatus','responseValue','responseSubform','responseCode','responseScore','ts'];
export const longTable=(people,opts)=>[LONG_HEADERS,...responseRecords(people,opts).map(r=>[...LONG_FIELDS.map(h=>r[h]),r.ts==='?'?'?':new Date(numeric(r.ts)).toISOString()])];
export const longCSV=(people,opts)=>csvString(longTable(people,opts));
const style=s=>{s.views=[{state:'frozen',xSplit:3,ySplit:1}];s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF142952'}};s.columns.forEach(c=>c.width=22);};
export async function wideWorkbook(people,{subformMode='rows',values=true,status=true,codes=true,scores=true,ignoreDisplayed=false,ignoreNotReached=false}={}) {
  if(![values,status,codes,scores].some(Boolean))throw new Error('Bitte mindestens eine Excel-Ausgabe wählen: Antworten, Status, Codes oder Scores.');
  const workbook=new Excel.Workbook(),records=responseRecords(people,{ignoreDisplayed,ignoreNotReached});
  if(!records.length)throw new Error('Keine Antworten für den Export vorhanden.');
  if(!['none','rows','columns'].includes(subformMode))throw new Error('Unbekannter Unterformular-Modus.');
  const column=r=>(r.unitAlias||r.unitName)+r.responseId+(subformMode==='columns'&&r.responseSubform?'##'+r.responseSubform:'');
  const filtered=subformMode==='none'?records.filter(r=>!r.responseSubform):records;
  const variables=[...new Set(records.map(column))].sort((a,b)=>a.localeCompare(b,'de')),rows=new Map();
  if(variables.length>16381)throw new Error('Zu viele Variablen für Excel. Bitte Unterformulare zeilenweise oder CSV verwenden.');
  for(const r of filtered){const k=key(r.group,r.login,r.code,subformMode==='rows'?r.responseSubform:'');if(!rows.has(k))rows.set(k,{id:r.group+r.login+r.code,group:r.group,subform:r.responseSubform,login:r.login+r.code+(subformMode==='rows'&&r.responseSubform?'_'+r.responseSubform:''),responses:new Map()});const row=rows.get(k),previous=row.responses.get(column(r));if(!previous||compareTime(r.ts,previous.ts)>=0)row.responses.set(column(r),r);}
  for(const [enabled,name,field]of [[values,'Antworten','responseValue'],[status,'Status','responseStatus'],[codes,'Codes','responseCode'],[scores,'Scores','responseScore']])if(enabled){const sheet=workbook.addWorksheet(name);sheet.addRow(['ID','Group','Login+Code',...variables]);for(const r of [...rows.values()].sort((a,b)=>a.id.localeCompare(b.id)||a.subform.localeCompare(b.subform)))sheet.addRow([r.id,r.group,r.login,...variables.map(v=>r.responses.has(v)?r.responses.get(v)[field]===null?'':String(r.responses.get(v)[field]):'')]);style(sheet);}
  if(!workbook.worksheets.length)throw new Error('Bitte mindestens eine Ausgabetabelle auswählen.');return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export function sessionTable(people,sizes={}) {
  const headers=['Person','Booklet','Session-No','Sessions-Total','Units-w-Value','Start-At-TS','Start-At-DT','First-Responses-After-MS','First-Responses-After-MMSS','Last-Responses-After-MS','Last-Responses-After-MMSS','Load-Speed-MBitPerSec','Browser','OS','Screen','Screen-Width','Screen-Height'];
  const mmss=ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
  const rows=[];for(const p of people){const total=p.booklets.reduce((n,b)=>n+b.sessions.length,0);for(const b of p.booklets){const sessions=[...b.sessions].map(s=>({...s,start:numeric(s.ts)-numeric(s.loadCompleteMS)})).sort((a,b)=>a.start-b.start),unitTimes=new Map();
    for(const u of b.units){if(!u.subforms.some(sf=>sf.responses.some(r=>!['DISPLAYED','UNSET','NOT_REACHED'].includes(r.status))))continue;const t=u.chunks.reduce((t,c)=>Math.max(t,numeric(c.ts)),0);if(t>0)unitTimes.set(u.alias||u.id,Math.max(t,unitTimes.get(u.alias||u.id)||0));}
    for(const [index,s]of sessions.entries()){const end=sessions[index+1]?.start??Infinity,times=[...unitTimes.values()].filter(t=>t>=s.start&&t<end).sort((a,b)=>a-b),first=times.length?times[0]-s.start:'',last=times.length?times.at(-1)-s.start:'',dims=String(s.screen||'').split(/\s*x\s*/i).map(Number),size=numeric(sizes[b.id]);rows.push([p.group+p.login+p.code,b.id,index+1,total,times.length,s.start,new Date(s.start).toISOString(),first,first===''?'':mmss(first),last,last===''?'':mmss(last),size&&s.loadCompleteMS?size*8/(s.loadCompleteMS*1000):0,s.browser,s.os,s.screen,dims.length===2?Math.max(...dims):'',dims.length===2?Math.min(...dims):'']);}
  }}
  return [headers,...rows];
}
export async function reviewsWorkbook(reviews) {
  const workbook=new Excel.Workbook(),groups=new Map();for(const r of reviews){const key=r.unitname||'Booklet_'+r.bookletname;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  const names=new Set();for(const [name,rows]of [...groups].sort(([a],[b])=>a.localeCompare(b))){let clean=String(name).replace(/[\\/*?:\[\]]/g,'_').replace(/^'|'$/g,'').slice(0,31)||'Reviews',n=1,base=clean;while(names.has(clean.toLowerCase()))clean=base.slice(0,26)+'_'+n++;names.add(clean.toLowerCase());const sheet=workbook.addWorksheet(clean);sheet.addRow(['groupname','loginname','code','priority','category','reviewtime','entry']);for(const r of rows){const category=[['design','D'],['tech','T'],['content','C']].filter(([k])=>r['category: '+k]!==null&&r['category: '+k]!==undefined).map(([,c])=>c).join(' / ');sheet.addRow([r.groupname,r.loginname,r.code,r.priority,category,r.reviewtime??r.reviewTime,r.entry]);}style(sheet);}
  if(!workbook.worksheets.length){const s=workbook.addWorksheet('Reviews');s.addRow(['Keine Reviews vorhanden']);}return new Uint8Array(await workbook.xlsx.writeBuffer());
}
