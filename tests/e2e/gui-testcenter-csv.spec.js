import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.use({serviceWorkers:'block'});
const input=name=>readFile(new URL('../fixtures/gui-final-20261109/'+name,import.meta.url));
const reports=JSON.parse(await input('testcenter-reports.json'));
test('Native Testcenter CSV GUI: both direct downloads match every Windows byte',async({page},testInfo)=>{
 await page.route('**/api/**',route=>{
  const u=new URL(route.request().url()),path=u.pathname;
  if(path==='/api/session/admin')return route.fulfill({json:{token:'synthetic-only',access:{workspaceAdmin:['1']}}});
  if(path==='/api/workspace/1')return route.fulfill({json:{name:reports.workspace.name}});
  if(path==='/api/workspace/1/results')return route.fulfill({json:reports.groups});
  if(path==='/api/workspace/1/files')return route.fulfill({json:[]});
  for(const kind of ['response','log'])if(path.endsWith('/report/'+kind))return route.fulfill({contentType:'text/csv',body:reports.report[u.searchParams.get('dataIds')][kind+'CSV']});
  return route.fulfill({status:404,body:''});
 });
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="testcenter"]').click();
 await page.locator('#tc-url').fill('http://127.0.0.1:4173');await page.locator('#tc-name').fill('synthetic-only');await page.locator('#tc-password').fill('synthetic-only');await page.locator('#tc-connect').click();
 await expect(page.locator('#tc-workspace')).toContainText(reports.workspace.name);await page.locator('#tc-compatibility').selectOption('windows');
 for(const [kind,name]of [['response','responses'],['log','logs']]){
  await page.locator(`#tc-${kind}-csv`).click();await expect(page.locator(`#tc-${kind}-csv`)).toBeEnabled();
  const waiting=page.waitForEvent('download');await page.locator('[data-output]').click();const download=await waiting,path=testInfo.outputPath(`native-${kind}.csv`);await download.saveAs(path);
  expect(await readFile(path)).toEqual(await input(`native-tc-${name}.csv`));
  await testInfo.attach('Native Testcenter '+kind+' CSV pair',{path});
 }
});
