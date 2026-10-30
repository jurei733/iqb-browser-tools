import {CodingBoxDatabase,isCodingBoxDatabase,browserToCodingBox} from './coding-box-database.js';
import {schema} from './schema.js';
import {STATUS,nullableNumeric,normalizePeople,refreshTimes,mergePeople} from './data.js';
const REQUIRED=['db_info','person','bookletInfo','booklet','session','bookletLog','unit','unitLog','unitLastState','chunk','response'];
const identity=p=>JSON.stringify([p.group,p.login,p.code||'']);

export class OutputDatabase {
  constructor(SQL,bytes=null,creator='Browser') {
    this.SQL=SQL;this.db=new SQL.Database(bytes||undefined);if(bytes&&isCodingBoxDatabase(this.db)){this.db.close();return new CodingBoxDatabase(SQL,bytes,creator);}this.creator=creator||'Browser';
    try {
      if(!bytes){this.db.run(schema);for(const [k,v]of Object.entries({name:'IQB-Testcenter-Output',version:'2',created_By:this.creator,created_DateTime:new Date().toISOString(),lastchanged_By:this.creator,lastchanged_DateTime:new Date().toISOString(),number_of_people:'0',number_of_responses:'0',has_subforms:'False',has_codes:'False',response_status:'{}'}))this.meta(k,v);}
      const tables=this.query("SELECT name FROM sqlite_master WHERE type='table'").map(r=>r.name);if(REQUIRED.some(t=>!tables.includes(t)))throw new Error('Keine vollständige IQB-Testcenter-Output-Datenbank.');
      const info=this.metadata();this.version=Number(info.version);if(info.name!=='IQB-Testcenter-Output'||![1,2,3].includes(this.version))throw new Error('Nicht unterstütztes IQB-Datenbankformat.');
      this.statuses=Object.fromEntries(STATUS.map((s,i)=>[i,s]));let custom={};try{custom=JSON.parse(info.response_status||'{}');}catch{}for(const [k,v]of Object.entries(custom))if(/^\d+$/.test(k)&&typeof v==='string')this.statuses[k]=v;
      this.db.run('PRAGMA foreign_keys=ON;');
    }catch(error){this.db.close();throw error;}
  }
  query(sql,params=[]) {const s=this.db.prepare(sql);try{s.bind(params);const rows=[];while(s.step())rows.push(s.getAsObject());return rows;}finally{s.free();}}
  run(sql,params=[]) {this.db.run(sql,params);}
  insert(table,columns,values) {this.run(`INSERT INTO [${table}] (${columns.map(c=>`[${c}]`).join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,values.map(v=>v===undefined?null:v));return this.query('SELECT last_insert_rowid() AS id')[0].id;}
  metadata(){return Object.fromEntries(this.query('SELECT [key],[value] FROM db_info').map(r=>[r.key,r.value]));}
  meta(key,value){this.run('DELETE FROM db_info WHERE [key]=?',[key]);this.run('INSERT INTO db_info ([key],[value]) VALUES (?,?)',[key,String(value)]);}
  status(value){return this.version===1?String(value):this.statuses[value]??`UNKNOWN_${value}`;}
  statusId(status){if(this.version===1)return status;let found=Object.entries(this.statuses).find(([,s])=>s===status);if(found)return Number(found[0]);const id=Math.max(13,...Object.keys(this.statuses).map(Number))+1;this.statuses[id]=status;return id;}
  summary(){return {...this.metadata(),people:this.query('SELECT count(*) AS n FROM person')[0].n,responses:this.query('SELECT count(*) AS n FROM response')[0].n,booklets:this.query('SELECT count(*) AS n FROM booklet')[0].n,units:this.query('SELECT count(*) AS n FROM unit')[0].n,groups:this.query('SELECT [group],count(*) AS people FROM person GROUP BY [group] ORDER BY [group]'),sizes:this.sizes()};}
  sizes(){return Object.fromEntries(this.query('SELECT name,size FROM bookletInfo').map(b=>[b.name,b.size]));}
  setSizes(sizes){if(!sizes||Array.isArray(sizes)||typeof sizes!=='object')throw new Error('Testheftgrößen müssen ein JSON-Objekt sein.');const rows=Object.entries(sizes);if(rows.some(([k,v])=>!k||!Number.isFinite(Number(v))||Number(v)<0))throw new Error('Ungültige Testheftgröße.');this.run('BEGIN');try{for(const [name,size]of rows){const existing=this.query('SELECT id FROM bookletInfo WHERE name=?',[name]);if(existing.length)this.run('UPDATE bookletInfo SET size=? WHERE name=?',[Number(size),name]);else this.insert('bookletInfo',['name','size'],[name,Number(size)]);}this.touch();this.run('COMMIT');}catch(e){try{this.run('ROLLBACK');}catch{}throw e;}return this.summary();}
  touch(){this.meta('lastchanged_By',this.creator);this.meta('lastchanged_DateTime',new Date().toISOString());this.meta('number_of_people',this.query('SELECT count(*) n FROM person')[0].n);this.meta('number_of_responses',this.query('SELECT count(*) n FROM response')[0].n);this.meta('has_subforms',this.query("SELECT 1 FROM response WHERE subform IS NOT NULL AND subform<>'' LIMIT 1").length?'True':'False');const completed=this.version===1?'CODING_COMPLETE':this.statusId('CODING_COMPLETE');this.meta('has_codes',this.query('SELECT 1 FROM response WHERE status=? LIMIT 1',[completed]).length?'True':'False');this.meta('response_status',JSON.stringify(this.statuses));}
  people(group=null){
    const persons=this.query(group===null?'SELECT * FROM person ORDER BY id':'SELECT * FROM person WHERE [group]=? ORDER BY id',group===null?[]:[group]),pmap=new Map(persons.map(p=>[p.id,{group:String(p.group),login:String(p.login),code:String(p.code??''),booklets:[]}])),bmap=new Map(),umap=new Map(),infos=new Map(this.query('SELECT * FROM bookletInfo').map(b=>[b.id,b.name]));
    for(const b of this.query('SELECT * FROM booklet ORDER BY id'))if(pmap.has(b.personId)){const value={id:infos.get(b.infoId)||'',firstTS:Number(b.firstTs),lastTS:Number(b.lastTs),sessions:[],logs:[],units:[]};bmap.set(b.id,value);pmap.get(b.personId).booklets.push(value);}
    for(const u of this.query('SELECT * FROM unit ORDER BY id'))if(bmap.has(u.bookletId)){const value={id:u.name,alias:u.alias||u.name,logs:[],laststate:[],chunks:[],subforms:[]};umap.set(u.id,value);bmap.get(u.bookletId).units.push(value);}
    for(const s of this.query('SELECT * FROM session'))bmap.get(s.bookletId)?.sessions.push({browser:s.browser||'',os:s.os||'',screen:s.screen||'',ts:Number(s.ts),loadCompleteMS:Number(s.loadCompleteMS)});
    for(const l of this.query('SELECT * FROM bookletLog'))bmap.get(l.bookletId)?.logs.push({ts:Number(l.ts),key:l.key,parameter:l.parameter||''});
    for(const l of this.query('SELECT * FROM unitLog'))umap.get(l.unitId)?.logs.push({ts:Number(l.ts),key:l.key,parameter:l.parameter||''});
    for(const s of this.query('SELECT * FROM unitLastState'))umap.get(s.unitId)?.laststate.push({key:s.key,value:s.value??''});
    for(const c of this.query('SELECT * FROM chunk')){let variables=[];try{variables=JSON.parse(c.variables||'[]');}catch{variables=String(c.variables||'').split(' ').filter(Boolean);}umap.get(c.unitId)?.chunks.push({id:c.key,type:c.type||'',ts:String(c.ts||0),variables});}
    for(const r of this.query('SELECT *,CAST(code AS TEXT) AS coding_code,CAST(score AS TEXT) AS coding_score FROM response')){const u=umap.get(r.unitId);if(!u)continue;let sf=u.subforms.find(sf=>sf.id===(r.subform||''));if(!sf){sf={id:r.subform||'',responses:[]};u.subforms.push(sf);}sf.responses.push({id:r.variableId,status:this.status(r.status),value:r.value??'',code:nullableNumeric(r.coding_code),score:nullableNumeric(r.coding_score)});}
    return [...pmap.values()];
  }
  import(people,{merge=true}={}){
    const incoming=mergePeople(refreshTimes(normalizePeople(people))),existing=this.people(),byIdentity=new Map();for(const p of existing){const k=identity(p);if(byIdentity.has(k))throw new Error('Die vorhandene Datenbank enthält doppelte Personen. Bitte zuerst die Datenbankprüfung öffnen.');byIdentity.set(k,p);}
    if(this.version!==1&&incoming.some(p=>p.booklets.some(b=>b.units.some(u=>u.subforms.some(sf=>sf.responses.some(r=>r.code===null||r.score===null)))))&&this.version!==3)this.upgradeNullableCodings();
    this.run('BEGIN');let count=0;
    try{for(const p of incoming){const found=this.query('SELECT id FROM person WHERE [group]=? AND [login]=? AND coalesce([code],\'\')=?',[p.group,p.login,p.code]);const pid=found[0]?.id??this.insert('person',['group','login','code'],[p.group,p.login,p.code]);const before=byIdentity.get(identity(p));const combined=merge&&before?mergePeople([before],[p])[0]:p;
        for(const b of combined.booklets){let info=this.query('SELECT id FROM bookletInfo WHERE name=?',[b.id])[0];const infoId=info?.id??this.insert('bookletInfo',['name','size'],[b.id,0]);this.run('DELETE FROM booklet WHERE personId=? AND infoId=?',[pid,infoId]);
          const bid=this.insert('booklet',['infoId','personId','firstTs','lastTs'],[infoId,pid,b.firstTS,b.lastTS]);
          for(const s of b.sessions)this.insert('session',['bookletId','browser','os','screen','ts','loadCompleteMS'],[bid,s.browser,s.os,s.screen,Number(s.ts),Number(s.loadCompleteMS)]);
          for(const l of b.logs)this.insert('bookletLog',['bookletId','key','parameter','ts'],[bid,l.key,l.parameter,Number(l.ts)]);
          for(const u of b.units){const uid=this.insert('unit',['bookletId','name','alias'],[bid,u.id,u.alias]);for(const l of u.logs)this.insert('unitLog',['unitId','key','parameter','ts'],[uid,l.key,l.parameter,Number(l.ts)]);for(const s of u.laststate)this.insert('unitLastState',['unitId','key','value'],[uid,s.key,s.value]);for(const c of u.chunks)this.insert('chunk',['unitId','key','type','variables','ts'],[uid,c.id,c.type,c.variables.join(' '),Number(c.ts)||0]);for(const sf of u.subforms)for(const r of sf.responses)this.insert('response',['unitId','variableId','status','value','subform','code','score'],[uid,r.id,this.statusId(r.status),r.value,sf.id,r.code,r.score]);}
        }count++;}
      this.touch();this.run('COMMIT');
    }catch(error){try{this.run('ROLLBACK');}catch{}throw error;}
    return {imported:count,...this.summary()};
  }
  check(){const integrity=this.query('PRAGMA integrity_check'),foreignKeys=this.query('PRAGMA foreign_key_check'),duplicates=this.query("SELECT [group],[login],coalesce([code],'') AS code,count(*) AS count FROM person GROUP BY [group],[login],coalesce([code],'') HAVING count(*)>1"),units=this.query('SELECT bookletId,name,alias,count(*) AS count FROM unit GROUP BY bookletId,name,alias HAVING count(*)>1');return {ok:integrity.every(r=>Object.values(r)[0]==='ok')&&!foreignKeys.length&&!duplicates.length&&!units.length,integrity,foreignKeys,duplicates,units};}
  upgradeNullableCodings(){
    this.run('BEGIN');try{this.run('ALTER TABLE response RENAME TO iqb_response_old');this.run('CREATE TABLE response (unitId bigint NOT NULL,variableId text NOT NULL,status int NOT NULL DEFAULT 0,value text,subform text,code int DEFAULT 0,score int DEFAULT 0,FOREIGN KEY(unitId) REFERENCES unit(id) ON DELETE CASCADE)');this.run('INSERT INTO response SELECT * FROM iqb_response_old');this.run('DROP TABLE iqb_response_old');this.meta('version','3');this.run('COMMIT');this.version=3;}catch(error){this.run('ROLLBACK');throw error;}
  }
  exportBrowser(){return this.export();}
  exportCodingBox(options){return browserToCodingBox(this,options);}
  export(){this.touch();return this.db.export();}
  close(){this.db.close();}
}
