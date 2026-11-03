import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {gunzipSync} from 'fflate';
import {windowsEdgeCorpus} from './windows-edge-corpus.mjs';
import {windowsCodingCorpus} from './windows-coding-corpus.mjs';
import {converterTypes} from './converter-corpus.mjs';
import {nativeOutcome} from './analyze-windows-differential.mjs';
import {parseChunk} from '../src/data.js';
import {encodeResult,decodeResult} from '../src/coding.js';
const directory=new URL('../tests/fixtures/windows-edge/',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function analyzeEdges(){
 globalThis.DOMParser??=DOMParser;
 const applicationFiles={};for(const name of (await readdir(new URL('../src/',import.meta.url))).sort())applicationFiles['src/'+name]=hash(await readFile(new URL('../src/'+name,import.meta.url)));
 const files=await Promise.all(['native-32.json','native-64.json','native-coding.json','coding-inputs.json'].map(name=>readFile(new URL(name,directory))));
 const [native32,native64,coding,inputs]=files.map(bytes=>JSON.parse(bytes)),cases=windowsEdgeCorpus(),caseHash=hash(JSON.stringify(cases));
 assert.equal(new Set(cases.map(c=>JSON.stringify([c.method,c.contentJSON]))).size,cases.length);
 for(const [native,bits]of [[native32,32],[native64,64]]){
  assert.equal(native.inputSHA256,caseHash);assert.equal(native.processBits,bits);assert.equal(native.timezone,'W. Europe Standard Time');assert.equal(native.culture,'de-DE');
  assert.equal(native.assemblySHA256,'c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1');assert.equal(native.results.length,cases.length);
 }
 assert.equal(coding.inputSHA256,hash(files[3]));assert.equal(coding.results.length,inputs.length);
 assert.equal(coding.codingSHA256,'7b8fdb074669c5e0ba267c2e924b484a322abb32cb733bae2c659b38191d3407');
 assert.equal(coding.commonSHA256,'4845bf183b80509f743dc87d6e5b211bd5c9757417a9ff08665278f27fda20a6');
 assert.equal(coding.processBits,32);
 assert.deepEqual(inputs.map(({id,job,coder,globalComment})=>({id,job,coder,globalComment})),windowsCodingCorpus());
 function compare(original,fixture){
  const expected=nativeOutcome(original);let value,kind='value';
  try{value=parseChunk(fixture.contentJSON,converterTypes[fixture.method],{windows:true});if(value.some(sf=>sf.responses.some(r=>r.status==='ERROR')))kind='error-response';}catch{kind='exception';}
  return {passed:expected.kind===kind&&(expected.rejected||isDeepStrictEqual(value,expected.value)),nativeOutcome:expected.kind,browserOutcome:kind,...(!expected.rejected?{expected:expected.value,actual:value}:{})};
 }
 const converters=cases.map(fixture=>{
  const x86=native32.results.find(r=>r.id===fixture.id),x64=native64.results.find(r=>r.id===fixture.id);assert.ok(x86&&x64);
  return {id:fixture.id,category:fixture.category,process32:compare(x86,fixture),process64:compare(x64,fixture),runtimesIdentical:isDeepStrictEqual(nativeOutcome(x86),nativeOutcome(x64))};
 });
 const codec=coding.results.map(original=>{
  const fixture=inputs.find(c=>c.id===original.id);assert.ok(fixture);let current,rejected=false;
  try{current=encodeResult(fixture.job,fixture.coder,fixture.globalComment,{windows:true});}catch{rejected=true;}
  if(original.nativeError)return {id:original.id,proof:'error-detection-only',passed:rejected,nativeError:original.nativeError.exceptionType};
  assert.ok(!rejected&&fixture.browserBase64);
  const sameXML=isDeepStrictEqual(gunzipSync(current),gunzipSync(Buffer.from(fixture.browserBase64,'base64')));
  const nativeToBrowser=isDeepStrictEqual(decodeResult(Buffer.from(original.nativeBase64,'base64')),original.nativeModel);
  const browserToNative=isDeepStrictEqual(original.browserModel,original.nativeModel);
  return {id:original.id,proof:'bidirectional-model-equality',passed:sameXML&&nativeToBrowser&&browserToNative,currentExportMatchesCapturedXML:sameXML,nativeToBrowser,browserToNative};
 });
 return {applicationFiles,generatedAt:new Date().toISOString(),completeEquivalence:false,realProductionDataTested:false,summary:{converterInputs:cases.length,windows64:{passed:converters.filter(c=>c.process64.passed).length,values:converters.filter(c=>c.process64.nativeOutcome==='value').length,errors:converters.filter(c=>c.process64.nativeOutcome!=='value').length},windows32:{passed:converters.filter(c=>c.process32.passed).length,different:converters.filter(c=>!c.process32.passed).length},runtimeDifferences:converters.filter(c=>!c.runtimesIdentical).length,coding:{cases:codec.length,bidirectional:codec.filter(c=>c.proof==='bidirectional-model-equality'&&c.passed).length,errorDetection:codec.filter(c=>c.proof==='error-detection-only'&&c.passed).length}},captures:['native-32.json','native-64.json','native-coding.json','coding-inputs.json'].map((file,i)=>({file,sha256:hash(files[i])})),nativeMetadata:{process32:{bits:native32.processBits,architecture:native32.processArchitecture,runtime:native32.runtime,finished:native32.finished},process64:{bits:native64.processBits,architecture:native64.processArchitecture,runtime:native64.runtime,finished:native64.finished},coding:{bits:coding.processBits,architecture:coding.processArchitecture,codingSHA256:coding.codingSHA256,commonSHA256:coding.commonSHA256,finished:coding.finished}},limitations:['Synthetic boundary inputs only; connected IQB workspaces are pilots or simulations, not empirical study data.','The unchanged Toolbox assembly produces six different numeric outputs in the captured 32-bit and 64-bit Windows processes. Browser Windows mode targets the captured 64-bit conversion profile, de-DE, Europe/Berlin. This is not proof of every Windows architecture or of the complete original GUI.','Error identity, .NET exception classes and messages are not established.','Coding compares decoded field values and entry order, not compressed bytes or XML indentation. Current browser XML is byte-bound to the browser exports read by Windows.','Coding serializer fields are initialized by reflection; scan loading and GUI interaction are outside this serializer test.','The native input JSON reader replaces isolated UTF-16 surrogates with U+FFFD; no claim about impossible malformed Unicode strings in original UI memory.'],converters,codec};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const report=await analyzeEdges();await writeFile(process.argv[2]||'work/windows-edges.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));if(report.converters.some(c=>!c.process64.passed)||report.codec.some(c=>!c.passed))process.exitCode=1;}
