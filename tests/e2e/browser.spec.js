import {test, expect} from '@playwright/test';

test('original templates, image decoders, workers, exports and browser storage', async({page}, testInfo)=>{
  const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  // Collect the existing browser harness report without adding a public report endpoint.
  await page.route('**/__report__', route=>route.fulfill({status: 200, body: 'OK'}));
  await page.goto('http://127.0.0.1:4174/tests/browser.html');
  const reported=page.waitForRequest(r=>r.method()==='POST'&&new URL(r.url()).pathname==='/__report__');
  await page.locator('#run').click();
  const report=(await reported).postDataJSON();
  console.log(`Browser compatibility: ${report.passed}/${report.total} passed`);
  await testInfo.attach('browser-compatibility.json', {body: JSON.stringify(report,null,2), contentType:'application/json'});
  expect(report.total).toBeGreaterThanOrEqual(43);
  expect(report.checks.filter(c=>!c.passed)).toEqual([]);
  expect(report.passed).toBe(report.total);
  expect(errors).toEqual([]);
});
