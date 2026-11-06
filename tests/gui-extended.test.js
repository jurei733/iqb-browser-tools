import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {readCodingFiles,encodeResult,decodeResult,applyResult,codedCases,initialCaseIndex} from '../src/coding.js';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const proof=JSON.parse(await readFile(new URL('./fixtures/gui-extended-20261105.json',import.meta.url))).codingZip;
const complete=JSON.parse(await readFile(new URL('./fixtures/gui-extended-20261105.json',import.meta.url))).codingComplete;
const sha=b=>createHash('sha256').update(b).digest('hex');
const fields=r=>({...r,entries:r.entries.map(({time,...entry})=>entry)});
async function nativeCase(){
 const source=await readFile(new URL('../'+proof.input.path,import.meta.url));assert.equal(sha(source),proof.input.sha256);
 const capture=Buffer.from(proof.capture.base64,'base64');assert.equal(sha(capture),proof.capture.sha256);assert.equal(capture.length,proof.capture.bytes);
 const {jobs}=await readCodingFiles([new File([source],proof.input.name)]);assert.equal(jobs.length,1);
 return {job:jobs[0],native:decodeResult(capture)};
}
test('Native ZIP GUI capture: archive stem and XML filename remain in job and result labels',async()=>{
 const {job,native}=await nativeCase();assert.equal(job.cases.length,4);assert.equal(job.label,'01-Modern Job.xml');
 job.cases[0].code='0';
 assert.deepEqual(fields(decodeResult(encodeResult(job,'IQB'))),fields(native));
});
test('Native ZIP result import and re-export retain the original label, zero and exact timestamp',async()=>{
 const {job,native}=await nativeCase();applyResult(job,native);
 assert.deepEqual(decodeResult(encodeResult(job,'IQB',native.globalComment,{windows:true})),native);
});
test('Native complete GUI workflow: four codes, both comments, case list and final-case resume',async()=>{
 const {job}=await nativeCase();const capture=Buffer.from(complete.capture.base64,'base64');
 assert.equal(sha(capture),complete.capture.sha256);assert.equal(capture.length,complete.capture.bytes);
 const native=decodeResult(capture);
 job.cases.forEach((c,i)=>{c.code=i%2?'1':'0';});job.cases[0].comment='Notiz GUI A01';
 assert.deepEqual(fields(decodeResult(encodeResult(job,'IQB','GUI-54 global 20261105',{windows:true}))),fields(native));
 assert.deepEqual(codedCases(job).map(({c,i})=>({number:i+1,variable:c.variable.id,code:c.code,comment:c.comment||''})),complete.observedList);
 applyResult(job,native);assert.equal(initialCaseIndex(job),complete.restartCase-1);
 assert.deepEqual(decodeResult(encodeResult(job,'IQB',native.globalComment,{windows:true})),native);
});

const booklet=JSON.parse(await readFile(new URL('./fixtures/gui-extended-20261105.json',import.meta.url))).toolboxBooklet;
const xmlTree=el=>({name:el.nodeName,attrs:Object.fromEntries(Array.from(el.attributes).filter(a=>!(el.nodeName==='Testlet'&&a.name==='label'&&a.value==='')).map(a=>[a.name,a.value]).sort()),content:Array.from(el.childNodes).some(c=>c.nodeType===1)?Array.from(el.childNodes).filter(c=>c.nodeType===1).map(xmlTree):el.textContent});
test('Native Booklet GUI and Texteditor: XML and complete phased messages match',async()=>{
 const {prepare}=await import('../src/preparation.js');const {messageText,windowsTextBytes}=await import('../src/diagnostics.js');
 const source=await readFile(new URL('../'+booklet.input.path,import.meta.url));assert.equal(sha(source),booklet.input.sha256);
 const nativeXML=Buffer.from(booklet.xml.base64,'base64'),nativeMessages=Buffer.from(booklet.messages.base64,'base64');
 for(const [bytes,capture]of[[nativeXML,booklet.xml],[nativeMessages,booklet.messages]]){assert.equal(sha(bytes),capture.sha256);assert.equal(bytes.length,capture.bytes);}
 const messages=[];const {outputs}=await prepare('booklets',{windows:true,file:{name:booklet.nativeInputPath,bytes:source}},m=>messages.push(m));
 assert.deepEqual(Object.keys(outputs),[booklet.outputName]);
 const tree=bytes=>xmlTree(new DOMParser().parseFromString(new TextDecoder().decode(bytes),'text/xml').documentElement);
 assert.deepEqual(tree(outputs[booklet.outputName]),tree(nativeXML));
 assert.equal(messageText(messages),nativeMessages.toString('utf16le').replace(/^\ufeff/,''));
 assert.deepEqual(Buffer.from(windowsTextBytes(messageText(messages))),nativeMessages);
});

const logins=JSON.parse(await readFile(new URL('./fixtures/gui-extended-20261105.json',import.meta.url))).toolboxLogins;
test('Native Login GUI: minimum length, mixed prefixes, zero passwords, edited workbook and single XML',async()=>{
 const T=await import('../src/toolbox.js');const {prepare}=await import('../src/preparation.js');const {messageText}=await import('../src/diagnostics.js');const {loginRowsShape,loginXMLTree}=await import('./helpers/native-logins.js');
 const bytes=Buffer.from(logins.input.base64,'base64');for(const capture of [logins.input,logins.xml,logins.workbook,logins.messages]){const raw=Buffer.from(capture.base64,'base64');assert.equal(sha(raw),capture.sha256);assert.equal(raw.length,capture.bytes);}
 const args={windows:true,file:{name:logins.input.name,bytes},renew:true,createXml:true,loginOptions:logins.options,xmlOptions:{booklet:logins.booklet,separate:logins.separate}};
 await assert.rejects(prepare('logins',{...args,loginOptions:{...logins.options,length:logins.guiMinimum.input}}),{message:logins.guiMinimum.error});
 const messages=[];const {outputs}=await prepare('logins',args,m=>messages.push(m));assert.deepEqual(Object.keys(outputs),['L6.xml','Logins-browser.xlsx']);
 assert.deepEqual(loginXMLTree(outputs['L6.xml'],{renew:true,...logins.options}),loginXMLTree(Buffer.from(logins.xml.base64,'base64'),{renew:true,...logins.options}));
 const browserWorkbook=await T.loadWorkbook(outputs['Logins-browser.xlsx']),nativeWorkbook=await T.loadWorkbook(Buffer.from(logins.workbook.base64,'base64'));
 assert.deepEqual(loginRowsShape(T.loginRows(browserWorkbook),logins.options),loginRowsShape(T.loginRows(nativeWorkbook),logins.options));
 const nativeMessages=Buffer.from(logins.messages.base64,'base64').toString('utf16le').replace(/^\ufeff/,'').split(logins.nativeInputPath).join(logins.input.name);assert.equal(messageText(messages),nativeMessages);
 const extended=await prepare('logins',{...args,windows:false});const xml=new DOMParser().parseFromString(new TextDecoder().decode(extended.outputs['Testtaker.xml']),'text/xml');assert.ok(Array.from(xml.getElementsByTagName('Login')).every(e=>e.getAttribute('mode')));
});
