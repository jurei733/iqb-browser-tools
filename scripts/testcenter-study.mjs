import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import initSqlJs from 'sql.js';
import {peopleFromDTO,readDataFiles,responseRecords,wideWorkbook,longCSV} from '../src/data.js';
import {parseCSV,loadWorkbook} from '../src/toolbox.js';
import {OutputDatabase} from '../src/database.js';
import {encodeResult,decodeResult} from '../src/coding.js';

globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const defaultFixture=new URL('../tests/fixtures/testcenter-study/',import.meta.url);
export const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const modelHash=value=>sha256(canonical(value));
export const workbookCells=workbook=>workbook.worksheets.map(s=>({name:s.name,rows:s.rowCount,columns:s.columnCount,values:Array.from({length:s.rowCount},(_,r)=>Array.from({length:s.columnCount},(_,c)=>s.getCell(r+1,c+1).text))}));

export async function runStudyComparison(outputDirectory,fixture=defaultFixture){
  const reference=JSON.parse(await readFile(new URL('reference.json',fixture)));
  const packed=await readFile(new URL('input.json.gz',fixture));
  assert.equal(sha256(packed),reference.inputArchiveSHA256,'Unchanged Testcenter input archive');
  const files=JSON.parse(gunzipSync(packed));
  for(const [name,hash]of Object.entries(reference.rawFileSHA256))assert.equal(sha256(files[name]),hash,name+' raw bytes');
  const blankTemplate=Buffer.from(files['blank-native.xlsx'],'base64');
  assert.equal(sha256(blankTemplate),reference.blankTemplateSHA256,'Unchanged valid native XLSX template');
  const responses=JSON.parse(files['existing-responses.json']);
  const table=parseCSV(files['logs.csv'],';'),headers=table.shift();
  const logs=files['logs-api.json']?JSON.parse(files['logs-api.json']):table.filter(row=>row.some(Boolean)).map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])));
  assert.equal(responses.length,reference.counts.unitRows);assert.equal(logs.length,reference.counts.logs);
  const SQL=await initSqlJs(),checks=[];
  const check=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks.push({name,passed:true});};
  let outputs;
  for(const [profile,windows]of [['32-bit',true],['64-bit','64']]){
    const people=peopleFromDTO(responses,logs,{windows});
    check(profile+' API full data graph',modelHash(people),reference.fullGraphSHA256);
    check(profile+' person count',people.length,reference.counts.people);
    check(profile+' response count',responseRecords(people).length,reference.counts.responses);
    const csvPeople=await readDataFiles(['responses.csv','logs.csv'].map(name=>({name,bytes:new TextEncoder().encode(files[name])})),{windows});
    check(profile+' CSV full data graph',modelHash(csvPeople),reference.csvGraphSHA256||reference.fullGraphSHA256);
    const db=new OutputDatabase(SQL);let bytes;
    try{
      db.import(people,{windows});check(profile+' database integrity',db.check().ok,true);bytes=db.exportWindows();
    }finally{db.close();}
    const saved=new OutputDatabase(SQL,bytes);
    try{
      check(profile+' SQLite full data graph',modelHash(saved.people()),reference.fullGraphSHA256);
      for(const table of reference.sqlTables){
        const columns=table.columns.map(c=>'['+c+']').join(',');
        const rows=saved.query('SELECT '+columns+' FROM ['+table.name+'] ORDER BY rowid').map(row=>table.columns.map(c=>row[c]));
        check(profile+' SQLite '+table.name+' count',rows.length,table.rows);
        check(profile+' SQLite '+table.name+' all field values',modelHash(rows),table.sha256);
      }
    }finally{saved.close();}
    const xlsx=await wideWorkbook(people),sheets=workbookCells(await loadWorkbook(xlsx));
    check(profile+' Excel sheet names and order',sheets.map(s=>s.name),reference.excelSheets.map(s=>s.name));
    for(const [i,sheet]of sheets.entries())check(profile+' Excel '+sheet.name,{rows:sheet.rows,columns:sheet.columns,sha256:modelHash(sheet.values)},reference.excelSheets[i].cells);
    // A protocol probe only: retain text as comments, with no codes, scores or submissions.
    const cases=[];
    for(const p of people)for(const b of p.booklets)for(const u of b.units)for(const sf of u.subforms)for(const r of sf.responses){
      if(['reason','critique'].includes(r.id)&&r.value&&r.status==='VALUE_CHANGED')cases.push({testee:p.login,variable:{id:u.id+'_'+r.id,codes:[]},code:'',comment:r.value,time:new Date(Number(u.chunks[0].ts)).toISOString()});
    }
    const job={id:reference.codecId||'Testcenter-Codec-A85A58E88AE4',label:'Synthetische Testcenter-Freitexte, reine Codecprobe',variables:[...new Set(cases.map(c=>c.variable.id))].map(id=>({id,codes:[]})),cases};
    const result=encodeResult(job,'Synthetische Codecprobe','Keine Bewertung oder manuelle Einreichung',{windows:true});
    const decoded=decodeResult(result);
    check(profile+' unscored comment count',decoded.entries.length,reference.counts.codingComments);
    check(profile+' original archive reader/writer model',modelHash(decoded),reference.codingModelSHA256);
    if(!outputs)outputs={...files,'blank-native.xlsx':blankTemplate,'logs-api.json':JSON.stringify(logs),'browser.sqlite':bytes,'browser-wide.xlsx':xlsx,'browser-long.csv':longCSV(people),'browser.result':result};
  }
  const report={synthetic:true,empiricalStudy:false,source:reference.source,counts:reference.counts,csvSkippedLogRows:reference.csvSkippedLogRows||0,checks,limitations:reference.limitations};
  if(outputDirectory){
    await mkdir(outputDirectory,{recursive:true});
    for(const [name,data]of Object.entries(outputs))await writeFile(join(outputDirectory,name),data);
    await writeFile(join(outputDirectory,'comparison.json'),JSON.stringify(report,null,2)+'\n');
    await writeFile(join(outputDirectory,'reference.json'),JSON.stringify(reference,null,2)+'\n');
  }
  return report;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);if(args[0]==='--')args.shift();
  assert(args.length<=2&&(!args[1]||['cohort1000','pilot84'].includes(args[1])),'Usage: node scripts/testcenter-study.mjs [OUTPUT_DIRECTORY] [cohort1000|pilot84]');
  const selected=args[1]==='pilot84'?new URL('../tests/fixtures/testcenter-pilot84/',import.meta.url):defaultFixture;
  const report=await runStudyComparison(args[0]&&resolve(args[0]),selected);
  console.log(report.checks.length+'/'+report.checks.length+' Testcenter study comparisons passed (synthetic, not empirical).');
}
