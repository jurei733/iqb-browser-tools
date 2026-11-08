import initSqlJs from 'sql.js';
import wasmURL from 'sql.js/dist/sql-wasm.wasm?url';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {windowsLongCSV,windowsSessionCSV} from './windows-compatibility.js';
import {windowsTestcenterGUI,windowsGUIJSON} from './windows-testcenter-gui.js';
import {prepare} from './preparation.js';
import {OutputDatabase} from './database.js';
import {databasePage} from './database-view.js';
import {readDataFiles,normalizePeople,wideWorkbook,longCSV,sessionTable,reviewsWorkbook,peopleFromDTO} from './data.js';
import {readCodingFiles} from './coding.js';
import {stringifyJSON} from './json.js';
import {strToU8,zipSync} from 'fflate';
import {tableWorkbook,csvString} from './toolbox.js';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
let SQL,db,people=[];
async function run(op,args,progress) {
  switch(op){
    case 'prepare':return prepare(args.kind,args,progress);
    case 'coding':return readCodingFiles(args.files.map(f=>({name:f.name,webkitRelativePath:f.relativePath||'',arrayBuffer:async()=>f.bytes.buffer.slice(f.bytes.byteOffset,f.bytes.byteOffset+f.bytes.byteLength)})));
    case 'load-data':people=await readDataFiles(args.files,{...args.options,onWarning:progress});return {people:people.length,responses:people.reduce((n,p)=>n+p.booklets.reduce((n,b)=>n+b.units.reduce((n,u)=>n+u.subforms.reduce((n,s)=>n+s.responses.length,0),0),0),0)};
    case 'dto':people=(args.nativeGUI&&args.windows?windowsTestcenterGUI:peopleFromDTO)(args.responses,args.logs,{windows:args.windows==='64'?'64':args.windows===true});return {people:people.length};
    case 'set-data':people=normalizePeople(args.people);return {people:people.length};
    case 'export-data':return exportData(args.format,people,args.options,args.sizes);
    case 'reviews':return reviewsWorkbook(args.reviews);
    case 'open-db':case 'new-db':{SQL??=await initSqlJs({locateFile:()=>wasmURL});const next=new OutputDatabase(SQL,op==='open-db'?args.bytes:null,args.creator);db?.close();db=next;return db.summary();}
    case 'db-summary':return requireDB().summary();
    case 'db-page':return databasePage(requireDB().people(args.group||null),args);
    case 'db-import':{const windows=args.windows==='64'?'64':args.windows===true;const data=args.files?await readDataFiles(args.files,{...args.options,windows,csvTarget:'database',onWarning:progress}):args.people?normalizePeople(args.people,{windows}):people;return requireDB().import(data,{merge:args.merge!==false,windows});}
    case 'db-sizes':return requireDB().setSizes(args.sizes);
    case 'db-check':return requireDB().check();
    case 'db-save':return args.format==='windows'?requireDB().exportWindows():args.format==='coding-box'?requireDB().exportCodingBox({allowCodingChanges:args.allowCodingChanges}):args.format==='browser'?requireDB().exportBrowser():requireDB().export();
    case 'db-version':if(requireDB().setVersion)return db.setVersion(args.version);return db.summary();
    case 'db-export':return exportData(args.format,requireDB().people(args.group??null),args.options,db.sizes());
    default:throw new Error('Unbekannter Arbeitsauftrag.');
  }
}
function requireDB(){if(!db)throw new Error('Bitte zuerst eine Datenbank öffnen oder anlegen.');return db;}
async function exportData(format,data,options={},sizes={}) {
  if(format==='xlsx')return wideWorkbook(data,options);
  if(format==='windows-long')return strToU8('\ufeff'+windowsLongCSV(data,options));
  if(format==='windows-sessions')return strToU8('\ufeff'+windowsSessionCSV(data,sizes));
  if(format==='long')return strToU8(longCSV(data,options));
  if(format==='sessions')return strToU8(csvString(sessionTable(data,sizes)));
  if(format==='session-xlsx')return tableWorkbook(sessionTable(data,sizes),'Sitzungen');
  if(format==='json')return strToU8(options.windowsGUI?windowsGUIJSON(data):stringifyJSON(data,null,2));
  if(format==='json-groups'){const groups=new Map();for(const p of data){if(!groups.has(p.group))groups.set(p.group,[]);groups.get(p.group).push(p);}const entries={};if(options.windowsGUI)entries['booklets.json']=strToU8(stringifyJSON(options.bookletSizes||{},null,2).replace(/\n/g,'\r\n'));for(const [g,list]of groups){const name=g.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')||'Gruppe';let target=name+'.json',i=1;while(entries[target])target=name+'_'+i+++'.json';entries[target]=strToU8(options.windowsGUI?windowsGUIJSON(list):stringifyJSON(list,null,2));}return zipSync(entries);}
  throw new Error('Unbekanntes Exportformat.');
}
let queue=Promise.resolve();
self.onmessage=({data:{id,op,args}})=>{queue=queue.then(async()=>{try{const result=await run(op,args||{},progress=>self.postMessage({id,progress}));self.postMessage({id,result},result instanceof Uint8Array?[result.buffer]:[]);}catch(error){self.postMessage({id,error:error.message,messages:error.messages});}});};
