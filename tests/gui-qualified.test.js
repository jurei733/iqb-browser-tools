import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DOMParser} from '@xmldom/xmldom';
import {unzipSync} from 'fflate';
import {readCodingFiles,decodeResult,encodeResult} from '../src/coding.js';
globalThis.DOMParser=DOMParser;
const proof=JSON.parse(await readFile(new URL('./fixtures/gui-qualified-20261109.json',import.meta.url)));
const withoutTimes=r=>({...r,entries:r.entries.map(({time,...e})=>e)});
test('Native training true/false GUI pair: flag import, case order, all result values and comment',async()=>{
 const results=[],inputs=[];
 for(const variant of proof.training.variants){
  const bytes=await readFile(new URL('../'+variant.input,import.meta.url));inputs.push(unzipSync(bytes));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.inputSHA256);
  const nativeBytes=await readFile(new URL('../'+variant.nativeResult,import.meta.url));
  assert.equal(createHash('sha256').update(nativeBytes).digest('hex'),variant.nativeResultSHA256);
  const job=(await readCodingFiles(Object.entries(unzipSync(bytes)).map(([name,body])=>({name:name.split('/').at(-1),arrayBuffer:async()=>body})))).jobs[0];
  assert.equal(job.settings.training,variant.training);assert.equal(job.cases.length,4);
  job.cases.forEach((c,i)=>{c.code=proof.training.codes[i];c.comment=i?'':proof.training.firstComment;});
  const expected=withoutTimes(decodeResult(nativeBytes));
  assert.deepEqual(withoutTimes(decodeResult(encodeResult(job,'IQB','',{windows:true}))),expected);results.push(expected);
 }
 assert.deepEqual(results[0],results[1]);
 for(const [name,bytes] of Object.entries(inputs[0]))assert.deepEqual(name==='Job.xml'?Buffer.from(bytes).toString().replace('training="False"','training="True"'):bytes,name==='Job.xml'?Buffer.from(inputs[1][name]).toString():inputs[1][name],name);
});
