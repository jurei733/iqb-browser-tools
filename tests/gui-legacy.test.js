import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMParser} from '@xmldom/xmldom';
import {readCodingFiles,decodeResult,applyResult} from '../src/coding.js';
globalThis.DOMParser=DOMParser;
test('native loose legacy jobs preserve NTFS case order, prefixes, packages and separate scan sources',async()=>{
 const names=['legacy.xml','A/B-1_ABCD001.png','A/B-1_ABCD002.png','B/B-1_WXYZ001.png','B/B-1_WXYZ002.png'];
 const files=await Promise.all(names.reverse().map(async name=>{const bytes=await readFile(new URL('./fixtures/gui-final-20261109/legacy-valid/'+name,import.meta.url));return {name:name.split('/').at(-1),webkitRelativePath:'legacy-valid/'+name,arrayBuffer:async()=>bytes};}));
 const {jobs}=await readCodingFiles(files);
 assert.deepEqual(jobs.map(j=>[j.label,j.cases.length]),[['legacy A B',4],['legacy B',2]]);
 assert.deepEqual(jobs[0].cases.map(c=>[c.testee,c.variable.id]),[['001','A'],['001','B'],['002','A'],['002','B']]);
 assert.deepEqual(jobs[1].cases.map(c=>[c.testee,c.variable.id]),[['001','B'],['002','B']]);
 assert.ok(jobs[0].cases.every(c=>c.pages.every(p=>p.path.includes('/A/'))));
 assert.ok(jobs[1].cases.every(c=>c.pages.every(p=>p.path.includes('/B/'))));
 const proof=JSON.parse(await readFile(new URL('./fixtures/gui-legacy-20261109.json',import.meta.url)));const result=decodeResult(Buffer.from(proof.legacy.nativeResult.base64,'base64'));
 for(const job of jobs)applyResult(job,result);
 assert.deepEqual(jobs[0].cases.map(c=>[c.code,c.comment]),[['1','zeta'],['0','alpha'],['1','beta'],['0','gamma']]);
 assert.deepEqual(jobs[1].cases.map(c=>[c.code,c.comment]),[['0','alpha'],['0','gamma']]);
 for(const job of jobs){assert.equal(job.settings.personPrefix,true);assert.equal(job.settings.showScore,true);assert.equal(job.settings.enableComments,true);}
});
