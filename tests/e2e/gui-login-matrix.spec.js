import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import {matrixRoot,matrixFiles,compareMatrixGeneration,compareMatrixReopen} from '../helpers/gui-login-matrix.js';

const proof=JSON.parse(await readFile(new URL('proof.json',matrixRoot)));
async function runAndDownload(page,info,label){
  await page.locator('#run-tool').click();await expect(page.locator('#run-tool')).toBeEnabled();
  const pending=page.waitForEvent('download');await page.locator('#download-all').click();
  const download=await pending,path=info.outputPath(label+'.zip');await download.saveAs(path);
  return unzipSync(await readFile(path));
}
for(let start=0;start<128;start+=8)test(`native GUI login product ${start+1}–${start+8}, including saved-file reopening`,async({page},info)=>{
  await page.goto('/');await page.locator('[data-module=toolbox]').click();await page.locator('[data-tool=logins]').click();
  for(const c of proof.cases.slice(start,start+8)){
    const reference=await matrixFiles(c),file=bytes=>({name:c.id+'.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(bytes)});
    await page.locator('#tool-file').setInputFiles(file(reference.input));
    await page.locator('#renew').check();await page.locator('#create-xml').check();
    await page.locator('#code-length').fill(String(c.length));await page.locator('#password-length').fill(String(c.passwordLength));
    for(const [id,key] of [['monitor','monitor'],['prefix-testee','prefixTestee'],['prefix-reserve','prefixReserve'],['prefix-review','prefixReview'],['separate','separate']])await page.locator('#'+id).setChecked(c[key]);
    await page.locator('#booklet-id').fill('Booklet1');
    await compareMatrixGeneration(c,await runAndDownload(page,info,c.id+'-new'),reference);
    await page.locator('[data-tool=codes]').click();await page.locator('[data-tool=logins]').click();
    await expect(page.locator('#renew')).not.toBeChecked();await expect(page.locator('#create-xml')).not.toBeChecked();
    await page.locator('#tool-file').setInputFiles(file(reference.native));await page.locator('#create-xml').check();
    await compareMatrixReopen(c,await runAndDownload(page,info,c.id+'-reopen'),reference);
  }
});
