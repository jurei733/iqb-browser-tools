import {converterTypes} from './converter-corpus.mjs';

export function windowsNumberCorpus(){
 const raw=['5e-324','1e-323','1e-320','1e-310','2.2250738585072014e-308','2.225073858507201e-308','1.7976931348623157e308','-1.7976931348623157e308','1e309','-1e309','1e-1000','-0.0','1.2345678901234567','999999999999999.5','0.84551240822557','0.845512408225570','2.5','1.005'];
 let seed=733;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;},view=new DataView(new ArrayBuffer(8));
 for(let i=0;i<64;i++){
  const exponent=random()%2047,significand=(BigInt(random()&0xfffff)<<32n)|BigInt(random());
  const bits=(BigInt(random()&1)<<63n)|(BigInt(exponent)<<52n)|significand;
  view.setBigUint64(0,bits);const value=view.getFloat64(0);let text=String(value);if(!/[.e]/i.test(text))text+='.0';raw.push(text);
 }
 const values=[...new Set(raw)],cases=[];
 for(const [index,value]of values.entries()){
  for(const method of Object.keys(converterTypes)){
   const contentJSON=method==='setResponsesIqbStandard'?`[{"id":"v","value":${value}}]`:method==='setResponsesSimplePlayerLegacy'?`{"answers":{"v":${value}}}`:`{"v":${value}}`;
   cases.push({id:`number-${index}-${method}`,method,contentJSON,category:'scalar-number'});
  }
  for(const method of ['setResponsesIqbStandard','setResponsesDan'])cases.push({id:`number-${index}-${method}-nested`,method,contentJSON:method==='setResponsesIqbStandard'?`[{"id":"v","value":{"n":${value}}}]`:`{"v":{"n":${value}}}`,category:'nested-number'});
 }
 return cases;
}
