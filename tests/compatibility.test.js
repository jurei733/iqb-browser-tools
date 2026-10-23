import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {gzipSync,gunzipSync,strToU8,strFromU8,zipSync} from 'fflate';
import * as C from '../src/coding.js';
import * as T from '../src/toolbox.js';
import {parseXML} from '../src/xml.js';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const jobXML=`<CodingJob id="job-1"><jobOpts showScore="true" suppressDescription="false"/><Variablen><v id="A01" lb="Rechnen"><descr>Richtig ist 13.</descr><c id="0" lb="falsch" to="0"/><c id="1" lb="richtig" to="1"/><loc b="B01" p="1"><varframe x="10" y="20" w="30" h="40"/></loc></v></Variablen><Cases>P001 P002</Cases></CodingJob>`;
const fakeFile=(name,bytes)=>({name,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
async function sampleJob(){return (await C.readCodingFiles([fakeFile('Job.zip',zipSync({'Job.xml':strToU8(jobXML),'scans/B01-1_P001.png':new Uint8Array([1]),'scans/B01-1_P002.png':new Uint8Array([2])}))])).jobs[0];}

test('CodingResults v5 imports the vendor gzip structure with code 0, UTF-8 and comments',()=>{
  const xml=`<?xml version="1.0" encoding="utf-8"?><CodingResults version="5" id="job-1" coder="ä&amp;ö" label="Job"><globalcomment>Prüfen</globalcomment><c v="A01" tp="P001" tm="2026-10-22T11:12:13" c="0">Zeile 1\nZeile 2 &amp; mehr</c></CodingResults>`;
  const r=C.decodeResult(gzipSync(strToU8(xml)));assert.equal(r.coder,'ä&ö');assert.equal(r.entries[0].code,'0');assert.equal(r.entries[0].comment,'Zeile 1\nZeile 2 & mehr');
});
test('job matching uses variable, booklet, page and testee; results export contains later coded cases',async()=>{
  const job=await sampleJob();assert.equal(job.cases.length,2);assert.equal(job.cases[0].pages[0].path,'scans/B01-1_P001.png');assert.deepEqual(job.cases[0].pages[0].frame,{x:10,y:20,w:30,h:40});
  Object.assign(job.cases[1],{code:'0',comment:'ä < & "\nText',time:'2026-10-22T11:12:13'});
  const encoded=C.encodeResult(job,'Coder ä','Gesamt & mehr'),root=parseXML(strFromU8(gunzipSync(encoded))).documentElement;
  assert.equal(root.nodeName,'CodingResults');assert.equal(root.getAttribute('version'),'5');assert.equal(root.getElementsByTagName('c')[0].getAttribute('tp'),'P002');
  const loaded=await sampleJob();assert.equal(C.applyResult(loaded,C.decodeResult(encoded)),0);assert.equal(loaded.cases[1].comment,'ä < & "\nText');assert.equal(loaded.cases[0].code,'');
});
test('results reject wrong job ID, duplicate cases, bad XML and unknown codes without partial mutation',async()=>{
  const job=await sampleJob();assert.throws(()=>C.applyResult(job,{id:'different',entries:[]}),/anderen Job/);
  assert.throws(()=>C.decodeResult(strToU8('<CodingResults version="5"><c tp="P" v="A"/><c tp="P" v="A"/></CodingResults>')),/Doppelte/);
  assert.throws(()=>parseXML('<!DOCTYPE x [<!ENTITY e "bad">]><x>&e;</x>'),/Entitäten/);
  assert.throws(()=>C.applyResult(job,{id:'job-1',entries:[{testee:'P001',variable:'A01',code:'1'},{testee:'P002',variable:'A01',code:'UNKNOWN'}]}),/Unbekannter Code/);
  assert.equal(job.cases[0].code,'');
});
test('code alphabets and capacity match CodeFactory.vb; requesting the full code space terminates',()=>{
  assert.equal(T.LETTERS,'abcdefghprqstuvxyz');assert.equal(T.NUMBERS,'2345679');
  const all=T.generateCodes(2,T.codeCapacity(2));assert.equal(new Set(all).size,all.length);assert.ok(all.every(c=>/^[abcdefghprqstuvxyz][2345679]$/.test(c)));
  assert.throws(()=>T.generateCodes(2,T.codeCapacity(2)+1),/Vorrat/);assert.equal(T.generateCodes(12,25).length,25);
});
test('Codes.xlsx uses the four original columns and counts',async()=>{
  const w=await T.loadWorkbook(await T.codeWorkbook()),sheet=w.getWorksheet('Codes');assert.deepEqual(sheet.getRow(1).values.slice(1),['2 Stellen','3 Stellen','4 Stellen','5 Stellen']);
  for(const [i,count]of [100,200,500,2000].entries()){const values=[];for(let r=2;r<=2001;r++){const v=sheet.getCell(r,i+1).text;if(v)values.push(v);}assert.equal(values.length,count);assert.equal(new Set(values).size,count);}
});
test('the original Booklet template produces valid XML with all referenced blocks and units',async()=>{
  const w=await T.loadWorkbook(await readFile(new URL('../public/templates/Booklet-Template.xlsx',import.meta.url))),files=T.bookletXML(w);
  assert.ok(Object.keys(files).length>0);
  for(const bytes of Object.values(files)){const root=parseXML(strFromU8(bytes)).documentElement;assert.equal(root.nodeName,'Booklet');assert.ok(root.getElementsByTagName('Id')[0].textContent);assert.ok(root.getElementsByTagName('Unit').length>0);}
});
test('the original Login template produces unique logins, a monitor per group and Testtaker XML',async()=>{
  const w=await T.loadWorkbook(await readFile(new URL('../public/templates/Logins-Vorlage.xlsx',import.meta.url)));
  const ref=T.named(w,'groupsCol.Name1');ref.sheet.getCell(ref.row+1,1).value='Schule & Süd';
  for(const [k,v]of [['NumberTest',2],['NumberPlus',1],['NumberReview',1]]){const c=T.named(w,'groupsCol.'+k);c.sheet.getCell(`${c.col}${c.row+1}`).value=v;}
  // Isolate one test group without depending on mutable contents of the vendor template.
  ref.sheet.getCell(`${ref.col}${ref.row+2}`).value='';
  assert.equal(T.generateLogins(w,{length:4,passwordLength:0,monitor:true}),5);
  const rows=T.loginRows(w);assert.equal(new Set(rows.map(r=>r.name)).size,5);assert.equal(rows.filter(r=>r.mode==='monitor-group').length,1);assert.ok(rows.every(r=>!r.password));
  const root=parseXML(strFromU8(T.testtakerXML(w,{booklet:'B01'})['Testtaker.xml'])).documentElement;assert.equal(root.nodeName,'Testtakers');assert.equal(root.getElementsByTagName('Login').length,5);assert.equal(root.getElementsByTagName('Booklet').length,4);
  const exported=await T.loadWorkbook(await w.xlsx.writeBuffer());assert.equal(T.loginRows(exported).length,5);
});
test('CSV preserves empty cells, quoted delimiters, newlines, umlauts, zero prefixes and escaped quotes',()=>{
  const csv='"ID";"Antwort;Text";"Leer"\r\n"001";"Grüße\r\nEr sagt ""ja""";""\r\n';
  const rows=T.parseCSV(csv);assert.deepEqual(rows,[['ID','Antwort;Text','Leer'],['001','Grüße\r\nEr sagt "ja"','']]);assert.deepEqual(T.parseCSV(T.csvString(rows)),rows);
  assert.throws(()=>T.parseCSV('"broken'),/geschlossen/);
});
test('toolbox response JSON preserves person identifiers, alias and status filters',()=>{
  const data=[{group:'G',login:'L',code:'001',booklets:[{id:'B',units:[{id:'U',alias:'AL_',subforms:[{id:'S',responses:[{id:'v',value:['a','b'],status:'VALUE_CHANGED'},{id:'w',value:'',status:'NOT_REACHED'}]}]}]}]}];
  const rows=T.flattenResponses(data,{ignoreNotReached:true});assert.equal(rows.length,2);assert.equal(rows[1][2],'001');assert.equal(rows[1][7],'AL_v');assert.equal(rows[1][8],'["a","b"]');
});
