// Keep ordinary timestamps as Number and retain the complete Int64 range as
// BigInt. The lossless JSON codec writes both as JSON numbers.
export const compactInteger=value=>value>=BigInt(Number.MIN_SAFE_INTEGER)&&value<=BigInt(Number.MAX_SAFE_INTEGER)?Number(value):value;
export function exactTime(value) {
  if(typeof value==='bigint')return compactInteger(value);
  if(typeof value==='string'&&/^[+-]?\d+$/.test(value.trim()))return compactInteger(BigInt(value.trim()));
  const number=Number(value);return Number.isFinite(number)?Number.isInteger(number)&&!Number.isSafeInteger(number)?BigInt(number):number:0;
}
export function compareTime(a,b){a=exactTime(a);b=exactTime(b);return a<b?-1:a>b?1:0;}
export const maxTime=(a,b)=>compareTime(a,b)>=0?exactTime(a):exactTime(b);
export const minTime=(a,b)=>compareTime(a,b)<=0?exactTime(a):exactTime(b);
export const sqlValues=values=>values.map(value=>typeof value==='bigint'?value.toString():value);
export const exactSqlRow=row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='bigint'?compactInteger(value):value]));
