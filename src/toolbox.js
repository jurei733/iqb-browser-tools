import Excel from 'exceljs';
import {DOMParser as WorkbookDOMParser,XMLSerializer as WorkbookXMLSerializer} from '@xmldom/xmldom';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {node,text,documentXML} from './xml.js';
const nativeCellKinds=new WeakMap();

export const LETTERS = 'abcdefghprqstuvxyz';
export const NUMBERS = '2345679';
export const codeCapacity = length => LETTERS.length ** Math.ceil(length/2) * NUMBERS.length ** Math.floor(length/2);
export function generateCodes(length,count,random = limit => {
  const buffer = new Uint32Array(2), ceiling = Math.floor(2**53 / limit) * limit;
  let number;
  do {crypto.getRandomValues(buffer);number=(buffer[0]&0x1fffff)*2**32+buffer[1];} while (number >= ceiling);
  return number % limit;
}) {
  if (!Number.isInteger(length) || length < 1 || length > 12 || !Number.isInteger(count) || count < 0 || count > 100000 || count > codeCapacity(length)) throw new Error('Anzahl oder Länge der Codes ist ungültig oder übersteigt den möglichen Vorrat.');
  // Sample without replacement. This terminates even when the entire code space is requested.
  const swaps = new Map(), capacity = codeCapacity(length), result = [];
  for(let i=0;i<count;i++) {
    const remaining = capacity-i, pick = random(remaining), index = swaps.get(pick) ?? pick;
    swaps.set(pick, swaps.get(remaining-1) ?? remaining-1);
    let number=index, code='';
    for(let j=0;j<length;j++) {const alphabet=j%2 ? NUMBERS:LETTERS;code+=alphabet[number%alphabet.length];number=Math.floor(number/alphabet.length);}
    result.push(code);
  }
  return result;
}
function style(sheet) {
  sheet.views=[{state:'frozen',ySplit:1}];
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF142952'}};
  sheet.columns.forEach(c => {c.width=24;});
}
export async function codeWorkbook() {
  const workbook=new Excel.Workbook(), sheet=workbook.addWorksheet('Codes');
  sheet.addRow(['2 Stellen','3 Stellen','4 Stellen','5 Stellen']);
  const codes=[generateCodes(2,100),generateCodes(3,200),generateCodes(4,500),generateCodes(5,2000)];
  for(let i=0;i<2000;i++) sheet.addRow(codes.map(col=>col[i] || ''));
  style(sheet); return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export async function loadWorkbook(bytes) {
  const parseWorkbookXML=source=>new WorkbookDOMParser().parseFromString(source,'application/xml');
  const entries=unzipSync(bytes instanceof Uint8Array?bytes:new Uint8Array(bytes));let changed=false;
  // Open XML SDK writes valid prefixed SpreadsheetML (x:workbook, x:row).
  // ExcelJS expects unprefixed element names. Normalize a decode copy by URI;
  // retain relationships, extension namespaces, attributes and original bytes.
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  for(const [path,data] of Object.entries(entries))if(/^xl\/.*\.xml$/i.test(path)){
    const source=strFromU8(data);if(!/xmlns:[\w.-]+\s*=\s*["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/.test(source))continue;
    const doc=parseWorkbookXML(source);let localChange=false;
    const visit=el=>{
      let target=el;
      if(el.namespaceURI===ns&&el.prefix){target=doc.createElementNS(ns,el.localName);for(const a of Array.from(el.attributes))target.setAttributeNS(a.namespaceURI,a.name,a.value);while(el.firstChild)target.appendChild(el.firstChild);el.parentNode.replaceChild(target,el);localChange=true;}
      for(const child of Array.from(target.childNodes))if(child.nodeType===1)visit(child);
    };
    visit(doc.documentElement);
    if(localChange){if(doc.documentElement.namespaceURI===ns)doc.documentElement.setAttribute('xmlns',ns);entries[path]=strToU8(new WorkbookXMLSerializer().serializeToString(doc));changed=true;}
  }
  const w=new Excel.Workbook();await w.xlsx.load(changed?zipSync(entries):bytes);
  const book=parseWorkbookXML(strFromU8(entries['xl/workbook.xml'])),relations=parseWorkbookXML(strFromU8(entries['xl/_rels/workbook.xml.rels']));
  const targets=new Map(Array.from(relations.getElementsByTagName('Relationship')).map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
  for(const sheet of Array.from(book.getElementsByTagName('sheet'))){
    const target=targets.get(sheet.getAttribute('r:id'));if(!target)continue;
    const parts=[];for(const part of (target.startsWith('/')?target.slice(1):'xl/'+target).split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}
    const data=entries[parts.join('/')];if(!data)continue;const kinds=new Map();
    for(const c of Array.from(parseWorkbookXML(strFromU8(data)).getElementsByTagName('c')))if(c.getAttribute('t')==='s')kinds.set(c.getAttribute('r'),c.getElementsByTagName('v').length?'shared':'shared-missing');
    const worksheet=w.getWorksheet(sheet.getAttribute('name'));if(worksheet)nativeCellKinds.set(worksheet,kinds);
  }
  return w;
}
// Preserve the original SDK's empty shared-string cells in Windows exports.
// ExcelJS otherwise repairs them on save; that changes the original parser's
// password/mode error handling after reopening the generated workbook.
export async function writeWindowsWorkbook(workbook){
  const entries=unzipSync(new Uint8Array(await workbook.xlsx.writeBuffer()));
  const parse=source=>new WorkbookDOMParser().parseFromString(source,'application/xml');
  const book=parse(strFromU8(entries['xl/workbook.xml'])),rels=parse(strFromU8(entries['xl/_rels/workbook.xml.rels']));
  const targets=new Map(Array.from(rels.getElementsByTagName('Relationship')).map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
  for(const sheet of Array.from(book.getElementsByTagName('sheet'))){
    const kinds=nativeCellKinds.get(workbook.getWorksheet(sheet.getAttribute('name')));if(!kinds)continue;
    const target=targets.get(sheet.getAttribute('r:id'));if(!target)continue;
    const path=target.startsWith('/')?target.slice(1):'xl/'+target;
    const doc=parse(strFromU8(entries[path]));let changed=false;
    for(const cell of Array.from(doc.getElementsByTagName('c')))if(kinds.get(cell.getAttribute('r'))==='shared-missing'){
      cell.setAttribute('t','s');while(cell.firstChild)cell.removeChild(cell.firstChild);changed=true;
    }
    if(changed)entries[path]=strToU8(new WorkbookXMLSerializer().serializeToString(doc));
  }
  return zipSync(entries);
}
export function named(workbook,name,optional=false) {
  const ref=workbook.definedNames.getRanges(name).ranges[0];
  const match=ref?.match(/^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]+)\$?(\d+)/);
  if(!match) {if(optional)return null;throw new Error(`Die Excel-Markierung „${name}“ fehlt. Bitte die Originalvorlage verwenden.`);}
  const sheet=workbook.getWorksheet((match[1] || match[2]).replace(/''/g,"'"));
  if(!sheet) throw new Error(`Tabellenblatt für ${name} fehlt.`);
  return {sheet,col:match[3],row:Number(match[4])};
}
const cell=(ref,row=ref?.row) => ref ? ref.sheet.getCell(`${ref.col}${row}`).text : '';
const set=(ref,row,val) => {const address=`${ref.col}${row}`,kinds=nativeCellKinds.get(ref.sheet);ref.sheet.getCell(address).value=String(val);if(String(val))kinds?.set(address,'text');else if(kinds?.get(address)?.startsWith('shared'))kinds.set(address,'shared-missing');};
function rows(ref) {const list=[];for(let r=ref.row+1;r<=ref.sheet.rowCount;r++) {if(!cell(ref,r)) break;list.push(r);}return list;}
const colNumber = col => [...col].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
const filename = input => String(input).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,180) || 'export';
export function bookletXML(workbook,{windows=false}={}) {
  const ids=named(workbook,'unitsCol.ID'),titles=named(workbook,'unitsCol.Title'),units=new Map();
  for(const r of rows(ids)) {
    const id=cell(ids,r),label=cell(titles,r);if(!label || units.has(id)) throw new Error(`Unit ${id}: Titel fehlt oder ID doppelt.`);
    units.set(id,{id,label});
  }
  const tids=named(workbook,'testletsCol.ID'),ttitles=named(workbook,'testletsCol.Title'),tunits=named(workbook,'testletsCol.Units'),testlets=new Map();
  for(const r of rows(tids)) {
    const id=cell(tids,r), list=cell(tunits,r).trim().split(/\s+/).filter(Boolean);
    if(testlets.has(id) || !list.length || list.some(u=>!units.has(u))) throw new Error(`Block ${id}: ID doppelt oder unbekannte/fehlende Units.`);
    testlets.set(id,{id,label:cell(ttitles,r),units:list.map(u=>units.get(u))});
  }
  const bids=named(workbook,'bookletsCol.ID'),btitles=named(workbook,'bookletsCol.Title'),descriptions=named(workbook,'bookletsCol.Description',true),first=named(workbook,'bookletsCol.FirstElement');
  const prefix=cell(named(workbook,'startlock.prefix',true)),suffix=cell(named(workbook,'startlock.suffix',true)),files={};
  const unitXML=(u,p='',short=null)=>node('Unit',{id:u.id,label:p+u.label,labelshort:short});
  for(const r of rows(bids)) {
    const id=cell(bids,r),title=cell(btitles,r);
    if(/\s/.test(id)||!title || files[`booklet${filename(id)}.xml`])throw new Error(`Testheft ${id}: ID doppelt/ungültig oder Titel fehlt.`);
    let body='',codeIndex=0;
    for(let c=colNumber(first.col);c<=first.sheet.columnCount;c++) {
      const heading=first.sheet.getCell(first.row,c).text, content=first.sheet.getCell(r,c).text;
      if(!heading)break;if(!content)continue;
      if(heading==='Unit') {if(!units.has(content))throw new Error(`Unbekannte Unit ${content}.`);body+=unitXML(units.get(content));}
      else if(heading==='Block-ID') {
        const block=testlets.get(content);if(!block)throw new Error(`Unbekannter Block ${content}.`);
        let code='',time='';
        for(let offset=1;offset<=2;offset++) {
          const h=first.sheet.getCell(first.row,c+offset).text, v=first.sheet.getCell(r,c+offset).text;
          if(h==='Code')code=v;else if(h==='max Time')time=v;
        }
        let restrictions='';if(code)restrictions+=node('CodeToEnter',{code},text(`${prefix}${++codeIndex}${suffix}`));
        if(time) {if(!Number.isFinite(Number(time))||Number(time)<0)throw new Error('Ungültige Zeitbegrenzung.');restrictions+=node('TimeMax',{minutes:time});}
        const blockUnits=block.units.map((u,i)=>block.units.length>1&&!u.id.endsWith('End')?unitXML(u,`${i+1}. `,i+1):unitXML(u)).join('');
        body+=node('Testlet',{id:block.id,label:block.label},(restrictions?node('Restrictions',{},restrictions):'')+blockUnits);
      } else if(!['Code','max Time'].includes(heading))throw new Error(`Unbekannter Spaltenkopf „${heading}“.`);
    }
    const metadata=node('Metadata',{},node('Id',{},text(id))+node('Label',{},text(title))+node('Description',{},text(windows?title:cell(descriptions,r))));
    const config=node('BookletConfig',{},node('Config',{key:'force_presentation_complete'},'ON')+node('Config',{key:'unit_navibuttons'},'FULL'));
    files[`booklet${filename(id)}.xml`]=strToU8(documentXML(node('Booklet',{'xmlns:xsi':'http://www.w3.org/2001/XMLSchema-instance','xsi:noNamespaceSchemaLocation':'https://raw.githubusercontent.com/iqb-berlin/testcenter-backend/9.1.1/definitions/vo_Booklet.xsd'},metadata+config+node('Units',{},body))));
  }
  if(!Object.keys(files).length)throw new Error('Keine Testhefte in der Vorlage gefunden.');return files;
}
export function loginRows(workbook) {
  const name=named(workbook,'loginsCol.Name'),group=named(workbook,'loginsCol.GroupID'),pw=named(workbook,'loginsCol.Password'),mode=named(workbook,'loginsCol.Mode'),n1=named(workbook,'loginsCol.GroupName1'),n2=named(workbook,'loginsCol.GroupName2');
  return rows(name).map(r=>({name:cell(name,r),group:cell(group,r),password:cell(pw,r),mode:cell(mode,r),name1:cell(n1,r),name2:cell(n2,r)}));
}
export function prepareLoginGroups(workbook,suffix){
  const name=named(workbook,'groupsCol.Name1'),name2=named(workbook,'groupsCol.Name2'),id=named(workbook,'groupsCol.ID');
  const counts=['NumberTest','NumberPlus','NumberReview'].map(n=>named(workbook,`groupsCol.${n}`));
  const groups=[],used=new Set(),groupSuffix=suffix??('_'+generateCodes(4,1)[0]);
  for(const r of rows(name)) {
    const numbers=counts.map(c=>Number(cell(c,r)||0));
    if(numbers.some(n=>!Number.isInteger(n)||n<0)||numbers.reduce((a,b)=>a+b,0)>50000)throw new Error('Die Login-Anzahlen müssen ganze Zahlen zwischen 0 und 50000 sein.');
    let gid=cell(id,r);if(!gid||used.has(gid)){const upper=(cell(name,r).match(/[A-Z]/g)||[]).join('');let i=1;gid=upper+groupSuffix;while(used.has(gid))gid=upper+(++i)+groupSuffix;}
    used.add(gid);set(id,r,gid);
    groups.push({id:gid,n1:cell(name,r),n2:cell(name2,r),numbers});
  }
  return groups;
}
export function generateLogins(workbook,{length=5,passwordLength=3,monitor=true,prefix,prefixTestee,prefixReserve,prefixReview,suffix}={}) {
  const groups=prepareLoginGroups(workbook,suffix);
  const total=groups.reduce((n,g)=>n+g.numbers.reduce((a,b)=>a+b,0)+(monitor?1:0),0),codes=generateCodes(length,total);
  if(!total)throw new Error('Keine Logins angefordert.');
  if(!Number.isInteger(passwordLength)||passwordLength<0||passwordLength>12)throw new Error('Ungültige Kennwortlänge.');
  const passwords=passwordLength?generateCodes(passwordLength,Math.min(total,codeCapacity(passwordLength))):[];
  const refs=['GroupName1','GroupName2','GroupID','Name','Password','Mode'].map(k=>named(workbook,`loginsCol.${k}`));
  let r=refs[0].row+1,index=0;
  // Remove stale logins before replacing the table, retaining styles and the header.
  for(let row=r;row<=refs[0].sheet.rowCount;row++)for(const ref of refs)set(ref,row,'');
  for(const g of groups) {
    for(let kind=0;kind<4;kind++)for(let i=0;i<(kind<3?g.numbers[kind]:(monitor?1:0));i++) {
      const modes=['run-hot-return','run-hot-return','run-review','monitor-group'];
      const prefixes=[(prefixTestee??prefix??false)?`T${String(i+1).padStart(2,'0')}_`:'',(prefixReserve??prefix??false)?'RS_':'',(prefixReview??prefix??false)?'RV_':'','TL_'];
      const values=[g.n1,g.n2,g.id,prefixes[kind]+codes[index],passwords.length?passwords[index%passwords.length]:'',modes[kind]];
      refs.forEach((ref,c)=>set(ref,r,values[c]));r++;index++;
    }
  }
  return total;
}
export function testtakerXML(workbook,{booklet='Booklet1',separate=false,windows=false,filename:outputName='Testtaker.xml'}={}) {
  if(!booklet.trim())throw new Error('Bitte eine Testheft-ID angeben.');
  const groups=new Map(),seen=new Set();
  const passwordRef=named(workbook,'loginsCol.Password');let rowIndex=passwordRef.row;
  for(const original of loginRows(workbook)) {
    const row={...original};rowIndex++;
    // The original clears a shared-string password without clearing its type.
    // Its subsequent reader catches the resulting parse error together with
    // the mode read. Reproduce that observable XML only in Windows mode.
    if(windows&&!row.password&&nativeCellKinds.get(passwordRef.sheet)?.get(`${passwordRef.col}${rowIndex}`)==='shared-missing')row.mode='';
    if(!row.group)throw new Error('Ein Login enthält keine Gruppen-ID.');
    if(seen.has(row.name))throw new Error(`Doppelter Login ${row.name}.`);seen.add(row.name);
    if(!windows&&!row.mode.trim())throw new Error(`Der Modus für ${row.name} fehlt.`);
    if(!groups.has(row.group))groups.set(row.group,{label:`${row.name1} - ${row.name2}`,rows:[]});groups.get(row.group).rows.push(row);
  }
  let custom='';const key=named(workbook,'customText.Key',true),val=named(workbook,'customText.Value',true);
  if(key&&val)for(const r of rows(key))custom+=node('CustomText',{key:cell(key,r)},text(cell(val,r)));
  const groupXML=([id,g])=>node('Group',{id,label:g.label},g.rows.map(row=>node('Login',{mode:row.mode,name:row.name,pw:row.password||null},row.mode==='monitor-group'?'':node('Booklet',{},text(booklet)))).join(''));
  const document=body=>strToU8(documentXML(node('Testtakers',{},node('Metadata')+(custom?node('CustomTexts',{},custom):'')+body)));
  if(!groups.size)throw new Error('Keine Logins vorhanden.');
  return separate?Object.fromEntries([...groups].map(g=>[`${filename(g[0])}.xml`,document(groupXML(g))])):{[filename(outputName)]:document([...groups].map(groupXML).join(''))};
}
export function parseCSV(source,delimiter='auto') {
  source=source.replace(/^\uFEFF/,'');
  if(delimiter==='auto') {let quoted=false,commas=0,semicolons=0;for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted){if(c==='\r'||c==='\n')break;if(c===',')commas++;if(c===';')semicolons++;}}delimiter=semicolons>commas?';':',';}
  const rows=[],row=[];let field='',quoted=false;
  for(let i=0;i<source.length;i++) {
    const c=source[i];
    if(c==='"') {if(quoted&&source[i+1]==='"'){field+='"';i++;}else if(quoted||!field)quoted=!quoted;else throw new Error('Ungültiges Anführungszeichen in CSV.');}
    else if(c===delimiter&&!quoted){row.push(field);field='';}
    else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(field);rows.push(row.splice(0));field='';}
    else field+=c;
  }
  if(quoted)throw new Error('Nicht geschlossenes Anführungszeichen in CSV.');
  if(field||row.length){row.push(field);rows.push(row);}
  if(!rows.length || !rows[0].length)throw new Error('Die CSV-Datei enthält keine Daten.');
  return rows;
}
export function csvString(rows) {return '\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');}
export async function tableWorkbook(rows,sheetName='Syscheck-Daten') {
  const w=new Excel.Workbook(),s=w.addWorksheet(sheetName);for(const r of rows)s.addRow(r.map(v=>String(v??'')));style(s);return new Uint8Array(await w.xlsx.writeBuffer());
}
export function flattenResponses(data,{ignoreDisplayed=false,ignoreNotReached=false}={}) {
  if(!Array.isArray(data))throw new Error('Erwartet wird ein Array von Testpersonen aus der Toolbox-JSON-Datei.');
  const rows=[['Gruppe','Login','Code','Testheft','Unit','Alias','Subform','Variable','Wert','Status']];
  for(const p of data)for(const b of p.booklets||[])for(const u of b.units||[])for(const sf of u.subforms||[])for(const r of sf.responses||[]) {
    if((ignoreDisplayed&&r.status==='DISPLAYED')||(ignoreNotReached&&r.status==='NOT_REACHED'))continue;
    rows.push([p.group,p.login,p.code,b.id,u.id,u.alias,sf.id,(u.alias||'')+r.id,typeof r.value==='object'?JSON.stringify(r.value):r.value,r.status]);
  }
  if(rows.length===1)throw new Error('Keine Antworten im erwarteten Toolbox-JSON-Format gefunden.');return rows;
}
export const archive = files => zipSync(files,{level:6});
