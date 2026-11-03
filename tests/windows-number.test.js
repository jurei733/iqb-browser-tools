import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChunk,responseUnit,peopleFromDTO,readDataFiles} from '../src/data.js';
test('Windows Double overflow produces an ERROR response in every converter family',()=>{
 for(const type of ['iqb-standard@1.1','unknown','IQBVisualUnitPlayerV2.1.0','keyvalue','iqb-simple-player@1.0.0']){
  const raw=type==='iqb-standard@1.1'?'[{"id":"v","value":1e309}]':type==='iqb-simple-player@1.0.0'?'{"answers":{"v":1e309}}':'{"v":1e309}';
  assert.equal(parseChunk(raw,type,{windows:true})[0].responses[0].status,'ERROR',type);
 }
});
test('Windows round-trip formatting preserves subnormal values and the original G15/G17 decision',()=>{
 const values=['1e-323','0.845512408225570'],expected=['{  "n": 9.8813129168249309E-324}','{  "n": 0.84551240822556994}'];
 for(let i=0;i<values.length;i++)assert.equal(parseChunk(`[{"id":"v","value":{"n":${values[i]}}}]`,'iqb-standard@1.1',{windows:'64'})[0].responses[0].value,expected[i]);
});
test('Windows state values retain numeric lexemes, property order and null through structured JSON',async()=>{
 const dto={groupname:'G',loginname:'L',code:'0',bookletname:'B',unitname:'U',originalUnitId:'U',responses:[],laststate:'{"10":12.0,"2":1e20,"n":null}'},expected=[{key:'10',value:'12.0'},{key:'2',value:'1e20'},{key:'n',value:null}];
 assert.deepEqual(responseUnit(dto,{windows:true}).laststate,expected);
 const people=peopleFromDTO([dto],[],{windows:true}),reloaded=await readDataFiles([{name:'structured.json',text:JSON.stringify(people)}],{windows:true});
 assert.deepEqual(reloaded[0].booklets[0].units[0].laststate,expected);
});
