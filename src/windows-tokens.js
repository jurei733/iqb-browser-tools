import {parseTree} from 'jsonc-parser';
import {legacyDouble,parseWindowsDouble} from './windows-number.js';

const order=Symbol('JSON property order');
export class WindowsNumber {
 constructor(raw,bits=32){this.raw=raw;this.bits=bits;this.floating=/[.eE]/.test(raw);this.value=this.floating?(bits===64?parseWindowsDouble(raw):Number(raw)):BigInt(raw);if(this.floating&&!Number.isFinite(this.value))throw new Error('Zahl außerhalb des Windows-Double-Bereichs.');}
}
class WindowsDate {
 constructor(parts,fraction='',suffix=''){this.parts=parts;this.fraction=fraction.replace(/0+$/,'');this.suffix=suffix;}
}
export const isContainer=value=>value!==null&&typeof value==='object'&&!(value instanceof WindowsNumber)&&!(value instanceof WindowsDate);
export const orderedEntries=value=>(value[order]||Object.keys(value)).map(key=>[key,value[key]]);
const pad=(value,length=2)=>String(value).padStart(length,'0');
const partsUTC=date=>[date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate(),date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds()];
function berlinParts(date){
 // Explicit reference profile: German Windows with W. Europe Standard Time.
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
 return ['year','month','day','hour','minute','second'].map(k=>Number(parts[k]));
}
function dateToken(value){
 const microsoft=value.match(/^\/Date\((-?\d+)\)\/$/);
 if(microsoft){const d=new Date(Number(microsoft[1]));if(Number.isFinite(d.getTime()))return new WindowsDate(partsUTC(d),'','Z');}
 const match=value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,7}))?(Z|[+-]\d\d:\d\d)?$/);
 if(!match)return value;
 const parts=match.slice(1,7).map(Number),[y,m,d,h,min,s]=parts;
 const check=new Date(0);check.setUTCFullYear(y,m-1,d);check.setUTCHours(h,min,s,0);
 if(y<1||y>9999||partsUTC(check).some((p,i)=>p!==parts[i]))return value;
 const fraction=match[7]||'',zone=match[8]||'';
 if(zone&&zone!=='Z'){
  if(Number(zone.slice(1,3))>23||Number(zone.slice(4))>59)return value;
  const instant=new Date(value);if(!Number.isFinite(instant.getTime()))return value;
  const local=berlinParts(instant),wall=new Date(0);wall.setUTCFullYear(local[0],local[1]-1,local[2]);wall.setUTCHours(...local.slice(3),instant.getUTCMilliseconds());
  const offset=Math.round((wall-instant)/60000),suffix=(offset<0?'-':'+')+pad(Math.floor(Math.abs(offset)/60))+':'+pad(Math.abs(offset)%60);
  return new WindowsDate(local,fraction,suffix);
 }
 return new WindowsDate(parts,fraction,zone);
}
export function parseWindowsJSON(source,{stringsOnly=false,bits=32}={}){
 const errors=[],tree=parseTree(source,errors,{allowTrailingComma:true});
 if(errors.length||!tree)throw new Error('Ungültiges JSON.');
 function convert(node){
  if(node.type==='number')return new WindowsNumber(source.slice(node.offset,node.offset+node.length),bits);
  if(node.type==='string')return stringsOnly?node.value:dateToken(node.value);
  if(node.type==='array')return node.children.map(convert);
  if(node.type==='object'){
   const result=Object.create(null),keys=[];
   for(const property of node.children){const [key,value]=property.children;if(!Object.hasOwn(result,key.value))keys.push(key.value);result[key.value]=convert(value);}
   Object.defineProperty(result,order,{value:keys});return result;
  }
  return node.value;
 }
 return convert(tree);
}
export function generalDouble(value,precision=15){
 if(value===0)return '0';
 if(!Number.isFinite(value))return String(value);
 const negative=value<0,[mantissa,rawExponent]=Math.abs(value).toExponential(precision-1).split('e'),exponent=Number(rawExponent),digits=mantissa.replace('.','').replace(/0+$/,'');
 let formatted;
 if(exponent< -4||exponent>=precision)formatted=digits[0]+(digits.length>1?'.'+digits.slice(1):'')+'E'+(exponent<0?'-':'+')+pad(Math.abs(exponent));
 else {const position=exponent+1;formatted=position<=0?'0.'+'0'.repeat(-position)+digits:position>=digits.length?digits+'0'.repeat(position-digits.length):digits.slice(0,position)+'.'+digits.slice(position);}
 return (negative?'-':'')+formatted;
}
function dateText(value,invariant){const [y,m,d,h,min,s]=value.parts;return (invariant?`${pad(m)}/${pad(d)}/${pad(y,4)}`:`${pad(d)}.${pad(m)}.${pad(y,4)}`)+` ${pad(h)}:${pad(min)}:${pad(s)}`;}
export function windowsTokenText(value,{invariant=false,stringsOnly=false}={}){
 if(value===null)return '';
 if(value instanceof WindowsNumber)return stringsOnly?value.raw:value.floating?generalDouble(value.value).replace('.',invariant?'.':','):String(value.value);
 if(value instanceof WindowsDate)return dateText(value,invariant);
 if(typeof value==='boolean')return stringsOnly?String(value):value?'True':'False';
 if(typeof value==='number')return generalDouble(value).replace('.',invariant?'.':',');
 if(typeof value==='bigint')return String(value);
 if(isContainer(value))return prettyWindowsJSON(value);
 return String(value);
}
export function prettyWindowsJSON(value,depth=0){
 if(value instanceof WindowsNumber){if(!value.floating)return String(value.value);let out=generalDouble(value.value);const parse=value.bits===64?legacyDouble:Number;if(parse(value.value.toExponential(14))!==value.value)out=generalDouble(value.value,17);return /[.E]/.test(out)?out:out+'.0';}
 if(value instanceof WindowsDate){const [y,m,d,h,min,s]=value.parts;return JSON.stringify(`${pad(y,4)}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(s)}${value.fraction?'.'+value.fraction:''}${value.suffix}`);}
 if(!isContainer(value))return JSON.stringify(value);
 const array=Array.isArray(value),items=array?value.map(item=>prettyWindowsJSON(item,depth+1)):orderedEntries(value).map(([key,item])=>JSON.stringify(key)+': '+prettyWindowsJSON(item,depth+1));
 return (array?'[':'{')+(items.length?'\r\n'+items.map(item=>'  '.repeat(depth+1)+item).join(',\r\n')+'\r\n'+'  '.repeat(depth):'')+(array?']':'}');
}
