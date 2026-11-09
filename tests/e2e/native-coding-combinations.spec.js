import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {zipSync,unzipSync,strToU8} from 'fflate';
import {DOMParser} from '@xmldom/xmldom';
import {decodeResult} from '../../src/coding.js';
globalThis.DOMParser=DOMParser;
const proof=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/native-combinations-20261109/coding.json.gz',import.meta.url))));
const native=JSON.parse(Buffer.from(proof.reportBase64,'base64'));
const images=unzipSync(await readFile(new URL('../../public/examples/Kodierjob-Schablone.zip',import.meta.url))),image=Object.entries(images).find(([n])=>/\.(png|jpg)$/i.test(n)&&!/(CT_|Testschablone)/i.test(n))[1];
const entries={'Job.xml':strToU8('<CodingJob id="state-job"><jobOpts enableComments="true" codername="Matrix"/><Variablen>'+['V1','V2'].map(id=>`<v id="${id}"><c id="0"/><c id="1"/><loc b="M" p="1"/></v>`).join('')+'</Variablen><Cases>001 002 003</Cases></CodingJob>')};
for(const person of ['001','002','003'])entries['M-1_'+person+'.png']=image;
const job=Buffer.from(zipSync(entries));
for(const id of ['state-0-0-0','state-1-0-2','state-3-4-2','state-5-1-4','state-1-1-1','state-4-3-4'])test(`Original result ${id}: import, export and browser workspace reopen`,async({page},testInfo)=>{
 const capture=native.results.find(c=>c.id===id);expect(capture.reopenedNativeModel).toBeTruthy();
 await page.goto('/');await page.locator('#coding-files').setInputFiles([{name:'Matrix.zip',mimeType:'application/zip',buffer:job},{name:'Matrix.result',mimeType:'application/gzip',buffer:Buffer.from(capture.nativeBase64,'base64')}]);
 await expect(page.locator('#comment')).toBeVisible();await page.locator('#coder').fill('Matrix');await page.locator('#coder').blur();
 for(let pass=1;pass<=2;pass++){
  await page.locator('#windows-results').check();const pending=page.waitForEvent('download');await page.locator('#export').click();const download=await pending;const path=testInfo.outputPath(`${id}-pass${pass}.result`);await download.saveAs(path);await testInfo.attach(`original paired pass ${pass}`,{path});
  expect(decodeResult(await readFile(path))).toEqual(capture.reopenedNativeModel);
  if(pass===1){await expect(page.locator('#saved')).toHaveText('Lokal gespeichert');await page.reload();await page.locator('#resume-workspace').click();await expect(page.locator('#comment')).toBeVisible();}
 }
});
