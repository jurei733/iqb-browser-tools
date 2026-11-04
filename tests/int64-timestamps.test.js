import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import {parseJSON,stringifyJSON} from '../src/json.js';
import {peopleFromDTO,readDataFiles,responseRecords,wideWorkbook} from '../src/data.js';
import {OutputDatabase} from '../src/database.js';
import {modelHash} from '../scripts/testcenter-study.mjs';
import {loadWorkbook} from '../src/toolbox.js';
const times=[9007199254740992n,9007199254740993n,9223372036854775807n,-9223372036854775808n];
const logs=times.map((timestamp,i)=>({groupname:'G',loginname:'P'+i,code:'',bookletname:'BOOK',unitname:'U',timestamp,logentry:'NOTE = '+i}));
const values=p=>p.map(p=>p.booklets[0].units[0].logs[0].ts);
test('Int64 API, raw JSON, CSV and exported JSON retain adjacent values and both limits',async()=>{
  for(const windows of [true,'64']){
    const json=stringifyJSON(logs),api=peopleFromDTO([],parseJSON(json),{windows});assert.deepEqual(values(api),times);
    const rows=['groupname;loginname;code;bookletname;unitname;timestamp;logentry',...logs.map(l=>['G',l.loginname,'','BOOK','U',String(l.timestamp),l.logentry].map(v=>'"'+v+'"').join(';'))];
    const csv=await readDataFiles([{name:'logs.csv',text:rows.join('\r\n')}],{windows});assert.deepEqual(csv,api);
    assert.deepEqual(values(parseJSON(stringifyJSON(api))),times);
    assert.match(stringifyJSON(api),/"ts":9007199254740993/);assert.doesNotMatch(stringifyJSON(api),/"ts":"9007199254740993"/);
    assert.equal(api[3].booklets[0].firstTS,-9223372036854775808n);
  }
});
test('Int64 SQLite integers survive Windows export, Coding-Box projection and unchanged native snapshot',async()=>{
  const SQL=await initSqlJs(),db=new OutputDatabase(SQL);let bytes,native;
  try{db.import(peopleFromDTO([],logs,{windows:true}),{windows:true});
    const sql=db.query('SELECT CAST(ts AS TEXT) exact,typeof(ts) storage FROM unitLog ORDER BY rowid');
    assert.deepEqual(sql.map(r=>r.exact),times.map(String));assert(sql.every(r=>r.storage==='integer'));
    bytes=db.exportWindows();native=db.exportCodingBox();
  }finally{db.close();}
  const restored=new OutputDatabase(SQL,bytes),coding=new OutputDatabase(SQL,native);let browser;
  try{assert.deepEqual(values(restored.people()),times);assert.deepEqual(values(coding.people()),times);browser=coding.exportBrowser();}finally{restored.close();coding.close();}
  const snapshot=new OutputDatabase(SQL,browser);try{assert.deepEqual(snapshot.exportCodingBox(),native);assert.deepEqual(values(snapshot.people()),times);}finally{snapshot.close();}
});
test('negative control: the native reference reader and graph hash distinguish adjacent Int64 numbers',()=>{
  const a='{"timestamp":9007199254740992}',b='{"timestamp":9007199254740993}';
  assert.equal(JSON.parse(a).timestamp,JSON.parse(b).timestamp,'Demonstrate the old blind spot');
  assert.notEqual(parseJSON(a).timestamp,parseJSON(b).timestamp);assert.notEqual(modelHash(parseJSON(a)),modelHash(parseJSON(b)));
  assert.notEqual(modelHash(parseJSON(b)),modelHash({timestamp:'9007199254740993'}),'A string must not impersonate a JSON number');
});
test('large chunk timestamps retain ordering, choose the latest response and survive SQLite and Excel',async()=>{
  const chunk=(ts,value)=>({id:String(ts),ts,responseType:'iqb-standard@1.1',content:[{id:'v',value,status:'VALUE_CHANGED'}]});
  const people=peopleFromDTO([{...logs[0],responses:[chunk(9007199254740993n,'latest'),chunk(9007199254740992n,'older')]}]);
  assert.equal(responseRecords(people)[0].responseValue,'latest');assert.equal(responseRecords(people)[0].ts,'9007199254740993');
  const SQL=await initSqlJs(),db=new OutputDatabase(SQL);try{db.import(people);assert.equal(responseRecords(db.people())[0].ts,'9007199254740993');}finally{db.close();}
  const workbook=await loadWorkbook(await wideWorkbook(people));assert.equal(workbook.getWorksheet('Antworten').getCell(2,4).text,'latest');
});

test('captured original x86/x64 methods match all 64 Int64 values and the full browser graph',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {int64LogCorpus}=await import('../scripts/int64-corpus.mjs');
  const {createHash}=await import('node:crypto');
  const root=new URL('./fixtures/int64-native/',import.meta.url);
  const source=JSON.parse(await readFile(new URL('source.json',root),'utf8'));
  const logs=int64LogCorpus();
  assert.equal(new Set(logs.map(l=>String(l.timestamp))).size,64);
  for(const [name,sha]of Object.entries(source.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex'),sha,'Untouched original capture '+name);
  for(const [arch,windows]of [['x86',true],['x64','64']]){
    const probe=JSON.parse(await readFile(new URL(arch+'-native-int64-probe.json',root),'utf8'));
    for(const path of ['api','csv','browserSqlite'])assert.deepEqual(probe[path],logs.map(l=>String(l.timestamp)));
    const captured=parseJSON(await readFile(new URL(arch+'-native-int64-people.json',root),'utf8'));
    assert.equal(modelHash(peopleFromDTO([],logs,{windows})),modelHash(captured),'Complete native graph '+arch);
  }
});
