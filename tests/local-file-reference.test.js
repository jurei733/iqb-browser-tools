import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreForm,formSnapshot,packForm} from '../src/form-state.js';
import {refreshLocalInputs} from '../src/local-connection.js';

test('local file references survive native File wrappers without custom properties, refresh and replacement',async t=>{
  const previous=globalThis.DataTransfer;
  // Native file lists may return File wrappers without application properties.
  globalThis.DataTransfer=class {files=[];items={add:file=>this.files.push(new File([file],file.name,{type:file.type,lastModified:file.lastModified}))};};
  t.after(()=>{globalThis.DataTransfer=previous;});
  const input={id:'file',type:'file',files:[],dispatchEvent(){}};
  const panel={querySelector:()=>input,querySelectorAll:()=>[input]};
  const reference={workspace:'/approved',path:'source.xlsx'};
  restoreForm(panel,[{id:'file',type:'file',files:[{name:'source.xlsx',bytes:new Uint8Array([1]),iqbLocalReference:reference}]}]);
  assert.equal(input.files[0].iqbLocalReference,undefined,'native wrappers omit custom properties');
  let snapshot=await packForm(formSnapshot(panel));
  assert.deepEqual(snapshot[0].files[0].iqbLocalReference,reference);
  let reads=0;
  await refreshLocalInputs(panel,{config:{workspace:{path:'/approved'}},async file(path){reads++;assert.equal(path,'source.xlsx');const file=new File([new Uint8Array([2])],path);file.iqbLocalReference=reference;return file;}});
  assert.equal(reads,1);
  snapshot=await packForm(formSnapshot(panel));
  assert.deepEqual(snapshot[0].files[0].iqbLocalReference,reference);
  assert.deepEqual([...snapshot[0].files[0].bytes],[2]);
  input.files=[new File(['user selection'],'other.xlsx')];
  snapshot=await packForm(formSnapshot(panel));
  assert.equal(snapshot[0].files[0].iqbLocalReference,undefined,'new user selection must not inherit an old path');
  assert.equal(snapshot[0].files[0].name,'other.xlsx');
  input.files=[];
  assert.deepEqual(formSnapshot(panel)[0].files,[]);
});
