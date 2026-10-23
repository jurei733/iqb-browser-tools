// Synthetic data only. Uses the unmodified Testcenter API, never direct SQL.
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const base=(process.env.TESTCENTER_URL||'http://127.0.0.1:5188').replace(/\/$/,'')+'/api';
let token='';
async function request(path,{method='GET',body}={}) {
  const headers={Accept:'application/json',...(token?{AuthToken:token}:{})};
  if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';
  const r=await fetch(base+path,{method,headers,body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();if(!r.ok)throw new Error(`${method} ${path}: ${r.status} ${text.slice(0,500)}`);
  try{return JSON.parse(text);}catch{return text;}
}
async function session(loginType,name,password) {
  const c=await request('/session/challenge',{method:'POST',body:{loginType,name,password}});
  let number=0;for(;number<=c.maxNumber;number++)if(createHash('sha256').update(c.salt+number).digest('hex')===c.challenge)break;
  if(number>c.maxNumber)throw new Error('Challenge not solved');
  return request('/session',{method:'PUT',body:{algorithm:c.algorithm,challenge:c.challenge,salt:c.salt,signature:c.signature,number}});
}
const admin=await session('admin','super',process.env.TESTCENTER_PASSWORD||'user123');token=admin.token;
const workspace=admin.access.workspaceAdmin[0];
const existing=await request(`/workspace/${workspace}/results`);
if(existing.some(g=>['BROWSER_A','BROWSER_B'].includes(g.groupName))){await request('/session',{method:'DELETE'});console.log('Demo-Gruppen sind bereits vorhanden; keine Daten verändert.');process.exit(0);}
const xml=`<?xml version="1.0" encoding="utf-8"?>
<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0">
<Metadata><Description>Synthetische Browser-Integration, keine echten Testpersonen</Description></Metadata>
<Group id="BROWSER_A" label="Demo A – Umlaute"><Login name="001" pw="demo123" mode="run-hot-return"><Booklet>BOOKLET.SAMPLE-1</Booklet></Login></Group>
<Group id="BROWSER_B" label="Demo B – zweiter Import"><Login name="002" pw="demo123" mode="run-hot-return"><Booklet>BOOKLET.SAMPLE-1</Booklet></Login></Group>
</Testtakers>`;
const form=new FormData();form.append('fileforvo',new Blob([xml],{type:'application/xml'}),'Browser-Demo.xml');
await request(`/workspace/${workspace}/file`,{method:'POST',body:form});
// Re-running updates the same sessions/chunks and does not create duplicate persons.
const manifest={server:base,version:await request('/version'),workspace,groups:['BROWSER_A','BROWSER_B'],people:2,units:4,responses:28,seeded:new Date().toISOString(),sessions:[]};
const adminToken=token;
for(const [i,login]of ['001','002'].entries()) {
  token='';const person=await session('login',login,'demo123');token=person.token;
  const id=await request('/test',{method:'PUT',body:{bookletName:'BOOKLET.SAMPLE-1'}});
  await request(`/test/${id}`);
  const t=1792742400000+i*60000;
  await request(`/test/${id}/state`,{method:'PATCH',body:[{key:'status',content:'running',timeStamp:t}]});
  await request(`/test/${id}/log`,{method:'PUT',body:[{key:'LOADCOMPLETE',content:{loadTime:1200,browser:'Demo Browser',os:'Platform test',screen:'1280 x 800'},timeStamp:t+1200},{key:'NOTE',content:'Grüße; "Welt"\nZeile 2',timeStamp:t+1300}]});
  for(const [j,alias]of ['UNIT.SAMPLE','an_alias'].entries()) {
    const path=`/test/${id}/unit/${alias}`,timeStamp=t+2000+j*1000;
    await request(path+'/state',{method:'PATCH',body:{originalUnitId:'UNIT.SAMPLE',newState:[{key:'RESPONSEPROGRESS',content:'complete',timeStamp},{key:'PRESENTATIONPROGRESS',content:'complete',timeStamp}]}});
    const content=JSON.stringify([
      {id:'text',value:`Grüße; "Welt"\n${login}/${alias}`,status:'CODING_COMPLETE',code:0,score:0},
      {id:'zero',value:0,status:'CODING_COMPLETE',code:0,score:0},
      {id:'bool',value:true,status:'VALUE_CHANGED'},
      {id:'null',value:null,status:'VALUE_CHANGED'},
      {id:'large',value:'__LARGE_INTEGER__',status:'VALUE_CHANGED'},
      {id:'array',value:['ä',0,false],status:'VALUE_CHANGED'},
      {id:'sub',subform:'01',value:`Unterformular ${login}`,status:'CODING_COMPLETE',code:2,score:1}
    ]).replace('"__LARGE_INTEGER__"','9007199254740993');
    await request(path+'/response',{method:'PUT',body:{timeStamp,dataParts:{all:content},responseType:'iqb-standard@1.1',originalUnitId:'UNIT.SAMPLE'}});
    await request(path+'/log',{method:'PUT',body:[{key:'ANSWER',content:'ä; "quoted"\nnext',timeStamp:timeStamp+1}]});
  }
  manifest.sessions.push({group:manifest.groups[i],login,testId:Number(id)});
  await request('/session',{method:'DELETE'});
}
token=adminToken;
manifest.resultGroups=await request(`/workspace/${workspace}/results`);
await request('/session',{method:'DELETE'});
await writeFile(new URL('./seed-manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
