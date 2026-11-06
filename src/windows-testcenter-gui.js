import {peopleFromDTO,responseUnit} from './data.js';
import {parseWindowsJSON,windowsTokenText,isContainer} from './windows-tokens.js';
import {stringifyJSON} from './json.js';
import {compactInteger} from './timestamps.js';

function sessionLoadTime(info){
  if(!Object.hasOwn(info,'loadTime'))return 0;
  const value=String(info.loadTime??'').trim();
  if(!/^[+-]?\d+$/.test(value))throw new Error('Windows-Sitzung: Ungültige ganzzahlige Ladezeit.');
  const n=BigInt(value);
  if(n < -9223372036854775808n||n > 9223372036854775807n)throw new Error('Windows-Sitzung: Ladezeit liegt außerhalb von Int64.');
  return compactInteger(n);
}

// The 3.3.0.2 dialog adds logs before responses. Its PersonList uses the
// displayed unit name for both identifiers, unlike the standalone DTO codec.
export function windowsTestcenterGUI(responses=[],logs=[],{windows=true}={}) {
  const people=peopleFromDTO([],logs.map(d=>({...d,originalUnitId:d.unitname})),{windows});
  for(const p of people)for(const b of p.booklets){
    b.firstTS=0;b.lastTS=0;
    b.sessions=b.logs.filter(l=>l.key==='LOADCOMPLETE').map(l=>{
      let info={};
      try{const parsed=parseWindowsJSON(l.parameter.replace(/\\"/g,'"'),{stringsOnly:true});if(!isContainer(parsed)||Array.isArray(parsed)||Object.values(parsed).some(isContainer))throw new Error();info=Object.fromEntries(Object.entries(parsed).map(([k,v])=>[k,v===null?null:windowsTokenText(v,{stringsOnly:true})]));}catch{}
      return {browser:Object.hasOwn(info,'browserName')&&Object.hasOwn(info,'browserVersion')?(info.browserName??'')+' '+(info.browserVersion??''):null,os:info.osName??null,screen:Object.hasOwn(info,'screenSizeWidth')&&Object.hasOwn(info,'screenSizeHeight')?(info.screenSizeWidth??'')+' x '+(info.screenSizeHeight??''):null,ts:l.ts,loadCompleteMS:sessionLoadTime(info)};
    });
  }
  for(const d of responses){
    const u=responseUnit(d,{windows});
    if(!u.subforms[0]?.responses.length)continue;
    u.id=u.alias;
    const identity=String(d.groupname??'')+String(d.loginname??'')+String(d.code??'');
    let p=people.find(p=>p.group+p.login+p.code===identity);
    if(!p){p={group:String(d.groupname??''),login:String(d.loginname??''),code:String(d.code??''),booklets:[]};people.push(p);}
    let b=p.booklets.find(b=>b.id===String(d.bookletname??''));
    if(!b){b={id:String(d.bookletname??''),firstTS:0,lastTS:0,logs:[],units:[],sessions:[]};p.booklets.push(b);}
    const old=b.units.find(v=>v.alias===u.alias);
    if(old&&!old.subforms.length&&!old.laststate.length&&!old.chunks.length)Object.assign(old,{chunks:u.chunks,laststate:u.laststate,subforms:u.subforms});
    else b.units.push(u);
  }
  return people.sort((a,b)=>(a.group+a.login+a.code).localeCompare(b.group+b.login+b.code,'de'));
}

export function windowsGUIJSON(people){
  const timestamp=v=>typeof v==='string'&&/^-?\d+$/.test(v)?BigInt(v):v;
  const log=l=>({ts:timestamp(l.ts),key:l.key,parameter:l.parameter});
  const ordered=people.map(p=>({group:p.group,login:p.login,code:p.code,booklets:p.booklets.map(b=>({id:b.id,firstTS:timestamp(b.firstTS),lastTS:timestamp(b.lastTS),logs:b.logs.map(log),units:b.units.map(u=>({id:u.id,alias:u.alias,laststate:u.laststate,subforms:u.subforms.map(sf=>({id:sf.id,responses:sf.responses.map(r=>({id:r.id,status:r.status,value:r.value,code:r.code,score:r.score}))})),chunks:u.chunks.map(c=>({id:c.id,type:c.type,ts:c.ts,variables:c.variables})),logs:u.logs.map(log)})),sessions:b.sessions.map(s=>({browser:s.browser,os:s.os,screen:s.screen,ts:timestamp(s.ts),loadCompleteMS:timestamp(s.loadCompleteMS)}))}))}));
  return stringifyJSON(ordered,null,2).replace(/\n/g,'\r\n');
}
