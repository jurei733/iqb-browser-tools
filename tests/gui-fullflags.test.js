import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DOMParser} from '@xmldom/xmldom';
import {readCodingFiles} from '../src/coding.js';
globalThis.DOMParser=DOMParser;
const root=new URL('./fixtures/gui-fullflags-20261109/',import.meta.url),proof=JSON.parse(await readFile(new URL('proof.json',root))),sha=b=>createHash('sha256').update(b).digest('hex');
test('32 direct native GUI flag captures cover the complete five-boolean product and match loaded initial controls',async()=>{
 assert.equal(proof.cases.length,32);assert.deepEqual(proof.cases.map(c=>c.id),Array.from({length:32},(_,i)=>'G'+String(i).padStart(2,'0')));
 for(const [i,c]of proof.cases.entries()){
  const bytes=await readFile(new URL(c.input,root));assert.equal(sha(bytes),c.sha256);assert.equal(sha(await readFile(new URL('../docs/evidence/gui-fullflags-20261109/'+c.screenshot,import.meta.url))),c.screenshotSHA256);
  const {jobs:[job]}=await readCodingFiles([{name:c.input,arrayBuffer:async()=>bytes}]);assert.equal(job.cases.length,c.observed.total);
  for(const [bit,key]of proof.dimensions.entries()){assert.equal(c[key],!!(i&(1<<bit)));assert.equal(job.settings[key],c[key]);}
  assert.equal(job.cases[0].variable.id,c.observed.selectedVariable);assert.equal(job.settings.enableComments,c.observed.commentField);assert.equal(!job.settings.suppressDescription,c.observed.instructionVisible);
  if(c.observed.scoreValues)assert.deepEqual(job.cases[0].variable.codes.map(v=>Number(v.score)),c.observed.scoreValues);
 }
});
