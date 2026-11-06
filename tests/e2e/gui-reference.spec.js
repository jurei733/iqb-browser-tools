import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {DOMParser} from '@xmldom/xmldom';
import {decodeResult} from '../../src/coding.js';
import {unzipSync} from 'fflate';
globalThis.DOMParser=DOMParser;
const reference=JSON.parse(await readFile(new URL('../fixtures/gui-reference-20261104.json',import.meta.url)));
const job=fileURLToPath(new URL('../../'+reference.coding.input.path,import.meta.url));
const looseJob=Object.entries(unzipSync(await readFile(job))).map(([name,buffer])=>({name:name.split('/').at(-1),mimeType:name.endsWith('.xml')?'application/xml':'image/png',buffer:Buffer.from(buffer)}));
const native=decodeResult(Buffer.from(reference.coding.capture.base64,'base64'));
const extended=JSON.parse(await readFile(new URL('../fixtures/gui-extended-20261105.json',import.meta.url)));
const remaining=JSON.parse(await readFile(new URL('../fixtures/gui-remaining-20261106.json',import.meta.url)));
const xmlTree=el=>({name:el.nodeName,attrs:Object.fromEntries(Array.from(el.attributes).filter(a=>!(el.nodeName==='Testlet'&&a.name==='label'&&a.value==='')).map(a=>[a.name,a.value]).sort()),content:Array.from(el.childNodes).some(c=>c.nodeType===1)?Array.from(el.childNodes).filter(c=>c.nodeType===1).map(xmlTree):el.textContent});
const fields=result=>({...result,entries:result.entries.map(({time,...entry})=>entry)});
async function result(page,testInfo,name){
 await page.locator('#windows-results').check();
 const waiting=page.waitForEvent('download');await page.locator('#export').click();
 const download=await waiting;expect(await download.failure()).toBeNull();
 const path=testInfo.outputPath(name);await download.saveAs(path);await testInfo.attach(name,{path});
 return decodeResult(await readFile(path));
}
test('Windows GUI workflow: paired codes and comment, restart, then exact native result roundtrip',async({page},testInfo)=>{
 await page.goto('/');await page.locator('#coding-files').setInputFiles(looseJob);
 await expect(page.locator('#comment')).toBeVisible();await page.locator('#coder').fill('IQB');
 await page.locator('[data-code="0"]').click();await page.locator('#comment').fill('gui probe');
 await page.locator('#next').click();await page.locator('[data-code="1"]').click();
 expect(fields(await result(page,testInfo,'paired.result'))).toEqual(fields(native));
 await page.reload();await page.locator('#resume-workspace').click();
 await expect(page.locator('#case-number')).toHaveValue('3');
 await page.locator('#previous').click();await expect(page.locator('[data-code="1"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#previous').click();await expect(page.locator('[data-code="0"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#comment')).toHaveValue('gui probe');
 // A fresh context reads the original file, including its actual wall-clock times.
 const context=await page.context().browser().newContext({baseURL:'http://127.0.0.1:4173'});
 try{
  const imported=await context.newPage();await imported.goto('/');
  await imported.locator('#coding-files').setInputFiles([{name:'modern.zip',mimeType:'application/zip',buffer:await readFile(job)},{name:'Job.xml.result',mimeType:'application/gzip',buffer:Buffer.from(reference.coding.capture.base64,'base64')}]);
  await expect(imported.locator('#case-number')).toHaveValue('3');
  expect(await result(imported,testInfo,'native-roundtrip.result')).toEqual(native);
 }finally{await context.close();}
});
test('Windows ZIP GUI: all cases, F4 comment, zero and arrow codes, sorted jump and complete resume',async({page},testInfo)=>{
 const capture=decodeResult(Buffer.from(extended.codingComplete.capture.base64,'base64'));
 await page.goto('/');await page.locator('#coding-files').setInputFiles({name:extended.codingZip.input.name,mimeType:'application/zip',buffer:await readFile(job)});
 await expect(page.locator('h1')).toHaveText(extended.codingZip.observedLabel);await page.locator('#coder').fill('IQB');
 await page.locator('[data-code="0"]').focus();await page.keyboard.press('0');await page.keyboard.press('1');await page.keyboard.press('ArrowUp');
 await page.keyboard.press('F4');await page.locator('#global-comment').fill('GUI-54 global 20261105');
 await page.locator('#comment').fill('Notiz GUI A01');await page.locator('#next').click();await page.locator('[data-code="1"]').click();
 await page.locator('#next').click();await page.locator('[data-code="0"]').focus();await page.keyboard.press('0');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowUp');
 await page.locator('#next').click();await page.locator('[data-code="1"]').click();
 expect(fields(await result(page,testInfo,'native-complete-paired.result'))).toEqual(fields(capture));
 await page.reload();await page.locator('#resume-workspace').click();await expect(page.locator('#case-number')).toHaveValue('4');
 await page.keyboard.press('F3');await expect(page.locator('dialog .case-list button')).toHaveCount(4);
 await page.locator('#case-sort').selectOption('variable');
 expect(await page.locator('dialog [data-case]').evaluateAll(rows=>rows.map(b=>Number(b.dataset.case)+1))).toEqual([1,3,2,4]);
 await page.locator('dialog [data-case="2"]').click();await expect(page.locator('#case-number')).toHaveValue('3');
});

test('Windows Toolbox GUI: Booklet XML and complete Texteditor messages',async({page},testInfo)=>{
 const proof=extended.toolboxBooklet;
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="booklets"]').click();
 await page.locator('#tool-file').setInputFiles({name:proof.input.name,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:await readFile(fileURLToPath(new URL('../../'+proof.input.path,import.meta.url)))});
 await page.locator('#run-tool').click();await expect(page.locator('[data-download]')).toHaveCount(1);
 const pending=page.waitForEvent('download');await page.locator('[data-download]').click();const download=await pending;expect(download.suggestedFilename()).toBe(proof.outputName);
 const xmlPath=testInfo.outputPath('native-paired-booklet.xml');await download.saveAs(xmlPath);const xml=new DOMParser().parseFromString((await readFile(xmlPath)).toString(),'text/xml');
 const nativeXML=new DOMParser().parseFromString(Buffer.from(proof.xml.base64,'base64').toString(),'text/xml');expect(xmlTree(xml.documentElement)).toEqual(xmlTree(nativeXML.documentElement));
 expect(Array.from(xml.getElementsByTagName('CodeToEnter')).map(e=>e.getAttribute('code'))).toEqual(['Hase','Bus','Haus','gut']);
 await page.locator('#diagnostics').click();const waiting=page.waitForEvent('download');await page.locator('#diagnostics-preparation').click();const textDownload=await waiting;
 const textPath=testInfo.outputPath('native-paired-messages.txt');await textDownload.saveAs(textPath);
 const nativeText=Buffer.from(proof.messages.base64,'base64').toString('utf16le').replace(proof.nativeInputPath,proof.input.name);
 expect((await readFile(textPath)).toString('utf16le')).toBe(nativeText);
 await testInfo.attach('Booklet XML',{path:xmlPath});await testInfo.attach('Windows Texteditor messages',{path:textPath});
});

