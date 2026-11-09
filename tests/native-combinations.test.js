import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {wideWorkbook,responseRecords} from '../src/data.js';
import {loadWorkbook} from '../src/toolbox.js';
import {workbookCells,modelHash} from '../scripts/testcenter-study.mjs';
const proof=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/native-combinations-20261109/excel.json.gz',import.meta.url))));
const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=Buffer.from(proof.inputBase64,'base64');
assert.equal(sha(bytes),proof.inputSHA256);assert.equal(proof.originalSHA256,'c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1');
const people=JSON.parse(bytes),shape=async bytes=>workbookCells(await loadWorkbook(bytes)).map(s=>({name:s.name,rows:s.rows,columns:s.columns,sha256:modelHash(s.values)}));
const ids=[];for(const source of ['memory','sqlite'])for(const mode of ['none','rows','columns'])for(let mask=1;mask<16;mask++)ids.push(`${source}-${mode}-${mask}`);
assert.deepEqual(proof.cases.map(c=>c.id),ids);assert.deepEqual([...new Set(responseRecords(people).map(r=>r.responseSubform))].sort(),['','A','B']);
test('90 original Excel source/field/subform combinations: every sheet and cell',async()=>{
 for(const c of proof.cases){const native=Buffer.from(c.base64,'base64');assert.equal(sha(native),c.sha256);
  const options={subformMode:c.subformMode,...Object.fromEntries(['values','status','codes','scores'].map((name,i)=>[name,!!(c.mask&(1<<i))]))};
  assert.deepEqual(await shape(await wideWorkbook(people,options)),await shape(native),c.id);
 }
});
