import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import QRCode from 'qrcode';
import {qrBmp} from './qr-bmp.js';
import {parseXML,children} from './xml.js';
import {loginRows} from './toolbox.js';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',R='http://schemas.openxmlformats.org/package/2006/relationships';
const all=(el,ns,tag)=>Array.from(el.getElementsByTagNameNS(ns,tag));
const controlTag=control=>children(children(control,'sdtPr')[0],'tag')[0]?.getAttributeNS(W,'val');
const serialize=doc=>new XMLSerializer().serializeToString(doc);
export function normalizeServer(input){let value=String(input||'').trim();if(!/^https?:\/\//i.test(value))value='https://'+value;const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Bitte eine gültige Serveradresse ohne Zugangsdaten eingeben.');url.hash='';url.search='';return url.href.replace(/\/+$/,'');}
export const loginLink=(server,login)=>normalizeServer(server)+'/#/'+encodeURIComponent(login);
function pngBytes(dataURL){const raw=atob(dataURL.split(',')[1]);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function makeDrawing(doc,rel,id,size){const xml=`<w:r xmlns:w="${W}"><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${size}" cy="${size}"/><wp:docPr id="${id}" name="Login-QR ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="Login-QR"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${size}" cy="${size}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  return doc.importNode(parseXML(xml).documentElement,true);
}
export async function loginDocx(workbook,templateBytes,server,{perGroup=false,qrCentimeters=3,windows=false,signal,onProgress=()=>{}}={}) {
  const logins=loginRows(workbook);if(!logins.length)throw new Error('Die Login-Tabelle enthält keine Logins.');if(logins.some(r=>!r.group))throw new Error('Ein Login hat keine Gruppen-ID.');
  if(!Number.isFinite(qrCentimeters)||qrCentimeters<1||qrCentimeters>12)throw new Error('QR-Größe muss zwischen 1 und 12 cm liegen.');
  const normalized=normalizeServer(server),url=windows?(/^http/i.test(server)?String(server):'https://'+server):normalized,template=unzipSync(new Uint8Array(templateBytes));if(!template['word/document.xml'])throw new Error('Die Vorlage ist keine gültige DOCX-Datei.');
  const groups=new Map();if(perGroup)for(const r of logins){if(!groups.has(r.group))groups.set(r.group,[]);groups.get(r.group).push(r);}else groups.set('Logins',logins);
  const files={};let count=0;
  for(const [group,rows]of groups){const entries={...template},doc=parseXML(strFromU8(entries['word/document.xml'])),body=all(doc,W,'body')[0];if(!body)throw new Error('Die Word-Vorlage hat keinen Dokumentinhalt.');
    const blocks=(windows?all(body,W,'p'):children(body).filter(n=>n.localName!=='sectPr')).map(n=>n.cloneNode(true)),section=children(body,'sectPr')[0];if(!blocks.length)throw new Error('Die Word-Vorlage ist leer.');
    const controls=all(doc,W,'sdt');if(!controls.some(s=>['login','link','link-qr'].includes(controlTag(s))))throw new Error('Die Vorlage enthält keine Login-Inhaltssteuerelemente. Bitte eine Originalvorlage oder eine Vorlage mit den bekannten Tags verwenden.');
    if(windows){for(const paragraph of all(body,W,'p'))paragraph.parentNode.removeChild(paragraph);}else for(const block of children(body).filter(n=>n!==section))body.removeChild(block);
    const relPath='word/_rels/document.xml.rels',rels=parseXML(entries[relPath]?strFromU8(entries[relPath]):`<Relationships xmlns="${R}"/>`),types=parseXML(strFromU8(entries['[Content_Types].xml']));
    const extension=windows?'bmp':'png';
    if(!Array.from(types.documentElement.childNodes).some(n=>n.nodeType===1&&n.getAttribute('Extension')===extension)){const ext=types.createElementNS('http://schemas.openxmlformats.org/package/2006/content-types','Default');ext.setAttribute('Extension',extension);ext.setAttribute('ContentType',windows?'image/bmp':'image/png');types.documentElement.appendChild(ext);}
    let id=Math.max(1000,...Array.from(rels.documentElement.childNodes).filter(n=>n.nodeType===1).map(n=>Number(n.getAttribute('Id').match(/^rIdIQB(\d{1,9})$/)?.[1])||0),...all(doc,'*','docPr').map(n=>Number(n.getAttribute('id'))||0));
    for(const row of rows){if(signal?.aborted)throw new DOMException('Verarbeitung abgebrochen.','AbortError');if(count%10===0){onProgress(count/logins.length);await new Promise(resolve=>setTimeout(resolve,0));}const link=windows?url+'/#/'+row.name:loginLink(url,row.name),values={'server-url':url,login:row.name,password:row.password,link,'testgroup-name':row.name1+' - '+row.name2,'testgroup-id':row.group,mode:row.mode},clones=blocks.map(b=>b.cloneNode(true));
      const bookmarkIds=new Map();
      for(const block of clones){for(const el of all(block,'*','*')){if(['bookmarkStart','bookmarkEnd'].includes(el.localName)){const old=el.getAttributeNS(W,'id');if(!bookmarkIds.has(old))bookmarkIds.set(old,String(++id));el.setAttributeNS(W,'w:id',bookmarkIds.get(old));}else if(el.localName==='id'&&el.namespaceURI===W)el.setAttributeNS(W,'w:val',String(++id));else if(el.localName==='docPr')el.setAttribute('id',String(++id));}
        const sdts=[...(block.localName==='sdt'?[block]:[]),...all(block,W,'sdt')];
        for(const control of sdts){const tag=controlTag(control),content=children(control,'sdtContent')[0];if(!content||!(tag in values)&&tag!=='link-qr')continue;
          for(const marker of all(control,W,'showingPlcHdr'))marker.parentNode.removeChild(marker);
          if(tag==='link-qr'){const blockLevel=control===block||children(content,'p').length>0,imageId=++id,name=`iqb-qr-${imageId}.${extension}`,rid=`rIdIQB${imageId}`;entries['word/media/'+name]=windows?qrBmp(link):pngBytes(await QRCode.toDataURL(link,{errorCorrectionLevel:'Q',scale:4,margin:4}));const rel=rels.createElementNS(R,'Relationship');rel.setAttribute('Id',rid);rel.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');rel.setAttribute('Target','media/'+name);rels.documentElement.appendChild(rel);while(content.firstChild)content.removeChild(content.firstChild);const run=makeDrawing(doc,rid,imageId,Math.round(qrCentimeters*360000));if(windows)control.parentNode.replaceChild(run,control);else if(blockLevel){const p=doc.createElementNS(W,'w:p');p.appendChild(run);content.appendChild(p);}else content.appendChild(run);}
          else if(windows){const run=doc.createElementNS(W,'w:r'),t=doc.createElementNS(W,'w:t');t.textContent=values[tag];run.appendChild(t);control.parentNode.replaceChild(run,control);}
          else {const texts=all(content,W,'t');if(texts.length){texts[0].textContent=values[tag];texts[0].setAttribute('xml:space','preserve');for(const t of texts.slice(1))t.textContent='';}else{const run=doc.createElementNS(W,'w:r'),t=doc.createElementNS(W,'w:t');t.textContent=values[tag];run.appendChild(t);content.appendChild(run);}}
        }
        if(section)body.insertBefore(block,section);else body.appendChild(block);
      }count++;
    }
    entries['word/document.xml']=strToU8(serialize(doc));entries[relPath]=strToU8(serialize(rels));entries['[Content_Types].xml']=strToU8(serialize(types));
    const base=(perGroup?group:'Logins').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')||'Logins';let name=base+'.docx',i=1;while(files[name])name=base+'_'+i+++'.docx';files[name]=zipSync(entries);
  }
  return {files,count};
}
