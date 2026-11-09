import{test,expect}from'@playwright/test';import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';
const proof=JSON.parse(await readFile(new URL('../fixtures/gui-final-20261109/cancel-input.json',import.meta.url)));
const bytes=Buffer.from((proof.bom?'\ufeff':'')+[proof.header,...Array.from({length:proof.count},(_,i)=>proof.row.replace('"cancel0"',`"cancel${i}"`))].join(proof.separator)+(proof.trailingNewline?proof.separator:''));
test('Native cancellation GUI: same 20000 CSV rows stop, produce no download and permit a new import',async({page})=>{
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(proof.sha256);
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="responses"]').click();await page.locator('#data-compatibility').selectOption('windows');await page.locator('#data-input').setInputFiles({name:'answers.csv',mimeType:'text/csv',buffer:bytes});await page.locator('#create-data').click();await page.locator('.cancel-job').click();await expect(page.locator('#create-data')).toBeEnabled();await expect(page.locator('[data-output]')).toHaveCount(0);
 await page.locator('#data-input').setInputFiles(new URL('../fixtures/gui-final-20261109/csv2024.csv',import.meta.url).pathname);await page.locator('#create-data').click();await expect(page.locator('[data-output]')).toHaveCount(1);await expect(page.locator('#outputs')).toContainText('3 Testpersonen');
});
