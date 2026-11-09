import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {loadWorkbook,loginRows} from '../../src/toolbox.js';
import {loginRowsShape,loginXMLTree} from '../helpers/native-logins.js';
const root=new URL('../fixtures/gui-login-boundaries-20261109/',import.meta.url);
const proof=JSON.parse(await readFile(new URL('proof.json',root))),source=await readFile(new URL('existing.xlsx',root));
async function open(page,id){await page.goto('/');await page.locator('[data-module=toolbox]').click();await page.locator('[data-tool=logins]').click();await page.locator('#tool-file').setInputFiles({name:id+'.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:source});await page.locator('#renew').check();await page.locator('#create-xml').check();await page.locator('#separate').uncheck();}
async function run(page){await page.locator('#run-tool').click();await expect(page.locator('#run-tool')).toBeEnabled();}
async function compare(page,info,c){
 const shape={length:c.parsedLength,passwordLength:c.parsedPasswordLength};
 for(const name of ['Logins-browser.xlsx',c.id+'.xml']){
  const pending=page.waitForEvent('download');await page.locator('[data-download]').filter({hasText:name}).click();const d=await pending,path=info.outputPath(c.id+'-'+name);await d.saveAs(path);const bytes=await readFile(path),native=await readFile(new URL(c.id+'/'+c.id+(name.endsWith('.xml')?'.xml':'.xlsx'),root));
  if(name.endsWith('.xml'))expect(loginXMLTree(bytes,{renew:true,...shape})).toEqual(loginXMLTree(native,{renew:true,...shape}));
  else expect(loginRowsShape(loginRows(await loadWorkbook(bytes)),shape)).toEqual(loginRowsShape(loginRows(await loadWorkbook(native)),shape));
 }
}
test('native login boundaries: 13 and 20 character names/passwords match original rows and XML',async({page},info)=>{
 for(const c of proof.cases.slice(0,2)){
  await open(page,c.id);await page.locator('#code-length').fill(c.length);await page.locator('#password-length').fill(c.passwordLength);
  for(const id of ['monitor','prefix-testee','prefix-reserve','prefix-review'])await page.locator('#'+id).setChecked(c.allPrefixes);
  await run(page);await expect(page.locator('[data-download]')).toHaveCount(2);await compare(page,info,c);
 }
});
test('native login boundaries: invalid numeric text, same-dialog recovery and parsed options on reopening',async({page},info)=>{
 const c=proof.cases[2];await open(page,c.id);await page.locator('#password-length').fill(c.passwordLength);for(const id of ['monitor','prefix-testee','prefix-reserve','prefix-review'])await page.locator('#'+id).check();
 for(const value of proof.invalidLoginValues){await page.locator('#code-length').fill(value);await run(page);await expect(page.locator('#notice')).toHaveText(proof.invalidLoginMessage);await expect(page.locator('[data-download]')).toHaveCount(0);}
 await page.locator('#code-length').fill('5');await run(page);await expect(page.locator('[data-download]')).toHaveCount(2);await compare(page,info,c);
 await page.locator('[data-tool=codes]').click();await page.locator('[data-tool=logins]').click();await expect(page.locator('#password-length')).toHaveValue('0');await expect(page.locator('#code-length')).toHaveValue('5');await expect(page.locator('#renew')).not.toBeChecked();await expect(page.locator('#create-xml')).not.toBeChecked();
});
test('native login boundaries: decimal, exponent and overflowing password text produce empty passwords',async({page},info)=>{
 for(const c of proof.cases.slice(3)){
  await open(page,c.id);await page.locator('#code-length').fill(c.length);await page.locator('#password-length').fill(c.passwordLength);for(const id of ['monitor','prefix-testee','prefix-reserve','prefix-review'])await page.locator('#'+id).check();
  await run(page);await expect(page.locator('[data-download]')).toHaveCount(2);await compare(page,info,c);
 }
});
