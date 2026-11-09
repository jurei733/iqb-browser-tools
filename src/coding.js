import {unzipSync, gunzipSync, gzipSync, strFromU8, strToU8} from 'fflate';
import {children, descendants, child, attr, value, parseXML, decodeXML, node, documentXML, text} from './xml.js';

const stem = path => path.split('/').at(-1).replace(/\.[^.]*$/, '');
const area = el => el ? Object.fromEntries(['x','y','w','h'].map(k => [k, Number(attr(el,k,0))])) : null;
const bool = (el,k,def) => {
  if(!el?.hasAttribute(k))return def;
  const value=attr(el,k).trim();
  if(!/^(?:true|false)$/i.test(value))throw new Error(`Ungültiger Wahrheitswert für ${k}: ${value}.`);
  return /^true$/i.test(value);
};
export const isResultFilename=name=>/\.result(?:-\d+)?$/i.test(name);
export const resultFilename=(label,date=new Date())=>(String(label).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150)||'Kodierung')+'_'+date.toISOString().replace(/[:.]/g,'-')+'.result';
const resultText=source=>/^[ \t\r\n]*$/.test(source)?'':source;
export function decodeResult(bytes) {
  const doc = parseXML(decodeXML(bytes[0] === 31 && bytes[1] === 139 ? gunzipSync(bytes) : bytes));
  const root = doc.documentElement;
  if (root.localName !== 'CodingResults' || attr(root,'version') !== '5') throw new Error('Erwartet wird eine CodingResults-Datei in Version 5.');
  const seen = new Set();
  const entries = children(root,'c').map(el => {
    const entry = {testee:attr(el,'tp'),variable:attr(el,'v'),code:attr(el,'c'),comment:resultText(el.textContent || ''),time:attr(el,'tm')};
    const key = JSON.stringify([entry.testee,entry.variable.toUpperCase()]);
    if (seen.has(key)) throw new Error('Doppelte Kodierung in der Ergebnisdatei.');
    seen.add(key); return entry;
  });
  return {id:attr(root,'id'),label:attr(root,'label'),coder:attr(root,'coder'),globalComment:resultText(value(root,'globalcomment')),entries};
}
export function encodeResult(job, coder, globalComment = '',{windows=false}={}) {
  if (windows?!coder:!coder.trim()) throw new Error('Bitte einen Kodierernamen eingeben.');
  let cases=job.cases;if(windows){const groups=[];for(const c of cases){let group=groups.find(g=>g[0]?.testee===c.testee);if(!group){group=[];groups.push(group);}group.push(c);}cases=[];for(const group of groups){if(!group.some(c=>c.code||c.comment))break;cases.push(...group);}}
  const body = (globalComment ? node('globalcomment',{},text(globalComment)) : '') + cases.filter(c => c.code || c.comment).map(c => node('c', {v:c.variable.id,tp:c.testee,tm:c.time || localTimestamp(),c:c.code || ''},text(c.comment || ''))).join('\n');
  return gzipSync(strToU8(documentXML(node('CodingResults',{version:'5',id:job.id,coder,label:job.resultLabel??job.label},body))));
}
export function localTimestamp(date = new Date()) {
  const p = n => String(n).padStart(2,'0');
  return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}
