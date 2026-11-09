import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadWorkbook} from '../../src/toolbox.js';
import {workbookCells} from '../../scripts/testcenter-study.mjs';
const root=new URL('../fixtures/gui-options-20261109/',import.meta.url),proof=JSON.parse(await readFile(new URL('proof.json',root)));
test('Windows Excel GUI: recover after no tables selected; mixed selections and exports retain options',async({page},info)=>{
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="database"]').click();
 await page.locator('#db-file').setInputFiles(fileURLToPath(new URL('../../'+proof.input,import.meta.url)));
 await expect(page.locator('#db-summary')).toContainText('3');
 for(const field of ['values','status','codes','scores'])await page.locator('#'+field).uncheck();
 await page.locator('#db-export').click();await expect(page.locator('#notice')).toHaveText(proof.emptySelection.message);
 await expect(page.locator('#db-export')).toBeEnabled();await expect(page.locator('[data-output]')).toHaveCount(0);
 for(const c of proof.cases){
  await page.locator('#subform').selectOption(c.options.subformMode);
  for(const field of ['values','status','codes','scores'])await page.locator('#'+field).setChecked(c.options[field]);
  await page.locator('#db-export').click();await expect(page.locator('[data-output]')).toHaveCount(1);
  const pending=page.waitForEvent('download');await page.locator('[data-output]').click();const download=await pending,path=info.outputPath(c.file);await download.saveAs(path);
  expect(workbookCells(await loadWorkbook(await readFile(path)))).toEqual(workbookCells(await loadWorkbook(await readFile(new URL(c.file,root)))));
  await expect(page.locator('#subform')).toHaveValue(c.options.subformMode);
  for(const field of ['values','status','codes','scores'])expect(await page.locator('#'+field).isChecked()).toBe(c.options[field]);
 }
});

import {DOMParser} from '@xmldom/xmldom';
import {decodeResult} from '../../src/coding.js';
globalThis.DOMParser=DOMParser;
for(const c of proof.coding.cases)test('Windows coding GUI '+c.id+': initial position, F3, save and browser restart',async({page},info)=>{
 await page.goto('/');await page.locator('#coding-files').setInputFiles([
  {name:'Job.zip',mimeType:'application/zip',buffer:await readFile(new URL(c.input,root))},
  {name:'saved.result',mimeType:'application/gzip',buffer:await readFile(new URL(c.result,root))}
 ]);
 await expect(page.locator('#case-number')).toHaveValue(String(c.selectedCase));await expect(page.locator('#comment')).toHaveValue(c.comment);await page.locator('#coder').fill('IQB');
 await page.keyboard.press('F3');const rows=page.locator('dialog [data-case]');await expect(rows).toHaveCount(c.list.length);
 if(c.list.length){await expect(rows.first()).toContainText(c.list[0].variable);if(c.list[0].comment)await expect(rows.first()).toContainText(c.list[0].comment);}
 await page.keyboard.press('Escape');
 const native=decodeResult(await readFile(new URL(c.native,root)));
 for(const phase of ['save','restart']){
  if(phase==='restart'){await page.reload();await page.locator('#resume-workspace').click();await expect(page.locator('#case-number')).toHaveValue(String(c.selectedCase));}
  await page.locator('#windows-results').check();const pending=page.waitForEvent('download');await page.locator('#export').click();const download=await pending,path=info.outputPath(c.id+'-'+phase+'.result');await download.saveAs(path);expect(decodeResult(await readFile(path))).toEqual(native);
 }
});
test('Windows crash input: browser keeps all six cases and three existing codes usable',async({page})=>{
 const c=proof.coding.originalCrash;await page.goto('/');await page.locator('#coding-files').setInputFiles([
  {name:'Job.zip',mimeType:'application/zip',buffer:await readFile(new URL(c.input,root))},
  {name:'saved.result',mimeType:'application/gzip',buffer:await readFile(new URL(c.result,root))}
 ]);await expect(page.locator('#case-number')).toHaveValue('2');await expect(page.locator('.progress')).toContainText('3 von 6 kodiert');
 await page.keyboard.press('F3');await expect(page.locator('dialog [data-case]')).toHaveCount(3);
});
