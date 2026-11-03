import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {converterCorpus} from './converter-corpus.mjs';
import {windowsEdgeCorpus} from './windows-edge-corpus.mjs';
import {windowsNumberCorpus} from './windows-number-corpus.mjs';
const directory=resolve(process.argv[2]||'work/native-windows');await mkdir(directory,{recursive:true});
const unique=new Map();
for(const [group,fixtures]of [['base',converterCorpus()],['edges',windowsEdgeCorpus()],['numbers',windowsNumberCorpus()]])for(const fixture of fixtures){
 const key=JSON.stringify([fixture.method,fixture.contentJSON]);let item=unique.get(key);
 if(!item){item={id:createHash('sha256').update(key).digest('hex'),method:fixture.method,contentJSON:fixture.contentJSON,sources:[]};unique.set(key,item);}
 item.sources.push({group,id:fixture.id});
}
await writeFile(directory+'/inputs.json',JSON.stringify([...unique.values()]));
await writeFile(directory+'/coding-inputs.json',await readFile('tests/fixtures/windows-edge/coding-inputs.json'));
console.log('Native Windows input count:',unique.size);
