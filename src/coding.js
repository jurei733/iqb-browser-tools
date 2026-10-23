import {unzipSync, gunzipSync, gzipSync, strFromU8, strToU8} from 'fflate';
import {children, descendants, child, attr, value, parseXML, node, documentXML, text} from './xml.js';

const stem = path => path.split('/').at(-1).replace(/\.[^.]*$/, '');
const area = el => el ? Object.fromEntries(['x','y','w','h'].map(k => [k, Number(attr(el,k,0))])) : null;
const bool = (el,k,def) => el?.hasAttribute(k) ? /^true$/i.test(attr(el,k)) : def;
export function decodeResult(bytes) {
  const doc = parseXML(strFromU8(bytes[0] === 31 && bytes[1] === 139 ? gunzipSync(bytes) : bytes));
  const root = doc.documentElement;
  if (root.localName !== 'CodingResults' || attr(root,'version') !== '5') throw new Error('Erwartet wird eine CodingResults-Datei in Version 5.');
  const seen = new Set();
  const entries = children(root,'c').map(el => {
    const entry = {testee:attr(el,'tp'),variable:attr(el,'v'),code:attr(el,'c'),comment:el.textContent || '',time:attr(el,'tm')};
    const key = JSON.stringify([entry.testee,entry.variable.toUpperCase()]);
    if (seen.has(key)) throw new Error('Doppelte Kodierung in der Ergebnisdatei.');
    seen.add(key); return entry;
  });
  return {id:attr(root,'id'),label:attr(root,'label'),coder:attr(root,'coder'),globalComment:value(root,'globalcomment'),entries};
}
export function encodeResult(job, coder, globalComment = '') {
  if (!coder.trim()) throw new Error('Bitte einen Kodierernamen eingeben.');
  const body = (globalComment ? node('globalcomment',{},text(globalComment)) : '') + job.cases.filter(c => c.code || c.comment).map(c => node('c', {v:c.variable.id,tp:c.testee,tm:c.time || localTimestamp(),c:c.code || ''},text(c.comment || ''))).join('\n');
  return gzipSync(strToU8(documentXML(node('CodingResults',{version:'5',id:job.id,coder,label:job.label},body))));
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
export async function readCodingFiles(files) {
  const bundles = [], results = [], loose = new Map();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const filename = file.webkitRelativePath || file.name;
    if (/\.result$/i.test(file.name)) {results.push(decodeResult(bytes));continue;}
    if (/\.zip$/i.test(file.name) && bytes[0] === 80 && bytes[1] === 75) {
      const entries = new Map(Object.entries(safeUnzip(bytes)).filter(([k]) => !k.endsWith('/')));
      bundles.push({name:stem(file.name),entries});
    } else loose.set(filename.replace(/\\/g,'/'),bytes);
  }
  if (loose.size) bundles.push({name:'Dateien',entries:loose});
  const templates = new Map();
  for (const bundle of bundles) for (const [path,bytes] of bundle.entries) if (/^CT_/i.test(stem(path))) templates.set(stem(path).slice(3).toUpperCase(),{path,bytes});
  const jobs = [], warnings = [];
  for (const bundle of bundles) {
    const images = new Map();
    for (const [path,bytes] of bundle.entries) {
      if (/\.(?:png|jpe?g|tiff?|bmp|gif|webp)$/i.test(path) && !/^CT_/i.test(stem(path))) {
        const key = stem(path).toUpperCase();
        if (images.has(key)) throw new Error(`Mehrdeutiger Scan-Dateiname: ${stem(path)}. Bitte getrennt importieren.`);
        images.set(key,{path,bytes});
      }
    }
    for (const [path,bytes] of bundle.entries) {
      if (!/\.xml$/i.test(path)) continue;
      const doc = parseXML(strFromU8(bytes));
      const root = doc.documentElement, vars = descendants(root,'Variablen')[0];
      if (!vars) continue;
      const opt = descendants(root,'jobOpts')[0] || descendants(root,'jobOptionen')[0];
      const settings = {showScore:bool(opt,'showScore',value(opt,'kodanzeigecreditspalte') === 'JA'),enableComments:bool(opt,'enableComments',true),suppressDescription:bool(opt,'suppressDescription',true),anonym:bool(opt,'anonym',false),training:bool(opt,'training',false),coder:attr(opt,'codername'),crop:area(child(opt,'crop'))};
      const variables = children(vars).map(v => {
        const old = children(v,'Kodierung');
        const locations = children(v,'loc').map(l => ({booklet:attr(l,'b'),page:attr(l,'p'),frame:area(child(l,'varframe'))}));
        if (!locations.length) for (const loc of descendants(v,'Ort')) {
          const match = attr(loc,'seiteID').match(/^(.*)-(\d+)$/); if(match) locations.push({booklet:match[1],page:match[2],frame:null});
        }
        return {id:attr(v,'id',attr(v,'bezeichner')),label:attr(v,'lb',attr(v,'aufgbez')),description:value(v,'descr') || value(v,'Allgemeine_kodieranweisung'),codes:descendants(v,'c').map(c => ({id:attr(c,'id'),label:attr(c,'lb'),description:c.textContent || '',score:attr(c,'to')})).concat(old.map(c => ({id:value(c,'Wert'),label:value(c,'Bedingung'),description:'',score:attr(c,'bewertung')}))),locations};
      });
      if (!variables.length || variables.some(v => !v.id || !v.codes.length)) throw new Error(`Die Variablen in ${path} enthalten keine vollständigen Codes.`);
      if (variables.some(v=>templates.has(v.id.toUpperCase()))) throw new Error(`${path}: Dieser Job verwendet Kodierschablonen. Diese sind in der ersten Browserfassung noch nicht umgesetzt.`);
      if(settings.training) throw new Error(`${path}: Trainingsjobs werden in dieser Browserfassung noch nicht unterstützt.`);
      if(descendants(root,'VariablenPaket').length || value(opt,'personenprefix') === 'JA') throw new Error(`${path}: Historische Variablenpakete oder Personenpräfixe sind noch nicht vollständig umgesetzt.`);
      const explicit = value(root,'Cases').trim().split(/\s+/).filter(Boolean);
      const people = explicit.length ? explicit : [...new Set([...images.keys()].map(n => n.slice(n.lastIndexOf('_')+1)))];
      const cases = [];
      for (const testee of people) for (const variable of variables) {
        const pages = [];
        for (const booklet of [...new Set(variable.locations.map(l => l.booklet))]) {
          for (const loc of variable.locations.filter(l => l.booklet === booklet).sort((a,b) => Number(a.page)-Number(b.page))) {
            const image = images.get(`${booklet}-${loc.page}_${testee}`.toUpperCase());
            if (image) pages.push({...image,frame:loc.frame});
          }
          if (pages.length) break;
        }
        if (pages.length) cases.push({testee,variable,pages,template:templates.get(variable.id.toUpperCase()) || null,code:'',comment:'',time:''});
      }
      if (!cases.length) {warnings.push(`${path}: Keine passenden Scans gefunden.`);continue;}
      const job = {id:attr(root,'id'),label:`${bundle.name} ${stem(path)}`,settings,variables,cases};
      if (!job.id) throw new Error(`Job-ID fehlt in ${path}.`);
      jobs.push(job);
    }
  }
  if (!jobs.length) throw new Error(warnings.join('\n') || 'Keine Kodierjobs gefunden. Erwartet werden Job-XML und passende Scans, zusammen als ZIP oder als Dateien.');
  return {jobs,results,warnings};
}
