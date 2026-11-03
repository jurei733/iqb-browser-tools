import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import assert from 'node:assert/strict';
import {converterCorpus,converterTypes,pipelineCorpus} from './converter-corpus.mjs';
import {parseChunk,responseUnit} from '../src/data.js';
export const nativePath=new URL('../tests/fixtures/windows-differential/native-converters.json',import.meta.url);
export function verifyCorpus(native){
 const cases=converterCorpus(),pipelines=pipelineCorpus(),hash=text=>createHash('sha256').update(text).digest('hex');
 assert.equal(native.inputSHA256,hash(JSON.stringify(cases)),'Changed corpus; capture the original Windows program again');
 assert.equal(native.pipelineInputSHA256,hash(JSON.stringify(pipelines)),'Changed API cases; capture the original Windows program again');
 assert.equal(native.assemblySHA256,'c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1');
 assert.equal(native.culture,'de-DE');assert.equal(native.results.length,cases.length);assert.equal(new Set(cases.map(c=>JSON.stringify([c.method,c.contentJSON]))).size,cases.length);
 return {cases,pipelines};
}
export function nativeOutcome(result){
 if(result.exceptionType)return {kind:'exception',rejected:true};
 const value=JSON.parse(result.outputJSON);return {kind:value.some(sf=>sf.responses.some(r=>r.status==='ERROR'))?'error-response':'value',rejected:value.some(sf=>sf.responses.some(r=>r.status==='ERROR')),value};
}
export const nativeUnit=output=>({id:output.unitId,alias:output.unitname,laststate:output.laststate,logs:[],subforms:output.subforms,chunks:output.chunks});
export function analyze(native){
 const {cases,pipelines}=verifyCorpus(native),checks=[],counterexamples=[];
 for(const test of cases){
  const original=native.results.find(r=>r.id===test.id);assert.ok(original,'Missing native case '+test.id);const expected=nativeOutcome(original);let actual,rejected=false,error='',browserOutcome='value';
  try{actual=parseChunk(test.contentJSON,converterTypes[test.method],{windows:true});rejected=actual.some(sf=>sf.responses.some(r=>r.status==='ERROR'));if(rejected)browserOutcome='error-response';}catch(e){rejected=true;browserOutcome='exception';error=e.message;}
  const enhanced=parseChunk(test.contentJSON,converterTypes[test.method]);
  if(!expected.rejected&&!isDeepStrictEqual(enhanced,expected.value)&&counterexamples.length<8)counterexamples.push({id:test.id,input:test.contentJSON,native:expected.value,enhanced});
  checks.push({id:test.id,method:test.method,category:test.category,nativeOutcome:expected.kind,browserOutcome,proof:expected.rejected?'error-handling-category-only':'strict-value-and-order',passed:expected.rejected?rejected&&browserOutcome===expected.kind:!rejected&&isDeepStrictEqual(actual,expected.value),enhancedModeIdentical:!expected.rejected&&isDeepStrictEqual(enhanced,expected.value),...(expected.rejected?{nativeError:original.exceptionType||expected.value[0]?.responses?.[0]?.value,browserError:error}:{}),...(!expected.rejected&&!isDeepStrictEqual(actual,expected.value)?{expected:expected.value,actual}:{})});
 }
 const api=pipelines.map(test=>{const original=native.pipelineResults.find(r=>r.id===test.id);assert.ok(original&&!original.exceptionType);return {id:test.id,proof:'strict-values-and-order-with-documented-field-mapping',passed:isDeepStrictEqual(responseUnit(test.dto,{windows:true}),nativeUnit(JSON.parse(original.outputJSON)))};});
 const valid=checks.filter(c=>c.proof==='strict-value-and-order'),rejections=checks.filter(c=>c.proof==='error-handling-category-only');
 return {generatedAt:new Date().toISOString(),nativeFinished:native.finished,nativePlatform:native.platform,nativeRuntime:native.runtime,culture:native.culture,assemblySHA256:native.assemblySHA256,inputSHA256:native.inputSHA256,pipelineInputSHA256:native.pipelineInputSHA256,completeEquivalence:false,realProductionDataTested:false,normalizationApplied:false,summary:{distinctConverterInputs:checks.length,strictValues:{passed:valid.filter(c=>c.passed).length,total:valid.length},errorHandling:{passed:rejections.filter(c=>c.passed).length,total:rejections.length,sameRepresentation:rejections.filter(c=>c.nativeOutcome===c.browserOutcome).length,identicalErrorMessagesProven:false},apiUnits:{passed:api.filter(c=>c.passed).length,total:api.length},enhancedMode:{strictlyIdentical:valid.filter(c=>c.enhancedModeIdentical).length,different:valid.filter(c=>!c.enhancedModeIdentical).length}},limitations:['No universal equivalence claim: a finite corpus is not all possible inputs.','Error cases prove error detection and the ERROR-record versus exception outcome; .NET exception classes, message text and GUI presentation are not identical.','Exact converter comparison preserves field values, types and list order; JSON object-key serialization order is not compared.','Native API field mapping: unitId→id and unitname→alias; browser-only empty logs field added. No response-value normalization.','German de-DE culture and the captured Windows/.NET versions only.','No production or anonymized study data supplied.','Enhanced mode intentionally preserves values and differs from Windows. Use explicit Windows conversion mode for this corpus.','Original GUI, all network failure paths, all file sizes and real domain accounts are not exhaustively tested.'],counterexamples,checks,api};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const native=JSON.parse(await readFile(nativePath,'utf8')),report=analyze(native),output=process.argv[2]||'work/windows-differential.json';await mkdir(new URL('../work/',import.meta.url),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));if([...report.checks,...report.api].some(c=>!c.passed))process.exitCode=1;}
