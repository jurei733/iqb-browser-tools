import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepare} from '../src/preparation.js';
import {loadWorkbook,loginRows} from '../src/toolbox.js';
import {loginRowsShape,loginXMLTree} from './helpers/native-logins.js';
const root=new URL('./fixtures/gui-login-boundaries-20261109/',import.meta.url);
const proof=JSON.parse(await readFile(new URL('proof.json',root))),source=await readFile(new URL('existing.xlsx',root));
const args=c=>({windows:true,file:{name:c.id+'.xlsx',bytes:source},renew:true,createXml:true,loginOptions:{length:c.length,passwordLength:c.passwordLength,monitor:c.monitor,prefixTestee:c.allPrefixes,prefixReserve:c.allPrefixes,prefixReview:c.allPrefixes},xmlOptions:{booklet:c.booklet,separate:c.separate}});
for(const c of proof.cases)test(`native GUI ${c.id}: long or invalid password lengths match Windows rows and XML`,async()=>{
 const {outputs}=await prepare('logins',args(c));
 const shape={length:c.parsedLength,passwordLength:c.parsedPasswordLength};
 assert.deepEqual(loginRowsShape(loginRows(await loadWorkbook(outputs['Logins-browser.xlsx'])),shape),loginRowsShape(loginRows(await loadWorkbook(await readFile(new URL(c.id+'/'+c.id+'.xlsx',root)))),shape));
 assert.deepEqual(loginXMLTree(outputs[c.id+'.xml'],{renew:true,...shape}),loginXMLTree(await readFile(new URL(c.id+'/'+c.id+'.xml',root)),{renew:true,...shape}));
});
for(const value of proof.invalidLoginValues)test(`native GUI rejects login length ${value} with original message`,async()=>{
 const a=args(proof.cases[2]);a.loginOptions.length=value;
 await assert.rejects(prepare('logins',a),{message:proof.invalidLoginMessage});
});
test('native boundary evidence binds input, six export pairs and all retained GUI captures',async()=>{
 const sha=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(sha(source),proof.inputSHA256);
 for(const c of proof.cases)for(const f of c.files)assert.equal(sha(await readFile(new URL(f.file,root))),f.sha256);
 for(const f of proof.screenshots)assert.equal(sha(await readFile(new URL('../docs/evidence/gui-login-boundaries-20261109/'+f.file,import.meta.url))),f.sha256);
});
