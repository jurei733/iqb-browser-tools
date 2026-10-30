import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import initSqlJs from 'sql.js';
import {unzipSync,strFromU8} from 'fflate';
import * as C from '../src/coding.js';
import * as D from '../src/data.js';
import * as T from '../src/toolbox.js';
import {OutputDatabase} from '../src/database.js';
import {loginDocx} from '../src/docx.js';
import {resolution,tiffResolution} from '../src/image.js';
import UTIF from 'utif2';
import {parseXML,children,child} from '../src/xml.js';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const folder=resolve(process.argv[2]),reportPath=resolve(process.argv[3]);
const native=JSON.parse((await readFile(join(folder,'original-windows.json'),'utf8')).replace(/^\uFEFF/,''));
assert.match(native.platform,/Windows/,'This comparison requires a Windows run');
const report={platform:native.platform,runtime:native.runtime,checks:[],intentionalDifferences:[],normalizations:['Spreadsheet cells are compared as a rectangular text matrix; omitted cells and empty cells have the same value.','The optional empty Testlet label is equivalent to an omitted label. ZIP metadata, styles, relationship IDs and XML attribute order are not content differences.']};
const record=id=>{const item=native.results.find(r=>r.id===id);assert.ok(item,'Missing original run '+id);if(item.error)throw new Error(item.error);return item.output;};
async function check(name,fn){try{await fn();report.checks.push({name,passed:true});}catch(e){report.checks.push({name,passed:false,error:e.message});}}
if(!process.argv[4])throw new Error('Usage: node scripts/compare-windows-files.mjs WINDOWS_RESULTS REPORT_JSON REFERENCE_INPUT_FOLDER');
const inputRoot=resolve(process.argv[4]);
const people=D.normalizePeople(JSON.parse(await readFile(join(inputRoot,'people.json'),'utf8')));
const rows=w=>Object.fromEntries(w.worksheets.filter(s=>s.rowCount).map(s=>[s.name,Array.from({length:s.rowCount},(_,i)=>Array.from({length:s.columnCount},(_,j)=>s.getCell(i+1,j+1).text))]));
const canonicalXML=el=>({name:el.nodeName,attrs:Object.fromEntries(Array.from(el.attributes||[]).filter(a=>!(el.nodeName==='Testlet'&&a.name==='label'&&a.value==='')).map(a=>[a.name,a.value]).sort(([a],[b])=>a.localeCompare(b))),content:children(el).length?children(el).map(canonicalXML):el.textContent});
await check('API identities: original deserializer retains large numeric logins and code zero as text',()=>{
 assert.deepEqual(record('toolbox-numeric-identities'),{group:'G',login:'9007199254740993',code:'0',booklet:'1'});
});
await check('CodingResults: native export decoded by the browser codec',async()=>{
 const original=C.decodeResult(await readFile(join(folder,'native.result'))),browser=C.decodeResult(await readFile(join(inputRoot,'browser.result')));assert.deepEqual(original,browser);
});
await check('CodingResults: Windows original reads the browser export',async()=>{
 const xml=record('coding-read-browser-result');const decoded=C.decodeResult(new TextEncoder().encode(xml));assert.equal(decoded.id,'reference-codec');assert.equal(decoded.coder,'Ref & Ä');assert.equal(decoded.entries.length,3);assert.equal(decoded.entries[0].code,'0');
});
await check('Kodierjob: flags, variable/person/page matching and crop frame geometry',async()=>{
 const data=await readFile(join(inputRoot,'coding','modern.zip')),load=await C.readCodingFiles([{name:'modern.zip',arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)}]),job=load.jobs[0];
 const reference=record('coding-jobs').find(j=>j.id===job.id);assert.ok(reference);for(const field of ['showScore','enableComments','suppressDescription'])assert.equal(job.settings[field],reference[field]);
 assert.deepEqual(job.cases.map(c=>[c.testee,c.variable.id]),reference.cases.map(c=>[c.testee,c.variable]));
 for(const [i,c]of job.cases.entries())for(const [j,p]of c.pages.entries()){
  const ref=reference.cases[i].pages[j];assert.equal(p.path.split('/').at(-1).replace(/\.[^.]+$/,''),ref.name);
  const adjusted=C.adjustFrame(p.frame,job.settings.crop);assert.deepEqual(adjusted,ref.frame);
 }
});
for(const name of ['anisotropic.png','anisotropic.jpg','anisotropic.bmp','anisotropic.tif'])await check('Scans: '+name+' physical aspect ratio matches Windows WPF',async()=>{
 const reference=record('coding-image-decoders').find(r=>r.name===name);assert.ok(reference);if(reference.error)throw new Error(reference.error);
 const bytes=await readFile(join(inputRoot,'images',name));let dpiX,dpiY;
 if(name.endsWith('.tif')){const ifd=UTIF.decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))[0];[dpiX,dpiY]=tiffResolution(ifd);}
 else [dpiX,dpiY]=await resolution(bytes);
 assert.equal(reference.width,192);assert.equal(reference.height,128);
 assert.ok(Math.abs(reference.displayWidth/reference.displayHeight-.75)<.001);
 assert.ok(Math.abs((192/dpiX)/(128/dpiY)-reference.displayWidth/reference.displayHeight)<.001);
});
for(const [mode,nativeMode]of [['none','None'],['rows','Rows'],['columns','Columns']])await check('Toolbox Excel: '+mode,async()=>{
 record('toolbox-wide-workbooks');const expected=await T.loadWorkbook(await readFile(join(folder,'wide-'+nativeMode+'.xlsx'))),actual=await T.loadWorkbook(await D.wideWorkbook(people,{subformMode:mode}));assert.deepEqual(rows(actual),rows(expected));
});
await check('CSV to Excel: Unicode, quoted comma, empty cells and leading zeroes',async()=>{
 record('toolbox-csv-to-xlsx');const expected=await T.loadWorkbook(await readFile(join(folder,'csv.xlsx')));
 const actual=await T.loadWorkbook(await T.tableWorkbook(T.parseCSV(await readFile(join(inputRoot,'simple.csv'),'utf8'))));assert.deepEqual(rows(actual),rows(expected));
});
await check('Reviews: original booklet/unit sheets, category labels and filled content',async()=>{
 record('toolbox-review-export');const expected=await T.loadWorkbook(await readFile(join(folder,'reviews.xlsx')));
 const actual=await T.loadWorkbook(await D.reviewsWorkbook(JSON.parse(await readFile(join(inputRoot,'reviews.json'),'utf8'))));assert.deepEqual(rows(actual),rows(expected));
});
await check('Testtaker XML: original login template preserves groups, logins, modes and custom texts',async()=>{
 const original=record('toolbox-testtaker-xml');assert.equal(original.length,1);
 const files=T.testtakerXML(await T.loadWorkbook(await readFile(join(inputRoot,'Logins-Beispiel.xlsx'))),{booklet:'DEMO'});
 assert.deepEqual(canonicalXML(parseXML(strFromU8(Object.values(files)[0])).documentElement),canonicalXML(parseXML(original[0].xml).documentElement));
});
await check('SQLite: browser reads original-created database',async()=>{
 record('toolbox-create-native-database');const db=new OutputDatabase(await initSqlJs(),await readFile(join(folder,'native.sqlite')));try{assert.equal(db.summary().people,3);assert.equal(db.summary().responses,6);assert.ok(db.check().ok);assert.deepEqual(D.responseRecords(db.people()).map(r=>[r.group,r.login,r.code,r.unitAlias,r.responseId,r.responseSubform,r.responseValue,r.responseStatus,r.responseCode,r.responseScore]).sort(),D.responseRecords(people).map(r=>[r.group,r.login,r.code,r.unitAlias,r.responseId,r.responseSubform,r.responseValue,r.responseStatus,r.responseCode,r.responseScore]).sort());}finally{db.close();}
});
await check('SQLite: Windows original reads browser-created database',()=>{
 let data=record('toolbox-open-browser-database');data=Array.isArray(data)?data:[data];assert.equal(data.length,3);assert.equal(D.responseRecords(D.normalizePeople(data)).length,6);
});
await check('Booklets: original Excel template produces equivalent XML',async()=>{
 const original=record('toolbox-booklet-template');assert.ok(original.length);const actual=T.bookletXML(await T.loadWorkbook(await readFile(join(inputRoot,'Booklet-Template.xlsx'))));assert.equal(Object.keys(actual).length,original.length);
 for(const f of original){const a=parseXML(strFromU8(actual[f.name])).documentElement,b=parseXML(f.xml).documentElement;
  const descriptionA=a.getElementsByTagName('Description')[0],descriptionB=b.getElementsByTagName('Description')[0];
  if(descriptionA.textContent!==descriptionB.textContent){report.intentionalDifferences.push({test:f.name,field:'Description',original:descriptionB.textContent,browser:descriptionA.textContent,reason:'Use description column instead of original title-column bug'});descriptionB.textContent=descriptionA.textContent;}
  assert.deepEqual(canonicalXML(a),canonicalXML(b));
 }
});
for(const n of [1,2])await check('Word: original template '+n+' retains the same filled content',async()=>{
 record('toolbox-word-original-templates');const workbook=await T.loadWorkbook(await readFile(join(inputRoot,'Logins-Beispiel.xlsx'))),generated=await loginDocx(workbook,await readFile(join(inputRoot,'Logins-Vorlage'+n+'.docx')),'https://testcenter.example.org');
 const docxText=bytes=>parseXML(strFromU8(unzipSync(bytes)['word/document.xml'])).documentElement.textContent.replace(/\s+/g,' ').trim();
 assert.equal(docxText(generated.files['Logins.docx']),docxText(await readFile(join(folder,'logins-'+n+'.docx'))));
});
await check('CodeFactory: native counts, uniqueness and alternating alphabets',()=>{
 const data=record('toolbox-code-factory');assert.equal(data.length,4);for(const [i,n]of [100,200,500,2000].entries()){const row=data[i];assert.equal(row.count,n);assert.equal(row.distinct,n);assert.ok(row.codes.every(s=>[...s].every((c,j)=>(j%2?T.NUMBERS:T.LETTERS).includes(c))));}
});
await check('Coding navigation: first open case, boundaries and atomic person batch match Windows',async()=>{
 const original=record('coding-navigation-and-batch');
 const bytes=await readFile(join(inputRoot,'coding','modern.zip'));
 const {jobs:[job]}=await C.readCodingFiles([{name:'modern.zip',arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}]);
 let index=C.initialCaseIndex(job);const positions=[index+1];
 index=C.navigationIndex(job,100);positions.push(index+1);
 job.cases[index].code='0';index=C.navigationIndex(job,index+1);positions.push(index+1);
 const batchCount=job.cases.filter(c=>c.testee===job.cases[index].testee).length;
 index=C.batchCode(job,index,'1');positions.push(index+1);
 const before=job.cases.map(c=>c.code);assert.throws(()=>C.batchCode(job,index,'8'),/eindeutig/);assert.deepEqual(job.cases.map(c=>c.code),before);
 C.batchCode(job,index,'0');index=C.navigationIndex(job,100);positions.push(index+1);
 index=C.navigationIndex(job,index-1);positions.push(index+1);
 index=C.navigationIndex(job,-1);positions.push(index+1);
 assert.deepEqual(positions,original.positions);assert.equal(batchCount,original.batchCount);assert.equal(original.rejectedCount,0);assert.equal(job.cases.length,original.caseCount);
 assert.deepEqual(job.cases.map(c=>c.code),C.decodeResult(new TextEncoder().encode(original.xml)).entries.map(e=>e.code));
});
report.passed=report.checks.filter(c=>c.passed).length;report.total=report.checks.length;await writeFile(reportPath,JSON.stringify(report,null,2));console.log(report.passed+'/'+report.total,'file comparisons passed');for(const c of report.checks)if(!c.passed)console.log(c.name,c.error);if(report.passed!==report.total)process.exitCode=1;
