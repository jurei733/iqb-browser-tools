import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]||'work/testcenter-tests');
await build({base:'/',build:{outDir:out,emptyOutDir:true,rollupOptions:{input:fileURLToPath(new URL('../tests/testcenter.html',import.meta.url))}}});
console.log('Integration tests:',out+'/tests/testcenter.html');
