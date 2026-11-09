import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import initSqlJs from 'sql.js';
import {OutputDatabase} from '../src/database.js';
test('Native positive duplicate GUI: same repeated person and repeated unit with count two',async()=>{
 const db=new OutputDatabase(await initSqlJs(),await readFile(new URL('./fixtures/gui-final-20261109/duplicates.sqlite',import.meta.url)));
 try{
  const check=db.check();assert.equal(check.ok,false);
  assert.deepEqual(check.duplicates,[{group:'DEMO',login:'demo1',code:'001',count:2}]);
  assert.deepEqual(check.units,[{bookletId:1,name:'MATHE01',alias:'MATHE_',count:2}]);
  assert.deepEqual(check.integrity,[{integrity_check:'ok'}]);assert.deepEqual(check.foreignKeys,[]);
 }finally{db.close();}
});