test('Windows multi-job GUI: independent progress, anonymous training, mouse and digit codes',async({page},testInfo)=>{
 const p=remaining.coding,capture=decodeResult(Buffer.from(p.trainingPartialResult.capture.base64,'base64'));
 await page.goto('/');await page.locator('#coding-files').setInputFiles([
  {name:extended.codingZip.input.name,mimeType:'application/zip',buffer:await readFile(job)},
  {name:'Job.xml.result',mimeType:'application/gzip',buffer:Buffer.from(extended.codingComplete.capture.base64,'base64')},
  ...[p.templateInput,p.trainingInput].map(f=>({name:f.name,mimeType:'application/zip',buffer:Buffer.from(f.capture.base64,'base64')}))
 ]);
 const choices=page.locator('#jobs option');await expect(choices).toHaveCount(3);
 expect(await choices.allTextContents()).toEqual(['01-Modern Job.xml · 4/4','02-Schablone Schablone.xml · 0/1','03-Anonym-Training Job.xml · 0/4']);
 await page.locator('#jobs').selectOption('2');await page.locator('#coder').fill('IQB');
 await expect(page.locator('.coding-panel .muted')).toHaveText('Testperson anonymisiert');
 await expect(page.locator('.progress')).toContainText('0 von 4 kodiert');
 await page.locator('[data-code="1"]').click();await page.locator('#next').click();
 await page.locator('[data-code="0"]').focus();await page.keyboard.press('0');await page.locator('#next').click();
 await expect(page.locator('#case-number')).toHaveValue('3');await expect(page.locator('.progress')).toContainText('2 von 4 kodiert');
 expect(fields(await result(page,testInfo,'anonymous-training-paired.result'))).toEqual(fields(capture));
 await page.locator('#jobs').selectOption('1');await expect(page.locator('.template-layer')).toBeVisible();await expect(page.locator('.progress')).toContainText('0 von 1 kodiert');
 await page.locator('#jobs').selectOption('0');await expect(page.locator('.progress')).toContainText('4 von 4 kodiert');
 await page.locator('#jobs').selectOption('2');await expect(page.locator('.progress')).toContainText('2 von 4 kodiert');
});

