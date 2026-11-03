import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalApp,systemIdentity} from '../scripts/lib/local-server.mjs';

async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'iqb-local-')),dist=join(root,'dist'),workspace=join(root,'work');await mkdir(dist);await mkdir(workspace);await writeFile(join(dist,'index.html'),'<h1>IQB</h1>');
  const app=await createLocalApp({dist,workspace,configFile:join(root,'config','local.json'),identity:{name:'tester',account:'DOMAIN\\tester',source:'Windows-Anmeldekonto'}});
  t.after(async()=>{await app.close();await rm(root,{recursive:true,force:true});});
  const config=await (await fetch(app.url+'/api/local/config')).json();
  const request=(path,options={})=>fetch(app.url+'/api/local/'+path,{...options,headers:{'X-IQB-Local-Token':config.token,...options.headers}});
  const suffix='workspace='+config.workspace.id;return {root,dist,workspace,app,config,request,suffix};
}
test('local starter: Windows identity comes from whoami, local fallback remains explicit',async()=>{
  const calls=[];assert.deepEqual(await systemIdentity({system:'win32',username:'fallback',execute:async(...args)=>{calls.push(args);return {stdout:'SCHOOL\\alice\r\n'};}}),{name:'alice',account:'SCHOOL\\alice',source:'Windows-Anmeldekonto'});assert.equal(calls[0][0],'whoami.exe');assert.deepEqual(calls[0][1],[]);
  assert.deepEqual(await systemIdentity({system:'win32',username:'local',execute:async()=>{throw Error('unavailable');}}),{name:'local',account:'local',source:'Lokales Betriebssystemkonto'});
});
test('local starter: rereads real files, overwrites results in place and serializes writes',async t=>{
  const f=await fixture(t);await mkdir(join(f.workspace,'nested'));await writeFile(join(f.workspace,'nested','Answers.csv'),'old');
  const rows=await (await f.request('files?'+f.suffix)).json();assert.deepEqual(rows,[{name:'Answers.csv',path:'nested/Answers.csv'}]);
  const endpoint='file?path=nested%2FAnswers.csv&'+f.suffix;assert.equal(await (await f.request(endpoint)).text(),'old');await writeFile(join(f.workspace,'nested','Answers.csv'),'new');assert.equal(await (await f.request(endpoint)).text(),'new');
  for(const value of ['first','second'])assert.equal((await f.request('result?path=nested%2FExisting.result&'+f.suffix,{method:'PUT',body:value})).status,200);
  assert.equal(await readFile(join(f.workspace,'nested','Existing.result'),'utf8'),'second');assert.equal((await (await f.request('files?'+f.suffix)).json()).filter(f=>f.name.includes('.result')).length,1);
});
test('local starter: rejects foreign origins, CSRF, path traversal and unapproved file writes',async t=>{
  const f=await fixture(t);assert.equal((await f.request('files?'+f.suffix,{headers:{Origin:'https://evil.invalid'}})).status,403);assert.equal((await fetch(f.app.url+'/api/local/config',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);assert.equal((await fetch(f.app.url+'/api/local/files?'+f.suffix)).status,403);
  for(const path of ['../escape.result','a/../escape.result','/escape.result','a\\escape.result','script.mjs','a//escape.result'])assert.ok((await f.request('result?path='+encodeURIComponent(path)+'&'+f.suffix,{method:'PUT',body:'x'})).status>=400,path);
  assert.equal((await f.request('file?path=..%2Fconfig%2Flocal.json&'+f.suffix)).status,400);
  assert.equal((await f.request('files?workspace=unknown')).status,403);
});
test('local starter: skips symlink directories and never overwrites a symlink target',async t=>{
  const f=await fixture(t),outside=join(f.root,'outside');await mkdir(outside);await writeFile(join(outside,'private.csv'),'private');
  try{await symlink(outside,join(f.workspace,'linked'),process.platform==='win32'?'junction':'dir');await symlink(join(outside,'private.csv'),join(f.workspace,'bad.result'),'file');}catch(e){if(e.code==='EPERM'){t.skip('Creating file symlinks needs Windows Developer Mode.');return;}throw e;}
  assert.deepEqual(await (await f.request('files?'+f.suffix)).json(),[]);assert.equal((await f.request('file?path=linked%2Fprivate.csv&'+f.suffix)).status,403);assert.equal((await f.request('result?path=bad.result&'+f.suffix,{method:'PUT',body:'bad'})).status,403);assert.equal(await readFile(join(outside,'private.csv'),'utf8'),'private');
});
test('local starter: remembers only an explicitly selected path and restores it after restart',async t=>{
  const f=await fixture(t);assert.equal((await f.request('connect',{method:'POST',body:JSON.stringify({path:f.workspace,remember:true})})).status,200);const configFile=join(f.root,'config','local.json');assert.deepEqual(JSON.parse(await readFile(configFile,'utf8')),{workspace:await import('node:fs/promises').then(fs=>fs.realpath(f.workspace))});
  const restarted=await createLocalApp({dist:f.dist,configFile});try{const config=await (await fetch(restarted.url+'/api/local/config')).json();assert.equal(config.workspace.path,f.config.workspace.path);}finally{await restarted.close();}
  assert.equal((await f.request('forget',{method:'POST'})).status,200);await assert.rejects(readFile(configFile),{code:'ENOENT'});assert.equal(await readFile(join(f.dist,'index.html'),'utf8'),'<h1>IQB</h1>');
});

test('local starter: actual OS account is available on this platform',async()=>{
  const identity=await systemIdentity();assert.ok(identity.name.trim());
  if(process.platform==='win32'){const {execFileSync}=await import('node:child_process');const account=execFileSync('whoami.exe',[],{encoding:'utf8'}).trim();assert.equal(identity.account,account);assert.equal(identity.name,account.slice(account.indexOf('\\')+1));assert.equal(identity.source,'Windows-Anmeldekonto');}
  else{const {userInfo}=await import('node:os');assert.equal(identity.name,userInfo().username);assert.equal(identity.account,userInfo().username);}
});
