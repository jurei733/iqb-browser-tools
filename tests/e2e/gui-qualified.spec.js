import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {DOMParser} from '@xmldom/xmldom';
import {unzipSync} from 'fflate';
import {decodeResult} from '../../src/coding.js';
globalThis.DOMParser=DOMParser;
const proof=JSON.parse(await readFile(new URL('../fixtures/gui-qualified-20261109.json',import.meta.url)));
const fields=r=>({...r,entries:r.entries.map(({time,...entry})=>entry)});
for(const variant of proof.training.variants)test(`Native training=${variant.training}: four codes, comment, case list, result and resume`,async({page},testInfo)=>{
 await page.goto('/');await page.locator('#coding-files').setInputFiles(Object.entries(unzipSync(await readFile(new URL('../../'+variant.input,import.meta.url)))).map(([name,buffer])=>({name:name.split('/').at(-1),mimeType:name.endsWith('.xml')?'application/xml':'image/png',buffer:Buffer.from(buffer)})));
 await page.locator('#coder').fill('IQB');await expect(page.locator('.coding-panel .muted')).toHaveText('Testperson anonymisiert');
 for(const [i,code]of proof.training.codes.entries()){
  await expect(page.locator('#case-number')).toHaveValue(String(i+1));
  await page.locator(`[data-code="${code}"]`).click();
  if(!i)await page.locator('#comment').fill(proof.training.firstComment);
  if(i<3)await page.locator('#next').click();
 }
 await expect(page.locator('.progress')).toContainText('4 von 4 kodiert');
 await page.keyboard.press('F3');await expect(page.locator('dialog [data-case]')).toHaveCount(4);await page.locator('#close-cases').click();
 await page.locator('#windows-results').check();const waiting=page.waitForEvent('download');await page.locator('#export').click();const download=await waiting;
 const path=testInfo.outputPath('paired.result');await download.saveAs(path);await testInfo.attach('Native-paired training result',{path});
 expect(fields(decodeResult(await readFile(path)))).toEqual(fields(decodeResult(await readFile(new URL('../../'+variant.nativeResult,import.meta.url)))));
 await page.reload();await page.locator('#resume-workspace').click();await expect(page.locator('#case-number')).toHaveValue('4');
 for(let i=0;i<3;i++)await page.locator('#previous').click();await expect(page.locator('#comment')).toHaveValue(proof.training.firstComment);
});
test('Native About entry routes and historical documentation destination, with working loaded-job fallback',async({page,context})=>{
 // Network contents are stubbed: this checks navigation to the exact observed native URL, not the live external server.
 await context.route('https://iqb-berlin.github.io/tba-info/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Dokumentationsnavigation im Test</h1>'}));
 await page.goto('/');await page.keyboard.press('F1');await expect(page.locator('#about')).toBeVisible();await expect(page.locator('#about')).toContainText('IQB-Kodieren 4.3.0.3');await page.locator('#close-about').click();await expect(page.locator('#about')).not.toBeVisible();
 await page.locator('[data-module="toolbox"]').click();await page.keyboard.press('F1');await expect(page.locator('#about')).toContainText('itc-ToolBox 3.3.0.2');
 await expect(page.locator('#toolbox-original-docs')).toHaveAttribute('href',proof.help.originalURL);
 await expect(page.locator('#toolbox-current-docs')).toHaveAttribute('href',proof.help.maintainedURL);
 const popupWait=page.waitForEvent('popup');await page.locator('#toolbox-original-docs').click();const popup=await popupWait;await expect(popup).toHaveURL(proof.help.originalURL);await popup.close();
 await page.locator('#close-about').click();await page.locator('[data-module="coding"]').click();await page.locator('#demo').click();
 await page.locator('#comment').fill('Hilfe erhält den Arbeitsstand');await page.keyboard.press('F1');await expect(page.locator('#about')).toBeVisible();await page.locator('#close-about').click();await expect(page.locator('#comment')).toHaveValue('Hilfe erhält den Arbeitsstand');
});
