export function windowsCodingCorpus(){
 const strings=['plain','ä & < > " \'','🙂 e\u0301','first\nsecond','first\rsecond','first\r\nsecond',' \t ','\n','', 'left\tcenter\nright\rend','\u0001','\ud800'];
 const cases=[];
 for(const [index,value]of strings.entries()){
  const job={id:'codec-job',label:'Codec',cases:[{testee:'001',variable:{id:'V1'},code:'0',comment:value,time:'2026-11-03T10:11:12'}]};
  cases.push({id:'comment-'+index,job,coder:'Reference',globalComment:value});
  cases.push({id:'attributes-'+index,job:{...job,id:value,label:value,cases:[{...job.cases[0],testee:value,variable:{id:value},code:value,comment:'text'}]},coder:value||'Reference',globalComment:'global'});
 }
 return cases;
}
