import test from 'node:test';
import assert from 'node:assert/strict';
import {importCSV,peopleFromDTO,readDataFiles} from '../src/data.js';
import {parseWindowsLogCSV,splitWindowsLog} from '../src/windows-csv.js';

const header='groupname;loginname;code;bookletname;unitname;timestamp;logentry';
const row=entry=>['g','p','','BOOK','u','123',entry].map(v=>'"'+v.replace(/"/g,'""')+'"').join(';');
test('Windows CSV skips quoted-semicolon logs like the original, standard CSV and API retain them',async()=>{
  const csv='\uFEFF'+header+'\r\n'+row('OK : value')+'\r\n'+row('NOTE = "Zitat"; Semikolon')+'\r\n',warnings=[];
  const windows=await readDataFiles([{name:'logs.csv',text:csv}],{windows:true,onWarning:m=>warnings.push(m)});
  assert.deepEqual(windows[0].booklets[0].units[0].logs,[{ts:123,key:'OK',parameter:'value'}]);
  assert.equal(warnings.length,1);assert.match(warnings[0],/logs.csv: Windows-Modus: 1 Logzeilen/);
  assert.equal(importCSV(csv)[0].booklets[0].units[0].logs.length,2);
  assert.equal(peopleFromDTO([],[{groupname:'g',loginname:'p',bookletname:'BOOK',unitname:'u',timestamp:123,logentry:'NOTE = "Zitat"; Semikolon'}],{windows:true})[0].booklets[0].units[0].logs.length,1);
});
test('Windows CSV preserves original field order, uppercase booklet and v2024 ID fallback',()=>{
  const modern=header.replace(';timestamp',';originalUnitId;timestamp');
  assert.equal(parseWindowsLogCSV(modern+'\n'+['g','p','','lower','alias','source','123','OK'].map(v=>'"'+v+'"').join(';'))[0].originalUnitId,'source');
  const [unquoted]=parseWindowsLogCSV(modern+'\ng;p;;lower;alias;source;123;OK');
  assert.equal(unquoted.originalUnitId,'alias');assert.equal(unquoted.bookletname,'LOWER');
  assert.throws(()=>parseWindowsLogCSV(header+'\n'+row('OK').replace('"123"','"oops"')),/Zeitstempel/);
});
test('Windows log splitting retains escaped text and equals parameters exactly as the native parser',()=>{
  assert.deepEqual(splitWindowsLog('NOTE : "Zeile\\nText"'),{key:'NOTE',parameter:'Zeile\\nText'});
  assert.deepEqual(splitWindowsLog('NOTE = "Text"'),{key:'NOTE',parameter:'"Text"'});
  assert.deepEqual(splitWindowsLog(' : unchanged'),{key:' : unchanged',parameter:''});
  assert.deepEqual(splitWindowsLog('NOTE : "a""b\\\\c"'),{key:'NOTE',parameter:'a"b\\c'});
});
test('Windows CSV validates Int64 timestamp limits before converting to the numeric event model',()=>{
  const parse=stamp=>parseWindowsLogCSV(header+'\n'+row('OK').replace('"123"','"'+stamp+'"'))[0].timestamp;
  for(const [stamp,expected]of [['9223372036854775807',9223372036854775807n],['-9223372036854775808',-9223372036854775808n],['9,223372036854775807E+18',9223372036854775807n],['1,230E+3',1230],['0E+999999',0]])assert.equal(parse(stamp),expected);
  for(const stamp of ['9223372036854775808','-9223372036854775809','9,223372036854775808E+18','1,23E+1'])assert.throws(()=>parse(stamp),/Int64-Zeitstempel/);
});
