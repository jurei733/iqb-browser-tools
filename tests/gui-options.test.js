import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import initSqlJs from 'sql.js';
import {OutputDatabase} from '../src/database.js';
import {wideWorkbook} from '../src/data.js';
import {loadWorkbook} from '../src/toolbox.js';
import {workbookCells} from '../scripts/testcenter-study.mjs';
const root=new URL('./fixtures/gui-options-20261109/',import.meta.url),proof=JSON.parse(await readFile(new URL('proof.json',root)));
const sha=b=>createHash('sha256').update(b).digest('hex');
test('actual Windows Excel dialog: empty selection rejects; three recovered/reopened option combinations match all cells',async()=>{
 const input=await readFile(new URL('../'+proof.input,import.meta.url));assert.equal(sha(input),proof.inputSHA256);
 const db=new OutputDatabase(await initSqlJs(),input);
 try{
  const people=db.people();
  await assert.rejects(wideWorkbook(people,{values:false,status:false,codes:false,scores:false}),e=>e.message===proof.emptySelection.message);
  for(const c of proof.cases){const native=await readFile(new URL(c.file,root));assert.equal(sha(native),c.sha256);
   assert.deepEqual(workbookCells(await loadWorkbook(await wideWorkbook(people,c.options))),workbookCells(await loadWorkbook(native)),c.id);
  }
 }finally{db.close();}
});

import {DOMParser} from '@xmldom/xmldom';
import {readCodingFiles,applyResult,decodeResult,encodeResult,initialCaseIndex,codedCases} from '../src/coding.js';
globalThis.DOMParser=DOMParser;
for(const c of proof.coding.cases)test('actual Windows coding GUI: '+c.id+' load, F3 and saved result including header and timestamps',async()=>{
 const jobBytes=await readFile(new URL(c.input,root)),saved=await readFile(new URL(c.result,root)),nativeBytes=await readFile(new URL(c.native,root));
 assert.equal(sha(jobBytes),c.inputSHA256);assert.equal(sha(saved),c.resultSHA256);assert.equal(sha(nativeBytes),c.nativeSHA256);
 const {jobs}=await readCodingFiles([new File([jobBytes],'Job.zip')]),job=jobs[0],imported=decodeResult(saved),native=decodeResult(nativeBytes);
 applyResult(job,imported);assert.equal(job.cases.length,c.caseCount);assert.equal(initialCaseIndex(job)+1,c.selectedCase);
 assert.deepEqual(codedCases(job).map(({c,i})=>({number:i+1,variable:c.variable.id,code:c.code||'',comment:c.comment||''})),c.list);
 assert.deepEqual(decodeResult(encodeResult(job,native.coder,imported.globalComment,{windows:true})),native);
 // The regular Browser export deliberately preserves the imported label.
 assert.equal(decodeResult(encodeResult(job,native.coder,imported.globalComment)).label,imported.label);
});
test('irregular native crash fixture remains recoverable without losing the three codes',async()=>{
 const crash=proof.coding.originalCrash,bytes=await readFile(new URL(crash.result,root));assert.equal(sha(bytes),crash.resultSHA256);
 const {jobs}=await readCodingFiles([new File([await readFile(new URL(crash.input,root))],'Job.zip')]),job=jobs[0];applyResult(job,decodeResult(bytes));
 assert.equal(job.cases.length,6);assert.equal(initialCaseIndex(job),1);assert.equal(job.cases.filter(c=>c.code==='0').length,3);
 assert.equal(decodeResult(encodeResult(job,'IQB','',{windows:true})).entries.length,3);
});
