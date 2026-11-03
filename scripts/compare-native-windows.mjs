import {readFile,writeFile} from 'node:fs/promises';
import {DOMParser} from '@xmldom/xmldom';
import {verifyNativeWindows,assertNativeRegressionScope} from './native-windows-checks.mjs';
globalThis.DOMParser=DOMParser;
const path=process.argv[2]||'tests/fixtures/windows-native/reference.json',output=process.argv[3]||'work/native-windows-comparison.json';
const bundle=JSON.parse(await readFile(path,'utf8')),report=await verifyNativeWindows(bundle,new Uint8Array(await readFile('tests/fixtures/windows-edge/coding-inputs.json')));
await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));
const failures=[...report.checks,...report.api,...report.codec].filter(c=>!c.passed);if(failures.length){console.log('Native parity failures:',failures.length,JSON.stringify(failures.slice(0,6),null,2));if(process.argv.includes('--allow-documented-x86-gap')){assertNativeRegressionScope(report);console.log('::warning::Two x86 G17 string differences for one binary-identical number remain open. They are not counted as equal.');}else process.exitCode=1;}
