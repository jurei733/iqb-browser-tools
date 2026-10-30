import {build} from 'vite';
import {cp,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]||'work/browser-tests');
await build({base:'/',build:{outDir:out,emptyOutDir:true,rollupOptions:{input:fileURLToPath(new URL('../tests/browser.html',import.meta.url))}}});
await mkdir(out+'/fixtures',{recursive:true});
await cp(new URL('../tests/fixtures/',import.meta.url),out+'/fixtures',{recursive:true});
console.log('Browser tests:',out+'/tests/browser.html');
