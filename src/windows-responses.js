import {WindowsNumber,isContainer,orderedEntries,parseWindowsJSON,windowsTokenText} from './windows-tokens.js';
const standardTypes=new Set(['iqb-aspect-player@0.1.1','iqb-standard@1.0.0','iqb-standard@1.0','iqb-standard@1.1']);
const token=windowsTokenText;
const invariantToken=value=>windowsTokenText(value,{invariant:true});
function int32(value){
  if(value instanceof WindowsNumber)value=value.value;
  if(value===null||typeof value==='object'||typeof value==='string'&&!/^[+-]?\d+$/.test(value.trim()))throw new Error('Windows-Konvertierung: Code oder Score ist keine ganze Zahl.');
  let number=Number(value);if(typeof value==='number'&&!Number.isInteger(value)){const floor=Math.floor(value),fraction=value-floor;number=fraction===.5?(floor%2===0?floor:floor+1):Math.round(value);}
  if(!Number.isInteger(number)||number< -2147483648||number>2147483647)throw new Error('Windows-Konvertierung: Code oder Score außerhalb des 32-Bit-Bereichs.');return number;
}
export function parseWindowsChunk(content,type='',{bits=32}={}){
  const family=standardTypes.has(type)?'iqb-standard':type==='unknown'?'Abi':type==='IQBVisualUnitPlayerV2.1.0'?'Dan':type==='iqb-simple-player@1.0.0'?'SimplePlayerLegacy':'KeyValue';
  const failed=message=>[{id:'',responses:[{id:'ERROR',value:`Converter ${family} failed: ${message}`,status:'ERROR',code:0,score:0}]}];
  // Newtonsoft checks the first token against Dictionary before parsing its
  // contents. This also applies to the malformed middle fields of 2011 CSVs.
  if(family==='KeyValue'&&typeof content==='string'&&content.startsWith('['))return failed('Cannot deserialize the current JSON array (e.g. [1,2,3]) into type \'System.Collections.Generic.Dictionary`2[System.String,Newtonsoft.Json.Linq.JToken]\' because the type requires a JSON object (e.g. {"name":"value"}) to deserialize correctly.\nTo fix this error either change the JSON to a JSON object (e.g. {"name":"value"}) or change the deserialized type to an array or a type that implements a collection interface (e.g. ICollection, IList) like List<T> that can be deserialized from a JSON array. JsonArrayAttribute can also be added to the type to force it to deserialize from a JSON array.\nPath \'\', line 1, position 1.');
  let data;try{data=typeof content==='string'?(content.trim()==='undefined'?null:parseWindowsJSON(content,{stringsOnly:type==='unknown',bits})):content;}catch(error){return failed(error.message);}
  const forms=new Map();
  const add=(form,id,value,status='UNSET',code=0,score=0)=>{if(form===null||isContainer(form))throw new Error('Windows-Konvertierung: Ein Unterformular muss ein skalarer Wert sein.');form=invariantToken(form);if(!forms.has(form))forms.set(form,[]);forms.get(form).push({id,value,status,code,score});};
  if(standardTypes.has(type)){
    const rows=Array.isArray(data)?data:[data];if(rows.some(row=>row!==null&&(!isContainer(row)||Array.isArray(row))))return failed('Antwortobjekt erwartet.');for(const row of rows){if(row===null)throw new Error('Windows-Konvertierung: Eine Antwort darf nicht null sein.');if(!isContainer(row)||Array.isArray(row))throw new Error('Windows-Konvertierung: Antwortobjekt erwartet.');if(!Object.hasOwn(row,'id')||!Object.hasOwn(row,'value'))continue;
      add(Object.hasOwn(row,'subform')?row.subform:'',token(row.id),row.value===null?'#null#':token(row.value).replace(/\r\n/g,''),Object.hasOwn(row,'status')?token(row.status):'UNSET',Object.hasOwn(row,'code')?int32(row.code):0,Object.hasOwn(row,'score')?int32(row.score):0);
    }
  }else{
    if(type==='iqb-simple-player@1.0.0'){if(data===null)throw new Error('Windows-Konvertierung: SimplePlayer-Objekt darf nicht null sein.');if(!isContainer(data)||Array.isArray(data))return failed('SimplePlayer-Objekt erwartet.');if(Object.values(data).some(value=>value!==null&&(!isContainer(value)||Array.isArray(value))))return failed('SimplePlayer-Inhaltsobjekt erwartet.');data=Object.hasOwn(data,'answers')?data.answers:{};}
    if(data===null)throw new Error('Windows-Konvertierung: Schlüssel-Wert-Objekt darf nicht null sein.');if(!isContainer(data)||Array.isArray(data))return failed('Schlüssel-Wert-Objekt erwartet.');
    if(type!=='unknown')forms.set('',[]);
    if(type==='IQBVisualUnitPlayerV2.1.0'&&Object.hasOwn(data,'responsesGiven')){const metadata=data.responsesGiven;if(metadata!==null){if(!isContainer(metadata)||Array.isArray(metadata))throw new Error('Windows-Konvertierung: responsesGiven muss ein Objekt sein.');for(const [,value]of orderedEntries(metadata)){if(value===null||isContainer(value)||typeof value==='string'&&!/^(true|false)$/i.test(value.trim())||!(typeof value==='boolean'||typeof value==='string'||value instanceof WindowsNumber))throw new Error('Windows-Konvertierung: Ungültiger Wahrheitswert in responsesGiven.');}}}
    // Dictionary<string,string> and JToken's explicit string cast reject containers.
    if(type!=='IQBVisualUnitPlayerV2.1.0'&&Object.values(data).some(value=>isContainer(value))){if(type==='unknown')return failed('Verschachtelter Wert wird von diesem Playerformat nicht unterstützt.');throw new Error('Windows-Konvertierung: Verschachtelter Wert wird von diesem Playerformat nicht unterstützt.');}
    for(const [id,value]of orderedEntries(data)){
      if(type==='IQBVisualUnitPlayerV2.1.0'&&['responsesGiven','pagesViewed'].includes(id))continue;
      if(type==='unknown'){
        const split=id.lastIndexOf('_'),suffix=id.slice(split+1).trim(),number=/^[+-]?\d+$/.test(suffix)?Number(suffix):0;
        const converted=value===null?null:typeof value==='boolean'?String(value):isContainer(value)?null:windowsTokenText(value,{stringsOnly:true});
        if(split>1&&number>0&&number<=2147483647){const form=String(number),variable=id.slice(0,split);if(!forms.get(form)?.some(r=>r.id===variable))add(form,variable,converted);}else add('',id,converted);
      }else add('',id,type==='IQBVisualUnitPlayerV2.1.0'?token(value):value===null?null:isContainer(value)?null:invariantToken(value));
    }
  }
  return [...forms].sort(type==='unknown'?([a],[b])=>a===''?-1:b===''?1:0:()=>0).map(([id,responses])=>({id,responses}));
}
