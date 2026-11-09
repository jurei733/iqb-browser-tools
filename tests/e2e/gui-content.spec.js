import{test,expect}from'@playwright/test';import{readFile}from'node:fs/promises';import{unzipSync,strFromU8}from'fflate';
test.use({serviceWorkers:'block'});const input=name=>readFile(new URL('../fixtures/gui-final-20261109/'+name,import.meta.url));const metadata=JSON.parse(await input('content-metadata.json')),bytes=JSON.parse(await input('content-test-bytes.json'));
test('Native content GUI: original index, ten credential-free files and booklet dependency sizes',async({page},testInfo)=>{
 await page.clock.install({time:new Date('2026-11-09T09:45:00Z')});await page.clock.pauseAt(new Date('2026-11-09T09:45:00Z'));
 await page.route('**/api/**',route=>{const u=new URL(route.request().url()),path=u.pathname;
  if(path==='/api/session/admin')return route.fulfill({json:{token:'synthetic-only',access:{workspaceAdmin:['1']}}});
  if(path==='/api/workspace/1')return route.fulfill({json:{name:'Sample Workspace'}});
  if(path.endsWith('/results'))return route.fulfill({json:[]});if(path.endsWith('/files'))return route.fulfill({json:metadata.files});
  if(path.endsWith('/files-dependencies')){const requested=route.request().postDataJSON().body;return route.fulfill({json:requested.some(n=>n==='SAMPLE_UNIT.XML')?metadata.deps:metadata.bookletDependencies});}
  if(path.includes('/file/'))return route.fulfill({contentType:'application/octet-stream',body:Buffer.from(bytes[decodeURIComponent(path.split('/').pop())],'base64')});return route.fulfill({status:404,body:''});
 });
 await page.goto('/');await page.locator('[data-module="toolbox"]').click();await page.locator('[data-tool="testcenter"]').click();await page.locator('#tc-url').fill('http://127.0.0.1:4173');await page.locator('#tc-name').fill('synthetic-only');await page.locator('#tc-password').fill('synthetic-only');await page.locator('#tc-connect').click();await expect(page.locator('#tc-workspace')).toContainText('Sample Workspace');await page.locator('#tc-compatibility').selectOption('windows');
 await page.locator('#tc-content').click();await expect(page.locator('[data-output]')).toBeVisible();let waiting=page.waitForEvent('download');await page.locator('[data-output]').click();let download=await waiting,path=testInfo.outputPath('Content.zip');await download.saveAs(path);const zip=unzipSync(await readFile(path));
 expect(Object.keys(zip).sort()).toEqual([...metadata.files.map(f=>f.name),'index.html'].sort());for(const f of metadata.files)expect(Buffer.from(zip[f.name]),f.name).toEqual(Buffer.from(bytes[f.name],'base64'));
 const native=strFromU8(await input('native-content-index.html')).replace('http://192.168.64.1:5189','http://127.0.0.1:4173');expect(strFromU8(zip['index.html'])).toEqual(native);await testInfo.attach('Native content export',{path});
 await page.locator('#tc-sizes').click();await expect(page.locator('[data-output]')).toContainText('BookletSizes.json');waiting=page.waitForEvent('download');await page.locator('[data-output]').click();download=await waiting;path=testInfo.outputPath('booklets.json');await download.saveAs(path);expect(JSON.parse(await readFile(path,'utf8'))).toEqual(metadata.sizes);
});
