import {DOMParser as PortableParser} from '@xmldom/xmldom';
import {unzipSync,zipSync,strToU8,strFromU8} from 'fflate';
import * as T from '../src/toolbox.js';
import * as C from '../src/coding.js';
import * as D from '../src/data.js';
import {converterCorpus,converterTypes,pipelineCorpus} from '../scripts/converter-corpus.mjs';
import {parseXML,decodeXML} from '../src/xml.js';
import {decodeCanvas} from '../src/image.js';
import {loginDocx} from '../src/docx.js';
import {task,cancelTasks} from '../src/worker-client.js';
import {solveChallenge,TestcenterClient} from '../src/testcenter.js';
const $=s=>document.querySelector(s),checks=[];
const assert=(condition,message='Prüfung fehlgeschlagen')=>{if(!condition)throw new Error(message);};
const get=async url=>{const r=await fetch(url);if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);return new Uint8Array(await r.arrayBuffer());};
const check=(name,fn)=>checks.push({name,fn});
const file=(name,bytes)=>({name,bytes});
$('#browser').textContent=navigator.userAgent;
let job,resultBytes,peopleBytes,sqlite,logins;
check('XML: native Parser, Sonderzeichen und fehlerhafte XML',()=>{assert(parseXML('<x>ä &amp; ü</x>').documentElement.textContent==='ä & ü');let rejected=false;try{parseXML('<x><y></x>');}catch{rejected=true;}assert(rejected,'Fehlerhafte XML wurde akzeptiert');assert(new PortableParser().parseFromString('<x>ü</x>').documentElement.textContent==='ü');});
check('XML: historische UTF-16-Kodierung',()=>{const xml='\ufeff<x>Grüße</x>',bytes=new Uint8Array(xml.length*2);for(let i=0;i<xml.length;i++){bytes[i*2]=xml.charCodeAt(i)&255;bytes[i*2+1]=xml.charCodeAt(i)>>8;}assert(parseXML(decodeXML(bytes)).documentElement.textContent==='Grüße');});
check('Kodieren: ZIP im echten Module-Worker importieren',async()=>{const loaded=await task('coding',{files:[file('Schablone.zip',await get('/examples/Kodierjob-Schablone.zip'))]});assert(loaded.jobs.length===1);job=loaded.jobs[0];assert(job.cases.length===1&&job.cases[0].template);});
check('Kodieren: Scan, DPI und transparente Schablone zeichnen',async()=>{const scan=await decodeCanvas(job.cases[0].pages[0]),mask=await decodeCanvas(job.cases[0].template);assert(scan.canvas.width===850&&mask.canvas.width===300);assert(Math.abs(scan.dpiX-96)<.1);assert(mask.canvas.getContext('2d').getImageData(0,0,1,1).data[3]===0);});
check('Kodieren: unterschiedliche X/Y-DPI behalten die physischen Scan- und Schablonenproportionen',async()=>{
 for(const name of ['anisotropic.png','anisotropic.jpg','anisotropic.bmp','anisotropic.tif']){
 const {canvas,dpiX,dpiY}=await decodeCanvas({path:name,bytes:await get('/fixtures/'+name)});
 assert(canvas.width===192&&canvas.height===128);assert(Math.abs(dpiX-192)<.1&&Math.abs(dpiY-96)<.1);
 canvas.style.width='192px';document.body.append(canvas);
 try{const bounds=canvas.getBoundingClientRect();assert(Math.abs(bounds.width/bounds.height-.75)<.001,`Verändertes Seitenverhältnis ${bounds.width}×${bounds.height}`);
  canvas.className='template-layer';canvas.style.width='96px';const overlay=canvas.getBoundingClientRect();assert(Math.abs(overlay.width/overlay.height-.75)<.001);
 }finally{canvas.remove();}
 }
});
for(const name of ['scan.png','scan.jpg','scan.bmp','scan.gif','scan.webp','scan.tif','orientation2.jpg','orientation3.jpg','orientation4.jpg','orientation5.jpg','orientation6.jpg','orientation7.jpg','orientation8.jpg','orientation6.png','orientation6.webp'])check('Bilddekoder: '+name,async()=>{const image=await decodeCanvas({path:name,bytes:await get('/fixtures/'+name)});assert(image.canvas.width===192&&image.canvas.height===128,`Unerwartete Abmessungen ${image.canvas.width}×${image.canvas.height}`);const pixel=image.canvas.getContext('2d').getImageData(20,20,1,1).data;assert(pixel[0]>170&&pixel[1]<100,`Bildkoordinaten verändert: ${[...pixel]}`);});
check('Bilddekoder: HTML-Image-Fallback nach Bitmap-Fehler',async()=>{const original=globalThis.createImageBitmap;try{globalThis.createImageBitmap=async()=>{throw new Error('Simulierter Dekoderfehler');};const image=await decodeCanvas({path:'scan.png',bytes:await get('/fixtures/scan.png')});assert(image.canvas.width===192&&image.canvas.height===128);}finally{globalThis.createImageBitmap=original;}});
check('Kodieren: GZip-Ergebnisse mit Code 0 und Kommentar',()=>{job.cases[0].code='0';job.cases[0].comment='ä & "\n001';resultBytes=C.encodeResult(job,'Engine-Test','Gesamtkommentar');const decoded=C.decodeResult(resultBytes);assert(decoded.entries[0].code==='0'&&decoded.entries[0].comment==='ä & "\n001');job.cases[0].code='';C.applyResult(job,decoded);assert(job.cases[0].code==='0');});
check('Safari-Ergebnisdateinamen: .result-2 im Worker importieren',async()=>{assert(C.isResultFilename('Beispiel.result-2'));const loaded=await task('coding',{files:[file('Schablone.zip',await get('/examples/Kodierjob-Schablone.zip')),file('Beispiel.result-2',resultBytes)]});assert(loaded.results.length===1&&loaded.results[0].entries[0].code==='0');assert(C.resultFilename('Job').endsWith('.result'));});
check('Codes: Excel-Datei im Browser erzeugen und erneut lesen',async()=>{const w=await T.loadWorkbook(await T.codeWorkbook());assert(w.getWorksheet('Codes').getCell('D2001').text.length===5);});
check('Booklets: Original-Xlsx zu gültigen Booklet-XML-Dateien',async()=>{const w=await T.loadWorkbook(await get('/templates/Booklet-Template.xlsx')),files=T.bookletXML(w);assert(Object.keys(files).length>0);for(const bytes of Object.values(files))assert(parseXML(strFromU8(bytes)).documentElement.localName==='Booklet');});
check('Windows-Originalexport: SpreadsheetML mit Namespace-Präfix und führenden Nullen einlesen',async()=>{const csv=await T.loadWorkbook(await get('/fixtures/windows-csv.xlsx')),sheet=csv.getWorksheet('Syscheck-Daten');assert(sheet.getCell('A2').text==='001'&&sheet.getCell('B2').text==='Grüße, Welt');const wide=await T.loadWorkbook(await get('/fixtures/windows-export.xlsx'));assert(wide.worksheets.length===4&&wide.getWorksheet('Codes').getCell('E3').text==='0');});
check('Logins: Originalvorlage, Präfixe und Testtaker-XML',async()=>{const w=await T.loadWorkbook(await get('/examples/Logins-Beispiel.xlsx'));const count=T.generateLogins(w,{length:5,passwordLength:3,monitor:true,prefixTestee:true});assert(count===4);assert(T.loginRows(w)[0].name.startsWith('T01_'));const files=T.testtakerXML(w,{booklet:'DEMO'});assert(parseXML(strFromU8(Object.values(files)[0])).getElementsByTagName('Login').length===4);logins=w;});
for(const preset of [1,2])check('Word: Originalvorlage '+preset+(preset===2?' mit QR-Code':''),async()=>{const result=await loginDocx(logins,await get('/templates/Logins-Vorlage'+preset+'.docx'),'https://tc.example.org');assert(result.count===4);const zip=unzipSync(Object.values(result.files)[0]),xml=parseXML(strFromU8(zip['word/document.xml']));assert(xml.documentElement.textContent.includes(T.loginRows(logins)[0].name));if(preset===2)assert(Object.keys(zip).filter(k=>k.startsWith('word/media/iqb-qr-')).length===4);});
check('Antworten: CSV und Logs gemeinsam im Worker einlesen',async()=>{const summary=await task('load-data',{files:[file('Antworten.csv',await get('/examples/Antworten.csv')),file('Logs.csv',await get('/examples/Logs.csv'))]});assert(summary.people===3&&summary.responses===6);peopleBytes=await task('export-data',{format:'json'});assert(JSON.parse(strFromU8(peopleBytes))[0].booklets[0].sessions.length===1);});
for(const mode of ['rows','columns','none'])check('Antworten: breite Excel-Datei, Unterformulare '+mode,async()=>{const w=await T.loadWorkbook(await task('export-data',{format:'xlsx',options:{subformMode:mode}}));assert(w.worksheets.length===4);assert(w.worksheets[0].rowCount===(mode==='rows'?7:4));});
check('Antworten: CSV, gruppiertes JSON und Sitzungsberichte',async()=>{for(const format of ['long','json-groups','sessions','session-xlsx']){const bytes=await task('export-data',{format,sizes:{DEMO:1000000}});assert(bytes.length>30);if(format==='sessions')assert(T.parseCSV(strFromU8(bytes)).length===4);if(format==='json-groups')assert(unzipSync(bytes)['DEMO.json']);}});
check('SQLite: WASM, Import und Integritätsprüfung',async()=>{await task('new-db');const info=await task('db-import',{files:[file('data.json',peopleBytes)]});assert(info.people===3&&info.responses===6);await task('db-sizes',{sizes:{DEMO:1000000}});assert((await task('db-check')).ok);sqlite=await task('db-save');assert(strFromU8(sqlite.slice(0,15))==='SQLite format 3');});
check('SQLite: exportierte Datei erneut öffnen und auswerten',async()=>{const info=await task('open-db',{bytes:sqlite});assert(info.people===3&&info.sizes.DEMO===1000000);const bytes=await task('db-export',{format:'xlsx',options:{subformMode:'columns'}});assert((await T.loadWorkbook(bytes)).worksheets.length===4);});
check('Worker: nach Abbruch neu starten und Datenbank wiederherstellen',async()=>{cancelTasks();assert((await task('open-db',{bytes:sqlite})).responses===6);});
check('Browser-Speicher: IndexedDB schreiben und wieder lesen',async()=>{const name='iqb-cross-browser-'+Date.now();const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('qa');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('qa','readwrite');tx.objectStore('qa').put(sqlite,'db');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});const bytes=await new Promise((resolve,reject)=>{const r=db.transaction('qa').objectStore('qa').get('db');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});assert(bytes.length===sqlite.length);db.close();indexedDB.deleteDatabase(name);});
check('Testcenter: Web-Crypto-Challenge und Browser-fetch',async()=>{const salt='qa',digest=new Uint8Array(await crypto.subtle.digest('SHA-256',strToU8('qa3'))),challenge=Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('');assert(await solveChallenge({algorithm:'SHA-256',salt,maxNumber:3,challenge})===3);const client=new TestcenterClient(location.origin);const data=await client.request('/../examples/BookletSizes.json');assert(data.DEMO===1000000);});
check('Reviews: Export mit Kategorien und gültigen Blattnamen',async()=>{const bytes=await task('reviews',{reviews:[{groupname:'G',loginname:'001',code:'00',unitname:'Unit/1','category: design':'','category: tech':null,'category: content':'x',entry:'ä & "'}]});const w=await T.loadWorkbook(bytes);assert(w.worksheets[0].getCell(2,5).text==='D / C');});
check('Kodieroptionen: Leerzeichen bei True und False im Worker',async()=>{
 const xml='<CodingJob id="reference-flags"><jobOpts showScore=" True " enableComments=" True " suppressDescription=" False "/><Variablen><v id="A"><c id="0"/><loc b="B" p="1"/></v></Variablen><Cases>001</Cases></CodingJob>';
 const bytes=zipSync({'job.xml':strToU8(xml),'B-1_001.png':new Uint8Array([1])});
 const loaded=await task('coding',{files:[file('flags.zip',bytes)]});assert(loaded.jobs[0].settings.showScore&&loaded.jobs[0].settings.enableComments&&!loaded.jobs[0].settings.suppressDescription);
});
check('Antwortkonverter: alte numerische Unterformulare und Boolean-Schreibweise',()=>{
 const forms=D.parseChunk('{"ab_01":"first","ab_1":"second","ab_0002":"third","ab_2147483648":"outside"}','unknown');
 assert(forms.map(v=>v.id).join('|')==='|1|2');assert(forms[1].responses[0].value==='first');assert(forms[0].responses[0].id==='ab_2147483648');
 assert(D.parseChunk('[{"id":"yes","value":true}]','iqb-standard@1.1')[0].responses[0].value==='True');
});
check('Große Antwortzahlen: API, Module-Worker, JSON, SQLite und Excel ohne Rundung',async()=>{
 const client=new TestcenterClient(location.origin,{fetch:async()=>new Response('{"value":9007199254740993}')});
 const result=await client.request('/reference');assert(typeof result.value==='bigint');
 const identity={groupname:'REF',loginname:result.value,code:0,bookletname:'B',unitname:'U'};
 await task('dto',{responses:[{...identity,responses:[{id:'all',ts:1000,responseType:'iqb-standard@1.1',content:[{id:'v',value:result.value}]}]}],logs:[]});
 let exported=JSON.parse(strFromU8(await task('export-data',{format:'json'})));assert(exported[0].login==='9007199254740993'&&exported[0].code==='0');assert(D.responseRecords(exported)[0].responseValue==='9007199254740993');
 const raw='[{"group":"REF","login":"001","booklets":[{"id":"B","units":[{"id":"U","subforms":[{"id":"","responses":[{"id":"v","value":9007199254740993}]}]}]}]}]';
 await task('new-db');await task('db-import',{files:[file('large.json',strToU8(raw))]});const saved=await task('db-save');await task('open-db',{bytes:saved});
 const workbook=await T.loadWorkbook(await task('db-export',{format:'xlsx',options:{subformMode:'rows'}}));assert(workbook.getWorksheet('Antworten').getCell(2,4).text==='9007199254740993');
});
let auditFrame;
const auditDoc=()=>auditFrame.contentDocument;
const waitAudit=async predicate=>{const start=Date.now();while(!predicate()){if(Date.now()-start>20000)throw new Error('Oberfläche antwortet nicht rechtzeitig.');await new Promise(r=>setTimeout(r,30));}};
const auditClick=selector=>{const el=auditDoc().querySelector(selector);assert(el,'Fehlendes Bedienelement '+selector);el.click();};
const auditSet=(selector,value)=>{const el=auditDoc().querySelector(selector);assert(el);el.value=value;el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
check('Funktionsmatrix Oberfläche: Joboptionen, fortlaufende Navigation, Rahmen und Zoom',async()=>{
 auditFrame=document.createElement('iframe');auditFrame.width='100%';auditFrame.height='800';auditFrame.src='/';document.body.append(auditFrame);await waitAudit(()=>auditDoc()?.querySelector('#coding-files'));
 const runId=Date.now();const xml=id=>`<CodingJob id="matrix-${id}-${runId}"><jobOpts showScore="false" enableComments="false" suppressDescription="true" anonym="true"/><Variablen><v id="V"><descr>HIDDEN DESCRIPTION</descr><c id="0" to="0"/><c id="1" to="1"/><loc b="B" p="1"><varframe x="1" y="1" w="10" h="10"/></loc></v></Variablen><Cases>001 002 003</Cases></CodingJob>`;
 const scan=await get('/fixtures/scan.png'),entries={'a.xml':strToU8(xml('a')),'b.xml':strToU8(xml('b'))};for(const person of ['001','002','003'])entries[`B-1_${person}.png`]=scan;
 const transfer=new DataTransfer();transfer.items.add(new File([zipSync(entries)],'matrix.zip'));const input=auditDoc().querySelector('#coding-files');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));await waitAudit(()=>auditDoc().querySelector('#case-number'));
 assert(!auditDoc().querySelector('#free-nav').checked);assert(!auditDoc().querySelector('#comment'));assert(!auditDoc().querySelector('.description'));assert(!auditDoc().querySelector('.code-option small'));assert(auditDoc().querySelector('.coding-panel .muted').textContent==='Testperson anonymisiert');
 auditSet('#case-number','3');auditDoc().querySelector('#case-number').dispatchEvent(new Event('change',{bubbles:true}));assert(auditDoc().querySelector('#case-number').value==='1');
 const physicalScan=await decodeCanvas({path:'scan.png',bytes:scan});await waitAudit(()=>auditDoc().querySelector('.scan-frame'));auditClick('#frame');await waitAudit(()=>!auditDoc().querySelector('.scan-frame'));auditSet('#zoom','150');await waitAudit(()=>{const box=auditDoc().querySelector('.scan-page');return box&&Math.abs(parseFloat(box.style.width)-192*96/physicalScan.dpiX*Number(auditDoc().querySelector('#zoom').value)/100)<.01;});
});
check('Funktionsmatrix Oberfläche: Code 0, sortierte Fallliste, richtiger Sprung und Dialog-Tastensperre',async()=>{
 auditClick('[data-code="1"]');await waitAudit(()=>auditDoc().querySelector('[data-code="1"]')?.getAttribute('aria-pressed')==='true');auditClick('#next');assert(auditDoc().querySelector('#case-number').value==='2');
 auditClick('[data-code="0"]');await waitAudit(()=>auditDoc().querySelector('[data-code="0"]')?.getAttribute('aria-pressed')==='true');auditClick('#coded-list');auditSet('#case-sort','code');assert(auditDoc().querySelector('.case-list button').dataset.case==='1');auditSet('#case-direction','desc');assert(auditDoc().querySelector('.case-list button').dataset.case==='0');
 auditDoc().querySelector('#close-cases').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert(auditDoc().querySelector('#case-number').value==='2');auditClick('[data-case="0"]');assert(auditDoc().querySelector('#case-number').value==='1');
 auditClick('#next');auditClick('#next');assert(auditDoc().querySelector('#case-number').value==='3');auditClick('[data-code="1"]');await waitAudit(()=>auditDoc().querySelector('.progress')?.textContent.includes('3 von 3'));
});
check('Funktionsmatrix Oberfläche: Jobwechsel erhält Fortschritt und vollständig kodierte Jobs öffnen am letzten Fall',async()=>{
 auditSet('#coder','Matrix-Test');const details=auditDoc().querySelector('#global-comment').closest('details');details.open=true;auditSet('#global-comment','Job A & Kommentar');
 auditSet('#jobs','1');await waitAudit(()=>auditDoc().querySelector('#case-number')?.value==='1');assert(auditDoc().querySelector('#global-comment').value==='');
 auditSet('#jobs','0');await waitAudit(()=>auditDoc().querySelector('#case-number')?.value==='3');assert(auditDoc().querySelector('#global-comment').value==='Job A & Kommentar');assert(auditDoc().querySelector('#jobs option').textContent.includes('3/3'));
 auditFrame.remove();
});
check('Windows-Differenzial: 547 unterschiedliche Eingaben und sieben originale API-Konvertierungen ohne Wertanpassungen',async()=>{
 const native=JSON.parse(strFromU8(await get('/fixtures/windows-differential/native-converters.json'))),cases=converterCorpus();
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(cases))),sha=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');assert(sha===native.inputSHA256,'Korpus stimmt nicht mit dem Windows-Lauf überein');assert(native.assemblySHA256==='c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1');
 const objectKeysOnly=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);let exact=0,rejected=0;
 for(const item of cases){const captured=native.results.find(r=>r.id===item.id),expected=captured.exceptionType?null:JSON.parse(captured.outputJSON),isError=captured.exceptionType||expected.some(sf=>sf.responses.some(r=>r.status==='ERROR'));let actual,error=false,outcome='value';try{actual=D.parseChunk(item.contentJSON,converterTypes[item.method],{windows:true});error=actual.some(sf=>sf.responses.some(r=>r.status==='ERROR'));if(error)outcome='error-response';}catch{error=true;outcome='exception';}if(isError){assert(error&&outcome===(captured.exceptionType?'exception':'error-response'),item.id+' zeigt eine andere Fehlerbehandlung');rejected++;}else{assert(!error&&objectKeysOnly(actual)===objectKeysOnly(expected),item.id+' hat abweichende Werte oder Listenreihenfolge');exact++;}}
 assert(exact===401&&rejected===146);
 for(const item of pipelineCorpus()){const original=JSON.parse(native.pipelineResults.find(r=>r.id===item.id).outputJSON),expected={id:original.unitId,alias:original.unitname,laststate:original.laststate,logs:[],subforms:original.subforms,chunks:original.chunks};assert(objectKeysOnly(D.responseUnit(item.dto,{windows:true}))===objectKeysOnly(expected),item.id+' API-Konvertierung weicht ab');}
});
$('#run').onclick=async()=>{const button=$('#run');button.disabled=true;$('#results').replaceChildren();const report={userAgent:navigator.userAgent,started:new Date().toISOString(),checks:[]};let passed=0;for(const {name,fn}of checks){$('#status').textContent=name;const li=document.createElement('li');try{await fn();passed++;li.className='ok';li.textContent='✓ '+name;report.checks.push({name,passed:true});}catch(e){li.className='fail';li.textContent='✗ '+name+' — '+e.message;report.checks.push({name,passed:false,error:e.message,stack:e.stack});}$('#results').append(li);}report.passed=passed;report.total=checks.length;report.finished=new Date().toISOString();$('#status').textContent=`${passed} / ${checks.length} erfolgreich`;$('#download').href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));$('#download').download='Browser-Pruefbericht.json';$('#download').hidden=false;try{await fetch('/__report__',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});}catch{}button.disabled=false;};
