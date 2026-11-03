import {test,expect} from '@playwright/test';
import {mkdtemp,mkdir,copyFile,readFile,writeFile,rm,readdir,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createLocalApp} from '../../scripts/lib/local-server.mjs';
import {decodeResult} from '../../src/coding.js';
import {loadWorkbook} from '../../src/toolbox.js';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
let root,workspace,app;
test.beforeAll(async()=>{root=await mkdtemp(join(tmpdir(),'iqb-local-browser-'));workspace=join(root,'work');await mkdir(workspace);for(const name of ['Kodierjob-Schablone.zip','Logins-Beispiel.xlsx'])await copyFile(resolve('public/examples',name),join(workspace,name));app=await createLocalApp({dist:resolve('dist'),configFile:join(root,'config.json'),identity:{name:'browser',account:'PILOT\\browser',source:'Windows-Anmeldekonto'}});});
test.afterAll(async()=>{await app?.close();await rm(root,{recursive:true,force:true});});
test('local starter: account, direct overwrite and remembered fresh Toolbox paths',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto(app.url);await page.locator('#local-settings').click();await expect(page.locator('#local-account')).toContainText('PILOT\\browser');await page.locator('#local-path').fill(workspace);await page.locator('#local-connect').click();await expect(page.locator('#local-settings-dialog')).toHaveCount(0);
  await page.locator('#open-local-folder').click();await expect(page.locator('#coder')).toHaveValue('browser');await page.locator('[data-code="1"]').click();await expect(page.locator('#saved')).toHaveText('Im Arbeitsordner gespeichert');
  const resultNames=(await readdir(workspace)).filter(n=>n.endsWith('.result'));expect(resultNames).toHaveLength(1);let resultPath=join(workspace,resultNames[0]);const first=decodeResult(new Uint8Array(await readFile(resultPath)));expect(first.coder).toBe('browser');expect(first.entries).toHaveLength(1);
  await page.locator('[data-code="0"]').click();await expect(page.locator('#saved')).toHaveText('Im Arbeitsordner gespeichert');expect((await readdir(workspace)).filter(n=>n.endsWith('.result'))).toEqual(resultNames);expect(decodeResult(new Uint8Array(await readFile(resultPath))).entries[0].code).not.toBe(first.entries[0].code);
  await rename(resultPath,join(workspace,'Existing.result'));resultPath=join(workspace,'Existing.result');
  await page.reload();await expect(page.locator('#local-settings')).toBeVisible();await page.locator('#open-local-folder').click();await expect(page.locator('#coder')).toHaveValue('browser');await expect(page.locator('#saved')).toHaveText('Im Arbeitsordner gespeichert');
  expect((await readdir(workspace)).filter(n=>n.endsWith('.result'))).toEqual(['Existing.result']);
  await page.locator('[data-module=toolbox]').click();await page.locator('[data-tool=logins]').click();const input=page.locator('.tool-main input[type=file]').first();const id=await input.getAttribute('id');await page.locator(`[data-local-input="${id}"]`).click();await page.locator('.local-file-dialog input[value="Logins-Beispiel.xlsx"]').check();await page.getByRole('button',{name:'Ausgewählte Dateien öffnen'}).click();await expect(page.locator('.local-file-dialog')).toHaveCount(0);
  await expect.poll(()=>input.evaluate(el=>el.files[0]?.iqbLocalReference?.path)).toBe('Logins-Beispiel.xlsx');
  // Wait for the persisted snapshot, then change the actual external workbook.
  await expect.poll(()=>page.evaluate(()=>new Promise(resolve=>{const req=indexedDB.open('iqb-browser',1);req.onsuccess=()=>{const db=req.result,get=db.transaction('progress').objectStore('progress').get('form:logins');get.onsuccess=()=>{resolve(get.result?.find(f=>f.type==='file')?.files?.[0]?.iqbLocalReference?.path);db.close();};};}))).toBe('Logins-Beispiel.xlsx');
  const workbookPath=join(workspace,'Logins-Beispiel.xlsx'),book=await loadWorkbook(await readFile(workbookPath));book.getWorksheet('Logins').getCell('D2').value='fresh-from-disk';const changed=Buffer.from(await book.xlsx.writeBuffer());await writeFile(workbookPath,changed);
  await page.reload();await expect(page.locator('#local-settings')).toBeVisible();await page.locator('[data-module=toolbox]').click();await page.locator('[data-tool=logins]').click();
  await expect.poll(()=>page.locator('#'+id).evaluate(async el=>{const file=el.files?.[0];if(!file)return '';const bytes=new Uint8Array(await file.arrayBuffer());const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('');})).toBe((await import('node:crypto')).createHash('sha256').update(changed).digest('hex'));
  // Missing external files must never silently fall back to an old browser copy.
  await rm(workbookPath);await page.reload();await expect(page.locator('#local-settings')).toBeVisible();await page.locator('[data-module=toolbox]').click();await page.locator('[data-tool=logins]').click();await expect(page.locator('#notice')).toContainText('nicht gefunden');await expect.poll(()=>page.locator('#'+id).evaluate(el=>el.files.length)).toBe(0);
  expect(errors).toEqual([]);
});
