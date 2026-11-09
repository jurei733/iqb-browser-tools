import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import initSqlJs from 'sql.js';
import {strFromU8} from 'fflate';
import * as C from '../src/coding.js';
import * as T from '../src/toolbox.js';
import * as D from '../src/data.js';
import {OutputDatabase} from '../src/database.js';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const fixture=name=>readFile(new URL('../public/'+name,import.meta.url));
const cell=(w,name,offset=1)=>{const r=T.named(w,name);return r.sheet.getCell(`${r.col}${r.row+offset}`);};
const cases=()=>({cases:[
  {testee:'001',variable:{id:'V2'},code:'0',comment:'Zulu'},
  {testee:'001',variable:{id:'V1'},code:'',comment:''},
  {testee:'002',variable:{id:'V1'},code:'1',comment:'Alpha'}
]});

test('matrix: sequential navigation stops at the first open case and resumes at the last completed case',()=>{
  const j=cases();assert.equal(C.initialCaseIndex(j),1);
  for(const [requested,expected]of [[-10,0],[0,0],[1,1],[2,1],[100,1],[NaN,0]])assert.equal(C.navigationIndex(j,requested),expected);
  assert.equal(C.navigationIndex(j,100,{free:true}),2);
  j.cases[1].code='0';assert.equal(C.initialCaseIndex(j),2);
  assert.equal(C.navigationIndex(j,100),2);
  j.cases[0].code='';assert.equal(C.navigationIndex(j,2),0);
});

test('matrix: case list sorts each original column while preserving actual case numbers and code zero',()=>{
  const j=cases(),before=structuredClone(j);
  assert.deepEqual(C.codedCases(j).map(r=>r.i),[0,2]);
  for(const field of ['variable','code','comment'])assert.deepEqual(C.codedCases(j,{sortBy:field}).map(r=>r.i),field==='code'?[0,2]:[2,0]);
  assert.deepEqual(C.codedCases(j,{sortBy:'number',direction:'desc'}).map(r=>r.i),[2,0]);
  j.cases[1].comment='Comment only';assert.equal(C.codedCases(j).length,3);j.cases[1].comment='';
  assert.deepEqual(j,before);assert.throws(()=>C.codedCases(j,{sortBy:'unknown'}),/Sortierung/);
});

test('matrix: Booklet validation rejects duplicate IDs, missing titles, unknown units and invalid times',async()=>{
  const bytes=await fixture('templates/Booklet-Template.xlsx');
  const mutations=[
    [w=>{cell(w,'unitsCol.ID',2).value=cell(w,'unitsCol.ID').text;},/Unit.*doppelt/],
    [w=>{cell(w,'unitsCol.Title').value='';},/Titel fehlt/],
    [w=>{cell(w,'testletsCol.Units').value='UNKNOWN';},/unbekannte/],
    [w=>{cell(w,'bookletsCol.ID',2).value=cell(w,'bookletsCol.ID').text;},/Testheft.*doppelt/],
    [w=>{const r=T.named(w,'bookletsCol.FirstElement');for(let c=r.sheet.getCell(`${r.col}${r.row}`).col;c<=r.sheet.columnCount;c++)if(r.sheet.getCell(r.row,c).text==='max Time'){r.sheet.getCell(r.row+1,c).value='-1';return;}throw new Error('fixture lacks max Time');},/Zeitbegrenzung/]
  ];
  for(const [mutate,pattern]of mutations){const w=await T.loadWorkbook(bytes);mutate(w);assert.throws(()=>T.bookletXML(w),pattern);}
});

