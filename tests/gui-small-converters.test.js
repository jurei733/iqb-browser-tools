import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {prepare} from '../src/preparation.js';import {smallConvertersRoot,smallConverterFiles,normalizedCodeWorkbook,converterWorkbookCells} from './helpers/gui-small-converters.js';
const proof=JSON.parse(await readFile(new URL('proof.json',smallConvertersRoot)));
for(const c of proof.cases)test(`native converter GUI ${c.id}: export or qualified crash`,async()=>{
 const files=await smallConverterFiles(c),args={windows:true,file:c.input?{name:c.input,bytes:files['inputs/'+c.input]}:null};
 if(c.kind==='native-crash'){await assert.rejects(prepare('csv',args),{message:c.browserMessage});return;}
 const result=await prepare(c.kind==='codes'?'codes':'csv',args),name=c.kind==='codes'?'Codes.xlsx':c.id+'.xlsx';
 if(c.kind==='codes')assert.deepEqual(await normalizedCodeWorkbook(result.outputs[name]),await normalizedCodeWorkbook(files['native/'+c.file]));
 else assert.deepEqual(await converterWorkbookCells(result.outputs[name]),await converterWorkbookCells(files['native/'+c.file]));
});
test('small-converter evidence binds every input, output, partial file and native capture',async()=>{
 assert.equal(proof.cases.length,35);for(const c of proof.cases){const files=await smallConverterFiles(c);for(const path of [...(c.input?['inputs/'+c.input]:[]),...(c.file?['native/'+c.file]:[]),...(c.partialFile?['native/'+c.partialFile]:[]),...c.screens])assert.equal(createHash('sha256').update(files[path]).digest('hex'),proof.files[path],path+' SHA256');}
});
test('extended CSV retains quoted newlines, unquoted fields and explicit Windows-1252 decoding',async()=>{
 for(const [id,encoding,expected]of [['SC02','utf-8','Zeile A\nZeile B'],['SC03','utf-8','Grüße'],['SC08','windows-1252','Grüße & Süd']]){
  const c=proof.cases.find(c=>c.id===id),files=await smallConverterFiles(c),result=await prepare('csv',{windows:false,encoding,file:{name:c.input,bytes:files['inputs/'+c.input]}}),workbook=await converterWorkbookCells(result.outputs[id+'.xlsx']);assert.ok(JSON.stringify(workbook).includes(JSON.stringify(expected).slice(1,-1)));
 }
});
