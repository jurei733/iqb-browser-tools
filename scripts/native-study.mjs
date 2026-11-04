import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import {peopleFromDTO,readDataFiles,responseRecords,wideWorkbook} from '../src/data.js';
import {parseCSV,loadWorkbook} from '../src/toolbox.js';
import {OutputDatabase} from '../src/database.js';
import {encodeResult,decodeResult} from '../src/coding.js';
import {sha256,modelHash,workbookCells} from './testcenter-study.mjs';

const studies=[
 {id:'cohort1000',folder:'testcenter-study',metadata:'reference.json',codecId:'Testcenter-Codec-A85A58E88AE4'},
 {id:'pilot84',folder:'testcenter-pilot84',metadata:'source.json',codecId:'Testcenter-Codec-1574B8D03210'}
];
const tables=['person','bookletInfo','booklet','session','bookletLog','unit','unitLog','unitLastState','chunk','response'];
const SQL=await initSqlJs();
const json=async path=>JSON.parse(await readFile(path));
const tableModels=db=>tables.map(name=>{
 const columns=db.query('PRAGMA table_info(['+name+'])').map(c=>c.name);
 const rows=db.query('SELECT '+columns.map(c=>'['+c+']').join(',')+' FROM ['+name+'] ORDER BY rowid').map(r=>columns.map(c=>r[c]));
 return {name,columns,rows:rows.length,sha256:modelHash(rows)};
});
const sheetModels=async bytes=>workbookCells(await loadWorkbook(bytes)).map(s=>({name:s.name,rows:s.rows,columns:s.columns,sha256:modelHash(s.values)}));

async function prepare(root){
 for(const study of studies){
  const fixture=resolve('tests/fixtures',study.folder),meta=await json(join(fixture,study.metadata)),packed=await readFile(join(fixture,'input.json.gz'));
  assert.equal(sha256(packed),meta.inputArchiveSHA256);const raw=JSON.parse(gunzipSync(packed));
  for(const [name,hash]of Object.entries(meta.rawFileSHA256))assert.equal(sha256(raw[name]),hash,name);
  const template=Buffer.from(raw['blank-native.xlsx'],'base64');assert.equal(sha256(template),meta.blankTemplateSHA256);
  const table=parseCSV(raw['logs.csv'],';'),headers=table.shift();
  const csvLogs=table.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
  const logs=raw['logs-api.json']?JSON.parse(raw['logs-api.json']):csvLogs,responses=JSON.parse(raw['existing-responses.json']);
  assert.equal(responses.length,meta.counts.unitRows);assert.equal(logs.length,meta.counts.logs);
  for(const [arch,windows]of [['x86',true],['x64','64']]){
   const dir=join(root,study.id,arch);await mkdir(dir,{recursive:true});
   const people=peopleFromDTO(responses,logs,{windows});assert.equal(people.length,meta.counts.people);assert.equal(responseRecords(people).length,meta.counts.responses);
   if(meta.fullGraphSHA256)assert.equal(modelHash(people),meta.fullGraphSHA256,'Previously captured original full graph');
   assert.equal(modelHash(people),modelHash(peopleFromDTO(responses,csvLogs,{windows})),'Direct and CSV log graphs');
   const csvPeople=await readDataFiles(['responses.csv','logs.csv'].map(name=>({name,bytes:Buffer.from(raw[name])})),{windows});
   const csvLogCount=csvPeople.reduce((n,p)=>n+p.booklets.reduce((n,b)=>n+b.logs.length+b.units.reduce((n,u)=>n+u.logs.length,0),0),0);
   const csvSkippedLogRows=logs.length-csvLogCount;
   const db=new OutputDatabase(SQL);let sqlite,sqlTables;
   try{db.import(people,{windows});assert(db.check().ok);sqlite=db.exportWindows();}finally{db.close();}
   const saved=new OutputDatabase(SQL,sqlite);try{assert(saved.check().ok);assert.equal(modelHash(saved.people()),modelHash(people));sqlTables=tableModels(saved);}finally{saved.close();}
   const xlsx=await wideWorkbook(people),excelSheets=await sheetModels(xlsx),cases=[];
   for(const p of people)for(const b of p.booklets)for(const u of b.units)for(const sf of u.subforms)for(const r of sf.responses)if(['reason','critique'].includes(r.id)&&r.value&&r.status==='VALUE_CHANGED')cases.push({testee:p.login,variable:{id:u.id+'_'+r.id,codes:[]},code:'',comment:r.value,time:new Date(Number(u.chunks[0].ts)).toISOString()});
   const job={id:study.codecId,label:'Synthetische Testcenter-Freitexte, reine Codecprobe',variables:[...new Set(cases.map(c=>c.variable.id))].map(id=>({id,codes:[]})),cases};
   const result=encodeResult(job,'Synthetische Codecprobe','Keine Bewertung oder manuelle Einreichung',{windows:true}),decoded=decodeResult(result);assert.equal(decoded.entries.length,meta.counts.codingComments);
   const files={'existing-responses.json':raw['existing-responses.json'],'responses.csv':raw['responses.csv'],'logs.csv':raw['logs.csv'],'logs-api.json':raw['logs-api.json']||JSON.stringify(logs),'blank-native.xlsx':template,'browser.sqlite':sqlite,'browser-wide.xlsx':xlsx,'browser.result':result};
   for(const [name,bytes]of Object.entries(files))await writeFile(join(dir,name),bytes);
   await writeFile(join(dir,'expected.json'),JSON.stringify({study:study.id,arch,counts:meta.counts,fullGraphSHA256:modelHash(people),csvGraphSHA256:modelHash(csvPeople),csvSkippedLogRows,sqlTables,excelSheets,codingModelSHA256:modelHash(decoded),inputSHA256:Object.fromEntries(Object.entries(files).filter(([n])=>n!=='browser-wide.xlsx').map(([n,b])=>[n,sha256(b)]))},null,2)+'\n');
  }
 }
 console.log('Prepared both Testcenter cohorts for fresh x86/x64 Windows execution.');
}

