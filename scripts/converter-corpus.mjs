import {stringifyJSON} from '../src/json.js';
export const converterTypes={setResponsesIqbStandard:'iqb-standard@1.1',setResponsesAbi:'unknown',setResponsesDan:'IQBVisualUnitPlayerV2.1.0',setResponsesKeyValue:'keyvalue',setResponsesSimplePlayerLegacy:'iqb-simple-player@1.0.0'};
export function converterCorpus(){
 const cases=[];const add=(id,method,content,category='generated-valid')=>cases.push({id,method,contentJSON:stringifyJSON(content),category});
 const values=['','001','äöß & < > "','a\r\nb\nc','\r\n',' \t ','🙂','e\u0301',0,-1,1,12.5,-12.5,1e-7,1e15,Math.PI,9007199254740991,'2026-10-22T10:11:12Z',null,true,false,[],[1,'001',true,null],{}, {a:1,b:'ä'},['a\r\nb','x']];
 const payload=(method,value)=>method==='setResponsesIqbStandard'?[{id:'v',value,status:'VALUE_CHANGED',code:0,score:0}]:method==='setResponsesSimplePlayerLegacy'?{answers:{v:value}}:{v:value};
 for(const method of Object.keys(converterTypes))for(const [i,value]of values.entries())add(method+'-value-'+i,method,payload(method,value),'value-boundary');
 let seed=733;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(const method of Object.keys(converterTypes))for(let n=0;n<80;n++){
  const entries=Array.from({length:1+random()%6},(_,i)=>({id:'V'+i,value:values[random()%values.length],status:['UNSET','NOT_REACHED','DISPLAYED','VALUE_CHANGED','CODING_COMPLETE'][random()%5],code:(random()%5)-2,score:random()%3,subform:['','01','02','A'][random()%4]}));
  const content=method==='setResponsesIqbStandard'?entries:Object.fromEntries(entries.map((r,i)=>['variable'+i+(method==='setResponsesAbi'?'_'+(n%4):''),r.value]));
  add(method+'-seed733-'+n,method,method==='setResponsesSimplePlayerLegacy'?{answers:content}:content,'seeded-combination');
 }
 for(const status of ['UNSET','NOT_REACHED','DISPLAYED','VALUE_CHANGED','DERIVE_ERROR','CODING_COMPLETE','NO_CODING','INVALID','CODING_INCOMPLETE','CODING_ERROR','PARTLY_DISPLAYED','DERIVE_PENDING','INTENDED_INCOMPLETE','CODE_SELECTION_PENDING','',null])add('status-'+String(status),'setResponsesIqbStandard',[{id:'v',value:'x',status}],'status-boundary');
 for(const code of [-2147483648,-1,0,1,2147483647,null,2147483648,-2147483649,1.5,'1','',true])add('code-'+typeof code+'-'+String(code),'setResponsesIqbStandard',[{id:'v',value:'x',code,score:0}],'code-boundary');
 for(const [id,value]of Object.entries({singleton:{id:'v',value:'x'},empty:[],missingID:[{value:'x'}],missingValue:[{id:'v'}],nullEntry:[null],nullRoot:null,scalarRoot:1,nullSubform:[{id:'v',value:'x',subform:null}],numberID:[{id:1,value:'x'}],nullID:[{id:null,value:'x'}],duplicate:[{id:'v',value:'x'},{id:'v',value:'y'}]}))add('structure-'+id,'setResponsesIqbStandard',value,'structure-boundary');
 for(const suffix of ['01','1','0002','+2','-1','0','2147483647','2147483648',' 2 ','1.5',''])add('abi-suffix-'+suffix,'setResponsesAbi',{['ab_'+suffix]:'a',ab_1:'b',ab_01:'c',plain:null},'form-boundary');
 for(const method of Object.keys(converterTypes))for(const [i,contentJSON]of ['{','[','undefined','{"v":1,"v":2}','{"v":1} trailing'].entries())cases.push({id:method+'-syntax-'+i,method,contentJSON,category:'syntax-boundary'});
 const seen=new Set();return cases.filter(test=>{const key=JSON.stringify([test.method,test.contentJSON]);if(seen.has(key))return false;seen.add(key);return true;});
}

export function pipelineCorpus(){
 const dto=(id,responses,laststate='{"PLAYER":"RUNNING"}')=>({id,dto:{groupname:'G',loginname:'001',code:'0',bookletname:'B',unitname:'U_alias',originalUnitId:'U',laststate,responses}});
 const chunk=(id,content,type,ts)=>({id,content:JSON.stringify(content),responseType:type,ts});
 return [
 dto('standard-repeated-forms',[chunk('newer',[{id:'v',value:12.5,status:'',code:0,score:0}],'iqb-standard@1.1',3000),chunk('older',[{id:'v',value:'a\r\nb\nc',subform:'',code:1,score:1}],'iqb-standard@1.1',1000)]),
 dto('abi-null',[chunk('all',{plain:null,ab_01:true,ab_1:false,ab_2:12.5},'unknown',1000)]),
 dto('keyvalue-state-values',[chunk('all',{null:null,date:'2026-10-22T10:11:12Z',decimal:12.5},'keyvalue',1000)],'{"empty":null,"n":12.5,"yes":true}'),
 dto('simple-empty',[chunk('all',{answers:{}},'iqb-simple-player@1.0.0',1000)]),
 dto('dan-container',[chunk('all',{value:[1,'001',null],empty:null,responsesGiven:{value:true}},'IQBVisualUnitPlayerV2.1.0',1000)]),
 dto('invalid-laststate',[chunk('all',{v:'x'},'keyvalue',1000)],'not JSON'),
 dto('array-laststate',[chunk('all',{v:'x'},'keyvalue',1000)],'[]')
 ];
}
