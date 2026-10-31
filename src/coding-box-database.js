import {gzipSync,gunzipSync,strToU8,strFromU8} from 'fflate';
import {OutputDatabase} from './database.js';
import {STATUS} from './data.js';

export class RoundtripError extends Error {constructor(message){super(message);this.name='RoundtripError';}}
const quote=name=>'"'+name.replace(/"/g,'""')+'"';
const query=(db,sql,params=[])=>{const statement=db.prepare(sql);try{statement.bind(params);const rows=[];while(statement.step())rows.push(statement.getAsObject());return rows;}finally{statement.free();}};
const tables=db=>new Set(query(db,"SELECT name FROM sqlite_master WHERE type='table'").map(r=>r.name));
export const isCodingBoxDatabase=db=>['workspace','persons','bookletinfo','booklet','unit','response'].every(t=>tables(db).has(t));
const canonical=people=>JSON.stringify(people.map(p=>({...p,booklets:p.booklets.map(b=>({...b,sessions:[...b.sessions].sort(order),logs:[...b.logs].sort(order),units:b.units.map(u=>({...u,laststate:[...u.laststate].sort(order),logs:[...u.logs].sort(order),chunks:[...u.chunks].sort(order),subforms:u.subforms.map(sf=>({...sf,responses:[...sf.responses].sort(order)})).sort(order)})).sort(order)})).sort(order)})).sort(order));
const canonicalState=db=>JSON.stringify({people:canonical(db.people()),sizes:Object.entries(db.sizes()).sort(order)});
function order(a,b){const left=JSON.stringify(a),right=JSON.stringify(b);return left<right?-1:left>right?1:0;}
function check(db){return query(db,'PRAGMA integrity_check').every(row=>Object.values(row)[0]==='ok');}
const readValue=value=>value===null?'#null#':String(value);
const nullableNumber=value=>value===null||value===undefined?null:Number.isSafeInteger(Number(value))?Number(value):String(value);

/** Native snapshots retain every table. The browser projection is kept separate. */
export class CodingBoxDatabase {
 constructor(SQL,bytes,creator='Browser',version='v3'){
  this.SQL=SQL;this.original=new Uint8Array(bytes);this.db=new SQL.Database(bytes);this.creator=creator;this.version=version;this.format='coding-box';
  try{if(!isCodingBoxDatabase(this.db)||!check(this.db))throw Error('Ungültige Coding-Box-Sicherung.');if(query(this.db,'SELECT count(*) n FROM workspace')[0].n!==1)throw Error('Eine Sicherung genau eines Coding-Box-Arbeitsbereichs verwenden.');const fields=new Set(query(this.db,'PRAGMA table_info(response)').map(r=>r.name));const casts=['code_v1','score_v1','code_v2','score_v2','code_v3','score_v3'].filter(f=>fields.has(f)).map(f=>'CAST('+quote(f)+' AS TEXT) AS '+quote(f));this.rows=query(this.db,'SELECT *'+(casts.length?','+casts.join(','):'')+' FROM response');}
  catch(error){this.db.close();throw error;}
 }
 query(sql,params=[]){return query(this.db,sql,params);}
 setVersion(version){if(!['v1','v2','v3'].includes(version))throw Error('Kodierversion v1, v2 oder v3 angeben.');this.version=version;return this.summary();}
 sizes(){return Object.fromEntries(this.query('SELECT * FROM bookletinfo').map(r=>[r.name,Number(r.size)||0]));}
 summary(){const workspace=this.query('SELECT id,name FROM workspace')[0];return {name:'Coding-Box',format:this.format,version:this.version,workspace:workspace.id,workspace_name:workspace.name,people:this.query('SELECT count(*) n FROM persons')[0].n,responses:this.rows.length,booklets:this.query('SELECT count(*) n FROM booklet')[0].n,units:this.query('SELECT count(*) n FROM unit')[0].n,groups:this.query('SELECT "group",count(*) people FROM persons GROUP BY "group"'),sizes:this.sizes(),native_tables:[...tables(this.db)].length,coding_versions:Object.fromEntries(['v1','v2','v3'].map(v=>[v,this.rows.filter(r=>r['status_'+v]!==null&&r['status_'+v]!==undefined).length]))};}
 people(group=null){
  const people=new Map(this.query('SELECT * FROM persons ORDER BY id').filter(p=>group===null||p.group===group).map(p=>[p.id,{group:String(p.group),login:String(p.login),code:String(p.code??''),booklets:[]}]));
  const infos=new Map(this.query('SELECT * FROM bookletinfo').map(b=>[b.id,b.name])),booklets=new Map(),units=new Map();
  for(const b of this.query('SELECT * FROM booklet ORDER BY id'))if(people.has(b.personid)){const item={id:infos.get(b.infoid),firstTS:Number(b.firstts)||0,lastTS:Number(b.lastts)||0,sessions:[],logs:[],units:[]};people.get(b.personid).booklets.push(item);booklets.set(b.id,item);}
  for(const u of this.query('SELECT * FROM unit ORDER BY id'))if(booklets.has(u.bookletid)){const item={id:u.name,alias:u.alias||u.name,laststate:[],logs:[],chunks:[],subforms:[]};booklets.get(u.bookletid).units.push(item);units.set(u.id,item);}
  const subforms=new Map();for(const r of this.rows){const key=JSON.stringify([r.unitid,r.variableid]);if(!subforms.has(key))subforms.set(key,new Set());subforms.get(key).add(r.subform||'');}
  const optional=table=>tables(this.db).has(table)?this.query('SELECT * FROM '+quote(table)):[];
  for(const s of optional('session'))booklets.get(s.bookletid)?.sessions.push({browser:s.browser||'',os:s.os||'',screen:s.screen||'',ts:Number(s.ts)||0,loadCompleteMS:Number(s.loadcompletems)||0});
  for(const l of optional('bookletlog'))booklets.get(l.bookletid)?.logs.push({key:l.key,parameter:l.parameter??'',ts:Number(l.ts)||0});
  for(const l of optional('unitlog'))units.get(l.unitid)?.logs.push({key:l.key,parameter:l.parameter??'',ts:Number(l.ts)||0});
  for(const s of optional('unitlaststate'))units.get(s.unitid)?.laststate.push({key:s.key,value:s.value??''});
  for(const c of optional('chunk')){let variables=[];try{variables=JSON.parse(c.variables||'[]');}catch{variables=String(c.variables||'').split(/[ ,]+/).filter(Boolean);}variables=variables.flatMap(v=>{const forms=subforms.get(JSON.stringify([c.unitid,String(v)]));return forms?[...forms].map(sf=>sf?sf+'##'+v:v):[v];});units.get(c.unitid)?.chunks.push({id:c.key,type:c.type||'',ts:String(c.ts||0),variables});}
  for(const r of this.rows){const unit=units.get(r.unitid);if(!unit){if(group!==null)continue;throw Error('Antwort ohne zugehörige Aufgabe.');}let sf=unit.subforms.find(s=>s.id===(r.subform||''));if(!sf){sf={id:r.subform||'',responses:[]};unit.subforms.push(sf);}const status=r['status_'+this.version]??r.status;sf.responses.push({id:r.variableid,value:readValue(r.value),status:STATUS[status]??'UNKNOWN_'+status,code:nullableNumber(r['code_'+this.version]),score:nullableNumber(r['score_'+this.version])});}
  return [...people.values()];
 }
 import(){throw Error('Zum Ergänzen zuerst als Browser-Tools-Datenbank speichern. Die vollständige Coding-Box-Sicherung bleibt erhalten.');}
 setSizes(){throw Error('Testheftgrößen in einer Browser-Tools-Arbeitskopie bearbeiten.');}
 check(){const integrity=this.query('PRAGMA integrity_check');return {ok:check(this.db),integrity,foreignKeys:[],duplicates:[],units:[]};}
 export(){return new Uint8Array(this.original);}
 exportCodingBox(){return this.export();}
 exportWindows(){const db=new OutputDatabase(this.SQL);try{db.import(this.people());db.setSizes(this.sizes());return db.exportWindows();}finally{db.close();}}
 exportBrowser(){
  const db=new OutputDatabase(this.SQL,null,this.creator);try{db.import(this.people());db.setSizes(this.sizes());db.run('CREATE TABLE iqb_codingbox_snapshot (format TEXT,version TEXT,native BLOB,baseline BLOB)');db.run('INSERT INTO iqb_codingbox_snapshot VALUES (?,?,?,?)',['coding-box-snapshot-v1',this.version,gzipSync(this.export()),gzipSync(strToU8(canonicalState(db)))]);return db.export();}finally{db.close();}
 }
 close(){this.db.close();}
}

function applyCodingUpdates(database,saved,current,baseline){
 if(saved.version!=='v3')throw new RoundtripError('Geänderte Kodierungen nur für den v3-Abschlussstand übernehmen.');
 const strip=people=>people.map(p=>({...p,booklets:p.booklets.map(b=>({...b,units:b.units.map(u=>({...u,subforms:u.subforms.map(sf=>({...sf,responses:sf.responses.map(({status,code,score,...r})=>r)}))}))}))}));
 const state=people=>JSON.stringify({people:canonical(strip(people)),sizes:Object.entries(database.sizes()).sort(order)});
 if(state(current)!==JSON.stringify({people:canonical(strip(JSON.parse(baseline.people))),sizes:baseline.sizes}))throw new RoundtripError('Für die vollständige Sicherung dürfen nur v3-Kodierungen geändert werden; Antworten, Personen und Logs unverändert lassen.');
 const native=new database.SQL.Database(gunzipSync(saved.native));
 try{
  const rows=query(native,'SELECT r.id,p."group",p.login,p.code,i.name booklet,u.name unit,r.variableid,r.subform,r.status_v3,CAST(r.code_v3 AS TEXT) code_v3,CAST(r.score_v3 AS TEXT) score_v3 FROM response r JOIN unit u ON u.id=r.unitid JOIN booklet b ON b.id=u.bookletid JOIN bookletinfo i ON i.id=b.infoid JOIN persons p ON p.id=b.personid');
  const identity=(p,b,u,sf,r)=>JSON.stringify([p.group,p.login,p.code,b,u,sf,r]);
  const baselineByKey=new Map();for(const p of JSON.parse(baseline.people))for(const b of p.booklets)for(const u of b.units)for(const sf of u.subforms)for(const r of sf.responses)baselineByKey.set(identity(p,b.id,u.id,sf.id,r.id),r);
  const index=new Map(rows.map(r=>[identity(r,r.booklet,r.unit,r.subform||'',r.variableid),r]));const changes=[];
  native.run('BEGIN');
  for(const p of current)for(const b of p.booklets)for(const u of b.units)for(const sf of u.subforms)for(const r of sf.responses){
   const key=identity(p,b.id,u.id,sf.id,r.id),previous=baselineByKey.get(key),old=index.get(key);if(previous&&JSON.stringify([previous.status,previous.code,previous.score])===JSON.stringify([r.status,r.code,r.score]))continue;if(!old)throw new RoundtripError('Antwortzuordnung für die Kodierung fehlt.');const status=STATUS.indexOf(r.status);
   if(status<0||[r.code,r.score].some(v=>v!==null&&(!/^-?\d+$/.test(String(v))||BigInt(v)<-9223372036854775808n||BigInt(v)>9223372036854775807n))||(status===5?(r.code===null||r.score===null):(r.code!==null||r.score!==null)))throw new RoundtripError('Ungültige v3-Kodierung.');
   const equal=(a,b)=>a===null&&b===null||a!==null&&b!==null&&String(a)===String(b);
   if(status===Number(old.status_v3)&&equal(r.code,old.code_v3)&&equal(r.score,old.score_v3))continue;
   native.run('UPDATE response SET status_v3=?,code_v3=?,score_v3=? WHERE id=?',[status,r.code,r.score,old.id]);
   changes.push({person:[p.group,p.login,p.code],booklet:b.id,unit:u.id,subform:sf.id,variable:r.id,before:{status:old.status_v3,code:old.code_v3,score:old.score_v3},after:{status,code:r.code,score:r.score}});
  }
  const workspace=query(native,'SELECT id,settings FROM workspace')[0],settings=JSON.parse(workspace.settings||'{}');
  if(!settings||Array.isArray(settings)||typeof settings!=='object'||settings.iqbBrowserCodingHistory&&!Array.isArray(settings.iqbBrowserCodingHistory))throw new RoundtripError('Ungültige Sicherungsmetadaten.');
  settings.iqbBrowserCodingHistory=[...(settings.iqbBrowserCodingHistory||[]),{source:'IQB Browser-Tools',version:'v3',changed_at:new Date().toISOString(),changes}];
  native.run('UPDATE workspace SET settings=? WHERE id=?',[JSON.stringify(settings),workspace.id]);native.run('COMMIT');return native.export();
 }finally{native.close();}
}
export function browserToCodingBox(database,{allowCodingChanges=false}={}){
 const snapshot=tables(database.db).has('iqb_codingbox_snapshot')?database.query('SELECT * FROM iqb_codingbox_snapshot'):[];
 if(snapshot.length){const saved=snapshot[0];if(saved.format!=='coding-box-snapshot-v1')throw new RoundtripError('Unbekannte Coding-Box-Erweiterung.');const baseline=strFromU8(gunzipSync(saved.baseline));if(canonicalState(database)!==baseline){if(allowCodingChanges)return applyCodingUpdates(database,saved,database.people(),JSON.parse(baseline));throw new RoundtripError('Die Arbeitskopie wurde verändert. Geänderte v3-Kodierungen ausdrücklich übernehmen.');}return gunzipSync(saved.native);}
 const target=new database.SQL.Database();
 try{
  target.run('CREATE TABLE workspace(id INTEGER,name TEXT,settings TEXT);INSERT INTO workspace VALUES(1,\'Browser-Tools-Import\',\'{}\');');
  const create=(name,columns)=>target.run('CREATE TABLE '+quote(name)+' ('+columns+')');
  create('persons','id INTEGER,workspace_id INTEGER,"group" TEXT,login TEXT,code TEXT,uploaded_at TEXT,booklets TEXT,source TEXT,consider INTEGER');
  create('bookletinfo','id INTEGER,name TEXT,size INTEGER');create('booklet','id INTEGER,infoid INTEGER,personid INTEGER,firstts INTEGER,lastts INTEGER');create('unit','id INTEGER,bookletid INTEGER,name TEXT,alias TEXT');
  create('response','id INTEGER,unitid INTEGER,variableid TEXT,value TEXT,status INTEGER,subform TEXT,status_v1 INTEGER,code_v1 INTEGER,score_v1 INTEGER,status_v2 INTEGER,code_v2 INTEGER,score_v2 INTEGER,status_v3 INTEGER,code_v3 INTEGER,score_v3 INTEGER');
  create('session','id INTEGER,bookletid INTEGER,browser TEXT,os TEXT,screen TEXT,ts INTEGER,loadcompletems INTEGER');create('bookletlog','id INTEGER,bookletid INTEGER,"key" TEXT,parameter TEXT,ts INTEGER');create('unitlog','id INTEGER,unitid INTEGER,"key" TEXT,parameter TEXT,ts INTEGER');create('unitlaststate','id INTEGER,unitid INTEGER,"key" TEXT,value TEXT');create('chunk','unitid INTEGER,"key" TEXT,type TEXT,variables TEXT,ts INTEGER');
  const counts={},infos=new Map(),insert=(table,row)=>{if(table!=='chunk')row={id:(counts[table]=(counts[table]||0)+1),...row};target.run('INSERT INTO '+quote(table)+' ('+Object.keys(row).map(quote).join(',')+') VALUES ('+Object.keys(row).map(()=>'?').join(',')+')',Object.values(row));return row.id;};
  const numericStatus=status=>{const id=STATUS.indexOf(status);if(id<0)throw Error('Unbekannter Antwortstatus '+status);return id;};
  target.run('BEGIN');for(const p of database.people()){
   const pid=insert('persons',{workspace_id:1,group:p.group,login:p.login,code:p.code,uploaded_at:new Date().toISOString(),booklets:'[]',source:'IQB Browser-Tools',consider:1});
   for(const b of p.booklets){if(!infos.has(b.id))infos.set(b.id,insert('bookletinfo',{name:b.id,size:database.sizes()[b.id]||0}));const bid=insert('booklet',{infoid:infos.get(b.id),personid:pid,firstts:b.firstTS,lastts:b.lastTS});
    for(const s of b.sessions)insert('session',{bookletid:bid,browser:s.browser,os:s.os,screen:s.screen,ts:s.ts,loadcompletems:s.loadCompleteMS});
    for(const l of b.logs)insert('bookletlog',{bookletid:bid,key:l.key,parameter:l.parameter,ts:l.ts});
    for(const u of b.units){const uid=insert('unit',{bookletid:bid,name:u.id,alias:u.alias});for(const l of u.logs)insert('unitlog',{unitid:uid,key:l.key,parameter:l.parameter,ts:l.ts});for(const s of u.laststate)insert('unitlaststate',{unitid:uid,key:s.key,value:s.value});for(const c of u.chunks)insert('chunk',{unitid:uid,key:c.id,type:c.type,variables:c.variables.join(','),ts:Number(c.ts)||0});for(const sf of u.subforms)for(const r of sf.responses){let value=r.value;if(value==='#null#')value=null;insert('response',{unitid:uid,variableid:r.id,value,status:numericStatus(r.status),subform:sf.id,status_v1:null,code_v1:null,score_v1:null,status_v2:null,code_v2:null,score_v2:null,status_v3:r.status==='CODING_COMPLETE'?numericStatus(r.status):null,code_v3:r.status==='CODING_COMPLETE'?r.code:null,score_v3:r.status==='CODING_COMPLETE'?r.score:null});}}
   }
  }target.run('COMMIT');return target.export();
 }finally{target.close();}
}