test('Windows Toolbox GUI: login minimum, mixed prefixes, edited workbook and native empty-password behavior',async({page},testInfo)=>{
 const proof=extended.toolboxLogins;const {loginXMLTree,loginRowsShape}=await import('../helpers/native-logins.js');const T=await import('../../src/toolbox.js');const {XMLSerializer}=await import('@xmldom/xmldom');globalThis.XMLSerializer=XMLSerializer;
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="logins"]').click();
 await page.locator('#tool-file').setInputFiles({name:proof.input.name,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(proof.input.base64,'base64')});
 await page.locator('#renew').check();await page.locator('#prefix-testee').check();await page.locator('#create-xml').check();await page.locator('#separate').uncheck();await page.locator('#booklet-id').fill('DEMO');
 await page.locator('#code-length').fill('4');await page.locator('#run-tool').click();await expect(page.locator('#notice')).toHaveText(proof.guiMinimum.error);await expect(page.locator('[data-download]')).toHaveCount(0);
 await page.locator('#code-length').fill('5');await page.locator('#run-tool').click();await expect(page.locator('[data-download]')).toHaveCount(2);
 const files={};for(let i=0;i<2;i++){const pending=page.waitForEvent('download');await page.locator(`[data-download="${i}"]`).click();const download=await pending;const path=testInfo.outputPath(download.suggestedFilename());await download.saveAs(path);files[download.suggestedFilename()]=await readFile(path);await testInfo.attach(download.suggestedFilename(),{path});}
 expect(Object.keys(files)).toEqual(['L6.xml','Logins-browser.xlsx']);expect(loginXMLTree(files['L6.xml'],{renew:true,...proof.options})).toEqual(loginXMLTree(Buffer.from(proof.xml.base64,'base64'),{renew:true,...proof.options}));
 expect(loginRowsShape(T.loginRows(await T.loadWorkbook(files['Logins-browser.xlsx'])),proof.options)).toEqual(loginRowsShape(T.loginRows(await T.loadWorkbook(Buffer.from(proof.workbook.base64,'base64'))),proof.options));
 await page.locator('#diagnostics').click();const pending=page.waitForEvent('download');await page.locator('#diagnostics-preparation').click();const download=await pending;const path=testInfo.outputPath('login-messages.txt');await download.saveAs(path);
 expect((await readFile(path)).toString('utf16le')).toBe(Buffer.from(proof.messages.base64,'base64').toString('utf16le').split(proof.nativeInputPath).join(proof.input.name));
});

