import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';import {loadWorkbook,loginRows} from '../src/toolbox.js';import {loginDocx} from '../src/docx.js';
import {nativeDocxShape} from './helpers/native-docx.js';import {wordProductsRoot,wordProductFiles} from './helpers/gui-word-products.js';
Object.assign(globalThis,{DOMParser,XMLSerializer});const proof=JSON.parse(await readFile(new URL('proof.json',wordProductsRoot)));
for(const c of proof.cases)test(`native Word GUI ${c.id}: document, QR or qualified failure`,async()=>{
 const files=await wordProductFiles(c),workbook=await loadWorkbook(files['inputs/'+c.input]);
 if(c.kind==='empty-input'){assert.equal(loginRows(workbook,{windows:true,stopAtMissingGroup:true}).length,0);return;}
 if(c.kind==='invalid-template'){assert.deepEqual(files['native/'+c.file],files['inputs/'+c.template]);await assert.rejects(loginDocx(workbook,files['inputs/'+c.template],'https://tc.example.test',{windows:true}),{message:'Die Vorlage ist keine gültige DOCX-Datei.'});return;}
 if(c.invalidServer)await assert.rejects(loginDocx(workbook,files['inputs/'+c.template],'https://'+c.invalidServer,{windows:true}),{message:c.errorMessage});
 const result=await loginDocx(workbook,files['inputs/'+c.template],c.server,{windows:true,qrCentimeters:4});assert.equal(result.count,c.count);assert.deepEqual(nativeDocxShape(result.files['Logins.docx']),nativeDocxShape(files['native/'+c.file]));
});
test('Word native product binds all transferred inputs, original outputs and GUI captures',async()=>{
 assert.equal(proof.cases.length,17);for(const c of proof.cases){const files=await wordProductFiles(c);for(const path of ['inputs/'+c.input,...(c.template?['inputs/'+c.template]:[]),...(c.file?['native/'+c.file]:[]),...c.screens])assert.equal(createHash('sha256').update(files[path]).digest('hex'),proof.files[path],path+' SHA256');}
});
test('Word extended mode retains its validation and original input modes',async()=>{
 const c=proof.cases.find(c=>c.id==='W00'),files=await wordProductFiles(c),workbook=await loadWorkbook(files['inputs/'+c.input]);
 const result=await loginDocx(workbook,files['inputs/'+c.template],c.server),shape=nativeDocxShape(result.files['Logins.docx']);assert.ok(JSON.stringify(shape).includes('run-hot-return'));
 for(const id of ['W10','W11']){const other=proof.cases.find(c=>c.id===id),data=await wordProductFiles(other);await assert.rejects(loginDocx(workbook,data['inputs/'+other.template],other.server));}
});
