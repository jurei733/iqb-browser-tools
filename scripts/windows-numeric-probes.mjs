// Separate diagnostic corpus: legacy CLR parsing/G15/G17/R, not additional
// end-to-end Toolbox or empirical study cases. Seed and IEEE neighbours are fixed.
export function windowsNumericProbes(){
 const raw=new Set(['0.0','-0.0','1e-1000','-1e-1000','1e309','-1e309','1.7976931348623157e308','1.7976931348623159e308','0.845512408225570','2.2250738585072014e-308']);
 const view=new DataView(new ArrayBuffer(8));
 const add=value=>{if(!Number.isFinite(value))return;let text=String(value);if(!/[.eE]/.test(text))text+='.0';raw.add(text);};
 const at=bits=>{view.setBigUint64(0,bits);return view.getFloat64(0);};
 const neighbours=(value,width=1)=>{if(!Number.isFinite(value)||!value)return;view.setFloat64(0,Math.abs(value));const bits=view.getBigUint64(0);for(let delta=-width;delta<=width;delta++){const b=bits+BigInt(delta);if(b>0n&&b<0x7ff0000000000000n){add(at(b));add(-at(b));}}};
 for(let exponent=-324;exponent<=308;exponent++)neighbours(10**exponent);
 for(const value of [-1.4626270185260474e-164,0.84551240822557,Number.MIN_VALUE,Number.MAX_VALUE,2.2250738585072014e-308])neighbours(value,16);
 for(let bits=1n;bits<=128n;bits++){add(at(bits));add(-at(bits));}
 let seed=20261104;const next=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 for(let i=0;i<4096;i++){const sign=BigInt(next()&1),exponent=BigInt(next()%2047),mantissa=BigInt(next()&0xfffff)<<32n|BigInt(next());add(at(sign<<63n|exponent<<52n|mantissa));}
 return [...raw];
}
