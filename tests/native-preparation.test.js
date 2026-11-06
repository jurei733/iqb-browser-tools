import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {prepare} from '../src/preparation.js';
import * as T from '../src/toolbox.js';
import {loginRowsShape,loginXMLTree} from './helpers/native-logins.js';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const proof=JSON.parse((await readFile(process.env.NATIVE_PREPARATION_REFERENCE||new URL('./fixtures/native-extended-preparation-20261106.json',import.meta.url),'utf8')).replace(/^\ufeff/,''));
assert.equal(proof.hashes['itc-Toolbox.exe'],'c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1');
assert.equal(proof.culture,'de-DE');assert.ok([32,64].includes(proof.bits));assert.equal(proof.results.length,8);
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
   const {outputs}=await prepare('logins',{windows:true,file:{name:'Logins.xlsx',bytes:input(o.source+'.xlsx')},renew:o.renew,createXml:o.xml,loginOptions,xmlOptions:{booklet:'DEMO',separate:o.separate}},m=>messages.push(m));
   const xmls=files=>Object.fromEntries(Object.entries(files).filter(([name])=>name.endsWith('.xml')).map(([name,b])=>[name.replace(/_[a-z][2345679][a-z][2345679](?=\.xml)/,'_<4>'),loginXMLTree(b,{renew:o.renew,...loginOptions})]).sort(([a],[b])=>a.localeCompare(b)));
   assert.deepEqual(xmls(outputs),xmls(Object.fromEntries(capture.files.map(f=>[f.name,bytes(f)]))));
   const native=T.loginRows(await T.loadWorkbook(bytes(capture.files.find(f=>f.name==='Logins.xlsx')))),browser=T.loginRows(await T.loadWorkbook(outputs['Logins-browser.xlsx']));
   assert.deepEqual(o.renew?loginRowsShape(browser,loginOptions):browser,o.renew?loginRowsShape(native,loginOptions):native);
   const expected=[...capture.messages];expected.splice(5,0,'beendet');expected.push('beendet');
   assert.deepEqual(normalizeMessages(messages,'Logins.xlsx'),normalizeMessages(expected,'Logins.xlsx'));
  }
 });
}
