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
