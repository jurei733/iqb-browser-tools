import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import initSqlJs from 'sql.js';
import {OutputDatabase} from '../../src/database.js';
const proof=JSON.parse(await readFile(new URL('../fixtures/gui-final-20261108.json',import.meta.url)));
for(const module of ['coding','toolbox'])test('Native '+module+' help GUI: button and F1 show identity, version, purpose and close',async({page})=>{
 await page.goto('/');await page.locator('[data-module="'+module+'"]').click();await page.locator('#scope').click();
 await expect(page.locator('#about')).toBeVisible();await expect(page.locator('#about')).toContainText('itc-ToolBox 3.3.0.2');await expect(page.locator('#about')).toContainText('Input, Reviews, System-Check, Antworten und Logs');
 await expect(page.locator('#about')).toContainText('IQB-Kodieren 4.3.0.3: Mit dieser Anwendung werden Scans von Testinstrumenten kodiert. Voraussetzung ist jeweils ein spezielles Dateipaket vom IQB.');
 await expect(page.locator('#toolbox-current-docs')).toHaveAttribute('href','https://iqb-berlin.github.io/tba-info/coding/toolbox/booklet.html');
 await page.locator('#close-about').click();await expect(page.locator('#about')).not.toBeVisible();
 await page.keyboard.press('F1');await expect(page.locator('#about')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#about')).not.toBeVisible();
});
test('Native CSV database GUI: import response and log files, save, compare ten original tables',async({page},testInfo)=>{
 const p=proof.csvDatabase;
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="database"]').click();await page.locator('#db-new').click();
 await expect(page.locator('#db-summary')).toContainText('0Testpersonen');
 await page.locator('#db-import-files').setInputFiles(p.files.map(c=>({name:c.name,mimeType:'text/csv',buffer:Buffer.from(c.base64,'base64')})));
 await page.locator('#db-import').click();await expect(page.locator('#db-summary')).toContainText('3Testpersonen');await expect(page.locator('#db-summary')).toContainText('6Antworten');
 const waiting=page.waitForEvent('download');await page.locator('#db-save').click();const download=await waiting,path=testInfo.outputPath('native-csv-import.sqlite');await download.saveAs(path);await testInfo.attach('Native CSV GUI paired SQLite',{path});
 const SQL=await initSqlJs(),browser=new OutputDatabase(SQL,await readFile(path)),original=new OutputDatabase(SQL,Buffer.from(p.sqliteAfter.base64,'base64'));
 try{const canonical=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).sort()));for(const table of ['person','bookletInfo','booklet','session','bookletLog','unit','unitLog','unitLastState','chunk','response'])expect(canonical(browser.query('SELECT * FROM ['+table+']')),table).toEqual(canonical(original.query('SELECT * FROM ['+table+']')));}finally{browser.close();original.close();}
});
