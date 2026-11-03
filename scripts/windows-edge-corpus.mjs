import {converterTypes} from './converter-corpus.mjs';

// Raw JSON is intentional: 12, 12.0 and 12e0 have different JToken types.
export function windowsEdgeCorpus(){
 const cases=[];
 const add=(id,method,contentJSON,category)=>cases.push({id,method,contentJSON,category});
 const values=['12.0','12e0','1e20','1.2345678901234567','1.7976931348623157e308','5e-324','-0.0','0.00001','0.0001','999999999999999.5','9007199254740993','9223372036854775808',
  ...['0001-01-01T00:00:00Z','2026-10-22T10:11:12.1234567Z','2026-10-22T10:11:12+02:00','2026-10-22T10:11:12-05:30','2026-10-22T10:11:12','2026-02-30T10:11:12Z','/Date(0)/','2026-10-22'].map(JSON.stringify)];
 for(const method of Object.keys(converterTypes))for(const [index,value]of values.entries()){
  const payload=method==='setResponsesIqbStandard'?`[{"id":"v","value":${value}}]`:method==='setResponsesSimplePlayerLegacy'?`{"answers":{"v":${value}}}`:`{"v":${value}}`;
  add(`${method}-lexeme-${index}`,method,payload,index<12?'number-lexeme':'date-token');
 }
 for(const method of Object.keys(converterTypes)){
  const ordered='{"10":"ten","2":"two","01":"one","__proto__":"own","constructor":"own"}';
  add(method+'-key-order',method,method==='setResponsesIqbStandard'?`[{"id":"v","value":${ordered}}]`:method==='setResponsesSimplePlayerLegacy'?`{"answers":${ordered}}`:ordered,'property-order');
 }
 const nested='{"10":12.0,"2":1.2345678901234567,"small":5e-324,"large":1.7976931348623157e308,"date":"2026-10-22T10:11:12.1234567Z"}';
 add('standard-nested-types','setResponsesIqbStandard',`[{"id":"v","value":${nested}}]`,'nested-token-types');
 add('dan-nested-types','setResponsesDan',`{"v":${nested}}`,'nested-token-types');
 for(const [index,metadata]of ['null','{}','{"v":true}','{"v":1}','{"v":"True"}','{"v":"false"}','{"v":"yes"}','{"v":null}','[]','1','{"v":{}}'].entries())add('dan-metadata-'+index,'setResponsesDan',`{"v":"x","responsesGiven":${metadata},"pagesViewed":"ignored"}`,'metadata-validation');
 return cases;
}
