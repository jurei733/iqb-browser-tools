import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {pipelineCorpus} from '../../scripts/converter-corpus.mjs';

test('Windows mode: raw API files retain original values and chunk order through the real worker',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('[data-module=toolbox]').click();await page.locator('[data-tool=responses]').click();
 await page.locator('#data-input').setInputFiles({name:'windows-api.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([pipelineCorpus()[0].dto]))});await page.locator('#data-compatibility').selectOption('windows');await page.locator('#format').selectOption('json');
 async function exported(){await page.locator('#create-data').click();await expect(page.locator('.tool-main')).toHaveAttribute('aria-busy','false');const waiting=page.waitForEvent('download');await page.locator('[data-output]').click();const download=await waiting;const path=testInfo.outputPath(download.suggestedFilename());await download.saveAs(path);return JSON.parse(await readFile(path,'utf8'));}
 const original=await exported(),unit=original[0].booklets[0].units[0];expect(unit.chunks.map(c=>c.id)).toEqual(['newer','older']);expect(unit.subforms.map(sf=>sf.responses[0].value)).toEqual(['12,5','ab\nc']);expect(unit.subforms[0].responses[0].status).toBe('');
 await page.locator('#data-compatibility').selectOption('extended');const enhanced=await exported();expect(enhanced[0].booklets[0].units[0].subforms).toHaveLength(1);expect(enhanced[0].booklets[0].units[0].subforms[0].responses[0].value).toBe('12.5');expect(errors).toEqual([]);
});
