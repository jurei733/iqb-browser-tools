import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {peopleFromDTO,responseRecords,splitLog,importCSV} from '../src/data.js';
import {csvString} from '../src/toolbox.js';
import {TestcenterClient} from '../src/testcenter.js';
test('real Testcenter 19.0.1 reports preserve JSON log strings and legacy CSV quoting',async()=>{
  const data=JSON.parse(await readFile(new URL('../demo/testcenter/demo-reports.json',import.meta.url)));
  const people=peopleFromDTO(data.responses,data.logs);
  assert.equal(people.length,2);assert.equal(responseRecords(people).length,28);
  for(const p of people){assert.equal(p.booklets[0].logs.find(l=>l.key==='NOTE').parameter,'Grüße; "Welt"\nZeile 2');for(const u of p.booklets[0].units)assert.equal(u.logs.find(l=>l.key==='ANSWER').parameter,'ä; "quoted"\nnext');}
  assert.deepEqual(splitLog('NOTE : "Grüße; ""Welt"""'),{key:'NOTE',parameter:'Grüße; "Welt"'});
  const keys=Object.keys(data.logs[0]),csv=csvString([keys,...data.logs.map(r=>keys.map(k=>r[k]))]);
  assert.equal(importCSV(csv)[0].booklets[0].logs.find(l=>l.key==='NOTE').parameter,'Grüße; "Welt"\nZeile 2');
});
test('server logout sends the live token and accepts an empty HTTP 205 response',async()=>{
  const calls=[],c=new TestcenterClient('http://127.0.0.1:5188',{fetch:async(url,options)=>{calls.push({url,options});return new Response(null,{status:205});}});
  c.token='demo-session';c.workspace=1;await c.logout();
  assert.equal(calls[0].url,'http://127.0.0.1:5188/api/session');assert.equal(calls[0].options.method,'DELETE');assert.equal(calls[0].options.headers.AuthToken,'demo-session');assert.equal(c.token,'');assert.equal(c.workspace,null);
  await c.logout();assert.equal(calls.length,1);
});
test('failed server logout still clears local credentials and reports failure',async()=>{
  const c=new TestcenterClient('http://127.0.0.1:5188',{fetch:async()=>new Response('unavailable',{status:503})});c.token='demo-session';c.workspace=1;
  await assert.rejects(()=>c.logout(),{status:503});assert.equal(c.token,'');assert.equal(c.workspace,null);
});