export function applyResult(job, result) {
  if (job.id !== result.id) throw new Error('Die Ergebnisdatei gehört zu einem anderen Job.');
  const cases = new Map(job.cases.map(c => [JSON.stringify([c.testee,c.variable.id.toUpperCase()]),c]));
  let ignored = 0;
  for (const e of result.entries) {
    const c = cases.get(JSON.stringify([e.testee,e.variable.toUpperCase()]));
    if (!c) { ignored++; continue; }
    if (e.code && !c.variable.codes.some(v => v.id === e.code)) throw new Error(`Unbekannter Code ${e.code} für ${e.variable}.`);
  }
  for (const e of result.entries) {
    const c = cases.get(JSON.stringify([e.testee,e.variable.toUpperCase()]));
    if (c) Object.assign(c,{code:e.code,comment:e.comment,time:e.time});
  }
  if(result.label!==undefined)job.resultLabel=result.label;
  return ignored;
}
export function safeUnzip(bytes) {
  let total = 0;
  return unzipSync(bytes,{filter: file => {
    total += file.originalSize;
    if (total > 300 * 1024 * 1024) throw new Error('Das entpackte Paket ist größer als 300 MB. Bitte den Job in kleinere Pakete aufteilen.');
    if (file.name.replace(/\\/g,'/').split('/').includes('..') || file.name.startsWith('/')) throw new Error('Ungültiger Archivpfad.');
    return true;
  }});
}
export function normalizeVariable(v) {
  const modern=descendants(v,'c'),old=children(v,'Kodierung'),alternate=children(v,'Code');
  const locations=children(v,'loc').map(l=>({booklet:attr(l,'b'),page:attr(l,'p'),frame:area(child(l,'varframe'))}));
  if(!locations.length)for(const loc of descendants(v,'Ort')){const m=attr(loc,'seiteID').match(/^(.*)-(\d+)$/);if(m)locations.push({booklet:m[1],page:m[2],frame:null});}
  return {id:attr(v,'id',attr(v,'bezeichner',attr(v,'name'))),label:attr(v,'lb',attr(v,'aufgbez',value(v,'Label'))),description:value(v,'descr')||value(v,'Allgemeine_kodieranweisung')||value(v,'AllgKodieranw')||value(v,'Position'),
    codes:modern.length?modern.map(c=>({id:attr(c,'id'),label:attr(c,'lb'),description:c.textContent||'',score:attr(c,'to','0')})):old.length?old.map(c=>({id:value(c,'Wert')||'?',label:value(c,'Bedingung'),description:'',score:attr(c,'bewertung','0')})):alternate.map(c=>({id:attr(c,'kennung','?'),label:c.textContent||'',description:'',score:attr(c,'score','0')})),locations};
}
export function adjustFrame(frame,crop=null,dpiX=96,dpiY=96) {
  if(!frame)return null;const x=frame.x-(crop?.x||0),y=frame.y-(crop?.y||0);
  return {x:Math.max(0,x)*dpiX/96,y:Math.max(0,y)*dpiY/96,w:Math.max(0,frame.w+Math.min(0,x))*dpiX/96,h:Math.max(0,frame.h+Math.min(0,y))*dpiY/96};
}
export function batchCode(job,index,digit) {
  const current=job.cases[index],cases=job.cases.filter(c=>c.testee===current.testee),matches=cases.map(c=>c.variable.codes.filter(code=>code.id.includes(digit)));
  if(matches.some(list=>list.length!==1))throw new Error('Der Code ist nicht für alle Variablen dieser Testperson eindeutig. Es wurde nichts geändert.');
  const advance=!current.code,time=localTimestamp();cases.forEach((c,i)=>{c.code=matches[i][0].id;c.time=time;});const next=job.cases.findIndex(c=>!c.code);return advance&&next>=0?next:index;
}
export function cycleCode(c,direction){const i=c.variable.codes.findIndex(v=>v.id===c.code);return c.variable.codes[i<0?0:(i+direction+c.variable.codes.length)%c.variable.codes.length].id;}
export function initialCaseIndex(job){const first=job.cases.findIndex(c=>!c.code);return first<0?Math.max(0,job.cases.length-1):first;}
export function navigationIndex(job,index,{free=false}={}){
  const maximum=free?job.cases.length-1:initialCaseIndex(job);
  return Math.max(0,Math.min(maximum,Number.isFinite(index)?Math.trunc(index):0));
}
export function codedCases(job,{sortBy='number',direction='asc'}={}){
  if(!['number','variable','code','comment'].includes(sortBy)||!['asc','desc'].includes(direction))throw new Error('Ungültige Sortierung der Fallliste.');
  const rows=job.cases.map((c,i)=>({c,i})).filter(({c})=>c.code||c.comment),sign=direction==='desc'?-1:1;
  return rows.sort((a,b)=>{
    const av=sortBy==='number'?a.i:sortBy==='variable'?a.c.variable.id:a.c[sortBy]||'',bv=sortBy==='number'?b.i:sortBy==='variable'?b.c.variable.id:b.c[sortBy]||'';
    const compared=sortBy==='number'?av-bv:String(av).localeCompare(String(bv),'de');
    return sign*compared||a.i-b.i;
  });
}
export async function readCodingFiles(files) {
  const bundles=[],results=[],loose=new Map();
  for(const file of files){const bytes=new Uint8Array(await file.arrayBuffer()),filename=(file.webkitRelativePath||file.name).replace(/\\/g,'/');
    if(isResultFilename(file.name)){results.push(decodeResult(bytes));continue;}
    if(/\.zip$/i.test(file.name)&&bytes[0]===80&&bytes[1]===75)bundles.push({name:stem(file.name),zipped:true,entries:new Map(Object.entries(safeUnzip(bytes)).filter(([k])=>!k.endsWith('/')))});
    else loose.set(filename,bytes);
  }
  if(loose.size)bundles.push({name:'Dateien',zipped:false,entries:loose});
  const jobs=[],warnings=[],globalTemplates=new Map();
  for(const bundle of bundles)for(const [path,bytes]of bundle.entries)if(/^CT_/i.test(stem(path)))globalTemplates.set(stem(path).slice(3).toUpperCase(),{path,bytes});
  for(const bundle of bundles){const images=[];
    for(const [path,bytes]of bundle.entries){if(isResultFilename(path)){results.push(decodeResult(bytes));continue;}
      if(/\.(?:png|jpe?g|tiff?|bmp|gif|webp)$/i.test(path)&&!/^CT_/i.test(stem(path))&&!/^Testschablone$/i.test(stem(path)))images.push({path:path.replace(/\\/g,'/'),bytes});}
    for(const [path,bytes]of bundle.entries){if(!/\.xml$/i.test(path))continue;let doc;try{doc=parseXML(decodeXML(bytes));}catch{warnings.push(`${path}: Ungültige XML-Datei übersprungen.`);continue;}
      const root=doc.documentElement,vars=descendants(root,'Variablen')[0];if(!vars)continue;
      const legacy=!!descendants(root,'jobOptionen').length,opt=descendants(root,'jobOpts')[0]||descendants(root,'jobOptionen')[0],xmlDir=path.includes('/')?path.slice(0,path.lastIndexOf('/')+1):'';
      const options={showScore:bool(opt,'showScore',value(opt,'kodanzeigecreditspalte')==='JA'),enableComments:bool(opt,'enableComments',child(opt,'kommentare')?value(opt,'kommentare')==='JA':true),suppressDescription:bool(opt,'suppressDescription',true),anonym:bool(opt,'anonym',false),training:bool(opt,'training',false),coder:attr(opt,'codername',value(opt,'kodierer')),crop:area(child(opt,'crop')),personPrefix:value(opt,'personenprefix')==='JA'};
      const variables=children(vars).map(normalizeVariable),lookup=new Map(variables.map(v=>[v.id.toUpperCase(),v]));
      if(!variables.length||variables.some(v=>!v.id||!v.codes.length))throw new Error(`Die Variablen in ${path} enthalten keine vollständigen Codes.`);
      let packages=[variables];
      if(legacy){const defs=descendants(root,'VariablenPaket');packages=defs.length?defs.map(p=>children(p,'Variable').map(v=>lookup.get(attr(v,'bezeichner').toUpperCase())).filter(Boolean)):variables.map(v=>[v]);}
      for(const selected of packages){if(!selected.length)continue;let scope=images;
        const dirname=p=>p.includes('/')?p.slice(0,p.lastIndexOf('/')):'',folder=(name)=>images.filter(i=>dirname(i.path).toUpperCase()===(xmlDir+name).replace(/\/$/,'').toUpperCase());
        if(legacy){scope=folder(selected[0].id);if(!scope.length)scope=folder('scans');if(!scope.length)scope=images.filter(i=>dirname(i.path).toUpperCase()===xmlDir.replace(/\/$/,'').toUpperCase());
          // The native loose-folder GUI enumerates NTFS names in ordinal order.
          // Browser directory inputs can arrive in APFS order instead.
          if(!bundle.zipped)scope=scope.slice().sort((a,b)=>a.path.toUpperCase()<b.path.toUpperCase()?-1:a.path.toUpperCase()>b.path.toUpperCase()?1:0);
        }
        const normalizedStem=image=>{let name=stem(image.path).toUpperCase();if(options.personPrefix){const i=name.lastIndexOf('_');if(i>=0)name=name.slice(0,i+1)+name.slice(i+5);}return name;};
        const explicit=(descendants(root,'Cases')[0]?.textContent||'').trim().split(/\s+/).filter(Boolean);
        if(new Set(explicit).size!==explicit.length)throw new Error(`${path}: Doppelte Testperson in Cases.`);
        const inferScope=legacy?scope:folder(selected[0].id).length?folder(selected[0].id):images;
        const people=explicit.length?explicit:[...new Set(inferScope.filter(i=>selected[0].locations.some(l=>normalizedStem(i).startsWith(`${l.booklet}-${l.page}_`.toUpperCase()))).map(i=>normalizedStem(i).slice(normalizedStem(i).lastIndexOf('_')+1)))];
        const cases=[];
        for(const testee of people)for(const variable of selected){const pages=[];
          for(const booklet of [...new Set(variable.locations.map(l=>l.booklet))]){
            for(const loc of variable.locations.filter(l=>l.booklet===booklet).sort((a,b)=>Number(a.page)-Number(b.page))){const target=`${booklet}-${loc.page}_${testee}`.toUpperCase();let matches=scope.filter(i=>normalizedStem(i)===target);
              if(!legacy&&matches.length>1){const own=folder(variable.id).filter(i=>normalizedStem(i)===target);if(own.length)matches=own;else{const common=folder('scans').filter(i=>normalizedStem(i)===target);if(common.length)matches=common;}}
              if(matches.length>1)throw new Error(`Mehrdeutiger Scan-Dateiname ${target} im ausgewählten Job.`);if(matches[0])pages.push({...matches[0],frame:loc.frame});}
            if(pages.length)break;
          }
          if(pages.length){let template=globalTemplates.get(variable.id.toUpperCase())||null;
            if(!template&&!bundle.zipped){const dir=dirname(pages[0].path),candidate=(dir?dir+'/':'')+'Testschablone.png';const entry=[...bundle.entries].find(([p])=>p.toUpperCase()===candidate.toUpperCase());if(entry)template={path:entry[0],bytes:entry[1]};}
            cases.push({testee,variable,pages,template,code:'',comment:'',time:''});}
        }
        if(!cases.length){warnings.push(`${path}: Keine passenden Scans gefunden.`);continue;}
        const xmlName=path.split('/').at(-1);
        const label=legacy?`${stem(path)} ${selected.map(v=>v.id).join(' ')}`:bundle.zipped?`${bundle.name} ${xmlName}`:xmlName;
        const job={id:attr(root,'id'),label,resultLabel:label,settings:{...options},variables:selected,cases};if(legacy&&!bundle.zipped)job.legacyResultGroup=xmlDir;if(!job.id)throw new Error(`Job-ID fehlt in ${path}.`);jobs.push(job);
      }
    }
  }
  if(!jobs.length)throw new Error(warnings.join('\n')||'Keine Kodierjobs gefunden. Erwartet werden Job-XML und passende Scans, zusammen als ZIP oder als Dateien.');
  return {jobs,results,warnings};
}
