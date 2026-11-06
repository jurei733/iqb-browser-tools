import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import initSqlJs from 'sql.js';
import {OutputDatabase} from '../src/database.js';
import {wideWorkbook,readDataFiles} from '../src/data.js';
import {windowsLongCSV,windowsSessionCSV} from '../src/windows-compatibility.js';
import {loadWorkbook} from '../src/toolbox.js';
import {windowsTestcenterGUI,windowsGUIJSON} from '../src/windows-testcenter-gui.js';
import {parseJSON} from '../src/json.js';
const proof=JSON.parse(await readFile(new URL('./fixtures/gui-remaining-20261106.json',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=cap=>{const b=Buffer.from(cap.base64,'base64');assert.equal(b.length,cap.bytes);assert.equal(sha(b),cap.sha256);return b;};
const input=await readFile(new URL('../'+proof.input.path,import.meta.url));
assert.equal(sha(input),proof.input.sha256);
const db=new OutputDatabase(await initSqlJs(),input),people=db.people();
const shape=async b=>(await loadWorkbook(b)).worksheets.map(s=>({name:s.name,rows:Array.from({length:s.rowCount},(_,i)=>{const row=s.getRow(i+1),cells=Array.from({length:row.cellCount},(_,j)=>row.getCell(j+1).text);while(cells.at(-1)==='')cells.pop();return cells;}).filter(r=>r.length)}));
test('Native SQLite GUI: same input, counters, group and clean duplicate check',()=>{
 const s=db.summary();assert.equal(s.people,proof.observed.people);assert.equal(s.responses,proof.observed.responses);assert.deepEqual(s.groups,proof.observed.groups);
 const check=db.check();assert.equal(check.ok,true);assert.deepEqual(check.duplicates,[]);assert.deepEqual(check.units,[]);
});
for(const c of proof.excel)test('Native SQLite GUI Excel '+c.id+': selected sheets, subforms, cells and order',async()=>{
 assert.deepEqual(await shape(await wideWorkbook(people,c.options)),await shape(bytes(c.capture)));
});
for(const c of proof.csv)test('Native SQLite GUI CSV '+c.id+': exact original text, BOM and CRLF',()=>{
 const text=c.format==='windows-long'?windowsLongCSV(people):windowsSessionCSV(people,db.sizes());
 assert.deepEqual(Buffer.from('\ufeff'+text),bytes(c.capture));
});
const reports=parseJSON(bytes(proof.testcenter.input).toString());
for(const c of proof.testcenter.json.filter(c=>c.name!=='booklets.json'))test('Native Testcenter GUI '+c.name+': logs first, aliases, null sessions and byte-identical JSON',()=>{
 const g=c.name.slice(0,-5),people=windowsTestcenterGUI(reports.responses.filter(d=>d.groupname===g),reports.logs.filter(d=>d.groupname===g));
 assert.deepEqual(Buffer.from(windowsGUIJSON(people)),bytes(c.capture));
});
test('Native Testcenter direct Excel: German column order and every cell',async()=>{
 const p=windowsTestcenterGUI(reports.responses,reports.logs),c=proof.testcenter.excel;
 assert.deepEqual(await shape(await wideWorkbook(p,c.options)),await shape(bytes(c.capture)));
});
test('Native Testcenter GUI SQLite: all ten data tables match the original writer',async()=>{
 const SQL=await initSqlJs(),native=new OutputDatabase(SQL,bytes(proof.testcenter.sqlite.capture)),web=new OutputDatabase(SQL);
 try{
  web.import(windowsTestcenterGUI(reports.responses,reports.logs),{windows:true});web.setSizes(native.sizes());
  const canonical=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).sort()));
  for(const table of ['person','bookletInfo','booklet','session','bookletLog','unit','unitLog','unitLastState','chunk','response'])assert.deepEqual(canonical(web.query('SELECT * FROM ['+table+']')),canonical(native.query('SELECT * FROM ['+table+']')),table);
  assert.equal(web.summary().people,2);assert.equal(web.summary().responses,28);assert.equal(web.check().ok,true);
 }finally{native.close();web.close();}
});
test('Native booklet-size JSON import preserves existing sizes and adds DEMO',async()=>{
 const p=proof.testcenter.bookletSizesImport,SQL=await initSqlJs(),before=new OutputDatabase(SQL,bytes(proof.testcenter.sqlite.capture)),after=new OutputDatabase(SQL,bytes(p.sqliteAfter));
 try{
  before.setSizes(JSON.parse(bytes(p.input.capture).toString('utf8')));
  assert.deepEqual(before.query('SELECT * FROM bookletInfo'),after.query('SELECT * FROM bookletInfo'));
  for(const table of ['person','booklet','session','bookletLog','unit','unitLog','unitLastState','chunk','response'])assert.deepEqual(before.query('SELECT * FROM ['+table+']'),after.query('SELECT * FROM ['+table+']'),table);
 }finally{before.close();after.close();}
});
test('Native JSON database import: all ten data tables match after adding J6.json',async()=>{
 const p=proof.testcenter,SQL=await initSqlJs(),before=new OutputDatabase(SQL,bytes(p.bookletSizesImport.sqliteAfter)),after=new OutputDatabase(SQL,bytes(p.jsonDatabaseImport.sqliteAfter));
 try{
  before.import(await readDataFiles([{name:p.jsonDatabaseImport.input.name,bytes:bytes(p.jsonDatabaseImport.input.capture)}],{windows:true}),{windows:true});
  const canonical=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).sort()));
  for(const table of ['person','bookletInfo','booklet','session','bookletLog','unit','unitLog','unitLastState','chunk','response'])assert.deepEqual(canonical(before.query('SELECT * FROM ['+table+']')),canonical(after.query('SELECT * FROM ['+table+']')),table);
  assert.equal(before.summary().people,5);assert.equal(before.summary().responses,34);
 }finally{before.close();after.close();}
});
