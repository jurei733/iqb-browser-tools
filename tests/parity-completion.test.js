import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {unzipSync,strFromU8} from 'fflate';
import initSqlJs from 'sql.js';
import {zoomBounds,stepZoom,rotateTemplate,moveTemplate} from '../src/viewer.js';
import {Diagnostics} from '../src/diagnostics.js';
import {prepare,validateBooklets} from '../src/preparation.js';
import {OutputDatabase} from '../src/database.js';
import {FileWorkspace} from '../src/file-workspace.js';
import {loadWorkbook,named} from '../src/toolbox.js';
import {encodeResult,decodeResult} from '../src/coding.js';
import {loginDocx} from '../src/docx.js';
import {windowsLongCSV,windowsSessionCSV} from '../src/windows-compatibility.js';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const file=async name=>({name:name.split('/').at(-1),bytes:new Uint8Array(await readFile(new URL('../public/'+name,import.meta.url)))});
test('parity: WPF zoom uses physical units, dynamic minimum and a tenth of the slider range',()=>{
 const b=zoomBounds(850,660,600,480);assert.equal(b.min,600/850);assert.equal(stepZoom(1,1,b),1+(2-600/850)*.1);assert.equal(stepZoom(0,-1,b),b.min);assert.equal(zoomBounds(192,128,600,480).max,600/192);
});
test('parity: template bounds and repeated shift drags use parent coordinates and reset the angle',()=>{
 const bounds={left:0,top:100,width:850,height:660,templateWidth:300,templateHeight:200};
 assert.deepEqual(moveTemplate({x:20,y:110},{x:-100,y:-200},bounds),{x:0,y:100});assert.deepEqual(moveTemplate({x:20,y:110},{x:1000,y:1000},bounds),{x:550,y:560});assert.equal(rotateTemplate(100,80,2),10);assert.equal(rotateTemplate(100,140,2),-20);
});
test('parity: diagnostic text retains all messages, Unicode, levels and operation boundaries',()=>{
 const d=new Diagnostics(),time=new Date('2026-10-31T00:00:00Z');for(const [level,message]of [['info','Start'],['warning','ä & Warnung'],['error','Fehler 1\nFehler 2']])d.add(message,{level,operation:'Booklets',time});
 assert.equal(d.entries.length,3);for(const value of ['Start','WARNING','ä & Warnung','ERROR','Fehler 1\r\n\tFehler 2','Booklets'])assert.ok(d.text().includes(value));
});
test('parity: Booklet preflight reports multiple errors together and worker preparation preserves them',async()=>{
 const input=await file('templates/Booklet-Template.xlsx'),w=await loadWorkbook(input.bytes);for(const name of ['unitsCol.Title','testletsCol.Units']){const r=named(w,name);r.sheet.getCell(r.col+(r.row+1)).value='';}
 assert.ok(validateBooklets(w).length>=2);input.bytes=new Uint8Array(await w.xlsx.writeBuffer());await assert.rejects(prepare('booklets',{file:input}),e=>e.messages.length>=2&&/Titel fehlt/.test(e.message)&&/fehlende Units/.test(e.message));
});
test('parity: preparation keeps existing logins and supports no-XML mode independently from regeneration',async()=>{
 const input=await file('examples/Logins-Beispiel.xlsx'),messages=[];
 const result=await prepare('logins',{file:input,renew:false,createXml:true,xmlOptions:{booklet:'B'}},m=>messages.push(m));assert.ok(result.outputs['Testtaker.xml']);
 await assert.rejects(prepare('logins',{file:input,renew:false,createXml:false}),/neu erzeugen oder/);
 const regenerated=await prepare('logins',{file:input,renew:true,createXml:false,loginOptions:{monitor:false,passwordLength:0}});assert.deepEqual(Object.keys(regenerated.outputs),['Logins-browser.xlsx']);
 const before=await loadWorkbook(input.bytes),after=await loadWorkbook(result.outputs['Logins-browser.xlsx']);assert.equal(before.getWorksheet('Logins').getCell('D2').text,after.getWorksheet('Logins').getCell('D2').text);assert.ok(messages.some(m=>m.includes('Ausgabe bereit')));
});
test('parity: Windows-compatible SQLite exports null codes as zero without changing the source snapshot',async()=>{
 const SQL=await initSqlJs(),db=new OutputDatabase(SQL);try{
  const data=JSON.parse(strFromU8((await file('examples/Antworten-Logs.json')).bytes));const r=data[0].booklets[0].units[0].subforms[0].responses[0];r.code=null;r.score=null;db.import(data);assert.equal(db.version,3);
  const exported=new OutputDatabase(SQL,db.exportWindows());try{assert.equal(exported.version,2);assert.equal(exported.people()[0].booklets[0].units[0].subforms[0].responses[0].code,0);assert.equal(db.people()[0].booklets[0].units[0].subforms[0].responses[0].code,null);assert.equal(exported.check().ok,true);}finally{exported.close();}
  db.run('UPDATE response SET code=?',['9007199254740993']);assert.throws(()=>db.exportWindows(),/32-Bit/);
 }finally{db.close();}
});
test('parity: original result mode reproduces the blank-person boundary while the complete mode retains later codes',()=>{
 const job={id:'parity',label:'P',cases:[{testee:'A',variable:{id:'V'},code:''},{testee:'B',variable:{id:'V'},code:'0'}]};assert.equal(decodeResult(encodeResult(job,'C','',{windows:true})).entries.length,0);assert.equal(decodeResult(encodeResult(job,'C')).entries.length,1);
});
test('parity: Windows Word mode writes BMP QR images at original dimensions and keeps raw login links',async()=>{
 const w=await loadWorkbook((await file('examples/Logins-Beispiel.xlsx')).bytes),template=(await file('templates/Logins-Vorlage2.docx')).bytes;
 const result=await loginDocx(w,template,'https://testcenter.example.org/',{windows:true,qrCentimeters:4}),zip=unzipSync(result.files['Logins.docx']);const images=Object.entries(zip).filter(([n])=>n.endsWith('.bmp'));assert.equal(images.length,result.count);assert.equal(strFromU8(images[0][1].slice(0,2)),'BM');const xml=strFromU8(zip['word/document.xml']);assert.ok(xml.includes('cx="1440000"'));assert.ok(strFromU8(zip['[Content_Types].xml']).includes('image/bmp'));
});
test('parity: directory saves serialize stable snapshots and recover after a failed write',async()=>{
 const writes=[];let fail=true;const root={getFileHandle:async name=>({createWritable:async()=>({write:async bytes=>{if(fail){fail=false;throw Error('disk full');}writes.push([name,[...bytes]]);},close:async()=>{},abort:async()=>{}})})};const fs=new FileWorkspace(root);await assert.rejects(fs.save('A',new Uint8Array([1])),/disk full/);const bytes=new Uint8Array([2]);const saved=fs.save('A',bytes);bytes[0]=9;await saved;assert.deepEqual(writes,[['A.result',[2]]]);
});
test('parity: original CSV retains German dates, original quote handling and the multi-session omission',()=>{
 const p=[{group:'G',login:'001',code:'0',booklets:[{id:'B',sessions:[],units:[{id:'U',alias:'A',chunks:[{id:'x',ts:'1000',variables:['v']}],subforms:[{id:'',responses:[{id:'v',status:'VALUE_CHANGED',value:'a"b',code:0,score:1}]}]}]}]}];
 const csv=windowsLongCSV(p);assert.ok(csv.includes('01.01.1970 00:00:01'));assert.ok(csv.includes('"a"b"'));assert.ok(csv.endsWith('\r\n'));
 const b=p[0].booklets[0];b.sessions=[{ts:100,loadCompleteMS:20,browser:'B',os:'O',screen:'10 x 20'}];assert.equal(windowsSessionCSV(p).split('\r\n').length,3);b.sessions.push({...b.sessions[0],ts:200});assert.equal(windowsSessionCSV(p).split('\r\n').length,2);
});