async function compare(root){
 const checks=[],captures=[];
 const check=(study,arch,name,actual,expected)=>{checks.push({study,arch,name,passed:modelHash(actual)===modelHash(expected),...(modelHash(actual)!==modelHash(expected)?{actual,expected}:{})});};
 for(const study of studies)for(const arch of ['x86','x64']){
  try{
  const dir=join(root,study.id,arch),expected=await json(join(dir,'expected.json')),report=await json(join(dir,'native-report.json'));
  check(study.id,arch,'native x64 host',report.nativeMachine,'8664');
  check(study.id,arch,'process bits',report.processBits,arch==='x86'?32:64);
  check(study.id,arch,'original Toolbox SHA256',report.toolboxSHA256,'c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1');
  check(study.id,arch,'original CodingResults library SHA256',report.codingCommonSHA256,'4845bf183b80509f743dc87d6e5b211bd5c9757417a9ff08665278f27fda20a6');
  for(const [name,hash]of Object.entries(report.inputSHA256))check(study.id,arch,'input '+name,hash,expected.inputSHA256[name]);
  for(const step of ['toolbox-api-import','toolbox-csv-import','toolbox-read-browser-sqlite','toolbox-write-sqlite','toolbox-excel-export','coding-original-archive-codec'])check(study.id,arch,step,report[step],'passed');
  const graph=await json(join(dir,'native-api-people.json')),csvGraph=await json(join(dir,'native-csv-people.json'));
  check(study.id,arch,'API full graph',modelHash(graph),expected.fullGraphSHA256);check(study.id,arch,'CSV full graph',modelHash(csvGraph),expected.csvGraphSHA256);
  check(study.id,arch,'CSV skipped log rows',report.csvSkippedLogRows,expected.csvSkippedLogRows);
  check(study.id,arch,'CSV skipped response rows',report.csvSkippedResponseRows,0);
  check(study.id,arch,'original limited SQLite reader',await json(join(dir,'native-browser-db-people.json')),await json(join(dir,'native-own-db-people.json')));
  const db=new OutputDatabase(SQL,await readFile(join(dir,'native.sqlite')));let actualTables;
  try{check(study.id,arch,'original database integrity',db.check().ok,true);check(study.id,arch,'browser reads full original database',modelHash(db.people()),expected.fullGraphSHA256);actualTables=tableModels(db);for(const [i,t]of actualTables.entries())check(study.id,arch,'SQLite all fields '+t.name,t,expected.sqlTables[i]);}finally{db.close();}
  const sheets=await sheetModels(await readFile(join(dir,'native-wide.xlsx')));check(study.id,arch,'Excel all sheets and cells',sheets,expected.excelSheets);
  const codec=decodeResult(await readFile(join(dir,'native-codec.result')));check(study.id,arch,'unscored comment archive',modelHash(codec),expected.codingModelSHA256);
  captures.push({study:study.id,arch,counts:expected.counts,report,fullGraphSHA256:modelHash(graph),csvGraphSHA256:modelHash(csvGraph),sqlTables:actualTables,excelSheets:sheets,codingModelSHA256:modelHash(codec)});
  }catch(error){checks.push({study:study.id,arch,name:'native capture files readable',passed:false,error:error.message});}
 }
 const result={synthetic:true,empiricalStudy:false,completeEquivalence:false,checks,captures,passed:checks.filter(c=>c.passed).length,total:checks.length,excluded:['SQLite db_info and sqlite_sequence metadata','XLSX styles and ZIP metadata; cells compared as text','Manual coding decisions and scan workflows','Empirical human study data']};
 await writeFile(join(root,'comparison.json'),JSON.stringify(result,null,2)+'\n');
 console.log('NATIVE_STUDY_REFERENCE_BEGIN');console.log(JSON.stringify(result));console.log('NATIVE_STUDY_REFERENCE_END');
 assert.equal(result.passed,result.total,'Fresh Windows Testcenter study comparisons failed');
 console.log(result.passed+'/'+result.total+' fresh Windows study comparisons passed.');
}
const [mode,path]=process.argv.slice(2);assert(['prepare','compare'].includes(mode)&&path,'Usage: node scripts/native-study.mjs prepare|compare OUTPUT_DIRECTORY');
await (mode==='prepare'?prepare:compare)(resolve(path));
