import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await mkdir('work',{recursive:true});
for(const [script,args]of [
  ['scripts/analyze-windows-differential.mjs',['work/windows-differential.json']],
  ['scripts/compare-windows-converters.mjs',['tests/fixtures/windows-reference/windows-results/original-windows.json','work/reference-converters.json']],
  ['scripts/compare-windows-files.mjs',['tests/fixtures/windows-reference/windows-results','work/reference-files.json','tests/fixtures/windows-reference/inputs']]
]){
  const result=spawnSync(process.execPath,[script,...args],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status){process.exitCode=result.status;break;}
}
