import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseChunk} from '../src/data.js';
import {parseJSON,stringifyJSON} from '../src/json.js';

// Values captured by invoking unmodified, hash-identified vendor assemblies.
// They were executed on macOS/.NET 10; this test does not claim a Windows run.
const native=JSON.parse(await readFile(new URL('./results/original-assemblies-macos.json',import.meta.url),'utf8'));
const fixtures=parseJSON(await readFile(new URL('./fixtures/reference-cases.json',import.meta.url),'utf8'));
const types={setResponsesIqbStandard:'iqb-standard@1.1',setResponsesAbi:'unknown',setResponsesDan:'IQBVisualUnitPlayerV2.1.0',setResponsesKeyValue:'keyvalue',setResponsesSimplePlayerLegacy:'iqb-simple-player@1.0.0'};
const order=forms=>forms.filter(sf=>sf.responses.length).map(sf=>({...sf,responses:[...sf.responses].sort((a,b)=>a.id.localeCompare(b.id))})).sort((a,b)=>a.id.localeCompare(b.id));
test('15 captured original assembly converter cases agree after documented corrections',()=>{
  assert.equal(fixtures.length,15);
  assert.equal(native.source_sha256['itc-ToolBox/itc-Toolbox.exe'],'c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1');
  for(const fixture of fixtures){
    const reference=native.results.find(r=>r.id===fixture.id);assert.ok(reference);assert.equal(reference.error,undefined);
    const expected=structuredClone(reference.output),actual=parseChunk(stringifyJSON(fixture.content),types[fixture.method]);
    for(const form of expected)for(const response of form.responses){
      // Intentional portability and data-retention corrections, recorded with
      // their exact source values rather than a broad comparison tolerance.
      if(['standard-primitives','aspect-primitives','dan-primitives'].includes(fixture.id)&&response.id==='number'&&response.value==='12,5')response.value='12.5';
      if(response.value===null||(fixture.id==='dan-primitives'&&response.id==='null'&&response.value===''))response.value='#null#';
      if(['standard-primitives','aspect-primitives'].includes(fixture.id)&&response.id==='lines'&&response.value==='ab\nc')response.value='a\r\nb\nc';
      if(['standard-array','standard-large-integers'].includes(fixture.id)&&/^[\[{]/.test(response.value))response.value=stringifyJSON(parseJSON(response.value));
    }
    assert.deepEqual(order(actual),order(expected),fixture.id);
  }
});