test('Windows SQLite GUI: five Excel selections and two byte-identical CSV downloads',async({page},testInfo)=>{
 const {loadWorkbook}=await import('../../src/toolbox.js');
 const workbookShape=async b=>(await loadWorkbook(b)).worksheets.map(s=>({name:s.name,rows:Array.from({length:s.rowCount},(_,i)=>{const row=s.getRow(i+1),values=Array.from({length:row.cellCount},(_,j)=>row.getCell(j+1).text);while(values.at(-1)==='')values.pop();return values;}).filter(r=>r.length)}));
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="database"]').click();
 await page.locator('#db-file').setInputFiles({name:'D6.sqlite',mimeType:'application/octet-stream',buffer:await readFile(fileURLToPath(new URL('../../'+remaining.input.path,import.meta.url)))});
 await expect(page.locator('#db-summary')).toContainText('3Testpersonen');await expect(page.locator('#db-summary')).toContainText('6Antworten');
 await expect(page.locator('#db-group')).toContainText('DEMO (3)');
 await page.locator('#db-check').click();await expect(page.locator('#db-check-result')).toContainText('Keine Fehler gefunden');
 for(const c of [...remaining.excel.map(c=>({...c,format:'xlsx'})),...remaining.csv]){
  await page.locator('#format').selectOption(c.format);
  if(c.options){await page.locator('#subform').selectOption(c.options.subformMode);for(const field of ['values','status','codes','scores'])await page.locator('#'+field).setChecked(c.options[field]);}
  await page.locator('#db-export').click();await expect(page.locator('#db-export')).toBeEnabled();
  const waiting=page.waitForEvent('download');await page.locator('[data-output]').click();const download=await waiting;expect(await download.failure()).toBeNull();
  const path=testInfo.outputPath(c.id+(c.format==='xlsx'?'.xlsx':'.csv'));await download.saveAs(path);await testInfo.attach('Original GUI pair '+c.id,{path});
  const actual=await readFile(path),native=Buffer.from(c.capture.base64,'base64');
  if(c.format==='xlsx')expect(await workbookShape(actual)).toEqual(await workbookShape(native));else expect(actual).toEqual(native);
 }
});

test('Windows scan GUI: Ctrl rotation, translation, panning, frame toggle and magenta end feedback',async({page},testInfo)=>{
 const p=remaining.coding,g=p.nativeGestures.ctrlDrag;
 await page.goto('/');await page.locator('#coding-files').setInputFiles({name:p.templateInput.name,mimeType:'application/zip',buffer:Buffer.from(p.templateInput.capture.base64,'base64')});
 await expect(page.locator('.template-layer')).toBeVisible();await page.locator('#zoom').selectOption(String(g.zoomPercent));await page.locator('#scans').scrollIntoViewIfNeeded();
 const overlay=page.locator('.template-layer'),initial=await overlay.boundingBox();
 await page.keyboard.down('Control');
 try{await page.mouse.move(initial.x+80,initial.y+80);await page.mouse.down();await page.mouse.move(initial.x+80,initial.y+80+g.deltaY,{steps:8});await page.mouse.up();}finally{await page.keyboard.up('Control');}
 await expect.poll(()=>overlay.evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return Math.atan2(m.b,m.a)*180/Math.PI;})).toBeCloseTo(g.observedRotationDegrees,2);
 await expect(overlay).toHaveCSS('left','0px');await expect(overlay).toHaveCSS('top','0px');
 await page.locator('#template-reset').click();const box=await overlay.boundingBox();await page.mouse.move(box.x+80,box.y+80);await page.mouse.down();await page.mouse.move(box.x+130,box.y+110,{steps:5});await page.mouse.up();
 await expect(overlay).toHaveCSS('left','50px');await expect(overlay).toHaveCSS('top','30px');
 await page.locator('#frame').uncheck();await expect(page.locator('.scan-frame')).toHaveCount(0);await page.locator('#frame').check();await expect(page.locator('.scan-frame')).toHaveCount(1);
 const scan=page.locator('#scans'),bounds=await scan.boundingBox(),before=await scan.evaluate(e=>({x:e.scrollLeft,y:e.scrollTop}));
 await page.mouse.move(bounds.x+Math.min(600,bounds.width-50),bounds.y+Math.min(500,bounds.height-50));await page.mouse.down();await page.mouse.move(bounds.x+Math.min(600,bounds.width-50)-40,bounds.y+Math.min(500,bounds.height-50)-30,{steps:5});await page.mouse.up();
 await expect.poll(()=>scan.evaluate(e=>e.scrollLeft)).toBe(before.x+40);await expect.poll(()=>scan.evaluate(e=>e.scrollTop)).toBe(before.y+30);
 await page.locator('[data-code="0"]').click();await page.locator('#next').click();await expect(page.locator('#case-number')).toHaveValue('1');
 await expect(page.locator('.scan-stage')).toHaveCSS('background-color','rgb(255, 0, 255)');
 const path=testInfo.outputPath('native-paired-end-feedback.png');await page.screenshot({path});await testInfo.attach('Paired scan GUI',{path});
});


