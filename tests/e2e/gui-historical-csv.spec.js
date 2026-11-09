import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadWorkbook} from '../../src/toolbox.js';
const fixture=name=>fileURLToPath(new URL('../fixtures/gui-final-20261109/'+name,import.meta.url));
const shape=async bytes=>(await loadWorkbook(bytes)).worksheets.map(s=>({name:s.name,rows:Array.from({length:s.rowCount},(_,i)=>Array.from({length:s.columnCount},(_,j)=>s.getRow(i+1).getCell(j+1).text))}));
test('Native historical CSV GUI: 2011, 2019 and 2024 imports produce the same Excel cells',async({page},testInfo)=>{
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="responses"]').click();
 await page.locator('#data-compatibility').selectOption('windows');
 for(const year of [2011,2019,2024]){
  await page.locator('#data-input').setInputFiles(fixture(`csv${year}.csv`));
  await page.locator('#create-data').click();await expect(page.locator('#create-data')).toBeEnabled();
  const waiting=page.waitForEvent('download');await page.locator('[data-output]').click();const download=await waiting;
  const path=testInfo.outputPath(`csv${year}-paired.xlsx`);await download.saveAs(path);
  expect(await shape(await readFile(path))).toEqual(await shape(await readFile(fixture(`native-csv${year}.xlsx`))));
  await testInfo.attach(`Windows CSV ${year} paired workbook`,{path});
 }
});
