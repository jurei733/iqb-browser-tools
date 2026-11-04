import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import initSqlJs from 'sql.js';
import {readCodingFiles,applyResult,decodeResult,encodeResult,initialCaseIndex} from '../src/coding.js';
import {OutputDatabase} from '../src/database.js';
import {wideWorkbook} from '../src/data.js';
import {loadWorkbook} from '../src/toolbox.js';
import {workbookCells} from '../scripts/testcenter-study.mjs';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const reference=JSON.parse(await readFile(new URL('./fixtures/gui-reference-20261104.json',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function input(section){const bytes=await readFile(new URL('../'+section.input.path,import.meta.url));assert.equal(sha(bytes),section.input.sha256);return bytes;}
function capture(section){const bytes=Buffer.from(section.capture.base64,'base64');assert.equal(sha(bytes),section.capture.sha256);assert.equal(bytes.length,section.capture.bytes);return bytes;}

test('Windows coding GUI capture: zero, comment, restart position and every result timestamp roundtrip',async()=>{
 const source=await input(reference.coding),{jobs}=await readCodingFiles([new File([source],'modern.zip')]);
 const job=jobs[0],native=decodeResult(capture(reference.coding));
 assert.equal(job.cases.length,4);assert.equal(native.coder,'IQB');
 assert.equal(decodeResult(encodeResult(job,'IQB')).label,native.label);
 assert.deepEqual(native.entries.map(({testee,variable,code,comment})=>({testee,variable,code,comment})),[
  {testee:'001',variable:'A01',code:'0',comment:'gui probe'},
  {testee:'001',variable:'A02',code:'1',comment:''}
 ]);
 assert.equal(applyResult(job,native),0);assert.equal(initialCaseIndex(job),2);
 assert.deepEqual(decodeResult(encodeResult(job,native.coder,native.globalComment,{windows:true})),native);
});

test('Windows Toolbox GUI capture: SQLite-to-Excel matches every sheet, row and cell text',async()=>{
 const SQL=await initSqlJs(),db=new OutputDatabase(SQL,await input(reference.toolbox));
 try{
  const native=workbookCells(await loadWorkbook(capture(reference.toolbox)));
  const browser=workbookCells(await loadWorkbook(await wideWorkbook(db.people(),reference.toolbox.options)));
  assert.deepEqual(browser,native);assert.equal(native.length,1);
  assert.equal(native[0].name,'Antworten');assert.equal(native[0].rows,4);
  assert.equal(native[0].values.flat().length,20);
 }finally{db.close();}
});
