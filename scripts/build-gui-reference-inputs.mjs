import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import Excel from 'exceljs';
const out=resolve(process.argv[2]||'work/direct-gui-20261105/inputs');await mkdir(out,{recursive:true});
const base='tests/fixtures/windows-reference/inputs/';
for(const [source,target]of [['Booklet-Template.xlsx','Booklet.xlsx'],['Logins-Beispiel.xlsx','Logins.xlsx']])await writeFile(join(out,target),await readFile(base+source));
for(const [name,edit]of [['Booklet-bad-reference.xlsx',w=>w.getWorksheet('Blöcke').getCell('D4').value='UNKNOWN'],['Booklet-empty-title.xlsx',w=>w.getWorksheet('Units').getCell('C3').value='']]){
 const w=new Excel.Workbook();await w.xlsx.readFile(base+'Booklet-Template.xlsx');edit(w);await w.xlsx.writeFile(join(out,name));
}
const w=new Excel.Workbook();await w.xlsx.readFile(base+'Logins-Beispiel.xlsx');const s=w.getWorksheet('Testgruppen');
s.getRow(3).values=['Beispielschule','Klasse 7',2,1,1,'DEMO'];s.getRow(4).values=['TEST Schule','Klasse 8',1,1,1,''];s.getRow(5).values=['TEST Schule','Klasse 9',1,0,1,''];
await w.xlsx.writeFile(join(out,'Logins-wide.xlsx'));console.log('Prepared five synthetic native comparison workbooks in '+out);

// All combinations of the six independently selectable generation options.
const cases=[];
for(const length of [5,8])for(const password of [0,4])for(const monitor of [false,true])for(const separate of [false,true])for(let prefix=0;prefix<8;prefix++){
 cases.push({id:`matrix-${length}-${password}-${+monitor}-${+separate}-${prefix}`,source:'Logins-wide',renew:true,xml:true,length,password,monitor,separate,testee:!!(prefix&1),reserve:!!(prefix&2),review:!!(prefix&4)});
}
await writeFile(join(out,'login-matrix.json'),JSON.stringify({schema:1,axes:{length:[5,8],password:[0,4],monitor:[false,true],separate:[false,true],prefixMask:[0,1,2,3,4,5,6,7]},cases},null,2)+'\n');
console.log('Prepared 128 full-factorial login options, each followed by a native save/reopen pass.');

// Full product of six independent validation faults, including the clean case.
const faults=[['missing-unit-title',w=>w.getWorksheet('Units').getCell('C3').value=''],['duplicate-unit',w=>w.getWorksheet('Units').getCell('A4').value='EL632'],['unknown-unit',w=>w.getWorksheet('Blöcke').getCell('D4').value='UNKNOWN'],['duplicate-testlet',w=>w.getWorksheet('Blöcke').getCell('A5').value='EL1'],['empty-testlet',w=>w.getWorksheet('Blöcke').getCell('D6').value=''],['repeated-space',w=>w.getWorksheet('Blöcke').getCell('D7').value='Instr_Read  FC_Read']];
const booklets=[];
for(let mask=0;mask<64;mask++){
 const w=new Excel.Workbook();await w.xlsx.readFile(base+'Booklet-Template.xlsx');
 const selected=faults.filter((_,i)=>mask&(1<<i));for(const [,edit]of selected)edit(w);
 const id='Booklet-errors-'+String(mask).padStart(2,'0');await w.xlsx.writeFile(join(out,id+'.xlsx'));booklets.push({id,faults:selected.map(([name])=>name)});
}
await writeFile(join(out,'booklet-matrix.json'),JSON.stringify({schema:1,axes:faults.map(([name])=>name),cases:booklets},null,2)+'\n');
console.log('Prepared all 64 combinations of six Booklet validation faults.');
