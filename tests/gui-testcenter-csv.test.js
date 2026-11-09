import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TestcenterClient} from '../src/testcenter.js';
const input=name=>readFile(new URL('./fixtures/gui-final-20261109/'+name,import.meta.url));
const reports=JSON.parse(await input('testcenter-reports.json'));
for(const [kind,name]of [['response','responses'],['log','logs']])test(`Native Testcenter ${kind} CSV GUI: byte-identical BOM, quotes, group concatenation and LF`,async()=>{
 const client=new TestcenterClient('http://127.0.0.1:5188',{fetch:async url=>{const u=new URL(url);return new Response(reports.report[u.searchParams.get('dataIds')][kind+'CSV'],{headers:{'Content-Type':'text/csv'}});}});client.workspace=1;
 assert.deepEqual(Buffer.from(await client.rawCSV(kind,['BROWSER_A','BROWSER_B'],{windows:true})),await input(`native-tc-${name}.csv`));
});
