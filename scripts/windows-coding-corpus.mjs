export function windowsCodingCorpus({states=false}={}){
 const strings=['plain','ä & < > " \'','🙂 e\u0301','first\nsecond','first\rsecond','first\r\nsecond',' \t ','\n','', 'left\tcenter\nright\rend','\u0001','\ud800'];
 const cases=[];
 for(const [index,value]of strings.entries()){
  const job={id:'codec-job',label:'Codec',cases:[{testee:'001',variable:{id:'V1'},code:'0',comment:value,time:'2026-11-03T10:11:12'}]};
  cases.push({id:'comment-'+index,job,coder:'Reference',globalComment:value});
  cases.push({id:'attributes-'+index,job:{...job,id:value,label:value,cases:[{...job.cases[0],testee:value,variable:{id:value},code:value,comment:'text'}]},coder:value||'Reference',globalComment:'global'});
 }
 if(states){
  // Complete 6 × 6 × 6 state product for three people, two variables each.
  // The second variable stays blank: stopping at a blank person must not be
  // confused with skipping a blank variable of an otherwise edited person.
  const values=[['',''],['0',''],['1',''],['','comment'],['0','note'],['',' \t ']];
  for(let a=0;a<values.length;a++)for(let b=0;b<values.length;b++)for(let c=0;c<values.length;c++){
   const selection=[a,b,c],entries=selection.flatMap((state,person)=>['V1','V2'].map((variable,i)=>({testee:String(person+1).padStart(3,'0'),variable:{id:variable},code:i?'':values[state][0],comment:i?'':values[state][1],time:'2026-11-09T10:11:12'})));
   cases.push({id:'state-'+selection.join('-'),job:{id:'state-job',label:'State matrix',cases:entries},coder:'Matrix',globalComment:selection.includes(0)?'partially edited':'complete'});
  }
 }
 return cases;
}
