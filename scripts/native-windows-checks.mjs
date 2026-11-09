import {verifyNumericProbes} from './verify-numeric-probes.mjs';
import {gunzipSync} from 'fflate';
import {nativeConverterCorpus,nativePipelineCases} from './windows-native-corpus.mjs';
import {converterTypes} from './converter-corpus.mjs';
import {windowsCodingCorpus} from './windows-coding-corpus.mjs';
import {parseChunk,responseUnit} from '../src/data.js';
import {encodeResult,decodeResult,applyResult} from '../src/coding.js';
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item);
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const same=(a,b)=>canonical(a)===canonical(b);
const ensure=(condition,message)=>{if(!condition)throw new Error(message);};
const hash=async input=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',input))).map(n=>n.toString(16).padStart(2,'0')).join('');
const outcome=result=>{
 if(result.exceptionType)return {kind:'exception'};
 const value=JSON.parse(result.outputJSON);return {kind:value.some(sf=>sf.responses.some(r=>r.status==='ERROR'))?'error-response':'value',value};
};
export async function verifyNativeWindows(bundle,codingInputBytes){
 const captures={};for(const name of ['native-32','native-64','native-coding']){ensure(bundle.rawCaptures[name],'Missing '+name);const raw=bytes(bundle.rawCaptures[name]);ensure(await hash(raw)===bundle.captureHashes[name],'Changed raw capture '+name);captures[name]=JSON.parse(new TextDecoder().decode(raw));}
 const inputs=nativeConverterCorpus(),pipelines=nativePipelineCases(),inputHash=await hash(new TextEncoder().encode(JSON.stringify(inputs))),pipelineHash=await hash(new TextEncoder().encode(JSON.stringify(pipelines)));
 ensure(inputHash===bundle.inputsSHA256,'Native input corpus changed');
 if(captures['native-32'].numericProbes){const rawNumeric=bytes(bundle.rawCaptures['numeric-inputs']||'');ensure(await hash(rawNumeric)===bundle.captureHashes['numeric-inputs']&&await hash(rawNumeric)===captures['native-32'].numericInputSHA256,'Changed raw numeric inputs');}
 const checks=[],api=[],numericChecks=[];
 for(const bits of [32,64]){
  const native=captures['native-'+bits];ensure(native.nativeMachine==='8664'&&native.processBits===bits,'Expected native x64 host / '+bits+'-bit process');ensure(native.inputSHA256===inputHash&&native.pipelineInputSHA256===pipelineHash,'Native capture input hash mismatch');ensure(native.timezone==='W. Europe Standard Time'&&native.culture==='de-DE','Reference locale changed');ensure(native.assemblySHA256==='c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1','Changed Toolbox original');ensure(native.results.length===inputs.length,'Missing native inputs');numericChecks.push(...await verifyNumericProbes(native,bits));
  for(const input of inputs){
   const found=native.results.find(r=>r.id===input.id);ensure(found,'Missing native result '+input.id);const expected=outcome(found);let actual,kind='value';
   try{actual=parseChunk(input.contentJSON,converterTypes[input.method],{windows:bits===64?'64':true});if(actual.some(sf=>sf.responses.some(r=>r.status==='ERROR')))kind='error-response';}catch{kind='exception';}
   const passed=kind===expected.kind&&(kind!=='value'||same(actual,expected.value));checks.push({id:input.id,bits,sources:input.sources,proof:kind==='value'&&expected.kind==='value'?'exact-values-and-list-order':'error-outcome-only',passed,...(!passed?{input:input.contentJSON,expected,actual,kind}:{})});
  }
  ensure(native.pipelineResults.length===pipelines.length,'Missing API cases');
  for(const input of pipelines){const found=native.pipelineResults.find(r=>r.id===input.id);ensure(found&&!found.exceptionType,'Missing native API output '+input.id);const original=JSON.parse(found.outputJSON),expected={id:original.unitId,alias:original.unitname,laststate:original.laststate,logs:[],subforms:original.subforms,chunks:original.chunks},actual=responseUnit(input.dto,{windows:bits===64?'64':true});api.push({id:input.id,bits,passed:same(actual,expected),...(!same(actual,expected)?{expected,actual}:{})});}
 }
 const nativeCodec=captures['native-coding'],codecInputs=JSON.parse(new TextDecoder().decode(codingInputBytes));
 ensure(await hash(codingInputBytes)===nativeCodec.inputSHA256,'Coding inputs changed');ensure(same(codecInputs.map(({id,job,coder,globalComment})=>({id,job,coder,globalComment})),windowsCodingCorpus({states:codecInputs.some(input=>input.id.startsWith('state-'))})),'Coding corpus changed');
 ensure(nativeCodec.codingSHA256==='7b8fdb074669c5e0ba267c2e924b484a322abb32cb733bae2c659b38191d3407'&&nativeCodec.commonSHA256==='4845bf183b80509f743dc87d6e5b211bd5c9757417a9ff08665278f27fda20a6','Changed CodingResults originals');ensure(nativeCodec.results.length===codecInputs.length,'Missing codec cases');
 const codec=codecInputs.map(input=>{const found=nativeCodec.results.find(r=>r.id===input.id);ensure(found,'Missing codec output');let exported,rejected=false;try{exported=encodeResult(input.job,input.coder,input.globalComment,{windows:true});}catch{rejected=true;}
  if(found.nativeError)return {id:input.id,proof:'error-detection-only',passed:rejected};
  const nativeToBrowser=same(decodeResult(bytes(found.nativeBase64)),found.nativeModel),browserToNative=same(found.browserModel,found.nativeModel),currentXML=!rejected&&same(gunzipSync(exported),gunzipSync(bytes(input.browserBase64)));
  let reopened=true;if(input.id.startsWith('state-')){
   ensure(found.reopenedNativeModel,'Missing original save/reopen capture '+input.id+': '+JSON.stringify(found.reopenError));
   const job=structuredClone(input.job);job.cases.forEach(c=>{Object.assign(c,{code:'',comment:'',time:''});c.variable.codes=[{id:'0'},{id:'1'}];});
   const original=decodeResult(bytes(found.nativeBase64));applyResult(job,original);
   reopened=same(decodeResult(encodeResult(job,original.coder,original.globalComment,{windows:true})),found.reopenedNativeModel);
  }
  return {id:input.id,proof:'bidirectional-field-values-and-list-order',passed:nativeToBrowser&&browserToNative&&currentXML&&reopened,reopened,...(!(nativeToBrowser&&browserToNative&&currentXML&&reopened)?{nativeToBrowser,browserToNative,currentXML,native:found.nativeModel,decoded:decodeResult(bytes(found.nativeBase64)),browser:found.browserModel}: {})};
 });
 return {completeEquivalence:false,realProductionDataTested:false,referenceCommit:bundle.commit,referenceRunId:bundle.runId,inputSHA256:inputHash,numericInputSHA256:captures['native-32'].numericInputSHA256||null,summary:{numericDiagnostics:{uniqueInputs:numericChecks.length/2,architectures:[32,64].map(bits=>({bits,passed:numericChecks.filter(c=>c.bits===bits&&c.passed).length,total:numericChecks.filter(c=>c.bits===bits).length,values:numericChecks.filter(c=>c.bits===bits&&c.proof==='binary64-and-G15-G17-R').length,errorOutcomes:numericChecks.filter(c=>c.bits===bits&&c.proof==='error-outcome-only').length}))},uniqueConverterInputs:inputs.length,architectures:[32,64].map(bits=>({bits,passed:checks.filter(c=>c.bits===bits&&c.passed).length,total:inputs.length,values:checks.filter(c=>c.bits===bits&&c.proof==='exact-values-and-list-order').length,valuesPassed:checks.filter(c=>c.bits===bits&&c.proof==='exact-values-and-list-order'&&c.passed).length,errorOutcomes:checks.filter(c=>c.bits===bits&&c.proof==='error-outcome-only').length})),api:{passed:api.filter(c=>c.passed).length,total:api.length,cases:pipelines.length},coding:{passed:codec.filter(c=>c.passed).length,total:codec.length,bidirectional:codec.filter(c=>c.passed&&c.proof==='bidirectional-field-values-and-list-order').length,errorDetection:codec.filter(c=>c.passed&&c.proof==='error-detection-only').length}},checks,api,codec,numericChecks};
}
export function assertNativeRegressionScope(report){
 const failures=[...report.checks,...report.api,...report.codec,...report.numericChecks].filter(c=>!c.passed);
 ensure(failures.length===0,'Native Windows comparison differs: '+failures.length);
 return failures;
}
