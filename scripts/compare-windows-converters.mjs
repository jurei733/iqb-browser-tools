import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as D from '../src/data.js';
import {parseJSON,stringifyJSON} from '../src/json.js';
const input=JSON.parse(await readFile(new URL('../tests/fixtures/reference-cases.json',import.meta.url),'utf8'));
const exactInput=parseJSON(await readFile(new URL('../tests/fixtures/reference-cases.json',import.meta.url),'utf8'));
const native=JSON.parse((await readFile(process.argv[2],'utf8')).replace(/^\uFEFF/,''));
const types={setResponsesIqbStandard:'iqb-standard@1.1',setResponsesAbi:'unknown',setResponsesDan:'IQBVisualUnitPlayerV2.1.0',setResponsesKeyValue:'keyvalue',setResponsesSimplePlayerLegacy:'iqb-simple-player@1.0.0'};
const report={platform:native.platform,runtime:native.runtime,checks:[],comparison:"Strict field values and array order in the explicit Windows conversion mode; no value normalization"};
for(const test of exactInput){
 try{
  const original=native.results.find(r=>r.id===test.id);if(original.error)throw new Error(original.error);
  let expected=original.outputJSON?JSON.parse(original.outputJSON):structuredClone(original.output);
  expected=Array.isArray(expected)?expected:[expected];
  const actual=D.parseChunk(stringifyJSON(test.content),types[test.method],{windows:true});
  assert.deepEqual(actual,expected);report.checks.push({name:test.id,passed:true});
 }catch(e){report.checks.push({name:test.id,passed:false,error:e.message});}
}
report.passed=report.checks.filter(c=>c.passed).length;report.total=report.checks.length;
await writeFile(process.argv[3],JSON.stringify(report,null,2));
console.log(report.passed+'/'+report.total,'converter comparisons passed');for(const c of report.checks)if(!c.passed)console.log(c.name,c.error);
if(report.passed!==report.total)process.exitCode=1;