test.describe('Captured native Testcenter API',()=>{
test.use({serviceWorkers:'block'});
test('Windows Testcenter GUI: login, group choices and byte-identical group JSON downloads',async({page},testInfo)=>{
 const p=remaining.testcenter,reports=JSON.parse(Buffer.from(p.input.base64,'base64').toString());
 await page.route('**/api/**',route=>{
  const u=new URL(route.request().url()),path=u.pathname;
  if(path==='/api/session/admin')return route.fulfill({json:{token:'synthetic-native-gui-session',access:{workspaceAdmin:['1']}}});
  if(path==='/api/workspace/1')return route.fulfill({json:{name:p.workspace}});
  if(path==='/api/workspace/1/results')return route.fulfill({json:p.groups.map(groupName=>({groupName,groupLabel:groupName,bookletsStarted:1}))});
  if(path==='/api/workspace/1/files')return route.fulfill({json:Object.entries(p.bookletSizes).map(([name,size])=>({name,type:'Booklet',size}))});
  if(path==='/api/workspace/1/files-dependencies')return route.fulfill({json:Object.entries(p.bookletSizes).map(([id,size])=>({id,size,dependencies:[]}))});
  if(path.endsWith('/report/log')||path.endsWith('/report/response'))return route.fulfill({json:reports[path.endsWith('/log')?'logs':'responses'].filter(d=>d.groupname===u.searchParams.get('dataIds'))});
  return route.fulfill({status:404,body:''});
 });
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="testcenter"]').click();
 await page.locator('#tc-url').fill('http://127.0.0.1:4173');await page.locator('#tc-name').fill('synthetic-native-gui');await page.locator('#tc-password').fill('synthetic-only');await page.locator('#tc-connect').click();
 await expect(page.locator('#tc-workspace')).toContainText(p.workspace);await page.locator('#tc-compatibility').selectOption('windows');
 await page.locator('[data-group="1"]').uncheck();await expect(page.locator('#tc-selection')).toHaveText('1 von 2 Gruppen ausgewählt.');
 await page.locator('#tc-all-groups').check();await expect(page.locator('#tc-selection')).toHaveText('2 von 2 Gruppen ausgewählt.');
 await page.locator('#format').selectOption('json-groups');await page.locator('#tc-data').click();await expect(page.locator('[data-output]')).toHaveCount(1);
 const waiting=page.waitForEvent('download');await page.locator('[data-output]').click();const download=await waiting;const path=testInfo.outputPath('native-gui-groups.zip');await download.saveAs(path);await testInfo.attach('Windows GUI paired JSON files',{path});
 const entries=unzipSync(await readFile(path));expect(Object.keys(entries).sort()).toEqual(p.json.map(c=>c.name).sort());
 for(const c of p.json)expect(Buffer.from(entries[c.name])).toEqual(Buffer.from(c.capture.base64,'base64'));
 await page.locator('#format').selectOption('xlsx');await page.locator('#tc-data').click();await expect(page.locator('#tc-data')).toBeEnabled();
 const excelWaiting=page.waitForEvent('download');await page.locator('[data-output]').click();const excelDownload=await excelWaiting;const excelPath=testInfo.outputPath('native-gui-direct.xlsx');await excelDownload.saveAs(excelPath);await testInfo.attach('Native direct Excel cells',{path:excelPath});
 const {loadWorkbook}=await import('../../src/toolbox.js'),shape=async b=>(await loadWorkbook(b)).worksheets.map(s=>({name:s.name,rows:Array.from({length:s.rowCount},(_,i)=>{const row=s.getRow(i+1);return Array.from({length:row.cellCount},(_,j)=>row.getCell(j+1).text);})}));
 expect(await shape(await readFile(excelPath))).toEqual(await shape(Buffer.from(p.excel.capture.base64,'base64')));
 // The original JSON dialog leaves session labels null. Its SQLite writer
 // converts exactly those labels to empty strings; compare the downloaded DB.
 await page.locator('#tc-db').click();await expect(page.locator('#tc-db')).toBeEnabled();
 await expect(page.locator('#notice')).toContainText('Browserdatenbank gesichert');
 await page.locator('[data-tool="database"]').click();
 const sqliteWaiting=page.waitForEvent('download');await page.locator('#db-save').click();const sqliteDownload=await sqliteWaiting;
 const sqlitePath=testInfo.outputPath('native-gui-import.sqlite');await sqliteDownload.saveAs(sqlitePath);await testInfo.attach('Native GUI paired SQLite tables',{path:sqlitePath});
 const {default:initSqlJs}=await import('sql.js'),{OutputDatabase}=await import('../../src/database.js'),SQL=await initSqlJs();
 const actual=new OutputDatabase(SQL,await readFile(sqlitePath)),original=new OutputDatabase(SQL,Buffer.from(p.sqlite.capture.base64,'base64'));
 try{
  const canonical=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).sort()));
  for(const table of ['person','bookletInfo','booklet','session','bookletLog','unit','unitLog','unitLastState','chunk','response'])expect(canonical(actual.query('SELECT * FROM ['+table+']')),table).toEqual(canonical(original.query('SELECT * FROM ['+table+']')));
  expect(actual.check().ok).toBe(true);
 }finally{actual.close();original.close();}
});
});

