import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TestcenterClient} from '../src/testcenter.js';
import {reviewsWorkbook} from '../src/data.js';
import {loadWorkbook} from '../src/toolbox.js';
const proof=JSON.parse(await readFile(new URL('./fixtures/gui-final-20261109/reviews-missing-categories.json',import.meta.url)));
const client=()=>{const c=new TestcenterClient('http://127.0.0.1:5188',{fetch:async url=>{const u=new URL(url);return new Response(proof.reports[u.searchParams.get('dataIds')].legacy,{headers:{'Content-Type':'application/json'}});}});c.workspace=1;return c;};
test('Native review GUI: empty successful report bodies are groups with zero reviews',async()=>{
 assert.deepEqual(await client().reviews(['BROWSER_A','BROWSER_B']),[]);
});
test('Native review GUI: Windows skips a group missing the three original category columns',async()=>{
 const warnings=[];
 assert.deepEqual(await client().reviews(['BROWSER_A','BROWSER_B','review_group'],{windows:true,onWarning:m=>warnings.push(m)}),[]);
 assert.equal(warnings.length,1);assert.match(warnings[0],/review_group/);
 assert.equal((await client().reviews(['review_group'])).length,2);
 const native=await loadWorkbook(await readFile(new URL('./fixtures/gui-final-20261109/native-reviews-missing-categories.xlsx',import.meta.url)));
 const browser=await loadWorkbook(await reviewsWorkbook([],{windows:true}));
 assert.equal(native.worksheets.length,0);assert.equal(browser.worksheets.length,0);
});

const standard=JSON.parse(await readFile(new URL('./fixtures/gui-final-20261109/reviews-standard.json',import.meta.url)));
const reviewCells=book=>book.worksheets.map(sheet=>({name:sheet.name,rows:Array.from({length:sheet.rowCount},(_,i)=>Array.from({length:7},(_,j)=>sheet.getCell(i+1,j+1).value??''))}));
test('Native review GUI: booklet and unit sheets match all original cells including string priorities',async()=>{
 const rows=Object.values(standard.reports).flatMap(body=>body?JSON.parse(body):[]);
 const native=await loadWorkbook(await readFile(new URL('./fixtures/gui-final-20261109/native-reviews-standard.xlsx',import.meta.url)));
 const browser=await loadWorkbook(await reviewsWorkbook(rows,{windows:true}));
 assert.deepEqual(reviewCells(browser),reviewCells(native));assert.equal(browser.worksheets.length,2);
 assert.deepEqual(browser.worksheets.map(sheet=>sheet.getCell('D2').value),['1','2']);
});
