import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {DOMParser} from '@xmldom/xmldom';
import {encodeResult,decodeResult,applyResult} from '../src/coding.js';
import {windowsCodingCorpus} from '../scripts/windows-coding-corpus.mjs';
Object.assign(globalThis,{DOMParser});
const proof=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/native-combinations-20261109/coding.json.gz',import.meta.url))));
const hash=b=>createHash('sha256').update(b).digest('hex'),inputBytes=Buffer.from(proof.inputBase64,'base64'),raw=Buffer.from(proof.reportBase64,'base64'),inputs=JSON.parse(inputBytes),native=JSON.parse(raw);
assert.equal(hash(raw),proof.reportSHA256);assert.equal(hash(inputBytes),native.inputSHA256);
assert.equal(native.codingSHA256,'7b8fdb074669c5e0ba267c2e924b484a322abb32cb733bae2c659b38191d3407');assert.equal(native.commonSHA256,'4845bf183b80509f743dc87d6e5b211bd5c9757417a9ff08665278f27fda20a6');
assert.deepEqual(inputs.map(({id,job,coder,globalComment})=>({id,job,coder,globalComment})),windowsCodingCorpus({states:true}));
assert.equal(inputs.length,240);assert.equal(native.results.length,240);
test('240 original coding exports: both file directions and error decisions',()=>{
 for(const input of inputs){const found=native.results.find(c=>c.id===input.id),encode=()=>encodeResult(input.job,input.coder,input.globalComment,{windows:true});
  if(found.nativeError){assert.throws(encode);continue;}
  assert.deepEqual(decodeResult(Buffer.from(found.nativeBase64,'base64')),found.nativeModel,input.id);
  assert.deepEqual(found.browserModel,found.nativeModel,input.id+' original reads browser file');
  assert.deepEqual(decodeResult(encode()),found.nativeModel,input.id+' current browser fields');
 }
});
test('216 original CaseList constructor reopen/re-export pairs: result fields and order',()=>{
 const cases=inputs.filter(c=>c.id.startsWith('state-'));assert.equal(cases.length,216);
 for(const input of cases){const found=native.results.find(c=>c.id===input.id);assert.ok(found.reopenedNativeModel,input.id);
  assert.deepEqual(decodeResult(Buffer.from(found.reopenedNativeBase64,'base64')),found.reopenedNativeModel);
  const job=structuredClone(input.job);for(const c of job.cases){Object.assign(c,{code:'',comment:'',time:''});c.variable.codes=[{id:'0'},{id:'1'}];}
  const result=decodeResult(Buffer.from(found.nativeBase64,'base64'));assert.equal(applyResult(job,result),0);
  assert.deepEqual(decodeResult(encodeResult(job,result.coder,result.globalComment,{windows:true})),found.reopenedNativeModel,input.id);
 }
});
