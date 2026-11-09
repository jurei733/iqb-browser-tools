import {readFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import assert from 'node:assert/strict';
import {loginXMLTree} from './native-logins.js';
export const bookletMatrixRoot=new URL('../fixtures/gui-booklet-matrix-20261109/',import.meta.url);
const cache=new Map();
export async function bookletMatrixFiles(c){const bundle=String(Math.floor(c.sequence/8)).padStart(2,'0');if(!cache.has(bundle))cache.set(bundle,unzipSync(await readFile(new URL('cases-'+bundle+'.zip',bookletMatrixRoot))));return cache.get(bundle);}
export function compareBookletText(actual,native){assert.deepEqual(Buffer.from(actual),Buffer.from(Buffer.from(native).toString('utf16le').replaceAll('C:\\Users\\IQB\\Documents\\',''),'utf16le'));}
export function compareBookletXML(c,outputs,files){assert.deepEqual(Object.keys(outputs),c.outputs);for(const name of c.outputs)assert.deepEqual(loginXMLTree(outputs[name]),loginXMLTree(files[c.xmlPrefix+name]),c.id+' '+name);}
