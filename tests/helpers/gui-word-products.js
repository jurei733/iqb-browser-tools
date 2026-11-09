import {readFile} from 'node:fs/promises';import {unzipSync} from 'fflate';
export const wordProductsRoot=new URL('../fixtures/gui-word-products-20261109/',import.meta.url);
const cache=new Map();
export async function wordProductFiles(c){const id=String(Math.floor(c.sequence/4)).padStart(2,'0');if(!cache.has(id))cache.set(id,unzipSync(await readFile(new URL('cases-'+id+'.zip',wordProductsRoot))));return cache.get(id);}
