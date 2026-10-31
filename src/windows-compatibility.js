import {responseRecords,LONG_HEADERS} from './data.js';
const date=value=>{const d=new Date(Number(value)),p=n=>String(n).padStart(2,'0');return `${p(d.getUTCDate())}.${p(d.getUTCMonth()+1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;};
const quoted=value=>'"'+String(value??'')+'"';
const german=value=>String(value).replace('.',',');
export function windowsLongCSV(people,options={}){
  const rows=responseRecords(people,options).map(r=>[
    ...['group','login','code','booklet','unitName','unitAlias','responseId','responseStatus','responseValue','responseSubform'].map(k=>quoted(r[k])),r.responseCode??0,r.responseScore??0,r.ts,quoted(/^\d+$/.test(String(r.ts))?date(r.ts):'?')
  ].join(';'));
  return LONG_HEADERS.join(';')+'\r\n'+rows.join('\r\n')+(rows.length?'\r\n':'');
}
export function windowsSessionCSV(people,sizes={}){
  const header='Person;Booklet;Session-No;Sessions-Total;Units-w-Value;Start-At-TS;Start-At-DT;First-Responses-After-MS;First-Responses-After-MMSS;Last-Responses-After-MS;Last-Responses-After-MMSS;Load-Speed-MBitPerSec;Browser;OS;Screen;Screen-Width;Screen-Height';
  const rows=[];
  for(const p of [...people].sort((a,b)=>(a.group+a.login+a.code).localeCompare(b.group+b.login+b.code,'de'))){const reports=[];
    for(const b of p.booklets){
      // getSessionReports in 3.3.0.2 omits multi-session booklets entirely.
      if(b.sessions.length!==1)continue;const units=new Map();
      for(const u of b.units){if(!u.subforms.some(s=>s.responses.some(r=>!['DISPLAYED','UNSET','NOT_REACHED'].includes(r.status))))continue;const ts=Math.max(0,...u.chunks.map(c=>Number(c.ts)||0)),id=u.alias||u.id;if(ts>0)units.set(id,Math.max(ts,units.get(id)||0));}
      if(!units.size)continue;const session=b.sessions[0],start=Number(session.ts)-Number(session.loadCompleteMS),times=[...units.values()];reports.push({b,session,start,first:Math.min(...times),last:Math.max(...times),units:[...units].sort((a,b)=>a[1]-b[1]).map(([name])=>name)});
    }
    for(const {b,session:s,start,first,last,units}of reports){const firstSec=Math.floor((first-start)/1000),lastSec=Math.floor((last-start)/1000),mmss=sec=>`'${Math.trunc(sec/60)}:${String(sec%60).padStart(2,'0')}`,dimensions=String(s.screen||'').split(' x ').map(Number),speed=s.loadCompleteMS?Number(sizes[b.id]||0)*8/(s.loadCompleteMS/1000):0;
      rows.push([quoted(p.group+p.login+p.code),quoted(b.id),1,reports.length,quoted(units.join(' ')),start,quoted(date(start)),firstSec,quoted(mmss(firstSec)),lastSec,quoted(mmss(lastSec)),quoted(german(speed)),quoted(s.browser),quoted(s.os),quoted(s.screen),dimensions.length===2?Math.max(...dimensions):'',dimensions.length===2?Math.min(...dimensions):''].join(';'));
    }
  }
  return header+'\r\n'+rows.join('\r\n')+(rows.length?'\r\n':'');
}
