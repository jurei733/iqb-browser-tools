import {converterCorpus,pipelineCorpus} from './converter-corpus.mjs';
import {windowsEdgeCorpus} from './windows-edge-corpus.mjs';
import {windowsNumberCorpus} from './windows-number-corpus.mjs';
export function nativeConverterCorpus(){
const unique=new Map();
for(const [group,fixtures]of [['base',converterCorpus()],['edges',windowsEdgeCorpus()],['numbers',windowsNumberCorpus()]])for(const fixture of fixtures){
 const key=JSON.stringify([fixture.method,fixture.contentJSON]);let item=unique.get(key);
 if(!item){item={id:'native-'+String(unique.size).padStart(4,'0'),method:fixture.method,contentJSON:fixture.contentJSON,sources:[]};unique.set(key,item);}
 item.sources.push({group,id:fixture.id});
}
return [...unique.values()];
}
const states=['{"10":12.0,"2":1e20,"tiny":5e-324,"large":1.7976931348623157e308}','{"overflow":1e309}','{"n":null,"b":true,"date":"2026-10-22T10:11:12-05:30"}','{"10":1,"2":2,"10":3}','{"v":{"nested":1}}','{"integer":9223372036854775808}'];
export const nativePipelineCases=()=>[...pipelineCorpus(),...states.map((laststate,index)=>({id:'laststate-boundary-'+index,dto:{groupname:'G',loginname:'001',code:'0',bookletname:'B',unitname:'U_alias',originalUnitId:'U',responses:[],laststate}}))];
