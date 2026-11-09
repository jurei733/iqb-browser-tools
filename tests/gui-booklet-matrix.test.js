import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepare} from '../src/preparation.js';
import {messageText,windowsTextBytes} from '../src/diagnostics.js';
import {bookletMatrixRoot,bookletMatrixFiles,compareBookletText,compareBookletXML} from './helpers/gui-booklet-matrix.js';
const proof=JSON.parse(await readFile(new URL('proof.json',bookletMatrixRoot)));
for(const c of proof.cases)test(`native Booklet GUI ${c.id}: full messages, XML and output decision`,async()=>{
 const files=await bookletMatrixFiles(c),messages=[];let result,error;
 try{result=await prepare('booklets',{windows:true,file:{name:c.input,bytes:files['inputs/'+c.input]}},m=>messages.push(m));}catch(e){error=e;}
 assert.equal(!!error,!c.outputs.length);compareBookletText(windowsTextBytes(messageText(messages)),files['native/'+c.id+'.txt']);
 if(result)compareBookletXML(c,result.outputs,files);
});
test('native Booklet matrix binds every input, output, complete text and dialog capture',async()=>{
 assert.equal(proof.cases.length,66);assert.equal(new Set(proof.cases.slice(0,64).map(c=>JSON.stringify(c.faults))).size,64);
 for(const c of proof.cases){const files=await bookletMatrixFiles(c);for(const path of ['inputs/'+c.input,'native/'+c.id+'.txt',...c.outputs.map(n=>c.xmlPrefix+n),...['done','text'].map(stage=>'screens/'+c.id+'-'+stage+'.jpg')])assert.equal(createHash('sha256').update(files[path]).digest('hex'),proof.files[path],path+' SHA256');}
});
