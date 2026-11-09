// Package retained native files; no GUI control or assembly-harness execution.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';import {zipSync} from 'fflate';
const root=resolve(process.argv[2]||'work/gui-word-products-20261109'),target=resolve('tests/fixtures/gui-word-products-20261109');
const successful=JSON.parse(await readFile(join(root,'completed.json'))),special=JSON.parse(await readFile(join(root,'special.json'))),transferred=JSON.parse(await readFile(join(root,'transferred.json'))),screens=await readdir(join(root,'screens'));
assert.equal(successful.length,15);assert.equal(special.length,2);
const cases=[...successful.map(c=>({...c,count:c.count??9,kind:'export'})),...special.map(c=>({...c,kind:c.id==='W12'?'empty-input':'invalid-template'}))].sort((a,b)=>a.id.localeCompare(b.id));assert.equal(new Set(cases.map(c=>c.id)).size,17);
const files={},bundles=[],sha=b=>createHash('sha256').update(b).digest('hex');await mkdir(target,{recursive:true});
for(let start=0;start<17;start+=4){const entries={};
 for(const c of cases.slice(start,start+4)){
  c.sequence=Number(c.id.slice(1));c.screens=screens.filter(s=>s.startsWith(c.id+'-')).map(s=>'screens/'+s);assert.ok(c.screens.length);
  const paths=['inputs/'+c.input,...(c.template?['inputs/'+c.template]:[]),...(c.file?['native/'+c.file]:[]),...c.screens];
  for(const path of paths){entries[path]=await readFile(join(root,path));files[path]=sha(entries[path]);}
  for(const name of [c.input,c.template].filter(Boolean))assert.equal(files['inputs/'+name],transferred.find(f=>f.file===name).sha256);
  if(c.file)assert.equal(files['native/'+c.file],c.sha256);
 }
 const file='cases-'+String(start/4).padStart(2,'0')+'.zip',bytes=zipSync(entries,{level:6});await writeFile(join(target,file),bytes);bundles.push({file,bytes:bytes.length,sha256:sha(bytes)});
}
const proof={date:'2026-11-09',original:{name:'itc-ToolBox',version:'3.3.0.2',sha256:'c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1'},method:'Visible native Windows file, template and output dialogs; generated DOCX files pulled through UTM guest-file transfer. Every source/template first transferred and read back byte-identically. No native assembly invocation replaces these GUI runs.',cases,files,bundles,comparison:'Full Word document XML element/attribute/text trees and BMP payload hashes. Namespace declarations and internal identifier values normalized; image relationships resolved to their exact BMP SHA256. All paragraph content, order, section placement, geometry, picture-frame properties and control structure retained.',corrections:['Shared-string password read failure clears mode in Windows Word output.','Stop at first missing group and emit groups in first-seen order, retaining their first labels.','Preserve natural QR size with a 4 cm maximum and native Single DPI arithmetic.','Use QRCoder 1.4.3 mask penalty/tie behavior; QR BMP bytes match.','Permit empty/no-tag templates in Windows mode; preserve section order and original picture-frame properties.','Match minimum server-address message and disable Word export for zero readable logins.'],qualifiedDifference:'W14: original reports completed and copies a corrupt template unchanged; browser explicitly rejects invalid DOCX rather than offering a corrupt file as successful output. W15 proves native recovery after that original failure.',limits:['Synthetic data only; no empirical study files.','17 finite GUI scenarios: two original templates × four server variants plus group, template, validation, cancellation and recovery cases.','Not an exhaustive proof of arbitrary DOCX files, Word rendering engines, Unicode QR payloads or every link length.','ZIP bytes, volatile IDs and namespace spelling are not claimed byte-identical.']};
await writeFile(join(target,'proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,successful:successful.length,files:Object.keys(files).length,bytes:bundles.reduce((n,b)=>n+b.bytes,0)}));
