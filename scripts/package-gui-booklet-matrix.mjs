// Package captured files only; no GUI control or native reference execution.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {zipSync} from 'fflate';
const root=resolve(process.argv[2]||'work/gui-booklet-matrix-20261109'),target=resolve('tests/fixtures/gui-booklet-matrix-20261109');
const done=JSON.parse(await readFile(join(root,'completed.json'))),plan=JSON.parse(await readFile(join(root,'inputs/booklet-matrix.json')));
const transferred=[...JSON.parse(await readFile(join(root,'transferred.json'))),...JSON.parse(await readFile(join(root,'extras-transferred.json')))];
assert.equal(done.length,66);assert.equal(new Set(done.map(c=>c.id)).size,66);
await mkdir(target,{recursive:true});const files={},cases=[],bundles=[];
const sha=b=>createHash('sha256').update(b).digest('hex');
for(let start=0;start<66;start+=8){const entries={};
  for(let n=start;n<Math.min(start+8,66);n++){
    const c=done[n];assert.equal(c.id,'B'+String(n).padStart(2,'0'));
    const outputs=n===0?['bookletTHETLK.xml']:n>=64?['bookletMETA_A.xml','bookletMETA_B.xml']:[];
    const paths=['inputs/'+c.input,'native/'+c.id+'.txt',...outputs.map(name=>'native/'+(n>=64?c.id+'/':'')+name),...['done','text'].map(stage=>'screens/'+c.id+'-'+stage+'.jpg')];
    for(const path of paths){entries[path]=await readFile(join(root,path));files[path]=sha(entries[path]);}
    assert.equal(files['inputs/'+c.input],transferred.find(t=>t.file===c.input).sha256);
    assert.equal(files['native/'+c.id+'.txt'],c.textSHA256);
    cases.push({id:c.id,sequence:n,input:c.input,outputs,xmlPrefix:'native/'+(n>=64?c.id+'/':''),faults:plan.cases[n]?.faults||[],scenario:n<64?'validation-product':n===64?'multiple-booklets-metadata-recovery':'absent-versus-empty-label-cells'});
  }
  const file='cases-'+String(start/8).padStart(2,'0')+'.zip',bytes=zipSync(entries,{level:6});await writeFile(join(target,file),bytes);bundles.push({file,sha256:sha(bytes),bytes:bytes.length});
}
const proof={date:'2026-11-09',original:{name:'itc-ToolBox',version:'3.3.0.2',sha256:'c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1'},method:'Visible original Windows GUI: file chooser, completed validation dialog, Texteditor command, native Notepad Save As, guest-file transfer. Every input transferred and read back byte-identically first. Preliminary B00/B01 observations were repeated for the retained sequence.',axes:plan.axes,cases,files,bundles,comparison:'Complete UTF-16LE/CRLF message export including BOM; only the native directory prefix is removed. Full XML element/attribute trees, retaining the distinction between absent and empty attributes. Error/output decisions match.',correction:'Retain XML cell presence: absent Testlet title cells omit label; existing empty cells emit label="". The extended mode remains unchanged.',recovery:'After all six faults in B63, B64 and B65 succeed in the same original process with corrected copies, two booklets, distinct descriptions, Unicode/XML escaping, and inverted absent/empty title cells.',screenshots:'Two native full-desktop screenshots per case, resized to 1512 pixels; completed Booklet dialog and full message text in Notepad. Long text is also retained as its complete UTF-16LE file.',limits:['All data synthetic, no empirical study files.','64 combinations of six specific validation faults plus two valid follow-ups; not every possible Workbook schema or failure.','Other GUI families remain separately listed.']};
await writeFile(join(target,'proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({cases:66,files:Object.keys(files).length,bundles:bundles.length,bytes:bundles.reduce((n,b)=>n+b.bytes,0)}));
