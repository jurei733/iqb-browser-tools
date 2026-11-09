import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import {bookletMatrixRoot,bookletMatrixFiles,compareBookletText,compareBookletXML} from '../helpers/gui-booklet-matrix.js';
const proof=JSON.parse(await readFile(new URL('proof.json',bookletMatrixRoot)));
for(let start=0;start<66;start+=8)test(`native Booklet GUI cases ${start}–${Math.min(start+7,65)}: validation, messages and recovery`,async({page},info)=>{
 await page.goto('/');await page.locator('[data-module=toolbox]').click();await page.locator('[data-tool=booklets]').click();
 for(const c of proof.cases.slice(start,start+8)){
  const files=await bookletMatrixFiles(c);
  await page.locator('#tool-file').setInputFiles({name:c.input,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(files['inputs/'+c.input])});
  await page.locator('#run-tool').click();await expect(page.locator('#run-tool')).toBeEnabled();await expect(page.locator('[data-download]')).toHaveCount(c.outputs.length);
  if(c.outputs.length){const pending=page.waitForEvent('download');await page.locator(c.outputs.length>1?'#download-all':'[data-download]').click();const download=await pending,path=info.outputPath(c.id+'-xml');await download.saveAs(path);const bytes=await readFile(path);compareBookletXML(c,c.outputs.length>1?unzipSync(bytes):{[c.outputs[0]]:bytes},files);}
  await page.locator('#diagnostics').click();const pending=page.waitForEvent('download');await page.locator('#diagnostics-preparation').click();const download=await pending,path=info.outputPath(c.id+'-messages.txt');await download.saveAs(path);compareBookletText(await readFile(path),files['native/'+c.id+'.txt']);await page.locator('#diagnostics-close').click();
 }
});
