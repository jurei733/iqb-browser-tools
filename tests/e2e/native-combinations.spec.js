import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {loginXMLTree} from '../helpers/native-logins.js';
import {loadWorkbook,loginRows} from '../../src/toolbox.js';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const proof=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/native-combinations-20261109/preparation.json.gz',import.meta.url))).toString().replace(/^\ufeff/,''));
for(const id of ['reopen-matrix-5-0-1-1-7','reopen-matrix-8-4-0-0-0'])test(`Native saved workbook: ${id}, two browser save/reopen passes`,async({page},testInfo)=>{
 const native=proof.results.find(c=>c.id===id),xmls=files=>Object.fromEntries(Object.entries(files).filter(([n])=>n.endsWith('.xml')).map(([n,b])=>[n,loginXMLTree(b)]).sort(([a],[b])=>a.localeCompare(b)));
 const expected=Object.fromEntries(native.files.map(f=>[f.name,Buffer.from(f.base64,'base64')]));
 let workbook=Buffer.from(native.inputFiles.find(f=>f.name==='Logins.xlsx').base64,'base64');
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="logins"]').click();
 for(let pass=1;pass<=2;pass++){
  await page.locator('#tool-file').setInputFiles({name:'Logins.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook});
  await page.locator('#renew').uncheck();await page.locator('#create-xml').check();await page.locator('#booklet-id').fill('DEMO');await page.locator('#separate').setChecked(native.options.separate);
  await page.locator('#run-tool').click();await expect(page.locator('[data-download]')).toHaveCount(native.files.filter(f=>f.name.endsWith('.xml')).length+1);
  const files={};for(let i=0;i<await page.locator('[data-download]').count();i++){
   const pending=page.waitForEvent('download');await page.locator(`[data-download="${i}"]`).click();const download=await pending;
   const path=testInfo.outputPath(`pass${pass}-`+download.suggestedFilename());await download.saveAs(path);files[download.suggestedFilename()]=await readFile(path);await testInfo.attach(`pass ${pass} `+download.suggestedFilename(),{path});
  }
  expect(xmls(files)).toEqual(xmls(expected));
  workbook=files['Logins-browser.xlsx'];expect(loginRows(await loadWorkbook(workbook))).toEqual(loginRows(await loadWorkbook(expected['Logins.xlsx'])));
 }
});
