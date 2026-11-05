import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import initSqlJs from 'sql.js';
import {OutputDatabase} from '../src/database.js';
import {responseRecords,wideWorkbook} from '../src/data.js';
import {loadWorkbook} from '../src/toolbox.js';

export async function loadFinalizedPilot(){
 const fixture=JSON.parse(await readFile(new URL('../tests/fixtures/pilot84-finalized.json',import.meta.url)));
 const bytes=Buffer.from(fixture.capture.data,'base64');
 assert.equal(bytes.length,fixture.capture.bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.capture.sha256);
 return {fixture,data:JSON.parse(gunzipSync(bytes))};
}

/** Compare browser readers and writers with native pilot captures, without altering expected grades. */
export async function verifyFinalizedPilot(fixture,data){
 const headers=data.csv[0],rows=data.csv.slice(1).filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
 const key=r=>JSON.stringify([r.person_group,r.person_login,r.person_code,r.booklet_name,r.unit_key,r.variable_id]);
 assert.equal(rows.length,756);assert(rows.every(r=>r.person_group===fixture.group));
 const manual=rows.filter(r=>r.status_v2);assert.equal(manual.length,137);
 assert.equal(manual.filter(r=>r.variable_id==='reason').length,71);
 assert.equal(manual.filter(r=>r.variable_id==='critique').length,66);
 assert.equal(data.decisions.length,12);
 for(const c of data.decisions){assert.equal(c.manual.code,0);assert.equal(c.manual.score,0);assert.equal(c.manual.is_open,false);assert(c.manual.notes.length>80);}
 const statuses={};
 for(const r of rows){const v=r.status_v2?'v2':'v1';for(const f of ['status','code','score'])assert.equal(r[f+'_v3'],r[f+'_'+v],'v3 precedence '+key(r));statuses[r.status_v3]=(statuses[r.status_v3]||0)+1;}
 for(const r of manual)assert.deepEqual([r.status_v2,r.code_v2,r.score_v2],['CODING_COMPLETE','0','0']);
 assert.deepEqual(statuses,{CODING_COMPLETE:655,NOT_REACHED:72,DISPLAYED:29});
 assert.deepEqual(data.excel.headers,headers);assert.equal(data.excel.rows.length,756);
 let normalized=0;
 for(const [i,r]of rows.entries())for(const [j,h]of headers.entries()){
  const actual=data.excel.rows[i][j],expected=r[h];
  if(actual!==expected){assert.equal(h,'value');assert(expected.includes('\r\n'));assert.equal(actual,expected.replace(/\r\n/g,'\n'));normalized++;}
 }
 assert.equal(normalized,20,'Only the 20 observed native XML line-ending conversions are allowed');
 const SQL=await initSqlJs(),source=new SQL.Database();
 for(const table of data.nativeProjection){source.run(table.sql);const cols=table.columns.map(k=>'"'+k.replaceAll('"','""')+'"').join(',');const insert=source.prepare('INSERT INTO "'+table.name+'" ('+cols+') VALUES ('+table.columns.map(()=>'?').join(',')+')');try{for(const row of table.rows)insert.run(row);}finally{insert.free();}}
 const bytes=source.export();source.close();const native=new OutputDatabase(SQL,bytes);let browser;
 try{
  const index=new Map(rows.map(r=>[key(r),r]));assert.equal(index.size,756);
  for(const version of ['v1','v2','v3']){
   native.setVersion(version);const records=responseRecords(native.people(fixture.group));assert.equal(records.length,756);
   for(const r of records){const e=index.get(JSON.stringify([r.group,r.login,r.code,r.booklet,r.unitName,r.responseId]));assert(e,'Identity in CSV');assert.equal(r.responseValue,e.value,'Exact SQLite text');
    if(!e['status_'+version])continue;
    assert.equal(r.responseStatus,e['status_'+version]);
    // Native CSV/Excel apply profile 11; native SQLite stores nullable grades.
    const raw=[r.responseCode===null?'':String(r.responseCode),r.responseScore===null?'':String(r.responseScore)];
    const exported=r.responseStatus==='NOT_REACHED'?['-96','NA']:r.responseStatus==='DISPLAYED'?['-99','0']:raw;
    assert.deepEqual(exported,[e['code_'+version],e['score_'+version]],'IQB-Standard missing profile');
   }
  }
  native.setVersion('v3');browser=new OutputDatabase(SQL,native.exportBrowser());assert.equal(browser.check().ok,true);
  assert.deepEqual(responseRecords(browser.people()),responseRecords(native.people(fixture.group)));
  assert.deepEqual(browser.exportCodingBox(),bytes,'Complete sanitized snapshot roundtrip');
  const w=await loadWorkbook(await wideWorkbook(browser.people()));
  for(const [sheetName,field]of [['Antworten','value'],['Status','status_v3'],['Codes','code_v3'],['Scores','score_v3']]){
   const s=w.getWorksheet(sheetName),cols=s.getRow(1).values,byLogin=new Map();s.eachRow((r,i)=>{if(i>1)byLogin.set(r.getCell(3).text,r);});
   for(const [i,r]of rows.entries()){
    const col=cols.indexOf(r.unit_alias+r.variable_id),row=byLogin.get(r.person_login+r.person_code+'_all');assert(col>0&&row);
    const expected=['code_v3','score_v3'].includes(field)&&r.status_v3!=='CODING_COMPLETE'?'':data.excel.rows[i][headers.indexOf(field)];
    assert.equal(row.getCell(col).text,expected,'Browser Excel '+sheetName+' '+key(r));
   }
  }
 }finally{browser?.close();native.close();}
 return {synthetic:true,empiricalStudy:false,people:84,responses:756,manualResponses:137,aggregatedCases:12,versions:['v1','v2','v3'],nativeExcelCells:14364,nativeExcelCRLFNormalizations:normalized,browserExcelResponseCells:3024,statusCounts:statuses,sanitizedSQLiteRoundtrip:true};
}
