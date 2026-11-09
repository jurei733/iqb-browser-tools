import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const fixture=new URL('../fixtures/gui-login-next-20261109/',import.meta.url);
async function open(page){await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="logins"]').click();await page.locator('#tool-file').setInputFiles(fileURLToPath(new URL('existing.xlsx',fixture)));}
async function run(page){await page.locator('#run-tool').click();await expect(page.locator('#run-tool')).toBeEnabled();}
async function compareXML(page,info,id,separate){
 const names=separate?['DEMO.xml','TESTS_v4f2.xml','TESTS2_v4f2.xml']:[id+'.xml'];
 for(const n of names){const pending=page.waitForEvent('download');await page.locator('[data-download]').filter({hasText:n}).click();const d=await pending,p=info.outputPath(id+'-'+n);await d.saveAs(p);expect(await readFile(p)).toEqual(await readFile(new URL(id+'/'+n,fixture)));}
}
test('native login GUI: no operation finishes normally; split/join/empty-booklet XML match original bytes',async({page},info)=>{
 await open(page);await run(page);await expect(page.locator('#notice')).toHaveText('beendet');await expect(page.locator('#notice')).not.toHaveClass(/error/);await expect(page.locator('[data-download]')).toHaveCount(0);await expect(page.locator('#outputs')).toBeEmpty();
 for(const [id,separate,booklet] of [['N1',true,'Booklet1'],['N2',false,'Booklet1'],['N3',false,'']]){
  await page.locator('#tool-file').setInputFiles({name:id+'.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:await readFile(new URL('existing.xlsx',fixture))});
  await page.locator('#create-xml').check();await page.locator('#separate').setChecked(separate);await page.locator('#booklet-id').fill(booklet);await run(page);await expect(page.locator('[data-download]')).toHaveCount(separate?4:2);await compareXML(page,info,id,separate);
 }
});
test('native login GUI: invalid length recovers with negative password length and all prefixes/proctor',async({page})=>{
 await open(page);await page.locator('#renew').check();await page.locator('#create-xml').check();await page.locator('#code-length').fill('4');await page.locator('#password-length').fill('-1');await page.locator('#booklet-id').fill('');await page.locator('#separate').uncheck();for(const id of ['monitor','prefix-testee','prefix-reserve','prefix-review'])await page.locator('#'+id).check();
 await run(page);await expect(page.locator('#notice')).toHaveText('Die Länge des Benutzernamens muss mindestens 5 sein.');await expect(page.locator('[data-download]')).toHaveCount(0);
 await page.locator('#code-length').fill('5');await run(page);await expect(page.locator('[data-download]')).toHaveCount(2);await expect(page.locator('#notice')).toContainText('12 Logins');
});
test('native login GUI: reopening resets operations and discards drafts while retaining submitted parameters',async({page})=>{
 await open(page);await page.locator('#create-xml').check();await page.locator('#booklet-id').fill('');await page.locator('#separate').uncheck();await run(page);await expect(page.locator('[data-download]')).toHaveCount(2);
 const reopen=async()=>{await page.locator('[data-tool="codes"]').click();await page.locator('[data-tool="logins"]').click();};
 await reopen();await expect(page.locator('#create-xml')).not.toBeChecked();await expect(page.locator('#renew')).not.toBeChecked();await expect(page.locator('#booklet-id')).toHaveValue('');await expect(page.locator('#separate')).not.toBeChecked();
 await page.locator('#create-xml').check();await page.locator('#booklet-id').fill('draft');await page.locator('#separate').check();await reopen();await expect(page.locator('#booklet-id')).toHaveValue('');await expect(page.locator('#separate')).not.toBeChecked();await expect(page.locator('#create-xml')).not.toBeChecked();
 // A fresh native process starts with static defaults; the saved input itself remains available.
 await page.reload();await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="logins"]').click();await expect(page.locator('#booklet-id')).toHaveValue('Booklet1');await expect(page.locator('#create-xml')).not.toBeChecked();
});
