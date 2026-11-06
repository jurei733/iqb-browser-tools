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
