import {parseJSON,stringifyJSON} from './json.js';
const standardTypes=new Set(['iqb-aspect-player@0.1.1','iqb-standard@1.0.0','iqb-standard@1.0','iqb-standard@1.1']);
function doubleText(value){
  // .NET Framework Double.ToString() uses G15 and the current de-DE culture.
  const rounded=Number(value.toPrecision(15)),exponent=rounded===0?0:Math.floor(Math.log10(Math.abs(rounded)));
  if(exponent< -4||exponent>=15){const [mantissa,exp]=rounded.toExponential(14).split('e');return mantissa.replace(/0+$/,'').replace(/\.$/,'').replace('.',',')+'E'+(Number(exp)<0?'-':'+')+String(Math.abs(Number(exp))).padStart(2,'0');}
  return String(rounded).replace('.',',');
}
function tokenText(value){
  if(value===null)return '';
  if(typeof value==='boolean')return value?'True':'False';
  if(typeof value==='number')return Number.isInteger(value)?String(value):doubleText(value);
  if(typeof value==='bigint')return String(value);
  if(typeof value==='string'){
    if(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)){const d=new Date(value),pad=n=>String(n).padStart(2,'0');if(!Number.isNaN(d.getTime()))return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth()+1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;}
    return value;
  }
  return pretty(value);
}
function pretty(value,depth=0){
  if(value===null)return 'null';
  if(typeof value!=='object')return stringifyJSON(value);
  const array=Array.isArray(value),items=array?value.map(item=>pretty(item,depth+1)):Object.entries(value).map(([key,item])=>stringifyJSON(key)+': '+pretty(item,depth+1));
  return (array?'[':'{')+(items.length?'\r\n'+items.map(item=>'  '.repeat(depth+1)+item).join(',\r\n')+'\r\n'+'  '.repeat(depth):'')+(array?']':'}');
}
function invariantToken(value){
  if(typeof value==='number'&&!Number.isInteger(value))return doubleText(value).replace(',','.');
  if(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)){const d=new Date(value),p=n=>String(n).padStart(2,'0');if(!Number.isNaN(d.getTime()))return `${p(d.getUTCMonth()+1)}/${p(d.getUTCDate())}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;}
  return tokenText(value);
}
const token=value=>value!==null&&typeof value==='object'?pretty(value):tokenText(value);
function int32(value){
  if(value===null||typeof value==='object'||typeof value==='string'&&!/^[+-]?\d+$/.test(value.trim()))throw new Error('Windows-Konvertierung: Code oder Score ist keine ganze Zahl.');
  let number=Number(value);if(typeof value==='number'&&!Number.isInteger(value)){const floor=Math.floor(value),fraction=value-floor;number=fraction===.5?(floor%2===0?floor:floor+1):Math.round(value);}
  if(!Number.isInteger(number)||number< -2147483648||number>2147483647)throw new Error('Windows-Konvertierung: Code oder Score außerhalb des 32-Bit-Bereichs.');return number;
}
export function parseWindowsChunk(content,type=''){
  const family=standardTypes.has(type)?'iqb-standard':type==='unknown'?'Abi':type==='IQBVisualUnitPlayerV2.1.0'?'Dan':type==='iqb-simple-player@1.0.0'?'SimplePlayerLegacy':'KeyValue';
  const failed=message=>[{id:'',responses:[{id:'ERROR',value:`Converter ${family} failed: ${message}`,status:'ERROR',code:0,score:0}]}];
  let data;try{data=typeof content==='string'?(content.trim()==='undefined'?null:parseJSON(content)):content;}catch(error){return failed(error.message);}
  const forms=new Map();
  const add=(form,id,value,status='UNSET',code=0,score=0)=>{if(form===null)throw new Error('Windows-Konvertierung: Ein Unterformular darf nicht null sein.');form=String(form);if(!forms.has(form))forms.set(form,[]);forms.get(form).push({id,value,status,code,score});};
  if(standardTypes.has(type)){
    const rows=Array.isArray(data)?data:[data];if(rows.some(row=>row!==null&&(typeof row!=='object'||Array.isArray(row))))return failed('Antwortobjekt erwartet.');for(const row of rows){if(row===null)throw new Error('Windows-Konvertierung: Eine Antwort darf nicht null sein.');if(typeof row!=='object'||Array.isArray(row))throw new Error('Windows-Konvertierung: Antwortobjekt erwartet.');if(!Object.hasOwn(row,'id')||!Object.hasOwn(row,'value'))continue;
      add(Object.hasOwn(row,'subform')?row.subform:'',token(row.id),row.value===null?'#null#':token(row.value).replace(/\r\n/g,''),Object.hasOwn(row,'status')?token(row.status):'UNSET',Object.hasOwn(row,'code')?int32(row.code):0,Object.hasOwn(row,'score')?int32(row.score):0);
    }
  }else{
    if(type==='iqb-simple-player@1.0.0'){if(data===null)throw new Error('Windows-Konvertierung: SimplePlayer-Objekt darf nicht null sein.');if(typeof data!=='object'||Array.isArray(data))return failed('SimplePlayer-Objekt erwartet.');if(Object.values(data).some(value=>value!==null&&(typeof value!=='object'||Array.isArray(value))))return failed('SimplePlayer-Inhaltsobjekt erwartet.');data=Object.hasOwn(data,'answers')?data.answers:{};}
    if(data===null)throw new Error('Windows-Konvertierung: Schlüssel-Wert-Objekt darf nicht null sein.');if(typeof data!=='object'||Array.isArray(data))return failed('Schlüssel-Wert-Objekt erwartet.');
    if(type!=='unknown')forms.set('',[]);
    // Dictionary<string,string> and JToken's explicit string cast reject containers.
    if(type!=='IQBVisualUnitPlayerV2.1.0'&&Object.values(data).some(value=>value!==null&&typeof value==='object')){if(type==='unknown')return failed('Verschachtelter Wert wird von diesem Playerformat nicht unterstützt.');throw new Error('Windows-Konvertierung: Verschachtelter Wert wird von diesem Playerformat nicht unterstützt.');}
    for(const [id,value]of Object.entries(data)){
      if(type==='IQBVisualUnitPlayerV2.1.0'&&['responsesGiven','pagesViewed'].includes(id))continue;
      if(type==='unknown'){
        const split=id.lastIndexOf('_'),suffix=id.slice(split+1).trim(),number=/^[+-]?\d+$/.test(suffix)?Number(suffix):0;
        const converted=value===null?null:typeof value==='boolean'?String(value):typeof value==='object'?null:String(value);
        if(split>1&&number>0&&number<=2147483647){const form=String(number),variable=id.slice(0,split);if(!forms.get(form)?.some(r=>r.id===variable))add(form,variable,converted);}else add('',id,converted);
      }else add('',id,type==='IQBVisualUnitPlayerV2.1.0'?token(value):value===null?null:typeof value==='object'?null:invariantToken(value));
    }
  }
  return [...forms].sort(type==='unknown'?([a],[b])=>a===''?-1:b===''?1:0:()=>0).map(([id,responses])=>({id,responses}));
}
