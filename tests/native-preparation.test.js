import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {prepare} from '../src/preparation.js';
import * as T from '../src/toolbox.js';
import {loginRowsShape,loginXMLTree} from './helpers/native-logins.js';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const packed=process.env.NATIVE_PREPARATION_REFERENCE?null:await readFile(new URL('./fixtures/native-combinations-20261109/preparation.json.gz',import.meta.url));
const raw=packed?gunzipSync(packed):await readFile(process.env.NATIVE_PREPARATION_REFERENCE);
if(packed){const source=JSON.parse(await readFile(new URL('./fixtures/native-combinations-20261109/preparation-source.json',import.meta.url)));assert.equal(createHash('sha256').update(packed).digest('hex'),source.archiveSHA256);assert.equal(createHash('sha256').update(raw).digest('hex'),source.rawSHA256);}
const proof=JSON.parse(raw.toString('utf8').replace(/^\ufeff/,''));
assert.equal(proof.hashes['itc-Toolbox.exe'],'c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1');
assert.equal(proof.culture,'de-DE');assert.ok([32,64].includes(proof.bits));assert.equal(proof.results.length,proof.matrix?(proof.bookletMatrix?334:270):14);
if(proof.bookletMatrix){
 assert.equal(proof.bookletMatrix.cases.length,64);
 assert.deepEqual(proof.bookletMatrix.cases.map(c=>c.id),Array.from({length:64},(_,mask)=>'Booklet-errors-'+String(mask).padStart(2,'0')));
 assert.equal(proof.results.filter(c=>c.id.startsWith('Booklet-errors-')).length,64);
}
if(proof.matrix){
 assert.equal(proof.matrix.cases.length,128);
 const expected=[];for(const length of [5,8])for(const password of [0,4])for(const monitor of [false,true])for(const separate of [false,true])for(let prefix=0;prefix<8;prefix++)expected.push(`matrix-${length}-${password}-${+monitor}-${+separate}-${prefix}`);
 assert.deepEqual(proof.matrix.cases.map(c=>c.id),expected);
 for(const c of proof.matrix.cases){const [,length,password,monitor,separate,prefix]=c.id.split('-').map((v,i)=>i?Number(v):v);assert.deepEqual(c,{id:c.id,source:'Logins-wide',renew:true,xml:true,length,password,monitor:!!monitor,separate:!!separate,testee:!!(prefix&1),reserve:!!(prefix&2),review:!!(prefix&4)});assert.deepEqual(proof.results.find(r=>r.id===c.id).options,c);}

 assert.deepEqual(proof.results.filter(c=>c.options?.reopenOf).map(c=>c.options.reopenOf),expected);
}
function bytes(capture){const raw=Buffer.from(capture.base64,'base64');assert.equal(raw.length,capture.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),capture.sha256);return raw;}
const input=name=>bytes(proof.inputFiles.find(f=>f.name===name));
const xmlTree=el=>({name:el.nodeName,attrs:Object.fromEntries(Array.from(el.attributes).filter(a=>!(el.nodeName==='Testlet'&&a.name==='label'&&a.value==='')).map(a=>[a.name,a.value]).sort()),content:Array.from(el.childNodes).some(c=>c.nodeType===1)?Array.from(el.childNodes).filter(c=>c.nodeType===1).map(xmlTree):el.textContent});
const tree=b=>xmlTree(new DOMParser().parseFromString(new TextDecoder().decode(b),'text/xml').documentElement);
const normalizeMessages=(messages,file)=>messages.map(m=>m.replace(/^Lese Datei .*$/,'Lese Datei '+file).replace(/_(?:[a-z][2345679]){2}(?=\.xml)/g,'_<4>'));
for(const capture of proof.results){
 test(`Native preparation workers: ${capture.id}`,async()=>{
  assert.equal(capture.error,null);for(const file of capture.files)bytes(file);
  const messages=[];
  if(!capture.options){
   const source=input(capture.id+'.xlsx'),nativeXML=capture.files.filter(f=>f.name.endsWith('.xml'));
   const task=prepare('booklets',{windows:true,file:{name:capture.id+'.xlsx',bytes:source}},m=>messages.push(m));
   if(!nativeXML.length)await assert.rejects(task);else{const {outputs}=await task;assert.deepEqual(Object.keys(outputs),nativeXML.map(f=>f.name));for(const file of nativeXML)assert.deepEqual(tree(outputs[file.name]),tree(bytes(file)));}
   assert.deepEqual(normalizeMessages(messages,capture.id+'.xlsx'),[...normalizeMessages(capture.messages,capture.id+'.xlsx'),'beendet']);
  }else{
   const o=capture.options,loginOptions={length:o.length,passwordLength:o.password,monitor:o.monitor,prefixTestee:o.testee,prefixReserve:o.reserve,prefixReview:o.review};
   const {outputs}=await prepare('logins',{windows:true,file:{name:'Logins.xlsx',bytes:capture.inputFiles?bytes(capture.inputFiles.find(f=>f.name==='Logins.xlsx')):input(o.source+'.xlsx')},renew:o.renew,createXml:o.xml,loginOptions,xmlOptions:{booklet:'DEMO',separate:o.separate}},m=>messages.push(m));
   const xmls=files=>Object.fromEntries(Object.entries(files).filter(([name])=>name.endsWith('.xml')).map(([name,b])=>[name.replace(/_[a-z][2345679][a-z][2345679](?=\.xml)/,'_<4>'),loginXMLTree(b,{renew:o.renew,...loginOptions})]).sort(([a],[b])=>a.localeCompare(b)));
   assert.deepEqual(xmls(outputs),xmls(Object.fromEntries(capture.files.map(f=>[f.name,bytes(f)]))));
   const native=T.loginRows(await T.loadWorkbook(bytes(capture.files.find(f=>f.name==='Logins.xlsx')))),browser=T.loginRows(await T.loadWorkbook(outputs['Logins-browser.xlsx']));
   assert.deepEqual(o.renew?loginRowsShape(browser,loginOptions):browser,o.renew?loginRowsShape(native,loginOptions):native);
   if(o.reopenOf){
    const parent=proof.results.find(c=>c.id===o.reopenOf),saved=parent.files.find(f=>f.name==='Logins.xlsx');
    assert.equal(capture.inputFiles.find(f=>f.name==='Logins.xlsx').sha256,saved.sha256,'reopen consumes the actual saved native workbook');
    assert.deepEqual(native,T.loginRows(await T.loadWorkbook(bytes(saved))),'native reopen preserves every login');
    const roundtrip=await prepare('logins',{windows:true,file:{name:'Logins.xlsx',bytes:outputs['Logins-browser.xlsx']},renew:false,createXml:o.xml,loginOptions,xmlOptions:{booklet:'DEMO',separate:o.separate}});
    assert.deepEqual(T.loginRows(await T.loadWorkbook(roundtrip.outputs['Logins-browser.xlsx'])),browser,'browser save/reopen preserves every login');
    assert.deepEqual(xmls(roundtrip.outputs),xmls(outputs));
   }
   const expected=[...capture.messages];expected.splice(5,0,'beendet');expected.push('beendet');
   assert.deepEqual(normalizeMessages(messages,'Logins.xlsx'),normalizeMessages(expected,'Logins.xlsx'));
  }
 });
}
