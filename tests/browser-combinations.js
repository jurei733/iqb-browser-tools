import {gunzipSync,strFromU8} from 'fflate';
import * as T from '../src/toolbox.js';
import * as C from '../src/coding.js';
// Retained fresh Windows outputs, executed in every real browser engine.
export function registerNativeCombinations({check,get,assert,canonical,sha256,task}){
 const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 const packed=async name=>{const raw=await get('/fixtures/native-combinations-20261109/'+name+'.json.gz');return JSON.parse(strFromU8(raw[0]===31&&raw[1]===139?gunzipSync(raw):raw).replace(/^\ufeff/,''));};
 const code=(value,length,prefix=false)=>{const m=prefix?value.match(/^(T\d{2}_|RS_|RV_|TL_)?(.*)$/):['','',value];assert(m,'invalid prefix');assert(new RegExp('^'+Array.from({length},(_,i)=>`[${i%2?T.NUMBERS:T.LETTERS}]`).join('')+'$').test(m[2]),'invalid generated code');return (m[1]||'')+`<${length}>`;};
 const group=value=>{const m=value.match(/^(.*)_([^_]+)$/);if(!m)return value;code(m[2],4);return m[1]+'_<4>';};
 const xml=(raw,options={})=>{
  const root=new DOMParser().parseFromString(new TextDecoder().decode(raw),'text/xml').documentElement;
  const tree=el=>({name:el.nodeName,attrs:Object.fromEntries(Array.from(el.attributes).filter(a=>!(el.nodeName==='Testlet'&&a.name==='label'&&!a.value)).map(a=>{let v=a.value;if(options.renew){if(el.nodeName==='Login'&&a.name==='name')v=code(v,options.length,true);if(el.nodeName==='Login'&&a.name==='pw')v=code(v,options.passwordLength);if(el.nodeName==='Group'&&a.name==='id')v=group(v);}return [a.name,v];}).sort()),content:Array.from(el.childNodes).some(c=>c.nodeType===1)?Array.from(el.childNodes).filter(c=>c.nodeType===1).map(tree):el.textContent});return tree(root);
 };
 const xmls=(files,options)=>Object.fromEntries(Object.entries(files).filter(([n])=>n.endsWith('.xml')).map(([n,b])=>[n.replace(/_[a-z][2345679][a-z][2345679](?=\.xml)/,'_<4>'),xml(b,options)]).sort(([a],[b])=>a.localeCompare(b)));
 const messages=(list,file)=>list.map(m=>m.replace(/^Lese Datei .*$/,'Lese Datei '+file).replace(/_(?:[a-z][2345679]){2}(?=\.xml)/g,'_<4>'));
 const rows=async raw=>T.loginRows(await T.loadWorkbook(raw));
 const rowShape=(rows,options)=>{assert(new Set(rows.map(r=>r.name)).size===rows.length,'duplicate generated name');return rows.map(r=>({...r,name:code(r.name,options.length,true),password:options.passwordLength?code(r.password,options.passwordLength):r.password,group:group(r.group)}));};
 check('Neue Windows-Matrix: 334 Vorbereitungen inklusive 128 gespeicherter Login-Dateien erneut öffnen',async()=>{
  const proof=await packed('preparation');assert(proof.results.length===334);assert(proof.hashes['itc-Toolbox.exe']==='c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1');
  const input=n=>bytes(proof.inputFiles.find(f=>f.name===n).base64);
  for(const c of proof.results){
   const progress=[],native=Object.fromEntries(c.files.map(f=>[f.name,bytes(f.base64)]));
   if(!c.options){let result,error;try{result=await task('prepare',{kind:'booklets',windows:true,file:{name:c.id+'.xlsx',bytes:input(c.id+'.xlsx')}},m=>progress.push(m));}catch(e){error=e;}
    const expected=Object.keys(native).filter(n=>n.endsWith('.xml'));assert(!!error===(expected.length===0),c.id+' error outcome');if(result)assert(canonical(xmls(result.outputs))===canonical(xmls(native)),c.id+' XML');
    assert(canonical(messages(progress,c.id+'.xlsx'))===canonical([...messages(c.messages,c.id+'.xlsx'),'beendet']),c.id+' messages');
   }else{
    const o=c.options,options={length:o.length,passwordLength:o.password,monitor:o.monitor,prefixTestee:o.testee,prefixReserve:o.reserve,prefixReview:o.review},args={kind:'logins',windows:true,file:{name:'Logins.xlsx',bytes:bytes(c.inputFiles.find(f=>f.name==='Logins.xlsx').base64)},renew:o.renew,createXml:o.xml,loginOptions:options,xmlOptions:{booklet:'DEMO',separate:o.separate}};
    const {outputs}=await task('prepare',args,m=>progress.push(m));assert(canonical(xmls(outputs,{renew:o.renew,...options}))===canonical(xmls(native,{renew:o.renew,...options})),c.id+' XML');
    const browserRows=await rows(outputs['Logins-browser.xlsx']),nativeRows=await rows(native['Logins.xlsx']);assert(canonical(o.renew?rowShape(browserRows,options):browserRows)===canonical(o.renew?rowShape(nativeRows,options):nativeRows),c.id+' rows');
    const expected=[...c.messages];expected.splice(5,0,'beendet');expected.push('beendet');assert(canonical(messages(progress,'Logins.xlsx'))===canonical(messages(expected,'Logins.xlsx')),c.id+' messages');
    if(o.reopenOf){const again=await task('prepare',{...args,file:{name:'Logins.xlsx',bytes:outputs['Logins-browser.xlsx']},renew:false});assert(canonical(await rows(again.outputs['Logins-browser.xlsx']))===canonical(browserRows),c.id+' browser reopen rows');assert(canonical(xmls(again.outputs))===canonical(xmls(outputs)),c.id+' browser reopen XML');}
   }
  }
 });
 check('Neue Windows-Matrix: 90 Excel-Kombinationen aus Browser-Speicher und erneut geöffneter SQLite-Datei',async()=>{
  const proof=await packed('excel'),input=bytes(proof.inputBase64);assert(await sha256(input)===proof.inputSHA256);assert(proof.cases.length===90);
  const people=JSON.parse(strFromU8(input)),shape=async raw=>(await T.loadWorkbook(raw)).worksheets.map(s=>({name:s.name,columns:s.columnCount,rows:Array.from({length:s.rowCount},(_,i)=>Array.from({length:s.columnCount},(_,j)=>s.getCell(i+1,j+1).text))}));
  await task('set-data',{people});await task('new-db');await task('db-import',{windows:'64'});const saved=await task('db-save',{format:'windows'});await task('open-db',{bytes:saved});
  for(const c of proof.cases){const native=bytes(c.base64);assert(await sha256(native)===c.sha256,c.id+' capture hash');const options={subformMode:c.subformMode,...Object.fromEntries(['values','status','codes','scores'].map((n,i)=>[n,!!(c.mask&(1<<i))]))};const actual=await task(c.source==='sqlite'?'db-export':'export-data',{format:'xlsx',options});assert(canonical(await shape(actual))===canonical(await shape(native)),c.id+' all cells');}
 });
 check('Neue Windows-Matrix: 216 Kodierzustände und Original-Konstruktor-Wiederöffnung in nativer Browser-XML',async()=>{
  const proof=await packed('coding'),input=bytes(proof.inputBase64),raw=bytes(proof.reportBase64),native=JSON.parse(strFromU8(raw));assert(await sha256(raw)===proof.reportSHA256);assert(await sha256(input)===native.inputSHA256);
  const cases=JSON.parse(strFromU8(input)).filter(c=>c.id.startsWith('state-'));assert(cases.length===216);
  for(const c of cases){const n=native.results.find(n=>n.id===c.id);assert(canonical(C.decodeResult(C.encodeResult(c.job,c.coder,c.globalComment,{windows:true})))===canonical(n.nativeModel),c.id+' export');const job=structuredClone(c.job);for(const item of job.cases){Object.assign(item,{code:'',comment:'',time:''});item.variable.codes=[{id:'0'},{id:'1'}];}const result=C.decodeResult(bytes(n.nativeBase64));C.applyResult(job,result);assert(canonical(C.decodeResult(C.encodeResult(job,result.coder,result.globalComment,{windows:true})))===canonical(n.reopenedNativeModel),c.id+' original constructor reopen');}
 });
}
