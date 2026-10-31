// Files are immutable browser snapshots; no absolute filesystem path is stored.
export const restorableTools=new Set(['booklets','logins','csv','responses','docx']);
export function formSnapshot(panel){return Array.from(panel.querySelectorAll('input,select,textarea')).filter(el=>el.id&&el.type!=='password').map(el=>({id:el.id,type:el.type,value:el.type==='file'?'':el.value,checked:el.checked,files:el.type==='file'?Array.from(el.files):undefined}));}
export function restoreForm(panel,fields){
 for(const saved of fields||[]){const input=panel.querySelector('#'+saved.id);if(!input||input.type==='password')continue;if(input.type==='file'){const transfer=new DataTransfer();for(const file of saved.files||[])transfer.items.add(file);input.files=transfer.files;}else{input.value=saved.value;if(input.type==='checkbox'||input.type==='radio')input.checked=saved.checked;}}
 for(const input of panel.querySelectorAll('input,select,textarea'))input.dispatchEvent(new Event('change',{bubbles:true}));
}
