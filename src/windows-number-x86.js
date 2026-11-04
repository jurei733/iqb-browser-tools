// x87 NumberToDouble / DoubleToNumber adapted from .NET CoreCLR (MIT).
// Copyright (c) .NET Foundation and Contributors.
// https://github.com/dotnet/coreclr/blob/release/2.0.0/src/vm/i386/fptext.asm
// License: public/coreclr-number-LICENSE.txt
// Each x87 operation rounds to a 64-bit significand; FBSTP then rounds
// to an integer before the decimal G15/G17 rounding. No fixture lookup.
const cache=new Map();
const evenRound=(n,d)=>{const q=n/d,r=n%d;return q+(2n*r>d||2n*r===d&&(q&1n)?1n:0n);};
// Positive binary80 values use a normalized significand m and exponent e.
function rational(n,d=1n){
 let e=n.toString(2).length-d.toString(2).length;
 if(e>=0?n<(d<<BigInt(e)):(n<<BigInt(-e))<d)e--;
 const shift=63-e;let m=evenRound(shift>=0?n<<BigInt(shift):n,shift>=0?d:d<<BigInt(-shift));
 if(m===1n<<64n){m>>=1n;e++;}return {m,e};
}
function fraction({m,e}){return e>=63?[m<<BigInt(e-63),1n]:[m,1n<<BigInt(63-e)];}
// The original ScaleByPow10 divides by positive powers for negative scales.
function power(k){if(!cache.has(k))cache.set(k,rational(10n**BigInt(k)));return cache.get(k);}
function operate(a,b,divide){const [n,d]=fraction(a),[p,q]=fraction(b);return divide?rational(n*q,d*p):rational(n*p,d*q);}
function scale(a,k){const n=Math.abs(k),low=n%16,high=n-low;if(low)a=operate(a,power(low),k<0);if(high)a=operate(a,power(high),k<0);return a;}
function exactDouble(value){const v=new DataView(new ArrayBuffer(8));v.setFloat64(0,Math.abs(value));const b=v.getBigUint64(0),ex=Number(b>>52n),m=(b&0xfffffffffffffn)|(ex?1n<<52n:0n),e=(ex||1)-1075;return e>=0?rational(m<<BigInt(e)):rational(m,1n<<BigInt(-e));}
function toDouble(a,negative){
 let {m,e}=a;const down=11+Math.max(0,-1022-e);m=evenRound(m,1n<<BigInt(down));let bits;
 if(e< -1022)bits=m;else{if(m===1n<<53n){m>>=1n;e++;}bits=e>1023?0x7ff0000000000000n:(BigInt(e+1023)<<52n)|(m&0xfffffffffffffn);}
 if(negative)bits|=1n<<63n;const v=new DataView(new ArrayBuffer(8));v.setBigUint64(0,bits);return v.getFloat64(0);
}
export function parseX86(raw){
 const negative=raw[0]==='-',unsigned=negative?raw.slice(1):raw,[mantissa,ex='0']=unsigned.toLowerCase().split('e'),[whole,fraction='']=mantissa.split('.');let digits=(whole+fraction).replace(/^0+/,''),scale10=whole.length+Number(ex)-(whole+fraction).length+digits.length;
 digits=digits.replace(/0+$/,'');if(!digits)return 0;if(scale10<=-330)return 0;if(scale10>=310)return negative?-Infinity:Infinity;
 const used=digits.slice(0,18);const value=toDouble(scale(rational(BigInt(used)),scale10-used.length),negative);return value===0?0:value;
}
// The assembly estimates the decimal scale from the binary exponent, then
// uses packed BCD (18 digits), with ties-to-even integer rounding.
export function bufferX86(value,precision=15){
 if(value===0)return {digits:'',scale:0,negative:false};
 const a=exactDouble(value),exponent=Math.floor(((a.e-57)*19728+65535)/65536),scaled=scale(a,-exponent),[n,d]=fraction(scaled);let digits=String(evenRound(n,d)),outScale=exponent+digits.length;
 if(digits.length>precision){const up=digits[precision]>='5';digits=digits.slice(0,precision);if(up)digits=String(BigInt(digits)+1n);if(digits.length>precision)outScale++;}
 return {digits:digits.replace(/0+$/,''),scale:outScale,negative:value<0};
}
function format({digits,scale,negative},precision){
 if(!digits)return '0';const exponent=scale-1;let text;
 if(exponent< -4||exponent>=precision)text=digits[0]+(digits.length>1?'.'+digits.slice(1):'')+'E'+(exponent<0?'-':'+')+String(Math.abs(exponent)).padStart(2,'0');
 else text=scale<=0?'0.'+'0'.repeat(-scale)+digits:scale>=digits.length?digits+'0'.repeat(scale-digits.length):digits.slice(0,scale)+'.'+digits.slice(scale);
 return (negative?'-':'')+text;
}
export function generalX86(value,precision=15){return Number.isFinite(value)?format(bufferX86(value,precision),precision):String(value);}
export function roundTripX86(value){if(!Number.isFinite(value))return String(value);const buf=bufferX86(value);return parseX86((buf.negative?'-':'')+(buf.digits||'0')+'e'+(buf.scale-buf.digits.length))===value?format(buf,15):generalX86(value,17);}
