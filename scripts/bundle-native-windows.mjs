import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const directory=process.argv[2]||'work/native-windows',hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bundle={runId:process.env.GITHUB_RUN_ID,commit:process.env.GITHUB_SHA,inputsSHA256:hash(await readFile(directory+'/inputs.json')),rawCaptures:{},captureHashes:{}};
for(const name of ['native-32','native-64','native-coding'])try{const bytes=await readFile(directory+'/'+name+'.json');JSON.parse(bytes);bundle.rawCaptures[name]=bytes.toString('base64');bundle.captureHashes[name]=hash(bytes);}catch(error){if(error.code!=='ENOENT')throw error;console.log('Missing native capture:',name);}
const bytes=Buffer.from(JSON.stringify(bundle));await writeFile(directory+'/bundle.json',bytes);
// Synthetic data, lossless transport, no token or repository write permission.
console.log('IQB_NATIVE_GZIP:'+gzipSync(bytes).toString('base64'));
console.log('IQB_NATIVE_SHA256:'+hash(bytes));
