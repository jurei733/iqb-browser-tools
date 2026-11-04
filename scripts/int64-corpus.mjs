export function int64LogCorpus(){
  const values=[0n,1n,-1n,2147483647n,-2147483648n,9007199254740991n,9007199254740992n,9007199254740993n,-9007199254740991n,-9007199254740992n,-9007199254740993n,9223372036854775807n,-9223372036854775808n];
  let state=0x75a39b6d20f1c48en;
  while(values.length<64){state=BigInt.asUintN(64,state*6364136223846793005n+1442695040888963407n);const value=BigInt.asIntN(64,state);if(!values.includes(value))values.push(value);}
  return values.map((timestamp,i)=>({groupname:'INT64',loginname:'P'+String(i).padStart(3,'0'),code:'',bookletname:'BOOK',unitname:i%2?'U':'',originalUnitId:i%2?'U':'',timestamp,logentry:'NOTE = '+i}));
}
