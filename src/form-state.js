// Online: immutable file snapshots. Local starter: an explicit workspace/path reference can be refreshed.
import {inputFiles,setInputFiles} from './file-inputs.js';
export const restorableTools=new Set(['booklets','logins','csv','responses','docx']);
export function formSnapshot(panel){return Array.from(panel.querySelectorAll('input,select,textarea')).filter(el=>el.id&&el.type!=='password').map(el=>({id:el.id,type:el.type,value:el.type==='file'?'':el.value,checked:el.checked,files:el.type==='file'?inputFiles(el):undefined}));}
export async function packForm(fields){return Promise.all(fields.map(async field=>({...field,files:field.files?await Promise.all(field.files.map(async file=>({name:file.name,type:file.type,lastModified:file.lastModified,iqbLocalReference:file.iqbLocalReference,bytes:new Uint8Array(await file.arrayBuffer())}))):undefined})));}
export function restoreForm(panel,fields){
 for(const saved of fields||[]){const input=panel.querySelector('#'+saved.id);if(!input||input.type==='password')continue;if(input.type==='file'){const files=[];for(const file of saved.files||[]){const restored=file.bytes?new File([file.bytes],file.name,{type:file.type,lastModified:file.lastModified}):file;if(file.iqbLocalReference)restored.iqbLocalReference=file.iqbLocalReference;files.push(restored);}setInputFiles(input,files);}else{input.value=saved.value;if(input.type==='checkbox'||input.type==='radio')input.checked=saved.checked;}}
 for(const input of panel.querySelectorAll('input,select,textarea'))input.dispatchEvent(new Event('change',{bubbles:true}));
}
