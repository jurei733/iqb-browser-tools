import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {loadWorkbook} from '../../src/toolbox.js';
test.use({serviceWorkers:'block'});
const input=name=>readFile(new URL('../fixtures/gui-final-20261109/'+name,import.meta.url));
const standard=JSON.parse(await input('reviews-standard.json')),missing=JSON.parse(await input('reviews-missing-categories.json'));
const cells=book=>book.worksheets.map(sheet=>({name:sheet.name,rows:Array.from({length:sheet.rowCount},(_,i)=>Array.from({length:7},(_,j)=>sheet.getCell(i+1,j+1).value??''))}));
for(const failed of [false,true])test('Native review GUI: '+(failed?'missing standard columns produce original empty workbook':'booklet and unit downloads match native cells'),async({page},testInfo)=>{
 await page.route('**/api/**',route=>{const u=new URL(route.request().url()),path=u.pathname;
  if(path==='/api/session/admin')return route.fulfill({json:{token:'synthetic-only',access:{workspaceAdmin:['1']}}});
  if(path==='/api/workspace/1')return route.fulfill({json:{name:standard.workspace.name}});
  if(path.endsWith('/results'))return route.fulfill({json:standard.groups});
  if(path.endsWith('/files'))return route.fulfill({json:[]});
  if(path.endsWith('/report/review')){const group=u.searchParams.get('dataIds');return route.fulfill({contentType:'application/json',body:failed?missing.reports[group].legacy:standard.reports[group]});}
  return route.fulfill({status:404,body:''});
 });
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="testcenter"]').click();
 await page.locator('#tc-url').fill('http://127.0.0.1:4173');await page.locator('#tc-name').fill('synthetic-only');await page.locator('#tc-password').fill('synthetic-only');await page.locator('#tc-connect').click();
 await expect(page.locator('#tc-workspace')).toContainText(standard.workspace.name);await expect(page.locator('#tc-groups')).toContainText('A Group of Reviewers');await page.locator('#tc-compatibility').selectOption('windows');
 await page.locator('#tc-reviews').click();await expect(page.locator('[data-output]')).toBeVisible();
 const waiting=page.waitForEvent('download');await page.locator('[data-output]').click();const download=await waiting,path=testInfo.outputPath('Reviews.xlsx');await download.saveAs(path);
 const browser=await loadWorkbook(await readFile(path)),native=await loadWorkbook(await input(failed?'native-reviews-missing-categories.xlsx':'native-reviews-standard.xlsx'));
 expect(cells(browser)).toEqual(cells(native));await testInfo.attach('Original Windows review comparison',{path});
});
