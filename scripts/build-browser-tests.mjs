import {build} from 'vite';
import {cp,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const out=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('../../../work/cross-browser/',import.meta.url));
await build({base:'/',build:{outDir:out,emptyOutDir:true,rollupOptions:{input:fileURLToPath(new URL('../tests/browser.html',import.meta.url))}}});
await mkdir(out+'/fixtures',{recursive:true});
await cp(new URL('../tests/fixtures/',import.meta.url),out+'/fixtures',{recursive:true});
console.log('Browser tests:',out+'/tests/browser.html');
