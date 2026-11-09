import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
test('Native positive duplicate GUI: identifies the same person and unit in the browser',async({page},testInfo)=>{
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="database"]').click();
 await page.locator('#db-file').setInputFiles(fileURLToPath(new URL('../fixtures/gui-final-20261109/duplicates.sqlite',import.meta.url)));
 await expect(page.locator('#db-check')).toBeEnabled();await page.locator('#db-check').click();
 const result=page.locator('#db-check-result');await expect(result).toContainText('DEMO');
 await expect(result).toContainText('demo1');await expect(result).toContainText('001');
 await expect(result).toContainText('MATHE01');await expect(result).toContainText('MATHE_');
 const check=JSON.parse(await result.locator('pre').textContent());
 expect(check.duplicates).toEqual([{group:'DEMO',login:'demo1',code:'001',count:2}]);
 expect(check.units).toEqual([{bookletId:1,name:'MATHE01',alias:'MATHE_',count:2}]);
 await testInfo.attach('Native positive duplicate pair',{body:await page.screenshot(),contentType:'image/png'});
});
