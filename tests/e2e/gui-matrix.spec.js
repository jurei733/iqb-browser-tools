import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadWorkbook} from '../../src/toolbox.js';
import {workbookCells} from '../../scripts/testcenter-study.mjs';
const root=new URL('../fixtures/gui-matrix-20261109/',import.meta.url);
const proof=JSON.parse(await readFile(new URL('proof.json',root)));
const fields=['values','status','codes','scores'];
async function openDatabase(page,file=proof.input){
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="database"]').click();
 await page.locator('#db-file').setInputFiles(fileURLToPath(new URL('../../'+file,import.meta.url)));
 await expect(page.locator('#db-summary')).toContainText('3');
}
async function choose(page,options){await page.locator('#subform').selectOption(options.subformMode);for(const f of fields)await page.locator('#'+f).setChecked(options[f]);}
async function compareExport(page,info,file){
 await page.locator('#db-export').click();await expect(page.locator('[data-output]')).toHaveCount(1);
 const pending=page.waitForEvent('download');await page.locator('[data-output]').click();const download=await pending,path=info.outputPath(file);await download.saveAs(path);
 expect(workbookCells(await loadWorkbook(await readFile(path)))).toEqual(workbookCells(await loadWorkbook(await readFile(new URL(file,root)))));
}
test('Windows GUI Excel matrix: all 45 nonempty option combinations match every native cell',async({page},info)=>{
 await openDatabase(page);
 for(const c of proof.cases){await choose(page,c.options);await compareExport(page,info,c.file);}
});
test('Windows GUI retains confirmed database Excel options across tools and discards an unsubmitted draft',async({page},info)=>{
 await openDatabase(page);const confirmed=proof.stateObservations.reopenedAfterCancel;
 await choose(page,confirmed);await compareExport(page,info,'columns15.xlsx');
 const reopen=async()=>{await page.locator('[data-tool="codes"]').click();await page.locator('[data-tool="database"]').click();};
 await reopen();await expect(page.locator('#subform')).toHaveValue(confirmed.subformMode);for(const f of fields)expect(await page.locator('#'+f).isChecked()).toBe(confirmed[f]);
 await choose(page,proof.stateObservations.cancelledDraft);await reopen();
 await expect(page.locator('#subform')).toHaveValue(confirmed.subformMode);for(const f of fields)expect(await page.locator('#'+f).isChecked()).toBe(confirmed[f]);
 await compareExport(page,info,'columns15.xlsx');
});
test('Windows GUI database capabilities: absent codes and subforms disable unavailable Excel options',async({page},info)=>{
 await openDatabase(page);await choose(page,proof.stateObservations.reopenedAfterCancel);await compareExport(page,info,'columns15.xlsx');
 await page.locator('#db-file').setInputFiles(fileURLToPath(new URL('plain.sqlite',root)));
 const c=proof.stateObservations.plainDatabase;
 for(const id of c.disabled)await expect(page.locator('#'+id)).toBeDisabled();
 await expect(page.locator('#subform')).toHaveValue('none');for(const f of fields)expect(await page.locator('#'+f).isChecked()).toBe(c.options[f]);
 await compareExport(page,info,'plain.xlsx');
 // Submitting the plain database's available choices becomes the next default.
 await page.locator('#db-file').setInputFiles(fileURLToPath(new URL('../../'+proof.input,import.meta.url)));
 for(const id of c.disabled)await expect(page.locator('#'+id)).toBeEnabled();
 await expect(page.locator('#subform')).toHaveValue('none');for(const f of fields)expect(await page.locator('#'+f).isChecked()).toBe(c.options[f]);
});

import {DOMParser} from '@xmldom/xmldom';
import {decodeResult} from '../../src/coding.js';
globalThis.DOMParser=DOMParser;
test.use({timezoneId:'Europe/Berlin'});
test('Windows coding GUI: all eight score/comment/instruction option combinations',async({page})=>{
 await page.goto('/');
 await page.locator('#coding-files').setInputFiles(await Promise.all(proof.coding.cases.map(async c=>({name:c.input,mimeType:'application/zip',buffer:await readFile(new URL(c.input,root))}))));
 for(let i=0;i<proof.coding.cases.length;i++){
  const c=proof.coding.cases[i];await page.locator('#jobs').selectOption(String(i));
  await expect(page.locator('#case-number')).toHaveValue('1');
  await expect(page.locator('.code-option')).toHaveCount(2);
  await expect(page.locator('.code-option small')).toHaveCount(c.showScore?2:0);
  if(c.showScore)await expect(page.locator('.code-option small')).toHaveText(['0 P.','2 P.']);
  await expect(page.locator('#comment')).toHaveCount(c.enableComments?1:0);
  await expect(page.locator('.description')).toHaveCount(c.suppressDescription?0:1);
  if(!c.suppressDescription)await expect(page.locator('.description')).toHaveText('FLAG-ANWEISUNG');
 }
});
test('Windows coding GUI: invalid group shortcut is atomic; valid shortcut saves two codes and reopens at 3/6',async({page},info)=>{
 const g=proof.coding.group;await page.clock.setFixedTime(new Date(g.valid.clock));
 await page.goto('/');await page.locator('#coding-files').setInputFiles({name:g.input,mimeType:'application/zip',buffer:await readFile(new URL(g.input,root))});
 await page.locator('#windows-results').check();await page.locator('#windows-results').blur();
 const compare=async phase=>{const pending=page.waitForEvent('download');await page.locator('#export').click();const download=await pending,path=info.outputPath(phase+'.result');await download.saveAs(path);expect(decodeResult(await readFile(path))).toEqual(decodeResult(await readFile(new URL(g[phase].native,root))));};
 await page.keyboard.press('Control+1');await expect(page.locator('#notice')).toHaveText(g.invalid.message);await expect(page.locator('#case-number')).toHaveValue('1');await expect(page.locator('.progress')).toContainText('0 von 6');await compare('invalid');
 await page.keyboard.press('Control+0');await expect(page.locator('#notice')).toHaveText(g.valid.message);await expect(page.locator('#case-number')).toHaveValue('3');await expect(page.locator('.progress')).toContainText('2 von 6');await compare('valid');
 await page.reload();await page.locator('#resume-workspace').click();await expect(page.locator('#case-number')).toHaveValue('3');await page.locator('#windows-results').check();await compare('valid');
});
