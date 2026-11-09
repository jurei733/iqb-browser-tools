import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepare} from '../src/preparation.js';
test('native GUI Continue with neither login generation nor XML leaves the existing input unchanged without an error',async()=>{
 const bytes=await readFile(new URL('./fixtures/gui-login-next-20261109/existing.xlsx',import.meta.url)),before=Buffer.from(bytes),messages=[];
 const result=await prepare('logins',{windows:true,file:{name:'N0.xlsx',bytes},renew:false,createXml:false},m=>messages.push(m));
 assert.equal(result.noOperation,true);assert.deepEqual(result.outputs,{});assert.equal(messages.at(-1),'beendet');assert.deepEqual(bytes,before);
});

import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {loadWorkbook,loginRows} from '../src/toolbox.js';
import {loginRowsShape,loginXMLTree} from './helpers/native-logins.js';
import {workbookCells} from '../scripts/testcenter-study.mjs';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const fixture=new URL('./fixtures/gui-login-next-20261109/',import.meta.url);
for(const [id,separate,booklet] of [['N1',true,'Booklet1'],['N2',false,'Booklet1'],['N3',false,'']])test(`original GUI ${id}: existing logins, XML grouping and booklet text match every byte`,async()=>{
 const bytes=await readFile(new URL('existing.xlsx',fixture)),result=await prepare('logins',{windows:true,file:{name:id+'.xlsx',bytes},renew:false,createXml:true,xmlOptions:{separate,booklet}});
 const files=separate?['DEMO.xml','TESTS_v4f2.xml','TESTS2_v4f2.xml']:[id+'.xml'];
 assert.deepEqual(Object.keys(result.outputs).filter(n=>n.endsWith('.xml')),files);
 for(const file of files)assert.deepEqual(Buffer.from(result.outputs[file]),await readFile(new URL(id+'/'+file,fixture)),file);
 assert.deepEqual(workbookCells(await loadWorkbook(result.outputs['Logins-browser.xlsx'])),workbookCells(await loadWorkbook(await readFile(new URL(id+'/'+id+'.xlsx',fixture)))));
});
test('original GUI N4: short login validation recovers with all prefixes, proctor and negative password length',async()=>{
 const bytes=await readFile(new URL('existing.xlsx',fixture));const args={windows:true,file:{name:'N4.xlsx',bytes},renew:true,createXml:true,loginOptions:{length:4,passwordLength:-1,monitor:true,prefixTestee:true,prefixReserve:true,prefixReview:true},xmlOptions:{separate:false,booklet:''}};
 await assert.rejects(prepare('logins',args),{message:'Die Länge des Benutzernamens muss mindestens 5 sein.'});
 args.loginOptions.length=5;const result=await prepare('logins',args),options={length:5,passwordLength:0};
 const native=await readFile(new URL('N4/N4.xlsx',fixture));
 assert.deepEqual(loginRowsShape(loginRows(await loadWorkbook(result.outputs['Logins-browser.xlsx'])),options),loginRowsShape(loginRows(await loadWorkbook(native)),options));
 assert.deepEqual(loginXMLTree(result.outputs['N4.xml'],{renew:true,...options}),loginXMLTree(await readFile(new URL('N4/N4.xml',fixture)),{renew:true,...options}));
});

import {createHash} from 'node:crypto';
test('native login GUI evidence binds the unchanged source, exported files and retained screenshots by SHA-256',async()=>{
 const p=JSON.parse(await readFile(new URL('proof.json',fixture))),sha=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(sha(await readFile(new URL(p.input,fixture))),p.inputSHA256);assert.equal(p.noOperation.afterSHA256,p.inputSHA256);
 for(const c of p.exports)for(const f of c.files)assert.equal(sha(await readFile(new URL(f.file,fixture))),f.sha256);
 for(const c of p.screenshots)assert.equal(sha(await readFile(new URL('../docs/evidence/gui-login-next-20261109/'+c.file,import.meta.url))),c.sha256);
});
