// Regenerate the browser→Windows inputs from the currently checked-out code.
// Original executable assemblies are deliberately not included in the repository.
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import initSqlJs from 'sql.js';
import {decodeResult,encodeResult} from '../src/coding.js';
import {normalizePeople} from '../src/data.js';
import {OutputDatabase} from '../src/database.js';
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const destination=resolve(process.argv[2]||'work/windows-reference-inputs');
await mkdir(destination,{recursive:true});
await cp(new URL('../tests/fixtures/windows-reference/inputs/',import.meta.url),destination,{recursive:true});
const old=decodeResult(await readFile(join(destination,'browser.result')));
const job={id:old.id,label:old.label,cases:old.entries.map(e=>({...e,variable:{id:e.variable}}))};
await writeFile(join(destination,'browser.result'),encodeResult(job,old.coder,old.globalComment));
const db=new OutputDatabase(await initSqlJs());
try{db.import(normalizePeople(JSON.parse(await readFile(join(destination,'people.json'),'utf8'))));await writeFile(join(destination,'browser.sqlite'),db.export());}finally{db.close();}
console.log('Current browser reference inputs:',destination);

const nullable=new OutputDatabase(await initSqlJs());try{const data=normalizePeople(JSON.parse(await readFile(join(destination,'people.json'),'utf8')));const response=data[0].booklets[0].units[0].subforms[0].responses[0];response.code=null;response.score=null;nullable.import(data);await writeFile(join(destination,'browser-windows-nullable.sqlite'),nullable.exportWindows());}finally{nullable.close();}
