import {readFile,writeFile} from 'node:fs/promises';
import {DOMParser} from '@xmldom/xmldom';
import {verifyNativeWindows} from './native-windows-checks.mjs';
globalThis.DOMParser=DOMParser;
const path=process.argv[2]||'tests/fixtures/windows-native/reference.json',output=process.argv[3]||'work/native-windows-comparison.json';
const bundle=JSON.parse(await readFile(path,'utf8')),report=await verifyNativeWindows(bundle,new Uint8Array(await readFile('tests/fixtures/windows-edge/coding-inputs.json')));
await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));
const failures=[...report.checks,...report.api,...report.codec,...report.numericChecks].filter(c=>!c.passed);if(failures.length){console.log('Native parity failures:',failures.length,JSON.stringify(failures.slice(0,6),null,2));process.exitCode=1;}
if(process.argv.includes('--require-numeric-probes')&&!report.summary.numericDiagnostics.uniqueInputs)throw new Error('Fresh numeric diagnostics are required');
