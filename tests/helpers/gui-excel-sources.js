import {readFile} from 'node:fs/promises';import {unzipSync} from 'fflate';
export const excelSourcesRoot=new URL('../fixtures/gui-excel-sources-20261109/',import.meta.url);const cache=new Map();
export async function excelSourceFiles(c){const name=c?'cases-'+String(Math.floor(c.sequence/4)).padStart(2,'0')+'.zip':'inputs.zip';if(!cache.has(name))cache.set(name,unzipSync(await readFile(new URL(name,excelSourcesRoot))));return cache.get(name);}
