// NumberToDouble algorithm and power tables adapted from .NET CoreCLR (MIT).
// Copyright (c) .NET Foundation and Contributors.
// https://github.com/dotnet/coreclr/blob/release/2.0.0/src/classlibnative/bcltype/number.cpp
// Full license: public/coreclr-number-LICENSE.txt
// Preserve the legacy NumberBuffer rounding used by .NET Framework, including
// its G15-to-G17 round-trip decision. No fixture values are looked up.
const powers=[0xa000000000000000n,0xc800000000000000n,0xfa00000000000000n,0x9c40000000000000n,0xc350000000000000n,0xf424000000000000n,0x9896800000000000n,0xbebc200000000000n,0xee6b280000000000n,0x9502f90000000000n,0xba43b74000000000n,0xe8d4a51000000000n,0x9184e72a00000000n,0xb5e620f480000000n,0xe35fa931a0000000n,0xcccccccccccccccdn,0xa3d70a3d70a3d70bn,0x83126e978d4fdf3cn,0xd1b71758e219652en,0xa7c5ac471b478425n,0x8637bd05af6c69b7n,0xd6bf94d5e57a42ben,0xabcc77118461ceffn,0x89705f4136b4a599n,0xdbe6fecebdedd5c2n,0xafebff0bcb24ab02n,0x8cbccc096f5088cfn,0xe12e13424bb40e18n,0xb424dc35095cd813n,0x901d7cf73ab0acdcn];
const powers16=[0x8e1bc9bf04000000n,0x9dc5ada82b70b59en,0xaf298d050e4395d6n,0xc2781f49ffcfa6d4n,0xd7e77a8f87daf7fan,0xefb3ab16c59b14a0n,0x850fadc09923329cn,0x93ba47c980e98cden,0xa402b9c5a8d3a6e6n,0xb616a12b7fe617a8n,0xca28a291859bbf90n,0xe070f78d39275566n,0xf92e0c3537826140n,0x8a5296ffe33cc92cn,0x9991a6f3d6bf1762n,0xaa7eebfb9df9de8an,0xbd49d14aa79dbc7en,0xd226fc195c6a2f88n,0xe950df20247c83f8n,0x81842f29f2cce373n,0x8fcac257558ee4e2n,0xe69594bec44de160n,0xcfb11ead453994c3n,0xbb127c53b17ec165n,0xa87fea27a539e9b3n,0x97c560ba6b0919b5n,0x88b402f7fd7553abn,0xf64335bcf065d3a0n,0xddd0467c64bce4c4n,0xc7caba6e7c5382edn,0xb3f4e093db73a0b7n,0xa21727db38cb0053n,0x91ff83775423cc29n,0x8380dea93da4bc82n,0xece53cec4a314f00n,0xd5605fcdcf32e217n,0xc0314325637a1978n,0xad1c8eab5ee43ba2n,0x9becce62836ac5b0n,0x8c71dcd9ba0b495cn,0xfd00b89747823938n,0xe3e27a444d8d991an];
const exps=[4,7,10,14,17,20,24,27,30,34,37,40,44,47,50];
const exps16=[54,107,160,213,266,319,373,426,479,532,585,638,691,745,798,851,904,957,1010,1064,1117];

const mask=(1n<<64n)-1n,top=1n<<63n,low=(1n<<32n)-1n;
export function parseWindowsDouble(raw){
 // StringToNumber trims insignificant trailing digits. DoubleToNumber's
 // round-trip probe keeps its full precision buffer, so it must stay separate.
 const [mantissa,exponent='0']=raw.toLowerCase().split('e'),[whole,fraction='']=mantissa.split('.'),digits=whole+fraction,trimmed=digits.replace(/0+$/,'');
 if(!trimmed||trimmed==='-')return 0;
 const value=legacyDouble(trimmed+'e'+(Number(exponent)-fraction.length+digits.length-trimmed.length));return value===0?0:value;
}
export function legacyDouble(raw){
 const negative=raw[0]==='-',unsigned=negative?raw.slice(1):raw;
 const [decimal,exponent='0']=unsigned.toLowerCase().split('e'),dot=decimal.indexOf('.'),all=decimal.replace('.',''),leading=all.match(/^0*/)[0].length,digits=all.slice(leading);
 if(!digits)return 0;
 const used=Math.min(digits.length,18),scale=(dot<0?decimal.length:dot)+Number(exponent)-leading-used,absolute=Math.abs(scale);
 if(absolute>=352)return scale<0?0:(negative?-Infinity:Infinity);
 let val=BigInt(digits.slice(0,used)),exp=64;
 while(!(val&top)){val<<=1n;exp--;}
 function multiply(b){val=(val>>32n)*(b>>32n)+(((val>>32n)*(b&low))>>32n)+(((val&low)*(b>>32n))>>32n);if(!(val&top)){val<<=1n;exp--;}}
 let index=absolute&15;if(index){exp+=scale<0?-exps[index-1]+1:exps[index-1];multiply(powers[index+(scale<0?15:0)-1]);}
 index=absolute>>4;if(index){exp+=scale<0?-exps16[index-1]+1:exps16[index-1];multiply(powers16[index+(scale<0?21:0)-1]);}
 if(val&1024n){const tmp=(val+1023n+((val>>11n)&1n))&mask;if(tmp<val){val=(tmp>>1n)|top;exp++;}else val=tmp;}
 exp+=1022;
 if(exp<=0){if(exp===-52&&val>=0x8000000000000058n)val=1n;else if(exp<=-52)val=0n;else val>>=BigInt(-exp+12);}
 else if(exp>=2047)val=0x7ff0000000000000n;
 else val=(BigInt(exp)<<52n)+((val>>11n)&0xfffffffffffffn);
 if(negative)val|=top;
 const bytes=new DataView(new ArrayBuffer(8));bytes.setBigUint64(0,val);return bytes.getFloat64(0);
}
