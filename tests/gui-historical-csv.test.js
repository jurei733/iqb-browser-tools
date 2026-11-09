import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readDataFiles,wideWorkbook} from '../src/data.js';
import {loadWorkbook} from '../src/toolbox.js';
const input=name=>readFile(new URL('./fixtures/gui-final-20261109/'+name,import.meta.url));
const shape=async bytes=>(await loadWorkbook(bytes)).worksheets.map(s=>({name:s.name,rows:Array.from({length:s.rowCount},(_,i)=>Array.from({length:s.columnCount},(_,j)=>s.getRow(i+1).getCell(j+1).text))}));
const options={subformMode:'none',values:true,status:false,codes:false,scores:false};
for(const year of [2011,2019,2024])test(`Native historical CSV GUI: ${year} input matches every original Excel cell`,async()=>{
 const people=await readDataFiles([{name:'answers.csv',bytes:await input(`csv${year}.csv`)}],{windows:true});
 assert.deepEqual(await shape(await wideWorkbook(people,options)),await shape(await input(`native-csv${year}.xlsx`)));
 if(year===2011){
  const extended=await readDataFiles([{name:'answers.csv',bytes:await input('csv2011.csv')}]);
  assert.notDeepEqual(await shape(await wideWorkbook(extended,options)),await shape(await input('native-csv2011.xlsx')));
 }
});
