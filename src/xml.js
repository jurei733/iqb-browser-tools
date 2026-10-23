export const text = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const children = (el, tag) => Array.from(el?.childNodes || []).filter(n => n.nodeType === 1 && (!tag || n.localName === tag));
export const descendants = (el, tag) => Array.from(el?.getElementsByTagName(tag) || []);
export const attr = (el, name, fallback = '') => el?.hasAttribute(name) ? el.getAttribute(name) : fallback;
export const child = (el, tag) => children(el, tag)[0];
export const value = (el, tag) => child(el, tag)?.textContent || '';
export function decodeXML(bytes){
  let encoding='utf-8';
  if((bytes[0]===255&&bytes[1]===254)||(bytes[0]===60&&bytes[1]===0))encoding='utf-16le';
  else if((bytes[0]===254&&bytes[1]===255)||(bytes[0]===0&&bytes[1]===60))encoding='utf-16be';
  else {const declaration=String.fromCharCode(...bytes.slice(0,200)).match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)/i);if(declaration)encoding=declaration[1];}
  try{return new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch{throw new Error(`Die XML-Zeichenkodierung ${encoding} konnte nicht gelesen werden.`);}
}
export function parseXML(source) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('XML mit Dokumenttyp oder Entitäten wird nicht unterstützt.');
  let errors = [];
  const parser = new DOMParser({errorHandler: {warning: () => {}, error: s => errors.push(s), fatalError: s => errors.push(s)}});
  const doc = parser.parseFromString(source.replace(/^\uFEFF/, ''), 'application/xml');
  if (errors.length || !doc.documentElement || doc.getElementsByTagName('parsererror').length) throw new Error('Die XML-Datei ist nicht wohlgeformt.');
  return doc;
}
export function node(tag, attrs = {}, inner = '') {
  return `<${tag}${Object.entries(attrs).filter(([,v]) => v !== null && v !== undefined).map(([k,v]) => ` ${k}="${text(v)}"`).join('')}>${inner}</${tag}>`;
}
export const documentXML = body => '<?xml version="1.0" encoding="utf-8"?>\n' + body;
