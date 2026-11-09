import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import initSqlJs from 'sql.js';
import {OutputDatabase} from '../src/database.js';
import {wideWorkbook} from '../src/data.js';
import {loadWorkbook} from '../src/toolbox.js';
import {workbookCells} from '../scripts/testcenter-study.mjs';
const root=new URL('./fixtures/gui-matrix-20261109/',import.meta.url);
const proof=JSON.parse(await readFile(new URL('proof.json',root)));
const sha=b=>createHash('sha256').update(b).digest('hex');
test('retained original GUI Excel files cover all 45 nonempty choices and match every cell',async()=>{
 const input=await readFile(new URL('../'+proof.input,import.meta.url));assert.equal(sha(input),proof.inputSHA256);
 const wanted=new Set(['none','rows','columns'].flatMap(mode=>Array.from({length:15},(_,i)=>mode+String(i+1).padStart(2,'0'))));
 assert.equal(proof.cases.length,45);assert.deepEqual(new Set(proof.cases.map(c=>c.id)),wanted);
 const db=new OutputDatabase(await initSqlJs(),input);
 try{for(const c of proof.cases){const native=await readFile(new URL(c.file,root));assert.equal(sha(native),c.sha256,c.id);
  assert.deepEqual(workbookCells(await loadWorkbook(await wideWorkbook(db.people(),c.options))),workbookCells(await loadWorkbook(native)),c.id);
 }}finally{db.close();}
});
test('native Excel GUI for a database without codings or subforms: available selection matches all cells',async()=>{
 const c=proof.stateObservations.plainDatabase,input=await readFile(new URL(c.input,root)),native=await readFile(new URL(c.native,root));
 assert.equal(sha(input),c.inputSHA256);assert.equal(sha(native),c.nativeSHA256);
 const db=new OutputDatabase(await initSqlJs(),input);
 try{assert.equal(db.metadata().has_codes,'False');assert.equal(db.metadata().has_subforms,'False');
  assert.deepEqual(workbookCells(await loadWorkbook(await wideWorkbook(db.people(),c.options))),workbookCells(await loadWorkbook(native)));
 }finally{db.close();}
});

import {DOMParser} from '@xmldom/xmldom';
import {readCodingFiles,decodeResult,encodeResult,applyResult} from '../src/coding.js';
globalThis.DOMParser=DOMParser;
test('direct GUI coding inputs and group results retain their hashes and all original saved fields',async()=>{
 const c=proof.coding,g=c.group;
 for(const f of [...c.cases,{input:g.input,sha256:g.inputSHA256}])assert.equal(sha(await readFile(new URL(f.input,root))),f.sha256);
 for(const phase of ['invalid','valid']){
  const bytes=await readFile(new URL(g[phase].native,root));assert.equal(sha(bytes),g[phase].sha256);
  const native=decodeResult(bytes),input=await readFile(new URL(g.input,root)),loaded=await readCodingFiles([{name:g.input,arrayBuffer:async()=>input}]);
  const job=loaded.jobs[0];applyResult(job,native);assert.deepEqual(decodeResult(encodeResult(job,native.coder,native.globalComment,{windows:true})),native);
 }
});
