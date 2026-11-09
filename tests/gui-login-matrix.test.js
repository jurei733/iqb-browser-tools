import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepare} from '../src/preparation.js';
import {matrixRoot,matrixFiles,compareMatrixGeneration,compareMatrixReopen} from './helpers/gui-login-matrix.js';

const proof=JSON.parse(await readFile(new URL('proof.json',matrixRoot)));
for(const c of proof.cases)test(`native GUI ${c.id}: generation and saved-file reopening`,async()=>{
  const reference=await matrixFiles(c);
  const args={windows:true,file:{name:c.id+'.xlsx',bytes:reference.input},renew:true,createXml:true,loginOptions:c,xmlOptions:{booklet:'Booklet1',separate:c.separate}};
  await compareMatrixGeneration(c,(await prepare('logins',args)).outputs,reference);
  args.file.bytes=reference.native;args.renew=false;
  await compareMatrixReopen(c,(await prepare('logins',args)).outputs,reference);
});
test('direct native GUI matrix contains every option product exactly once and binds all retained files',async()=>{
  assert.equal(proof.cases.length,128);
  const keys=proof.cases.map(c=>JSON.stringify([c.length,c.passwordLength,c.monitor,c.separate,c.prefixTestee,c.prefixReserve,c.prefixReview]));
  assert.equal(new Set(keys).size,128);
  for(const c of proof.cases){
    const {files,names}=await matrixFiles(c);
    for(const path of ['inputs/'+c.id+'.xlsx',...['native','reopened'].flatMap(dir=>[dir+'/'+c.id+'.xlsx',...names.map(n=>dir+'/'+n)]),...['options','done','reopen-options','reopen-done'].map(stage=>'screens/'+c.id+'-'+stage+'.jpg')]){
      assert.ok(files[path],c.id+' missing '+path);
      assert.equal(createHash('sha256').update(files[path]).digest('hex'),proof.files[path],path+' SHA256');
    }
    for(const name of [...names,c.id+'.xlsx'])assert.deepEqual(files['native/'+name],files['reopened/'+name],c.id+' Windows did not change saved outputs');
  }
});
