import {test as base, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {DOMParser, XMLSerializer} from '@xmldom/xmldom';
import {unzipSync, strFromU8} from 'fflate';
import {decodeResult} from '../../src/coding.js';
import {loadWorkbook} from '../../src/toolbox.js';

globalThis.DOMParser=DOMParser;
globalThis.XMLSerializer=XMLSerializer;
const fixture=name=>fileURLToPath(new URL('../fixtures/pilot/'+name,import.meta.url));
const example=name=>fileURLToPath(new URL('../../public/examples/'+name,import.meta.url));
const template=name=>fileURLToPath(new URL('../../public/templates/'+name,import.meta.url));
const test=base.extend({
  page: async({page}, use, testInfo)=>{
    const errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    await use(page);
    if(testInfo.status!==testInfo.expectedStatus)console.log('Application notice:',await page.locator('#notice').textContent().catch(()=>''));
    expect(errors, 'Unhandled browser errors').toEqual([]);
  }
});
const module=(page,id)=>page.locator(`[data-module="${id}"]`).click();
const tool=(page,id)=>page.locator(`[data-tool="${id}"]`).click();
const done=page=>expect(page.locator('.tool-main')).toHaveAttribute('aria-busy','false');
async function download(page,selector,testInfo){
  const waiting=page.waitForEvent('download');
  await page.locator(selector).click();
  const result=await waiting;
  expect(await result.failure()).toBeNull();
  const path=testInfo.outputPath(result.suggestedFilename());
  await result.saveAs(path);
  await testInfo.attach(result.suggestedFilename(),{path});
  return readFile(path);
}

test('coding: keyboard, modal guard, result download and stored progress',async({page},testInfo)=>{
  await page.goto('/');
  await page.locator('#demo').click();
  await expect(page.locator('#comment')).toBeVisible();
  await page.locator('#coder').fill('Browser CI');
  await page.locator('[data-code="1"]').click();
  await expect(page.locator('[data-code="1"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#comment').fill('Grüße & Code 1');
  await page.locator('#next').click();
  await expect(page.locator('#case-number')).toHaveValue('2');
  await page.locator('#next-open').focus();
  await page.keyboard.press('0');
  await expect(page.locator('[data-code="0"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#coded-list').click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('1');
  await page.locator('#close-cases').click();
  await expect(page.locator('#case-number')).toHaveValue('2');
  await expect(page.locator('[data-code="0"]')).toHaveAttribute('aria-pressed','true');
  const result=decodeResult(await download(page,'#export',testInfo));
  expect(result.coder).toBe('Browser CI');
  expect(result.entries.map(e=>e.code)).toEqual(['1','0']);
  expect(result.entries[0].comment).toBe('Grüße & Code 1');
  await page.reload();
  await page.locator('#demo').click();
  await expect(page.locator('.progress')).toContainText('2 von 2');
  await expect(page.locator('#comment')).toHaveValue('Grüße & Code 1');
});

test('coding: upload a job and move, rotate and reset its template',async({page})=>{
  await page.goto('/');
  await page.locator('#coding-files').setInputFiles(example('Kodierjob-Schablone.zip'));
  const overlay=page.locator('.template-layer');
  await expect(overlay).toBeVisible();
  const initial=await overlay.boundingBox();
  await page.mouse.move(initial.x+30,initial.y+30);
  await page.mouse.down();
  await page.mouse.move(initial.x+90,initial.y+70,{steps:5});
  await page.mouse.up();
  await expect(overlay).not.toHaveCSS('left','0px');
  await page.locator('#template-right').click();
  await expect(overlay).not.toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
  await page.locator('#template-reset').click();
  await expect(overlay).toHaveCSS('left','0px');
  await expect(overlay).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
});

test('Toolbox: retain login inputs and downloads, then create QR Word handouts',async({page},testInfo)=>{
  await page.goto('/');await module(page,'toolbox');await tool(page,'logins');
  await page.locator('#tool-file').setInputFiles(example('Logins-Beispiel.xlsx'));
  await page.locator('#booklet-id').fill('BOOKLET.CI');
  await page.locator('#prefix-testee').check();
  await tool(page,'docx');await tool(page,'logins');
  await expect(page.locator('#booklet-id')).toHaveValue('BOOKLET.CI');
  await expect(page.locator('#prefix-testee')).toBeChecked();
  await expect.poll(()=>page.locator('#tool-file').evaluate(el=>el.files[0]?.name)).toBe('Logins-Beispiel.xlsx');
  await page.locator('#run-tool').click();await done(page);
  const xml=strFromU8(await download(page,'[data-download]:has-text("xml")',testInfo));
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  expect(Array.from(doc.getElementsByTagName('Booklet'),el=>el.textContent)).toEqual(expect.arrayContaining(['BOOKLET.CI']));
  await tool(page,'docx');await tool(page,'logins');
  const logins=await download(page,'[data-download]:has-text("xlsx")',testInfo);
  expect((await loadWorkbook(logins)).worksheets.length).toBeGreaterThan(0);
  await tool(page,'docx');
  await page.locator('#docx-logins').setInputFiles({name:'Logins.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:logins});
  await page.locator('#docx-preset').selectOption('2');
  await page.locator('#docx-server').fill('https://tc.example.org');
  await page.locator('#create-docx').click();await done(page);
  const zip=unzipSync(await download(page,'[data-output]',testInfo));
  expect(Object.keys(zip).filter(name=>name.startsWith('word/media/iqb-qr-'))).toHaveLength(4);
  expect(strFromU8(zip['word/document.xml'])).toContain('tc.example.org');
});

test('Toolbox: CSV keeps exact values and rejects invalid input without stale downloads',async({page},testInfo)=>{
  await page.goto('/');await module(page,'toolbox');await tool(page,'csv');
  await page.locator('#tool-file').setInputFiles(fixture('Syscheck-Pilot.csv'));
  await page.locator('#run-tool').click();await done(page);
  const sheet=(await loadWorkbook(await download(page,'[data-download]',testInfo))).worksheets[0];
  expect(sheet.getCell('A2').text).toBe('001');expect(sheet.getCell('C2').text).toBe('0');
  expect(sheet.getCell('B3').text).toBe('Zeile 1\nZeile 2');
  expect(sheet.getCell('C3').text).toBe('9007199254740993');
  await page.locator('#tool-file').setInputFiles(fixture('Fehlerhaft.csv'));
  await expect(page.locator('#outputs')).toBeEmpty();
  await page.locator('#run-tool').click();await done(page);
  await expect(page.locator('#notice')).toContainText('Anführungszeichen');
  await expect(page.locator('#outputs')).toBeEmpty();
});

test('Toolbox: codes and booklets produce downloadable original formats',async({page},testInfo)=>{
  await page.goto('/');await module(page,'toolbox');
  await page.locator('#run-tool').click();await done(page);
  const sheet=(await loadWorkbook(await download(page,'[data-download]',testInfo))).getWorksheet('Codes');
  expect(sheet.getCell('D2001').text).toHaveLength(5);
  await tool(page,'booklets');
  await page.locator('#tool-file').setInputFiles(template('Booklet-Template.xlsx'));
  await page.locator('#run-tool').click();await done(page);
  const count=await page.locator('[data-download]').count();expect(count).toBeGreaterThan(0);
  for(let i=0;i<count;i++){
    const bytes=await download(page,`[data-download="${i}"]`,testInfo);
    expect(new DOMParser().parseFromString(strFromU8(bytes),'application/xml').documentElement.localName).toBe('Booklet');
  }
});

test('Toolbox: answers, SQLite exports, rejected database and offline recovery',async({page,context},testInfo)=>{
  await page.goto('/');await module(page,'toolbox');await tool(page,'responses');
  await page.locator('#data-input').setInputFiles([example('Antworten.csv'),example('Logs.csv')]);
  await page.locator('#create-data').click();await done(page);
  await expect(page.locator('#outputs')).toContainText('3 Testpersonen, 6 Antworten');
  expect((await loadWorkbook(await download(page,'[data-output]',testInfo))).worksheets.map(s=>s.name)).toEqual(['Antworten','Status','Codes','Scores']);
  await tool(page,'database');await page.locator('#db-new').click();await done(page);
  await page.locator('#db-import-files').setInputFiles(example('Antworten-Logs.json'));
  await page.locator('#db-import').click();await done(page);
  await expect(page.locator('#db-summary')).toContainText('3Testpersonen');
  await page.locator('#db-check').click();await done(page);
  await expect(page.locator('#db-check-result')).toContainText('Keine Fehler');
  const sqlite=await download(page,'#db-save',testInfo);
  expect(sqlite.subarray(0,15).toString()).toBe('SQLite format 3');
  await page.locator('#db-file').setInputFiles(fixture('Keine-Datenbank.sqlite'));
  await expect(page.locator('#notice')).toHaveClass('notice error');
  await expect(page.locator('#db-summary')).toContainText('3Testpersonen');
  await page.locator('#db-export').click();await done(page);
  expect((await loadWorkbook(await download(page,'[data-output]',testInfo))).worksheets).toHaveLength(4);
  // Wait for the real production service worker to finish caching WASM and templates.
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
  await context.setOffline(true);
  try{
    await page.reload();await module(page,'toolbox');await tool(page,'database');
    await page.locator('#db-restore').click();await done(page);
    await expect(page.locator('#db-summary')).toContainText('6Antworten');
    await page.locator('#db-check').click();await done(page);
    await expect(page.locator('#db-check-result')).toContainText('Keine Fehler');
    await tool(page,'docx');await page.locator('#docx-logins').setInputFiles(example('Logins-Beispiel.xlsx'));
    await page.locator('#create-docx').click();await done(page);
    expect(unzipSync(await download(page,'[data-output]',testInfo))['word/document.xml']).toBeTruthy();
  }finally{await context.setOffline(false);}
});

test.describe('Testcenter with a synthetic API',()=>{
// Browser-level routing must see API requests rather than a service worker's
// outgoing requests. The separate offline test exercises the real worker.
test.use({serviceWorkers:'block'});
test('Testcenter: group selection and workspace changes cannot export stale groups',async({page},testInfo)=>{
  // API responses are synthetic; this tests browser fetch and the production UI,
  // independently of the separately maintained live Testcenter installation.
  let releaseGroups,startedGroups,failGroups=false,secondWorkspaceRequests=0;
  const heldGroups=new Promise(resolve=>releaseGroups=resolve);
  const requestedGroups=new Promise(resolve=>startedGroups=resolve);
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    if(path==='/api/session/admin')return route.fulfill({json:{token:'synthetic-ci-session',access:{workspaceAdmin:['1','2']}}});
    if(path==='/api/session')return route.fulfill({status:205,body:''});
    if(path==='/api/workspace/1'||path==='/api/workspace/2')return route.fulfill({json:{name:'Workspace '+path.at(-1)}});
    if(path==='/api/workspace/2/results'){secondWorkspaceRequests++;startedGroups();await heldGroups;return failGroups?route.fulfill({status:503,body:'Synthetic unavailable workspace'}):route.fulfill({json:[{groupName:'SECOND',groupLabel:'New group'}]});}
    if(path==='/api/workspace/1/results')return route.fulfill({json:[{groupName:'FIRST',groupLabel:'First group'},{groupName:'OTHER',groupLabel:'Other group'}]});
    if(path.includes('/report/'))return route.fulfill({json:[]});
    return route.fulfill({status:404,body:'Unexpected mock API path'});
  });
  await page.goto('/');await module(page,'toolbox');await tool(page,'testcenter');
  await page.locator('#tc-url').fill('http://127.0.0.1:4173');
  await page.locator('#tc-name').fill('synthetic-ci');await page.locator('#tc-password').fill('synthetic-only');
  await page.locator('#tc-connect').click();await done(page);
  await expect(page.locator('[data-group]')).toHaveCount(2);
  await page.locator('[data-group="1"]').uncheck();
  await expect(page.locator('#tc-selection')).toHaveText('1 von 2 Gruppen ausgewählt.');
  expect(await page.locator('#tc-all-groups').evaluate(el=>el.indeterminate)).toBe(true);
  await page.locator('#format').selectOption('json');await page.locator('#tc-data').click();await done(page);
  expect(JSON.parse((await download(page,'[data-output]',testInfo)).toString())).toEqual([]);
  await page.locator('#tc-workspace').selectOption('2');await requestedGroups;
  try{
    await expect(page.locator('[data-module="coding"]')).toBeDisabled();
    await expect(page.locator('#tc-data')).toBeDisabled();
    await expect(page.locator('#outputs')).toBeEmpty();
  }finally{releaseGroups();}
  await done(page);await expect(page.locator('#tc-groups')).toContainText('New group');
  await expect(page.locator('#tc-groups')).not.toContainText('First group');
  await expect(page.locator('#tc-selection')).toHaveText('1 von 1 Gruppen ausgewählt.');
  // Failed group discovery must keep the workspace ID and groups together.
  await page.locator('#tc-workspace').selectOption('1');await done(page);
  failGroups=true;
  await page.locator('#tc-workspace').selectOption('2');await done(page);
  await expect(page.locator('#notice')).toContainText('HTTP 503');
  await expect(page.locator('#tc-workspace')).toHaveValue('1');
  await expect(page.locator('#tc-groups')).toContainText('First group');
  await expect(page.locator('#tc-data')).toBeEnabled();
  expect(secondWorkspaceRequests).toBe(2);
  await page.locator('#tc-disconnect').click();await done(page);
  await expect(page.locator('#tc-login')).toBeVisible();
  await page.locator('#tc-password').fill('unsent-synthetic');await tool(page,'codes');await tool(page,'testcenter');
  await expect(page.locator('#tc-password')).toHaveValue('');
});
});
