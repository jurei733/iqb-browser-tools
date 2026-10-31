import * as T from './toolbox.js';
import {strToU8} from 'fflate';
export function validateBooklets(w){
  const errors=[],read=(name)=>T.named(w,name),cell=(ref,row)=>ref.sheet.getCell(`${ref.col}${row}`).text;
  const rows=ref=>{const result=[];for(let n=ref.row+1;n<=ref.sheet.rowCount&&cell(ref,n);n++)result.push(n);return result;};
  const units=read('unitsCol.ID'),titles=read('unitsCol.Title'),seen=new Set();
  for(const r of rows(units)){const id=cell(units,r);if(seen.has(id))errors.push(`Unit ${id}: ID doppelt (Zeile ${r}).`);if(!cell(titles,r))errors.push(`Unit ${id}: Titel fehlt (Zeile ${r}).`);seen.add(id);}
  const blocks=read('testletsCol.ID'),members=read('testletsCol.Units'),blockIds=new Set();
  for(const r of rows(blocks)){const id=cell(blocks,r),list=cell(members,r).trim().split(/\s+/).filter(Boolean);if(blockIds.has(id))errors.push(`Block ${id}: ID doppelt (Zeile ${r}).`);if(!list.length)errors.push(`Block ${id}: fehlende Units (Zeile ${r}).`);for(const unit of list)if(!seen.has(unit))errors.push(`Block ${id}: unbekannte Unit ${unit} (Zeile ${r}).`);blockIds.add(id);}
  const booklets=read('bookletsCol.ID'),labels=read('bookletsCol.Title'),first=read('bookletsCol.FirstElement'),bookletIds=new Set(),firstCol=first.sheet.getCell(`${first.col}${first.row}`).col;
  for(const r of rows(booklets)){const id=cell(booklets,r);if(bookletIds.has(id)||/\s/.test(id))errors.push(`Testheft ${id}: ID doppelt/ungültig (Zeile ${r}).`);if(!cell(labels,r))errors.push(`Testheft ${id}: Titel fehlt (Zeile ${r}).`);bookletIds.add(id);
    for(let c=firstCol;c<=first.sheet.columnCount;c++){const heading=first.sheet.getCell(first.row,c).text,value=first.sheet.getCell(r,c).text;if(!heading)break;if(!value)continue;if(heading==='Unit'&&!seen.has(value))errors.push(`Testheft ${id}: unbekannte Unit ${value}.`);else if(heading==='Block-ID'&&!blockIds.has(value))errors.push(`Testheft ${id}: unbekannter Block ${value}.`);else if(heading==='max Time'&&(!Number.isFinite(Number(value))||Number(value)<0))errors.push(`Testheft ${id}: ungültige Zeitbegrenzung ${value}.`);else if(!['Unit','Block-ID','Code','max Time'].includes(heading))errors.push(`Testheft ${id}: unbekannter Spaltenkopf ${heading}.`);}
  }
  return errors;
}
export async function prepare(kind,args={},onProgress=()=>{}){
  onProgress('Verarbeitung gestartet.');let outputs={},summary='';
  if(kind==='codes'){outputs={'Codes.xlsx':await T.codeWorkbook()};summary='2.800 eindeutige Codes in vier Spalten erzeugt.';}
  else{
    const file=args.file;if(!file)throw new Error('Bitte eine Eingabedatei auswählen.');
    if(kind==='csv'){const rows=T.parseCSV(new TextDecoder(args.encoding||'utf-8',{fatal:true}).decode(file.bytes),args.delimiter==='tab'?'\t':args.delimiter||'auto');onProgress(`${rows.length-1} Datenzeilen eingelesen.`);outputs={[file.name.replace(/\.[^.]+$/,'')+'.xlsx']:await T.tableWorkbook(rows)};summary=`${rows.length-1} Datenzeilen verarbeitet.`;}
    else{
      const w=await T.loadWorkbook(file.bytes);onProgress(`Excel-Datei ${file.name} eingelesen.`);
      if(kind==='booklets'){const messages=validateBooklets(w);if(messages.length){const error=new Error(messages.join('\n'));error.messages=messages;throw error;}outputs=T.bookletXML(w,{windows:args.windows});summary=`${Object.keys(outputs).length} Testheft(e) erzeugt.`;}
      else if(kind==='logins'){let count=T.loginRows(w).length;if(count&&!args.renew&&!args.createXml)throw new Error('Bitte Logins neu erzeugen oder Login-XML auswählen.');if(args.renew||!count)count=T.generateLogins(w,args.loginOptions);outputs=args.createXml?T.testtakerXML(w,args.xmlOptions):{};outputs['Logins-browser.xlsx']=new Uint8Array(await w.xlsx.writeBuffer());summary=`${count} Logins und ${Object.keys(outputs).length-1} XML-Datei(en) erzeugt.`;}
      else throw new Error('Unbekannter Vorbereitungsauftrag.');
    }
  }
  for(const name of Object.keys(outputs))onProgress(`Ausgabe bereit: ${name}`);return {outputs,summary};
}
