import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {decodeResult} from '../../src/coding.js';
import {DOMParser} from '@xmldom/xmldom';
globalThis.DOMParser=DOMParser;
const proof=JSON.parse(await readFile(new URL('../fixtures/gui-legacy-20261109.json',import.meta.url)));
const withoutTimes=r=>({...r,entries:r.entries.map(({time,...entry})=>entry)});
const folder=fileURLToPath(new URL('../fixtures/gui-final-20261109/legacy-valid',import.meta.url));
// Observed in the original 4.3.0.3 GUI on 2026-11-09, with nonblank comments.
const sorts={number:[[1,2,3,4],[4,3,2,1]],variable:[[1,3,2,4],[2,4,1,3]],code:[[2,4,1,3],[1,3,2,4]],comment:[[2,3,4,1],[1,4,3,2]]};
test('Native legacy folder: packages, four-character prefixes, scan folders and all case-list sort directions',async({page},testInfo)=>{
 await page.goto('/');await page.locator('#coding-folder').setInputFiles(folder);
 await page.locator('#coder').fill('IQB');
 await expect(page.locator('#jobs option')).toHaveText(['legacy A B · 0/4','legacy B · 0/2']);
 const comments=['zeta','alpha','beta','gamma'],codes=['1','0','1','0'];
 for(let i=0;i<4;i++){
  await expect(page.locator('#case-number')).toHaveValue(String(i+1));
  await expect(page.locator('.coding-panel')).toContainText(i<2?'001':'002');
  await page.locator('#comment').fill(comments[i]);await page.locator(`[data-code="${codes[i]}"]`).click();
  if(i<3)await page.locator('#next').click();
 }
 const pending=page.waitForEvent('download');await page.locator('#export').click();const download=await pending;const path=testInfo.outputPath('legacy-native-paired.result');await download.saveAs(path);
 expect(withoutTimes(decodeResult(await readFile(path)))).toEqual(withoutTimes(decodeResult(Buffer.from(proof.legacy.nativeResult.base64,'base64'))));
 await testInfo.attach('legacy-paired-result',{path});
 await page.keyboard.press('F3');
 const order=async()=>page.locator('dialog [data-case]').evaluateAll(rows=>rows.map(r=>Number(r.dataset.case)+1));
 for(const [column,directions] of Object.entries(sorts)){
  await page.locator('#case-sort').selectOption(column);
  await page.locator('#case-direction').selectOption('asc');expect(await order()).toEqual(directions[0]);
  await page.locator('#case-direction').selectOption('desc');expect(await order()).toEqual(directions[1]);
 }
 await page.locator('#case-sort').selectOption('number');await page.locator('#case-direction').selectOption('desc');
 await page.locator('dialog [data-case="1"]').click();await expect(page.locator('#case-number')).toHaveValue('2');
 await expect(page.locator('#comment')).toHaveValue('alpha');await expect(page.locator('[data-code="0"]')).toHaveAttribute('aria-pressed','true');
 await testInfo.attach('legacy-case2-browser',{body:await page.screenshot(),contentType:'image/png'});
 await page.locator('#jobs').selectOption('1');await expect(page.locator('#case-number')).toHaveValue('2');
 await expect(page.locator('#comment')).toHaveValue('gamma');
 await page.locator('#previous').click();await expect(page.locator('#comment')).toHaveValue('alpha');
});
