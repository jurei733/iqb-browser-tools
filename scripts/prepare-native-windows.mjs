import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {nativeConverterCorpus,nativePipelineCases} from './windows-native-corpus.mjs';
const directory=resolve(process.argv[2]||'work/native-windows');await mkdir(directory,{recursive:true});
await writeFile(directory+'/inputs.json',JSON.stringify(nativeConverterCorpus()));
await writeFile(directory+'/coding-inputs.json',await readFile('tests/fixtures/windows-edge/coding-inputs.json'));
await writeFile(directory+'/pipeline-inputs.json',JSON.stringify(nativePipelineCases()));
console.log('Native Windows input count:',nativeConverterCorpus().length);
