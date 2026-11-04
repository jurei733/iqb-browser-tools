import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {decodeResult} from '../../src/coding.js';
import {loadWorkbook} from '../../src/toolbox.js';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const example=name=>fileURLToPath(new URL('../../public/examples/'+name,import.meta.url));
const fixture=name=>fileURLToPath(new URL('../fixtures/pilot/'+name,import.meta.url));
const done=page=>expect(page.locator('.tool-main')).toHaveAttribute('aria-busy','false');
async function viewport(page){const sizes=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));expect(sizes.document,'Page must not require horizontal scrolling').toBeLessThanOrEqual(sizes.viewport+2);}
async function download(page,selector,testInfo){const waiting=page.waitForEvent('download');await page.locator(selector).tap();const file=await waiting;expect(await file.failure()).toBeNull();const path=testInfo.outputPath(file.suggestedFilename());await file.saveAs(path);return readFile(path);}
test('@mobile touch coding, result round trip, restart and orientation',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await viewport(page);await page.locator('#demo').tap();await page.locator('#coder').fill('Mobile Abnahme');await page.locator('[data-code="1"]').tap();await page.locator('#comment').fill('Grüße; mobile Prüfung');await page.locator('#next').tap();await expect(page.locator('#case-number')).toHaveValue('2');await page.locator('[data-code="0"]').tap();await viewport(page);
 await page.locator('#coded-list').tap();await expect(page.locator('#close-cases')).toBeVisible();await page.locator('#close-cases').tap();
 const result=decodeResult(await download(page,'#export',testInfo));expect(result.entries.map(e=>e.code)).toEqual(['1','0']);expect(result.entries[0].comment).toBe('Grüße; mobile Prüfung');
 await page.reload();await page.locator('#demo').tap();await expect(page.locator('#case-number')).toHaveValue('2');await page.locator('#previous').tap();await expect(page.locator('#comment')).toHaveValue('Grüße; mobile Prüfung');await page.setViewportSize({width:844,height:390});await viewport(page);expect(errors).toEqual([]);
});
test('@mobile Toolbox exact CSV export, invalid input and recovery by touch',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('[data-module="toolbox"]').tap();await page.locator('[data-tool="csv"]').tap();await page.locator('#tool-file').setInputFiles(fixture('Syscheck-Pilot.csv'));await page.locator('#run-tool').tap();await done(page);await viewport(page);
 const workbook=await loadWorkbook(await download(page,'[data-download]',testInfo)),sheet=workbook.worksheets[0];expect(sheet.getCell('A2').text).toBe('001');expect(sheet.getCell('C3').text).toBe('9007199254740993');
 await page.locator('#tool-file').setInputFiles(fixture('Fehlerhaft.csv'));await page.locator('#run-tool').tap();await done(page);await expect(page.locator('#outputs')).toBeEmpty();await expect(page.locator('#notice')).toContainText('Anführungszeichen');
 await page.locator('#tool-file').setInputFiles(fixture('Syscheck-Pilot.csv'));await page.locator('#run-tool').tap();await done(page);expect((await download(page,'[data-download]',testInfo)).length).toBeGreaterThan(1000);expect(errors).toEqual([]);
});
test('@mobile SQLite open, inspect and export without page overflow',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('[data-module="toolbox"]').tap();await page.locator('[data-tool="database"]').tap();await page.locator('#db-file').setInputFiles(example('Beispiel.sqlite'));await done(page);await expect(page.locator('#db-summary')).toContainText('3Testpersonen');await page.locator('#db-check').tap();await done(page);await expect(page.locator('#db-check-result')).toContainText('Keine Fehler');await viewport(page);
 const saved=await download(page,'#db-save',testInfo);expect(saved.subarray(0,15).toString()).toBe('SQLite format 3');await page.locator('#db-file').setInputFiles({name:'roundtrip.sqlite',mimeType:'application/octet-stream',buffer:saved});await done(page);await expect(page.locator('#db-summary')).toContainText('3Testpersonen');expect(errors).toEqual([]);
});
