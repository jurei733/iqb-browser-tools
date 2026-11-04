import {windowsNumericProbes} from './windows-numeric-probes.mjs';
import {parseX86,generalX86,roundTripX86} from '../src/windows-number-x86.js';
import {parseWindowsDouble,legacyDouble} from '../src/windows-number.js';
import {generalDouble} from '../src/windows-tokens.js';
export {windowsNumericProbes};
const ensure=(condition,message)=>{if(!condition)throw new Error(message);};
const hash=async input=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',input))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function verifyNumericProbes(native,bits){
 if(!native.numericProbes)return [];
 const inputs=windowsNumericProbes(),inputHash=await hash(new TextEncoder().encode(JSON.stringify(inputs)));
 ensure(native.numericInputSHA256===inputHash,'Numeric diagnostic inputs changed');
 ensure(native.jsonSHA256==='b624949df8b0e3a6153fdfb730a7c6f4990b6592ee0d922e1788433d276610f3','Changed original JSON library');
 ensure(native.numericProbes.length===inputs.length,'Missing numeric diagnostics');
 const view=new DataView(new ArrayBuffer(8));
 return inputs.map((raw,index)=>{
  const expected=native.numericProbes[index];ensure(expected.index===index,'Reordered numeric diagnostics');
  const value=bits===32?parseX86(raw):parseWindowsDouble(raw);let actual;
  if(!Number.isFinite(value))actual={kind:'exception'};
  else{
   view.setFloat64(0,value);const g15=bits===32?generalX86(value):generalDouble(value),g17=bits===32?generalX86(value,17):generalDouble(value,17);
   const roundTrip=bits===32?roundTripX86(value):legacyDouble(value.toExponential(14))===value?g15:g17;
   actual={kind:'value',bits:view.getBigUint64(0).toString(16).padStart(16,'0'),g15,g17,roundTrip};
  }
  const passed=expected.exceptionType?actual.kind==='exception':actual.kind==='value'&&['bits','g15','g17','roundTrip'].every(key=>actual[key]===expected[key]);
  return {index,bits,proof:expected.exceptionType?'error-outcome-only':'binary64-and-G15-G17-R',passed,...(!passed?{raw,expected,actual}:{})};
 });
}
