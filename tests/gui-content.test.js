import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{windowsContentIndex}from'../src/windows-content.js';import{TestcenterClient}from'../src/testcenter.js';
const p=JSON.parse(await readFile(new URL('./fixtures/gui-final-20261109/content-metadata.json',import.meta.url)));
test('Native content GUI: complete original HTML matches bytes including dependency rows and dates',async()=>{
 const html=windowsContentIndex([...p.files.filter(f=>f.type!=='Unit'),...p.deps],{url:'http://192.168.64.1:5189/api',workspaceName:'Sample Workspace',now:new Date('2026-11-09T09:45:00Z')});assert.equal(html,await readFile(new URL('./fixtures/gui-final-20261109/native-content-index.html',import.meta.url),'utf8'));assert.equal(p.nativeManifest.length,12);assert.ok(p.nativeManifest.every(f=>f.equal));
});
test('Native content GUI: resource dependency sizes match original booklets.json',async()=>{
 const native=JSON.parse(await readFile(new URL('./fixtures/gui-remaining-20261106.json',import.meta.url)));
 const c=new TestcenterClient('http://synthetic.invalid',{fetch:async url=>new Response(JSON.stringify(url.endsWith('/files')?p.files:p.bookletDependencies))});c.workspace=1;
 assert.deepEqual(await c.bookletSizes(),p.sizes);assert.deepEqual(p.sizes,native.testcenter.bookletSizes);
});
