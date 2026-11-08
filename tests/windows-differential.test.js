import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import initSqlJs from 'sql.js';
import {converterTypes,converterCorpus,pipelineCorpus} from '../scripts/converter-corpus.mjs';
import {verifyCorpus,nativeOutcome,nativeUnit,nativePath,analyze} from '../scripts/analyze-windows-differential.mjs';
import {parseChunk,responseUnit,readDataFiles,importCSV,peopleFromDTO,wideWorkbook} from '../src/data.js';
import {csvString,loadWorkbook} from '../src/toolbox.js';
import {OutputDatabase} from '../src/database.js';
const native=JSON.parse(await readFile(nativePath,'utf8'));
test('strict Windows evidence: input hashes, unique cases, assembly and culture are bound to the native capture',()=>{verifyCorpus(native);assert.equal(native.results.length,547);assert.equal(native.pipelineResults.length,7);});
function strictMethod(method){
 const cases=converterCorpus().filter(c=>c.method===method);let checked=0;
 for(const fixture of cases){const expected=nativeOutcome(native.results.find(r=>r.id===fixture.id));if(expected.rejected)continue;assert.deepEqual(parseChunk(fixture.contentJSON,converterTypes[method],{windows:true}),expected.value,fixture.id);checked++;}
 assert.ok(checked>0);
}
test('strict Windows converter values and order: setResponsesIqbStandard',()=>strictMethod('setResponsesIqbStandard'));
test('strict Windows converter values and order: setResponsesAbi',()=>strictMethod('setResponsesAbi'));
test('strict Windows converter values and order: setResponsesDan',()=>strictMethod('setResponsesDan'));
test('strict Windows converter values and order: setResponsesKeyValue',()=>strictMethod('setResponsesKeyValue'));
test('strict Windows converter values and order: setResponsesSimplePlayerLegacy',()=>strictMethod('setResponsesSimplePlayerLegacy'));
test('strict Windows evidence: error detection and representation are checked separately from error-message identity',()=>{
 const report=analyze(native);assert.deepEqual(report.summary.strictValues,{passed:401,total:401});assert.equal(report.summary.errorHandling.passed,146);assert.equal(report.summary.errorHandling.total,146);assert.equal(report.summary.errorHandling.sameRepresentation,146);assert.equal(report.summary.errorHandling.identicalErrorMessagesProven,false);assert.equal(report.completeEquivalence,false);assert.equal(report.realProductionDataTested,false);assert.equal(report.normalizationApplied,false);assert.equal(report.summary.enhancedMode.different,177);
});
test('strict Windows API units: preserve chunk order, duplicate subforms, nullable values and laststate',()=>{
 for(const fixture of pipelineCorpus()){const expected=JSON.parse(native.pipelineResults.find(r=>r.id===fixture.id).outputJSON);assert.deepEqual(responseUnit(fixture.dto,{windows:true}),nativeUnit(expected),fixture.id);}
});
test('Windows conversion propagates through raw API JSON files and Testcenter CSV',async()=>{
 const {dto}=pipelineCorpus()[0],expected=responseUnit(dto,{windows:true});
 const fromJSON=await readDataFiles([{name:'raw.json',text:JSON.stringify([dto])}],{windows:true});assert.deepEqual(fromJSON[0].booklets[0].units[0],expected);
 // Native CSV PersonList.AddUnitData uses the alias as identity (also
 // captured by the direct CSV GUI fixture from 2026-11-08); API JSON does not.
 const headers=['groupname','loginname','code','bookletname','unitname','originalUnitId','responses','laststate'];const values=headers.map(name=>name==='responses'?JSON.stringify(dto.responses):dto[name]);const fromCSV=importCSV(csvString([headers,values]),'auto',{windows:true});assert.deepEqual(fromCSV[0].booklets[0].units[0],{...expected,id:dto.unitname});
 const enhanced=await readDataFiles([{name:'raw.json',text:JSON.stringify([dto])}]);assert.equal(enhanced[0].booklets[0].units[0].subforms.length,1);assert.equal(enhanced[0].booklets[0].units[0].subforms[0].responses[0].value,'12.5');
});
test('Windows conversion: preserve null in SQLite and original decimal values in Excel',async()=>{
 const SQL=await initSqlJs(),db=new OutputDatabase(SQL);
 try{const people=peopleFromDTO([pipelineCorpus()[1].dto],[],{windows:true});db.import(people,{windows:true});assert.equal(db.query('SELECT value FROM response WHERE variableId=?',['plain'])[0].value,null);assert.ok(db.check().ok);
 const dto=pipelineCorpus()[0].dto,values=peopleFromDTO([{...dto,responses:dto.responses.slice(0,1)}],[],{windows:true});const workbook=await loadWorkbook(await wideWorkbook(values));const sheet=workbook.getWorksheet('Antworten');assert.equal(sheet.getCell('D2').text,'12,5');
 }finally{db.close();}
});
