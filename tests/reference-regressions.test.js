import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {zipSync,strToU8} from 'fflate';
import * as C from '../src/coding.js';
import * as D from '../src/data.js';
import * as T from '../src/toolbox.js';
import {OutputDatabase} from '../src/database.js';
import {TestcenterClient} from '../src/testcenter.js';
import {parseJSON} from '../src/json.js';
import initSqlJs from 'sql.js';
import {readFile} from 'node:fs/promises';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const file=(name,bytes)=>({name,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
const content='[{"id":"large","value":9007199254740993},{"id":"negative","value":-9007199254740993},{"id":"nested","value":[9007199254740993]}]';
test('unchanged Windows-generated SpreadsheetML imports with its namespaces, values and sheets intact',async()=>{
 const csv=await T.loadWorkbook(await readFile(new URL('./fixtures/windows-csv.xlsx',import.meta.url)));assert.equal(csv.getWorksheet('Syscheck-Daten').getCell('A2').text,'001');assert.equal(csv.getWorksheet('Syscheck-Daten').getCell('B2').text,'Grüße, Welt');
 const wide=await T.loadWorkbook(await readFile(new URL('./fixtures/windows-export.xlsx',import.meta.url)));assert.deepEqual(wide.worksheets.map(s=>s.name),['Antworten','Status','Codes','Scores']);assert.equal(wide.getWorksheet('Antworten').getCell('E2').text,'13');assert.equal(wide.getWorksheet('Codes').getCell('E3').text,'0');
});
test('original jobOptions accepts whitespace around True and False; invalid flags are rejected',async()=>{
  const make=flag=>zipSync({'job.xml':strToU8(`<CodingJob id="ref"><jobOpts showScore="${flag}" enableComments=" True " suppressDescription=" False "/><Variablen><v id="A"><c id="0"/><loc b="B" p="1"/></v></Variablen><Cases>001</Cases></CodingJob>`),'B-1_001.png':new Uint8Array([1])});
  const job=(await C.readCodingFiles([file('ref.zip',make(' True '))])).jobs[0];assert.equal(job.settings.showScore,true);assert.equal(job.settings.enableComments,true);assert.equal(job.settings.suppressDescription,false);
  await assert.rejects(()=>C.readCodingFiles([file('ref.zip',make('maybe'))]),/showScore/);
});
test('original Abi converter normalizes positive Int32 suffixes and keeps the first duplicate variable',()=>{
  const data=D.parseChunk('{"ab_01":"first","ab_1":"second","ab_0002":"third","ab_+2":"fourth","ab_2147483648":"outside","ab_0":"zero","a_1":"short"}','unknown');
  assert.deepEqual(data.map(s=>s.id),['','1','2']);assert.equal(data[1].responses[0].value,'first');assert.equal(data[2].responses[0].value,'third');assert.deepEqual(data[0].responses.map(r=>r.id),['ab_2147483648','ab_0','a_1']);
});
test('original converter Boolean spelling is preserved for standard, Dan and key/value players',()=>{
  for(const type of ['iqb-standard@1.1','IQBVisualUnitPlayerV2.1.0','iqb-simple-player@1.0.0','generic']){
    const source=type==='iqb-standard@1.1'?'[{"id":"yes","value":true},{"id":"no","value":false}]':type==='iqb-simple-player@1.0.0'?'{"answers":{"yes":true,"no":false}}':'{"yes":true,"no":false}';
    assert.deepEqual(D.parseChunk(source,type)[0].responses.map(r=>r.value),['True','False']);
  }
  assert.equal(D.parseChunk('{"v":true}','unknown')[0].responses[0].value,'true');
});
test('large original integer values remain exact through JSON, CSV, SQLite and Excel',async()=>{
  const dto={groupname:'G',loginname:'001',bookletname:'B',unitname:'U',responses:[{id:'all',content,responseType:'iqb-standard@1.1',ts:1000}]};
  const people=D.peopleFromDTO([dto]);assert.deepEqual(D.responseRecords(people).map(r=>r.responseValue),['9007199254740993','-9007199254740993','[9007199254740993]']);
  const csv=T.csvString([['groupname','loginname','code','bookletname','unitname','responses','laststate'],['G','001','','B','U',JSON.stringify(dto.responses),'']]);
  assert.equal(D.responseRecords(D.importCSV(csv))[0].responseValue,'9007199254740993');
  const raw='[{"group":"G","login":"001","booklets":[{"id":"B","units":[{"id":"U","subforms":[{"id":"","responses":'+content+'}]}]}]}]';
  assert.equal(D.responseRecords(await D.readDataFiles([{name:'raw.json',text:raw}]))[0].responseValue,'9007199254740993');
  const db=new OutputDatabase(await initSqlJs());db.import(people);const reopened=new OutputDatabase(await initSqlJs(),db.export());assert.equal(D.responseRecords(reopened.people())[0].responseValue,'9007199254740993');db.close();reopened.close();
  const workbook=await T.loadWorkbook(await D.wideWorkbook(people));assert.equal(workbook.getWorksheet('Antworten').getCell(2,4).text,'9007199254740993');
});
test('exact API integers survive structured cloning before conversion in a worker',async()=>{
  const client=new TestcenterClient('https://test.example.org',{fetch:async()=>new Response('{"value":9007199254740993}')});
  const result=structuredClone(await client.request('/fixture'));assert.equal(result.value,9007199254740993n);assert.equal(D.parseChunk([{id:'v',value:result.value}],'iqb-standard@1.1')[0].responses[0].value,'9007199254740993');
  assert.deepEqual(parseJSON('{"v":1,"v":2}'),{v:2});
});
test('numeric API identities remain exact and code zero stays distinct from a missing code',()=>{
  const input=parseJSON('[{"groupname":"G","loginname":9007199254740993,"code":0,"bookletname":1,"unitname":"U","responses":[]},{"groupname":"G","loginname":"9007199254740993","code":"0","bookletname":"1","unitname":"V","responses":[]},{"groupname":"G","loginname":"9007199254740993","bookletname":"1","unitname":"U","responses":[]}]');
  const people=D.peopleFromDTO(input);assert.equal(people.length,2);assert.equal(people[0].login,'9007199254740993');assert.equal(people[0].code,'0');assert.equal(people[0].booklets.length,1);assert.equal(people[0].booklets[0].units.length,2);assert.equal(people[1].code,'');
});
