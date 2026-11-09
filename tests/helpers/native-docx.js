import {unzipSync,strFromU8} from 'fflate';
import {DOMParser} from '@xmldom/xmldom';
import {createHash} from 'node:crypto';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export function nativeDocxShape(bytes){
 const entries=unzipSync(bytes),parse=b=>new DOMParser().parseFromString(strFromU8(b),'text/xml');
 const doc=parse(entries['word/document.xml']),rels=parse(entries['word/_rels/document.xml.rels']);
 const targets=new Map(Array.from(rels.getElementsByTagName('Relationship')).map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const media=id=>{const target=targets.get(id);if(!target)throw Error('Unbound drawing relationship '+id);return hash(entries[target.startsWith('/')?target.slice(1):'word/'+target]);};
 function tree(el){
   const attrs=Array.from(el.attributes).filter(a=>a.namespaceURI!=='http://www.w3.org/2000/xmlns/').map(a=>{
     let value=a.value;
     if(a.localName==='id'||(el.localName==='id'&&el.namespaceURI===W&&a.localName==='val'))value='<identifier>';
     if(a.namespaceURI===R&&a.localName==='embed')value=media(value);
     return [(a.namespaceURI||'')+'|'+a.localName,value];
   }).sort((a,b)=>a[0].localeCompare(b[0]));
   const content=Array.from(el.childNodes).flatMap(n=>n.nodeType===1?[tree(n)]:n.nodeType===3&&(el.localName==='t'||n.data.trim())?[n.data]:[]);
   return {name:(el.namespaceURI||'')+'|'+el.localName,attrs:Object.fromEntries(attrs),content};
 }
 return {document:tree(doc.documentElement),images:Object.entries(entries).filter(([name])=>/\.bmp$/i.test(name)).map(([,bytes])=>hash(bytes)).sort()};
}
