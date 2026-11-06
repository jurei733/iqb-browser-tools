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
