import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {loadWorkbook} from '../../src/toolbox.js';
test('@load 250 scan files load through the real coding worker',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4176/tests/acceptance.html');await page.waitForFunction(()=>window.acceptance);
 const r=await page.evaluate(()=>window.acceptance.largeJob());expect(r.jobs).toBe(1);expect(r.cases).toBe(250);expect(r.metadata.scanFiles).toBe(250);expect(r.sample).toEqual({width:850,height:660});expect(r.heartbeat).toBeGreaterThan(0);expect(errors).toEqual([]);console.log('Scan workload:',JSON.stringify(r));await info.attach('scan-workload.json',{body:JSON.stringify(r,null,2),contentType:'application/json'});
});
test('@load 10000 people, 60000 responses, Excel, cancellation and checkpoint recovery',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4176/tests/acceptance.html');await page.waitForFunction(()=>window.acceptance);
 const {xlsx,...r}=await page.evaluate(()=>window.acceptance.largeData());expect(r.summary.people).toBe(10000);expect(r.summary.responses).toBe(60000);expect(r.integrity).toBe(true);expect(r.visibleRows).toBe(100);expect(r.totalRows).toBe(60000);expect(r.aborted).toBe('AbortError');expect(r.recovered.responses).toBe(60000);expect(r.heartbeat).toBeGreaterThan(2);expect(errors).toEqual([]);
 const bytes=Buffer.from(xlsx),path=info.outputPath('large-export.xlsx');await writeFile(path,bytes);const workbook=await loadWorkbook(bytes);expect(workbook.worksheets.map(s=>s.name)).toEqual(['Antworten','Status','Codes','Scores']);for(const sheet of workbook.worksheets){expect(sheet.rowCount).toBe(10001);expect(sheet.columnCount).toBe(9);}expect(workbook.getWorksheet('Antworten').getCell(10001,4).text).toBe('9999:0;Grüße\nnext');expect(workbook.getWorksheet('Codes').getCell(10001,4).text).toBe('0');console.log('Data workload:',JSON.stringify(r));await info.attach('data-workload.json',{body:JSON.stringify({...r,excelBytes:bytes.length},null,2),contentType:'application/json'});
});
