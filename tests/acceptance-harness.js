import {task,cancelTasks} from '../src/worker-client.js';
import {decodeCanvas} from '../src/image.js';
window.acceptance={
 async largeJob(){
  const metadata=await (await fetch('/fixtures/acceptance/large-job.json')).json(),bytes=new Uint8Array(await (await fetch('/fixtures/acceptance/large-job.zip')).arrayBuffer());
  const start=performance.now();let heartbeat=0;const timer=setInterval(()=>heartbeat++,20);
  try{const parsed=await task('coding',{files:[{name:'Large.zip',bytes}]});const job=parsed.jobs[0],sample=await decodeCanvas(job.cases[0].pages[0]);return {metadata,jobs:parsed.jobs.length,cases:job.cases.length,sample:{width:sample.canvas.width,height:sample.canvas.height},heartbeat,milliseconds:performance.now()-start};}finally{clearInterval(timer);}
 },
 async largeData(){
  const responses=[],logs=[],count=10000;
  for(let i=0;i<count;i++){const identity={groupname:'LOAD',loginname:'P'+String(i).padStart(5,'0'),code:'',bookletname:'BOOK',unitname:'U'},ts=1730000000000+i*10;
   responses.push({...identity,responses:[{id:'all',ts,responseType:'iqb-standard@1.1',content:Array.from({length:6},(_,j)=>({id:'v'+j,value:i+':'+j+';Grüße\nnext',status:'VALUE_CHANGED',code:0,score:0}))}]});
   for(let j=0;j<4;j++)logs.push({...identity,timestamp:ts+j,logentry:'ANSWER = '+j});
  }
  await task('dto',{responses,logs});await task('new-db');const start=performance.now();let heartbeat=0;const timer=setInterval(()=>heartbeat++,20);
  try{await task('db-import');const summary=await task('db-summary'),integrity=await task('db-check'),page=await task('db-page',{pageSize:100}),checkpoint=await task('db-save'),xlsx=await task('db-export',{format:'xlsx'});
   let settled=false;const pending=task('db-import'),result=pending.then(()=>{settled=true;return 'completed';},error=>{settled=true;return error.name;});await new Promise(resolve=>setTimeout(resolve,20));if(settled)throw Error('Abort probe completed before cancellation');cancelTasks();const aborted=await result;
   await task('open-db',{bytes:checkpoint});const recovered=await task('db-summary');return {summary,integrity:integrity.ok,visibleRows:page.rows.length,totalRows:page.total,aborted,recovered,sqliteBytes:checkpoint.length,xlsx:Array.from(xlsx),heartbeat,milliseconds:performance.now()-start};
  }finally{clearInterval(timer);}
 }
};
