import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeEdges} from '../scripts/analyze-windows-edges.mjs';
import {parseWindowsJSON,generalDouble} from '../src/windows-tokens.js';
const report=await analyzeEdges();
test('Windows boundary evidence binds inputs, assembly hashes and both process architectures',()=>{
 assert.equal(report.summary.converterInputs,118);assert.equal(report.nativeMetadata.process32.bits,32);assert.equal(report.nativeMetadata.process64.bits,64);
 assert.equal(report.completeEquivalence,false);assert.equal(report.realProductionDataTested,false);assert.equal(report.captures.length,4);
});
for(const category of ['number-lexeme','date-token','property-order','nested-token-types','metadata-validation'])test('Windows 64-bit reference profile: '+category,()=>{
 const checks=report.converters.filter(c=>c.category===category);assert.ok(checks.length);assert.deepEqual(checks.filter(c=>!c.process64.passed),[]);
});
test('Historical ARM/x86 counterexamples stay visible instead of being counted as equivalent',()=>{
 assert.deepEqual(report.summary.windows32,{passed:112,different:6});
 assert.equal(report.summary.runtimeDifferences,6);
 assert.deepEqual(report.converters.filter(c=>!c.process32.passed).map(c=>c.id),['setResponsesIqbStandard-lexeme-5','setResponsesDan-lexeme-5','setResponsesKeyValue-lexeme-5','setResponsesSimplePlayerLegacy-lexeme-5','standard-nested-types','dan-nested-types']);
});
test('Original CodingResults codec reads current browser exports and browser reads native exports',()=>{
 assert.deepEqual(report.summary.coding,{cases:24,bidirectional:22,errorDetection:2});assert.deepEqual(report.codec.filter(c=>!c.passed),[]);
});
test('Windows JSON parser rejects malformed input without accepting a partial AST',()=>{
 for(const source of ['{"v":1} trailing','{"v":}','[1,,2]'])assert.throws(()=>parseWindowsJSON(source));
 assert.equal(generalDouble(Number.MAX_VALUE),'1.79769313486232E+308');
});