test('matrix: Testtaker join and separate exports retain custom texts, modes and XML special characters',async()=>{
  const w=await T.loadWorkbook(await fixture('examples/Logins-Beispiel.xlsx'));
  cell(w,'customText.Key').value='welcome';cell(w,'customText.Value').value='Grüße & <Info>';
  const source=T.loginRows(w),groups=[...new Set(source.map(r=>r.group))];
  const joined=T.testtakerXML(w,{booklet:'B & <1>'}),separate=T.testtakerXML(w,{booklet:'B & <1>',separate:true});
  assert.equal(Object.keys(joined).length,1);assert.equal(Object.keys(separate).length,groups.length);
  const parse=bytes=>new DOMParser().parseFromString(strFromU8(bytes),'application/xml');
  const xml=parse(joined['Testtaker.xml']);assert.equal(xml.getElementsByTagName('Login').length,source.length);
  assert.equal(xml.getElementsByTagName('Booklet').length,source.filter(r=>r.mode!=='monitor-group').length);
  assert.ok(Array.from(xml.getElementsByTagName('Booklet')).every(n=>n.textContent==='B & <1>'));
  assert.ok(xml.getElementsByTagName('CustomText').length>0);
  assert.equal(Object.values(separate).reduce((n,b)=>n+parse(b).getElementsByTagName('Login').length,0),source.length);
  cell(w,'loginsCol.Name',2).value=source[0].name;assert.throws(()=>T.testtakerXML(w),/Doppelter Login/);
});

test('matrix: login generation honors disabled proctor, zero password length and independent prefixes',async()=>{
  const w=await T.loadWorkbook(await fixture('templates/Logins-Vorlage.xlsx'));
  T.generateLogins(w,{length:5,passwordLength:0,monitor:false,prefixTestee:true,prefixReserve:false,prefixReview:true,suffix:'_TEST'});
  const rows=T.loginRows(w);assert.ok(rows.length);assert.ok(rows.every(r=>r.password===''));
  assert.ok(rows.every(r=>r.mode!=='monitor-group'));
  assert.ok(rows.filter(r=>r.mode==='run-review').every(r=>r.name.startsWith('RV_')));
  assert.ok(rows.some(r=>/^T\d+_/.test(r.name)));
  assert.throws(()=>T.generateLogins(w,{passwordLength:-1}),/Kennwortlänge/);
});

test('matrix: every Excel sheet toggle and both response-status filters affect actual exported cells',async()=>{
  const people=D.normalizePeople(JSON.parse(await fixture('examples/Antworten-Logs.json')));
  const all=D.responseRecords(people);assert.ok(all.length);
  // Include each filter status even if example fixtures change later.
  const unit=people[0].booklets[0].units[0];unit.subforms[0].responses.push(
    {id:'DISPLAYED_ONLY',status:'DISPLAYED',value:'shown',code:0,score:0},
    {id:'NOT_REACHED_ONLY',status:'NOT_REACHED',value:'unseen',code:0,score:0});
  const filtered=D.responseRecords(people,{ignoreDisplayed:true,ignoreNotReached:true});
  assert.ok(filtered.every(r=>!['DISPLAYED','NOT_REACHED'].includes(r.responseStatus)));
  for(const [option,sheet]of [['values','Antworten'],['status','Status'],['codes','Codes'],['scores','Scores']]){
    const options={values:false,status:false,codes:false,scores:false,[option]:true,ignoreDisplayed:true,ignoreNotReached:true};
    const w=await T.loadWorkbook(await D.wideWorkbook(people,options));
    assert.deepEqual(w.worksheets.map(s=>s.name),[sheet]);
    const contents=w.worksheets[0].getSheetValues().flat().join(' ');assert.ok(!contents.includes('DISPLAYED_ONLY')&&!contents.includes('NOT_REACHED_ONLY'));
  }
  await assert.rejects(D.wideWorkbook(people,{values:false,status:false,codes:false,scores:false}),/Bitte Optionen wählen/);
});

test('matrix: SQLite checks duplicate units, preserves unrelated groups and exports group subsets',async()=>{
  const SQL=await initSqlJs(),db=new OutputDatabase(SQL);
  try{
    db.import(D.normalizePeople(JSON.parse(await fixture('examples/Antworten-Logs.json'))));
    const group=db.summary().groups[0].group;
    assert.ok(db.people(group).every(p=>p.group===group));assert.deepEqual(db.people('absent'),[]);
    const u=db.query('SELECT * FROM unit LIMIT 1')[0];
    db.insert('unit',['bookletId','name','alias'],[u.bookletId,u.name,u.alias]);
    assert.equal(db.check().ok,false);assert.equal(db.check().units[0].count,2);
  }finally{db.close();}
});
