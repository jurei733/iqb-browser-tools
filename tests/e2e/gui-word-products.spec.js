import {test,expect} from '@playwright/test';import {readFile} from 'node:fs/promises';
import {nativeDocxShape} from '../helpers/native-docx.js';import {wordProductsRoot,wordProductFiles} from '../helpers/gui-word-products.js';
const proof=JSON.parse(await readFile(new URL('proof.json',wordProductsRoot)));
for(let start=0;start<17;start+=4)test(`native Word GUI products ${start}–${Math.min(start+3,16)}`,async({page},info)=>{
 await page.goto('/');await page.locator('[data-module=toolbox]').click();await page.locator('[data-tool=docx]').click();
 for(const c of proof.cases.slice(start,start+4)){
  const files=await wordProductFiles(c),upload=(name,mimeType)=>({name,mimeType,buffer:Buffer.from(files['inputs/'+name])});
  await page.locator('#docx-logins').setInputFiles(upload(c.input,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
  if(c.kind==='empty-input'){await expect(page.locator('#docx-input-status')).toHaveText('0 Logins in 0 Gruppen gefunden.');await expect(page.locator('#create-docx')).toBeDisabled();await expect(page.locator('[data-output]')).toHaveCount(0);continue;}
  await expect(page.locator('#create-docx')).toBeEnabled();await page.locator('#docx-server').fill(c.server||'https://tc.example.test');
  if(/^T[12]\.docx$/.test(c.template))await page.locator('#docx-preset').selectOption(c.template[1]);else{await page.locator('#docx-preset').selectOption('custom');await page.locator('#docx-template').setInputFiles(upload(c.template,'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));}
  if(c.invalidServer){await page.locator('#docx-server').fill('https://'+c.invalidServer);await page.locator('#create-docx').click();await expect(page.locator('#notice')).toHaveText(c.errorMessage);await expect(page.locator('[data-output]')).toHaveCount(0);await page.locator('#docx-server').fill(c.server);}
  await page.locator('#create-docx').click();
  if(c.kind==='invalid-template'){await expect(page.locator('#notice')).toHaveText('Die Vorlage ist keine gültige DOCX-Datei.');await expect(page.locator('[data-output]')).toHaveCount(0);continue;}
  await expect(page.locator('[data-output]')).toHaveCount(1);const pending=page.waitForEvent('download');await page.locator('[data-output]').click();const download=await pending,path=info.outputPath(c.id+'.docx');await download.saveAs(path);expect(nativeDocxShape(await readFile(path))).toEqual(nativeDocxShape(files['native/'+c.file]));
 }
});
