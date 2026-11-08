import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import initSqlJs from 'sql.js';
import {OutputDatabase} from '../src/database.js';
import {readDataFiles} from '../src/data.js';
const proof=JSON.parse(await readFile(new URL('./fixtures/gui-final-20261108.json',import.meta.url)));
const bytes=c=>{const b=Buffer.from(c.base64,'base64');assert.equal(b.length,c.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),c.sha256);return b;};
const input=proof.csvDatabase.files.map(c=>({name:c.name,bytes:bytes(c)}));
const tables=['person','bookletInfo','booklet','session','bookletLog','unit','unitLog','unitLastState','chunk','response'];
test('Native CSV database GUI: exact ten-table output, skipped logs, alias identity and timestamps',async()=>{
 const SQL=await initSqlJs(),original=new OutputDatabase(SQL,bytes(proof.csvDatabase.sqliteAfter)),browser=new OutputDatabase(SQL),warnings=[];
 try{
  browser.import(await readDataFiles(input,{windows:true,csvTarget:'database',onWarning:m=>warnings.push(m)}),{windows:true});
  const canonical=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).sort()));
  for(const table of tables)assert.deepEqual(canonical(browser.query('SELECT * FROM ['+table+']')),canonical(original.query('SELECT * FROM ['+table+']')),table);
  assert.equal(browser.summary().people,3);assert.equal(browser.summary().responses,6);
  assert.deepEqual(warnings,['G6.csv: Logdatei wie im Windows-SQLite-Import übersprungen.']);
 }finally{original.close();browser.close();}
});
test('Windows CSV direct-output still reads logs; extended database imports preserve IDs and logs',async()=>{
 const windows=await readDataFiles(input,{windows:true}),extended=await readDataFiles(input,{csvTarget:'database'});
 assert.equal(windows[0].booklets[0].sessions.length,1);assert.equal(windows[0].booklets[0].units[0].id,'MATHE_');
 assert.equal(extended[0].booklets[0].units[0].id,'MATHE01');assert.equal(extended[0].booklets[0].sessions.length,1);
});
