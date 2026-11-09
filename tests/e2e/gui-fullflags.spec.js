import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const root=new URL('../fixtures/gui-fullflags-20261109/',import.meta.url),proof=JSON.parse(await readFile(new URL('proof.json',root)));
test('all 32 native GUI display combinations across score/comments/instruction/anonym/training flags',async({page})=>{
 await page.goto('/');await page.locator('#coding-files').setInputFiles(await Promise.all(proof.cases.map(async c=>({name:c.input,mimeType:'application/zip',buffer:await readFile(new URL(c.input,root))}))));
 for(const [index,c]of proof.cases.entries()){
  await page.locator('#jobs').selectOption(String(index));await expect(page.locator('#case-number')).toHaveValue('1');await expect(page.locator('.progress')).toContainText('0 von 6');await expect(page.locator('.code-option')).toHaveCount(2);
  await expect(page.locator('.code-option small')).toHaveCount(c.observed.scoreValues?2:0);if(c.observed.scoreValues)await expect(page.locator('.code-option small')).toHaveText(c.observed.scoreValues.map(v=>v+' P.'));
  await expect(page.locator('#comment')).toHaveCount(c.observed.commentField?1:0);await expect(page.locator('.description')).toHaveCount(c.observed.instructionVisible?1:0);if(c.observed.instructionVisible)await expect(page.locator('.description')).toHaveText('FLAG-ANWEISUNG');
 }
});
