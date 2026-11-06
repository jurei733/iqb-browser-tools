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
