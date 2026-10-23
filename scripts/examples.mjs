import {mkdir,readFile,writeFile} from 'node:fs/promises';
import initSqlJs from 'sql.js';
import {peopleFromDTO} from '../src/data.js';
import {OutputDatabase} from '../src/database.js';
import {loadWorkbook,named,csvString} from '../src/toolbox.js';
const root=new URL('../public/examples/',import.meta.url);await mkdir(root,{recursive:true});
const start=1792663200000,responses=[],logs=[];
for(let n=1;n<=3;n++){
  const identity={groupname:'DEMO',loginname:'demo'+n,code:'00'+n,bookletname:'DEMO',unitname:'MATHE_',originalUnitId:'MATHE01'};
  responses.push({...identity,laststate:JSON.stringify({currentPage:'1'}),responses:[{id:'all',ts:start+5000+n*1000,responseType:'iqb-standard@1.1',content:JSON.stringify([{id:'summe',value:n===2?'12':'13',status:'CODING_COMPLETE',code:n===2?0:1,score:n===2?0:1},{id:'begruendung',value:n===2?null:'8 + 5 = 13',status:'VALUE_CHANGED',subform:'1'}])}]});
  logs.push({...identity,unitname:'',timestamp:start+1000,logentry:'LOADCOMPLETE : '+JSON.stringify({browserName:'Beispielbrowser',browserVersion:'1',osName:'Beispielsystem',screenSizeWidth:1440,screenSizeHeight:900,loadTime:1000})});
  logs.push({...identity,timestamp:start+3000,logentry:'PAGE : 1'});
}
const people=peopleFromDTO(responses,logs),sizes={DEMO:1000000};
await writeFile(new URL('Antworten-Logs.json',root),JSON.stringify(people,null,2));
for(const [name,data,headers]of [['Antworten.csv',responses,['groupname','loginname','code','bookletname','unitname','originalUnitId','responses','laststate']],['Logs.csv',logs,['groupname','loginname','code','bookletname','unitname','originalUnitId','timestamp','logentry']]])await writeFile(new URL(name,root),csvString([headers,...data.map(d=>headers.map(k=>Array.isArray(d[k])?JSON.stringify(d[k]):d[k]))]));
await writeFile(new URL('BookletSizes.json',root),JSON.stringify(sizes,null,2));
const db=new OutputDatabase(await initSqlJs());db.import(people);db.setSizes(sizes);await writeFile(new URL('Beispiel.sqlite',root),db.export());db.close();
const w=await loadWorkbook(await readFile(new URL('../public/templates/Logins-Vorlage.xlsx',import.meta.url)));
for(const type of ['groups','logins']){const names=type==='groups'?['Name1','Name2','ID','NumberTest','NumberPlus','NumberReview']:['GroupName1','GroupName2','GroupID','Name','Password','Mode'];for(const name of names){const ref=named(w,type+'Col.'+name);for(let row=ref.row+1;row<=ref.sheet.rowCount;row++)ref.sheet.getCell(ref.col+row).value='';}}
const group={Name1:'Beispielschule',Name2:'Klasse 7',ID:'DEMO',NumberTest:3,NumberPlus:0,NumberReview:0};for(const [key,value]of Object.entries(group)){const ref=named(w,'groupsCol.'+key);ref.sheet.getCell(ref.col+(ref.row+1)).value=value;}
for(let n=1;n<=3;n++)for(const [key,value]of Object.entries({GroupName1:'Beispielschule',GroupName2:'Klasse 7',GroupID:'DEMO',Name:'demo'+n,Password:'beispiel',Mode:'run-hot-return'})){const ref=named(w,'loginsCol.'+key);ref.sheet.getCell(ref.col+(ref.row+n)).value=value;}
await writeFile(new URL('Logins-Beispiel.xlsx',root),new Uint8Array(await w.xlsx.writeBuffer()));
console.log('Synthetic examples generated.');
