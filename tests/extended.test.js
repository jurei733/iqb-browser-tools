import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import initSqlJs from 'sql.js';
import * as C from '../src/coding.js';
import * as T from '../src/toolbox.js';
import * as D from '../src/data.js';
import {OutputDatabase} from '../src/database.js';
import {loginDocx,loginLink} from '../src/docx.js';
import {TestcenterClient,solveChallenge,apiBase,contentIndex} from '../src/testcenter.js';
import {resolution} from '../src/image.js';
import {parseXML,decodeXML} from '../src/xml.js';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
test('XML inputs respect UTF-16 and historical Windows character declarations',()=>{
  const xml='<?xml version="1.0" encoding="UTF-16"?><x>Grüße</x>',bytes=Buffer.from('\ufeff'+xml,'utf16le');assert.equal(parseXML(decodeXML(bytes)).documentElement.textContent,'Grüße');
  assert.equal(parseXML(decodeXML(Buffer.from('<?xml version="1.0" encoding="windows-1252"?><x>Grüße</x>','latin1'))).documentElement.textContent,'Grüße');
});
const SQL=await initSqlJs();
const file=(name,bytes)=>({name,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
const chunk=(value,ts=2000,subform='')=>({id:'all',responseType:'iqb-standard@1.1',ts,content:JSON.stringify([{id:'v',value,status:'CODING_COMPLETE',code:0,score:0,subform}])});
const dto=(value='ä; "ja"\n001',ts=2000)=>({groupname:"G'1",loginname:'001',code:'00',bookletname:'B',unitname:'U_',originalUnitId:'Original',responses:[chunk(value,ts)],laststate:'{"currentPage":"001"}'});
const log=(timestamp=1000,unitname='')=>({...dto(),unitname,timestamp,logentry:'LOADCOMPLETE : '+JSON.stringify({browserName:'Firefox',browserVersion:'130',osName:'Linux',screenSizeWidth:800,screenSizeHeight:1200,loadTime:500})});
const persons=()=>D.peopleFromDTO([dto()],[log()]);

test('all original response converters retain nulls, arrays, subforms and defaults',()=>{
  assert.deepEqual(D.parseChunk('{"responsesGiven":{},"pagesViewed":{},"v":"x"}','IQBVisualUnitPlayerV2.1.0')[0].responses.map(r=>r.id),['v']);
  const abi=D.parseChunk('{"var_1":"a","var_2":"b","var_0":"c","plain":"d"}','unknown');assert.deepEqual(abi.map(s=>s.id),['','1','2']);
  assert.equal(D.parseChunk('{"answers":{"v":"001"}}','iqb-simple-player@1.0.0')[0].responses[0].value,'001');
  for(const type of ['iqb-aspect-player@0.1.1','iqb-standard@1.0.0','iqb-standard@1.0','iqb-standard@1.1'])assert.equal(D.parseChunk('{"id":"v","value":null}',type)[0].responses[0].value,'#null#');
  assert.equal(D.parseChunk('[{"id":"v","value":["a","b"],"subform":"1"}]','iqb-standard@1.1')[0].responses[0].value,'["a","b"]');
  assert.equal(D.parseChunk('invalid','iqb-standard@1.1')[0].responses[0].status,'ERROR');
});
test('legacy 11-column, 2019 and 2024 CSV schemas preserve values and original unit IDs',()=>{
  const base=['groupname','loginname','code','bookletname','unitname'];
  for(const year of [2011,2019,2024]){const headers=[...base,...(year===2024?['originalUnitId']:[]),'responses',...(year===2011?['restorePoint','responseType','response-ts','restorePoint-ts']:[]),'laststate'];const d=dto();if(year===2011){d.responses=chunk(null).content;d.restorePoint='';d.responseType='iqb-standard@1.1';d['response-ts']=2000;d['restorePoint-ts']=0;}else d.responses=JSON.stringify(d.responses);const csv=T.csvString([headers,headers.map(h=>d[h]??'')]);const p=D.importCSV(csv),r=D.responseRecords(p)[0];assert.equal(r.responseValue,year===2011?'#null#':'ä; "ja"\n001');assert.equal(r.unitName,year===2024?'Original':'U_');assert.equal(r.ts,'2000');}
});
test('responses and logs merge by tuple, retain original IDs and choose latest responses independent of file order',async()=>{
  const recent=D.peopleFromDTO([dto('new',4000)],[]),old=D.peopleFromDTO([dto('old',2000)],[]),logs=D.peopleFromDTO([],[{...log(),originalUnitId:undefined,unitname:'U_',logentry:'PAGE = 1'}]);
  for(const p of [D.mergePeople(recent,old,logs),D.mergePeople(logs,old,recent)]){assert.equal(p[0].booklets[0].units.length,1);assert.equal(D.responseRecords(p)[0].responseValue,'new');assert.equal(D.responseRecords(p)[0].ts,'4000');assert.equal(p[0].booklets[0].units[0].id,'Original');assert.equal(p[0].booklets[0].units[0].logs[0].key,'PAGE');}
  assert.equal(D.responseRecords(D.peopleFromDTO([dto('new',4000),dto('old',2000)]))[0].responseValue,'new');
  const colliding=D.mergePeople(D.peopleFromDTO([{...dto(),groupname:'AB',loginname:'C'}]),D.peopleFromDTO([{...dto(),groupname:'A',loginname:'BC'}]));assert.equal(colliding.length,2);
  const merged=await D.readDataFiles([{name:'one.json',text:JSON.stringify(recent)},{name:'two.json',text:JSON.stringify(old)}]);assert.equal(D.responseRecords(merged)[0].responseValue,'new');
});
test('wide workbooks implement all three subform modes and the four original sheets',async()=>{
  const d=dto();d.responses=[chunk('plain'),chunk('one',3000,'1'),chunk('two',4000,'2')];const data=D.peopleFromDTO([d]);
  for(const mode of ['rows','columns','none']){const w=await T.loadWorkbook(await D.wideWorkbook(data,{subformMode:mode}));assert.deepEqual(w.worksheets.map(s=>s.name),['Antworten','Status','Codes','Scores']);const s=w.worksheets[0];assert.equal(s.rowCount,mode==='rows'?4:2);assert.deepEqual(s.getRow(1).values.slice(1,4),['ID','Group','Login+Code']);assert.equal(s.getCell(2,3).text,'00100');if(mode==='columns')assert.deepEqual(s.getRow(1).values.slice(4),['U_v','U_v##1','U_v##2']);else assert.equal(s.getCell(2,4).text,'plain');}
  await assert.rejects(()=>D.wideWorkbook(data,{values:false,status:false,codes:false,scores:false}),/mindestens/);
});
test('long and multi-session exports retain original headers, quotes, milliseconds and Mbit/s',()=>{
  const data=persons(),b=data[0].booklets[0];b.sessions.push({...b.sessions[0],ts:10000});b.units.push({...structuredClone(b.units[0]),id:'Second',alias:'V_',chunks:[{id:'all',type:'',ts:'12000',variables:['v']}]});
  const table=D.longTable(data);assert.deepEqual(table[0],D.LONG_HEADERS);assert.equal(table[1][4],'Original');assert.equal(T.parseCSV(D.longCSV(data))[1][8],'ä; "ja"\n001');
  const sessions=D.sessionTable(data,{B:1000000});assert.equal(sessions.length,3);assert.equal(sessions[1][2],1);assert.equal(sessions[2][2],2);assert.equal(sessions[1][3],2);assert.equal(sessions[1][7],1500);assert.equal(sessions[1][11],16);assert.equal(sessions[1][15],1200);assert.equal(sessions[2][7],2500);
});
test('SQLite roundtrip preserves every data table, zero codes, custom statuses and quoted values',()=>{
  const data=persons(),u=data[0].booklets[0].units[0];u.logs=[{ts:1900,key:'PAGE',parameter:'"1"'}];u.subforms.push({id:'S',responses:[{id:'custom',value:'001',status:'CUSTOM',code:0,score:0}]});u.chunks.push({id:'s',type:'iqb-standard@1.1',ts:'2100',variables:['S##custom']});
  const db=new OutputDatabase(SQL);db.import(data);db.setSizes({B:1234});const bytes=db.export();assert.equal(strFromU8(bytes.slice(0,15)),'SQLite format 3');const again=new OutputDatabase(SQL,bytes);
  assert.deepEqual(again.people(),D.refreshTimes(data));assert.equal(again.summary().people,1);assert.equal(again.summary().responses,2);assert.equal(again.sizes().B,1234);assert.equal(again.check().ok,true);assert.equal(again.query('SELECT variables FROM chunk WHERE key=?',['s'])[0].variables,'S##custom');db.close();again.close();
});
test('SQLite imports are idempotent, merge log-only CSV and replace only imported booklets',()=>{
  const db=new OutputDatabase(SQL);db.import(persons());db.import(persons());assert.equal(db.summary().people,1);assert.equal(db.summary().responses,1);assert.equal(db.query('SELECT count(*) n FROM session')[0].n,1);
  db.import(D.peopleFromDTO([dto('new',4000)]));db.import(D.peopleFromDTO([dto('old',1500)]));assert.equal(D.responseRecords(db.people())[0].responseValue,'new');
  const headers=['groupname','loginname','code','bookletname','unitname','timestamp','logentry'],l={...log(5000),logentry:'END = done'};db.import(D.importCSV(T.csvString([headers,headers.map(h=>l[h])])));assert.equal(db.people()[0].booklets[0].logs.length,2);
  db.import(D.peopleFromDTO([{...dto(),bookletname:'Other'}]));db.import(D.peopleFromDTO([dto('replacement',6000)]),{merge:false});assert.equal(db.people()[0].booklets.length,2);assert.equal(D.responseRecords(db.people()).find(r=>r.booklet==='B').responseValue,'replacement');assert.equal(db.check().ok,true);db.close();
});
test('SQLite v1 string statuses open; rejected files and bad sizes leave valid state intact',()=>{
  const db=new OutputDatabase(SQL);db.import(persons());db.run('UPDATE response SET status=?',['CODING_COMPLETE']);db.meta('version','1');const v1=new OutputDatabase(SQL,db.export());assert.equal(D.responseRecords(v1.people())[0].responseStatus,'CODING_COMPLETE');assert.throws(()=>v1.setSizes({B:-1}),/Ungültige/);assert.equal(v1.check().ok,true);assert.throws(()=>new OutputDatabase(SQL,new Uint8Array([1,2,3])));db.close();v1.close();
});
test('SQLite failed import rolls back all changes; duplicate detection is actionable',()=>{
  const db=new OutputDatabase(SQL);db.import(persons());const before=db.summary().responses;db.run("CREATE TRIGGER reject_fixture BEFORE INSERT ON response WHEN NEW.value='fail' BEGIN SELECT RAISE(ABORT,'fixture rejected'); END");const bad=persons();bad[0].booklets[0].units[0].subforms[0].responses[0].value='fail';assert.throws(()=>db.import(bad),/fixture rejected/);assert.equal(db.summary().responses,before);assert.equal(db.check().ok,true);
  db.insert('person',['group','login','code'],["G'1",'001','00']);assert.equal(db.check().ok,false);assert.throws(()=>db.import(persons()),/doppelte Personen/);db.close();
});
async function logins(){const w=await T.loadWorkbook(await readFile(new URL('../public/templates/Logins-Vorlage.xlsx',import.meta.url))),name=T.named(w,'groupsCol.Name1');name.sheet.getCell(`${name.col}${name.row+1}`).value='Schule & Süd';name.sheet.getCell(`${name.col}${name.row+2}`).value='';for(const [k,v]of [['NumberTest',1],['NumberPlus',1],['NumberReview',1]]){const c=T.named(w,'groupsCol.'+k);c.sheet.getCell(`${c.col}${c.row+1}`).value=v;}T.generateLogins(w,{length:5,passwordLength:3,prefixTestee:true,prefixReserve:true,prefixReview:true,suffix:'_DEMO'});return w;}
test('individual login prefixes and original group suffix generation are retained',async()=>{
  const w=await logins(),rows=T.loginRows(w);assert.equal(rows.length,4);assert.ok(rows[0].name.startsWith('T01_'));assert.ok(rows[1].name.startsWith('RS_'));assert.ok(rows[2].name.startsWith('RV_'));assert.ok(rows[3].name.startsWith('TL_'));assert.ok(rows.every(r=>r.group));
});
test('both original Word templates retain document structure, text controls and QR relationships',async()=>{
  const w=await logins(),rows=T.loginRows(w);for(const n of [1,2]){const result=await loginDocx(w,await readFile(new URL(`../public/templates/Logins-Vorlage${n}.docx`,import.meta.url)),'https://tc.example.org/');assert.equal(result.count,4);const entries=unzipSync(result.files['Logins.docx']),doc=parseXML(strFromU8(entries['word/document.xml'])),text=doc.documentElement.textContent;assert.ok(text.includes(rows[0].name));assert.ok(text.includes('Schule & Süd'));assert.ok(!text.includes('Klicken oder tippen'));if(n===2){const images=Object.keys(entries).filter(n=>n.startsWith('word/media/iqb-qr-'));assert.equal(images.length,4);assert.ok(images.every(k=>entries[k][0]===137));assert.ok(strFromU8(entries['word/_rels/document.xml.rels']).includes('rIdIQB'));assert.ok(strFromU8(entries['[Content_Types].xml']).includes('image/png'));}}
  assert.equal(loginLink('tc.example.org/','A & B'),'https://tc.example.org/#/A%20%26%20B');
});
test('custom DOCX table templates repeat safely per login; cancellation aborts generation',async()=>{
  const w=await logins(),template=unzipSync(await readFile(new URL('../public/templates/Logins-Vorlage1.docx',import.meta.url)));template['word/document.xml']=strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:sdt><w:sdtPr><w:tag w:val="login"/></w:sdtPr><w:sdtContent><w:r><w:t>placeholder</w:t></w:r></w:sdtContent></w:sdt></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>');const bytes=zipSync(template),out=await loginDocx(w,bytes,'tc.example.org',{perGroup:true}),doc=parseXML(strFromU8(unzipSync(Object.values(out.files)[0])['word/document.xml']));assert.equal(doc.getElementsByTagName('w:tbl').length,4);assert.equal(doc.getElementsByTagName('w:sectPr').length,1);
  const aborter=new AbortController();aborter.abort();await assert.rejects(()=>loginDocx(w,bytes,'tc.example.org',{signal:aborter.signal}),{name:'AbortError'});
});
test('reviews export category presence and sanitize duplicate worksheet names',async()=>{
  const rows=[{groupname:'G',loginname:'001',code:'00',unitname:'a/b','category: design':'','category: tech':null,'category: content':'x',entry:'ä & "'},{unitname:'a?b','category: tech':false,entry:'two'}];const w=await T.loadWorkbook(await D.reviewsWorkbook(rows));assert.deepEqual(w.worksheets.map(s=>s.name),['a_b','a_b_1']);assert.deepEqual(w.worksheets.map(s=>s.getCell(2,5).text).sort(),['D / C','T']);
});
const response=(value,status=200)=>new Response(typeof value==='string'?value:JSON.stringify(value),{status,headers:{'Content-Type':typeof value==='string'?'text/plain':'application/json'}});
test('Testcenter plain authentication, workspace discovery, encoded reports and AuthToken follow original API',async()=>{
  const calls=[],client=new TestcenterClient('https://tc.example.org/',{fetch:async(url,init)=>{calls.push({url,init});if(url.endsWith('/session/admin'))return response({token:'TEST',access:{workspaceAdmin:['w 1']}});if(url.endsWith('/workspace/w%201'))return response({name:'Demo'});return response([]);}});assert.deepEqual(await client.login('admin','pw'),[{id:'w 1',name:'Demo'}]);client.workspace='w 1';await client.report('response','G & 1');assert.ok(calls.at(-1).url.endsWith('/report/response?dataIds=G%20%26%201'));assert.equal(calls.at(-1).init.headers.AuthToken,'TEST');assert.deepEqual(JSON.parse(calls[0].init.body),{name:'admin',password:'pw'});client.disconnect();assert.equal(client.token,'');assert.equal(apiBase('tc.example.org/api/'),'https://tc.example.org/api');
});
test('Testcenter challenge authentication solves inclusive maxNumber and preserves signed payload',async()=>{
  const challenge={algorithm:'SHA-256',salt:'salt',signature:'signed',maxNumber:2,challenge:Buffer.from(await crypto.subtle.digest('SHA-256',strToU8('salt2'))).toString('hex')};assert.equal(await solveChallenge(challenge),2);const calls=[],client=new TestcenterClient('tc.example.org',{fetch:async(url,init)=>{calls.push({url,init});if(url.endsWith('/session/admin'))return response('Challenge required',400);if(url.endsWith('/session/challenge'))return response(challenge);if(url.endsWith('/session'))return response({token:'TEST',access:{workspaceAdmin:[]}});throw new Error('unexpected');}});assert.deepEqual(await client.login('a','b'),[]);assert.deepEqual(JSON.parse(calls[1].init.body),{loginType:'admin',name:'a',password:'b'});assert.deepEqual(JSON.parse(calls[2].init.body),{algorithm:'SHA-256',challenge:challenge.challenge,salt:'salt',signature:'signed',number:2});
  await assert.rejects(()=>solveChallenge({...challenge,algorithm:'MD5'}),/Algorithmus/);
});
test('Testcenter dependencies batch at 600, sizes deduplicate resources, content includes escaped index',async()=>{
  const files=[{type:'Booklet',name:'B.xml',id:'B',size:10},{type:'Unit',name:'U.xml',id:'U',size:20,info:{label:'<unsafe>'}},{type:'Resource',name:'player.html',size:30}],calls=[];
  const client=new TestcenterClient('tc.example.org',{fetch:async(url,init)=>{calls.push({url,init});if(url.endsWith('/files'))return response({Booklet:[files[0]],Unit:[files[1]],Resource:[files[2]]});if(url.endsWith('/files-dependencies')){const names=JSON.parse(init.body).body;return response(names.includes('B.xml')?[{...files[0],dependencies:[{relationship_type:'containsUnit',object_name:'U.xml'},{relationship_type:'usesPlayer',object_name:'player.html'},{relationship_type:'usesPlayer',object_name:'player.html'}]}]:[{...files[1],dependencies:[]}]);}return response('file');}});client.workspace=1;assert.deepEqual(await client.bookletSizes(),{B:60});const out=unzipSync(await client.content());assert.deepEqual(Object.keys(out).sort(),['B.xml','U.xml','index.html','player.html']);assert.ok(strFromU8(out['index.html']).includes('&lt;unsafe&gt;'));await client.dependencies(Array.from({length:601},(_,i)=>String(i)));assert.deepEqual(calls.filter(c=>c.url.endsWith('files-dependencies')).slice(-2).map(c=>JSON.parse(c.init.body).body.length),[600,1]);assert.ok(!contentIndex([{...files[1],name:'x".xml'}]).includes('href="x"'));
});
test('Testcenter CSV combines exactly one header and network errors explain CORS',async()=>{
  const client=new TestcenterClient('tc.example.org',{fetch:async()=>response('id;value\r\n001;"a;b"\r\n')});client.workspace=1;const csv=T.parseCSV(strFromU8(await client.rawCSV('response',['G1','G2'])));assert.equal(csv.length,3);assert.deepEqual(csv[1],['001','a;b']);client.fetch=async()=>{throw new TypeError('network');};await assert.rejects(()=>client.groups(),/CORS/);
});
test('default Testcenter fetch retains the browser-global receiver',async()=>{
  const original=globalThis.fetch;globalThis.fetch=function(){assert.equal(this,globalThis);return Promise.resolve(response([]));};try{const client=new TestcenterClient('tc.example.org');client.workspace=1;assert.deepEqual(await client.groups(),[]);}finally{globalThis.fetch=original;}
});
test('scan resolution reads PNG pHYs and JPEG JFIF metadata',async()=>{
  const png=new Uint8Array(50),p=new DataView(png.buffer);p.setUint32(0,0x89504e47);p.setUint32(8,9);png.set(strToU8('pHYs'),12);p.setUint32(16,11811);p.setUint32(20,11811);png[24]=1;assert.ok(Math.abs((await resolution(png))[0]-300)<.01);
  const jpeg=new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1,1,1,1,44,1,44,0,0,255,217]);assert.deepEqual(await resolution(jpeg),[300,300]);assert.deepEqual(await resolution(new Uint8Array([1])),[96,96]);
});
test('legacy coding packages, person prefixes, templates and training flag import together',async()=>{
  const xml='<Job id="old"><jobOptionen><personenprefix>JA</personenprefix><kommentare>NEIN</kommentare></jobOptionen><Variablen><Variable bezeichner="A" aufgbez="Alt"><Kodierung bewertung="1"><Wert>1</Wert><Bedingung>richtig</Bedingung></Kodierung><loc b="B" p="1"/></Variable><Variable name="B"><Label>Zweite</Label><Code kennung="1" score="1">richtig</Code><locs><Ort seiteID="B-1"/></locs></Variable></Variablen><Pakete><VariablenPaket><Variable bezeichner="A"/><Variable bezeichner="B"/></VariablenPaket></Pakete></Job>',bytes=zipSync({'job.xml':strToU8(xml),'A/B-1_ABCD001.png':new Uint8Array([1]),'CT_A.png':new Uint8Array([2])});
  const result=await C.readCodingFiles([file('job.zip',bytes)]),job=result.jobs[0];assert.equal(result.jobs.length,1);assert.equal(job.cases.length,2);assert.equal(job.cases[0].testee,'001');assert.equal(job.settings.enableComments,false);assert.ok(job.cases[0].template);assert.equal(job.variables[1].label,'Zweite');
  const training=xml.replace('jobOptionen>','jobOpts training="true">').replace('</jobOptionen>','</jobOpts>');const modern=await C.readCodingFiles([file('x.zip',zipSync({'job.xml':strToU8(training),'A/B-1_ABCD001.png':new Uint8Array([1])}))]);assert.equal(modern.jobs[0].settings.training,true);
});
test('modern coding jobs resolve duplicate basenames by variable directory and root loose templates',async()=>{
  const v=id=>`<v id="${id}"><c id="0"/><loc b="B" p="1"/></v>`,xml=`<CodingJob id="j"><Variablen>${v('A')}${v('B')}</Variablen><Cases>P</Cases></CodingJob>`;const job=(await C.readCodingFiles([file('x.zip',zipSync({'j.xml':strToU8(xml),'A/B-1_P.png':new Uint8Array([1]),'B/B-1_P.png':new Uint8Array([2])}))])).jobs[0];assert.equal(job.cases[0].pages[0].bytes[0],1);assert.equal(job.cases[1].pages[0].bytes[0],2);
  const loose=(await C.readCodingFiles([file('j.xml',strToU8(xml)),file('B-1_P.png',new Uint8Array([1])),file('Testschablone.png',new Uint8Array([2]))])).jobs[0];assert.ok(loose.cases.every(c=>c.template));
});
test('coding crop and DPI corrections, code cycling and atomic person batch match original controls',()=>{
  assert.deepEqual(C.adjustFrame({x:10,y:10,w:50,h:40},{x:20,y:5},192,96),{x:0,y:5,w:80,h:40});const variable={codes:[{id:'0'},{id:'1'},{id:'9'}]},job={cases:[{testee:'P',variable,code:''},{testee:'P',variable,code:''},{testee:'Q',variable,code:''}]};assert.equal(C.batchCode(job,0,'1'),2);assert.deepEqual(job.cases.map(c=>c.code),['1','1','']);assert.equal(C.cycleCode(job.cases[0],-1),'0');job.cases[1].variable={codes:[{id:'10'},{id:'11'}]};assert.throws(()=>C.batchCode(job,0,'1'),/nichts geändert/);assert.equal(job.cases[0].code,'1');
});