test('Windows booklet-size GUI: import JSON and preserve all existing SQLite data',async({page},testInfo)=>{
 const p=remaining.testcenter,size=p.bookletSizesImport;
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="database"]').click();
 await page.locator('#db-file').setInputFiles({name:p.sqlite.name,mimeType:'application/octet-stream',buffer:Buffer.from(p.sqlite.capture.base64,'base64')});
 await expect(page.locator('#db-summary')).toContainText('28Antworten');
 await page.locator('#db-sizes').setInputFiles({name:size.input.name,mimeType:'application/json',buffer:Buffer.from(size.input.capture.base64,'base64')});await page.locator('#db-import-sizes').click();await expect(page.locator('#db-import-sizes')).toBeEnabled();
 const waiting=page.waitForEvent('download');await page.locator('#db-save').click();const download=await waiting,path=testInfo.outputPath('native-size-import.sqlite');await download.saveAs(path);await testInfo.attach('Native booklet-size GUI pair',{path});
 const {default:initSqlJs}=await import('sql.js'),{OutputDatabase}=await import('../../src/database.js'),SQL=await initSqlJs(),actual=new OutputDatabase(SQL,await readFile(path)),original=new OutputDatabase(SQL,Buffer.from(size.sqliteAfter.base64,'base64'));
 try{for(const table of ['person','bookletInfo','booklet','session','bookletLog','unit','unitLog','unitLastState','chunk','response'])expect(actual.query('SELECT * FROM ['+table+']'),table).toEqual(original.query('SELECT * FROM ['+table+']'));}finally{actual.close();original.close();}
});

test('Windows JSON import GUI: add people and preserve original SQLite tables',async({page},testInfo)=>{
 const p=remaining.testcenter,json=p.jsonDatabaseImport;
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="database"]').click();
 await page.locator('#db-file').setInputFiles({name:p.sqlite.name,mimeType:'application/octet-stream',buffer:Buffer.from(p.bookletSizesImport.sqliteAfter.base64,'base64')});
 await page.locator('#db-import-files').setInputFiles({name:json.input.name,mimeType:'application/json',buffer:Buffer.from(json.input.capture.base64,'base64')});await page.locator('#db-import').click();
 await expect(page.locator('#db-summary')).toContainText('5Testpersonen');await expect(page.locator('#db-summary')).toContainText('34Antworten');
 const waiting=page.waitForEvent('download');await page.locator('#db-save').click();const download=await waiting,path=testInfo.outputPath('native-json-import.sqlite');await download.saveAs(path);await testInfo.attach('Native JSON GUI pair',{path});
 const {default:initSqlJs}=await import('sql.js'),{OutputDatabase}=await import('../../src/database.js'),SQL=await initSqlJs(),actual=new OutputDatabase(SQL,await readFile(path)),original=new OutputDatabase(SQL,Buffer.from(json.sqliteAfter.base64,'base64'));
 try{const canonical=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).sort()));for(const table of ['person','bookletInfo','booklet','session','bookletLog','unit','unitLog','unitLastState','chunk','response'])expect(canonical(actual.query('SELECT * FROM ['+table+']')),table).toEqual(canonical(original.query('SELECT * FROM ['+table+']')));}finally{actual.close();original.close();}
});