test('parity: Windows import skips a changed booklet at the same end timestamp and replaces it after a later end',async()=>{
 const SQL=await initSqlJs(),db=new OutputDatabase(SQL);try{const people=JSON.parse(strFromU8((await file('examples/Antworten-Logs.json')).bytes)).slice(0,1);const b=people[0].booklets[0],value=()=>db.people()[0].booklets[0].units[0].subforms[0].responses[0].value;db.import(people,{windows:true});const old=value();b.units[0].subforms[0].responses[0].value='changed';b.firstTS-=1000;db.import(people,{windows:true});assert.equal(value(),old);b.lastTS+=1000;db.import(people,{windows:true});assert.equal(value(),'changed');assert.ok(db.check().ok);}finally{db.close();}
});
test('parity: Windows JSON import stops the current file on a concatenated-identity collision and reports it',async()=>{
 const {readDataFiles}=await import('../src/data.js'),rows=JSON.parse(strFromU8((await file('examples/Antworten-Logs.json')).bytes));Object.assign(rows[0],{group:'A',login:'BC',code:''});Object.assign(rows[1],{group:'AB',login:'C',code:''});Object.assign(rows[2],{group:'NEW',login:'1',code:''});const messages=[],files=[{name:'collision.json',text:JSON.stringify(rows)}];const actual=await readDataFiles(files,{windows:true,onWarning:m=>messages.push(m)});assert.equal(actual.length,1);assert.equal(actual[0].group,'A');assert.equal(messages.length,1);assert.match(messages[0],/ABC/);assert.equal((await readDataFiles(files)).length,3);
});
