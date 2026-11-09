// The optional starter serves this app and its API on the same loopback origin.
// Hosted pages never probe or connect to a separate local service.
import {inputFiles,setInputFiles} from './file-inputs.js';
export async function discoverLocalConnection(){
  if(globalThis.location?.hostname!=='127.0.0.1')return null;
  try{const response=await fetch('/api/local/config',{cache:'no-store'});if(!response.ok)return null;const config=await response.json();if(config.protocol!=='iqb-local-v1'||typeof config.token!=='string')return null;return new LocalConnection(config);}catch{return null;}
}
export class LocalConnection {
  constructor(config){this.config=config;}
  async request(path,{method='GET',body,workspace}={}){
    const url=new URL('/api/local/'+path,location.origin);if(workspace)url.searchParams.set('workspace',workspace);
    const response=await fetch(url,{method,body,cache:'no-store',headers:{'X-IQB-Local-Token':this.config.token}});
    if(!response.ok){let message='Die lokale Verbindung ist unterbrochen.';try{message=(await response.json()).error||message;}catch{}throw new Error(message);}return response;
  }
  async connect(path,remember){const response=await this.request('connect',{method:'POST',body:JSON.stringify({path,remember})});const workspace=await response.json();this.config.workspace=workspace;return workspace;}
  async forget(){await this.request('forget',{method:'POST'});this.config.workspace=null;}
  async list(workspace=this.config.workspace){if(!workspace)throw new Error('Bitte zuerst einen lokalen Arbeitsordner verbinden.');return (await this.request('files',{workspace:workspace.id})).json();}
  async file(path,workspace=this.config.workspace){
    if(!workspace)throw new Error('Bitte zuerst einen lokalen Arbeitsordner verbinden.');const response=await this.request('file?path='+encodeURIComponent(path),{workspace:workspace.id}),bytes=await response.arrayBuffer();
    const file=new File([bytes],path.split('/').at(-1));file.iqbLocalReference={workspace:workspace.path,path};return file;
  }
  workspace(workspace=this.config.workspace){return new LocalWorkspace(this,workspace);}
}
export class LocalWorkspace {
  constructor(connection,workspace){this.connection=connection;this.root=workspace;this.pending=Promise.resolve();this.targets=new Map();}
  async files(){const entries=(await this.connection.list(this.root)).filter(f=>/\.(zip|xml|png|jpe?g|tiff?|bmp|gif|webp|result(?:-\d+)?)$/i.test(f.name));return Promise.all(entries.map(async entry=>{const file=await this.connection.file(entry.path,this.root);return {name:entry.name,webkitRelativePath:entry.path,arrayBuffer:()=>file.arrayBuffer()};}));}
  save(label,bytes,id){
    const path=this.targets.get(id)||((String(label).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150)||'Kodierung')+'.result'),copy=new Uint8Array(bytes);
    const result=this.pending.catch(()=>{}).then(async()=>{await this.connection.request('result?path='+encodeURIComponent(path),{method:'PUT',body:copy,workspace:this.root.id});return path;});this.pending=result;return result;
  }
}
export async function refreshLocalInputs(panel,connection){
  const inputs=Array.from(panel.querySelectorAll('input[type=file]')).filter(input=>inputFiles(input).some(file=>file.iqbLocalReference));
  try{
    const replacements=await Promise.all(inputs.map(async input=>[input,await Promise.all(inputFiles(input).map(file=>{const ref=file.iqbLocalReference;if(!ref)return file;if(ref.workspace!==connection.config.workspace?.path)throw new Error('Der gespeicherte Dateipfad gehört zu einem anderen Arbeitsordner. Bitte die Datei neu auswählen.');return connection.file(ref.path);}))]));
    for(const [input,files]of replacements){setInputFiles(input,files);input.dispatchEvent(new Event('change',{bubbles:true}));}
  }catch(error){for(const input of inputs)input.value='';throw error;}
}
export function installLocalFileInputs(connection,{notify}){
  const enhanced=new WeakSet();
  async function choose(input){
    try{
      const entries=await connection.list();const accepts=(input.accept||'').split(',').filter(s=>s.startsWith('.'));
      const available=entries.filter(f=>!accepts.length||accepts.some(extension=>f.name.toLowerCase().endsWith(extension.toLowerCase())));
      if(!available.length)throw new Error('Im verbundenen Arbeitsordner wurde keine passende Datei gefunden.');
      const dialog=document.createElement('dialog');dialog.className='local-file-dialog';const title=document.createElement('h2');title.textContent='Dateien aus dem Arbeitsordner';dialog.append(title);
      const description=document.createElement('p');description.textContent=connection.config.workspace.path;dialog.append(description);const list=document.createElement('div');list.className='local-file-list';dialog.append(list);
      for(const entry of available){const label=document.createElement('label'),field=document.createElement('input');field.type=input.multiple?'checkbox':'radio';field.name='local-file';field.value=entry.path;label.append(field,document.createTextNode(entry.path));list.append(label);}
      const apply=document.createElement('button');apply.type='button';apply.className='primary';apply.textContent='Ausgewählte Dateien öffnen';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Abbrechen';dialog.append(apply,cancel);
      cancel.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());apply.onclick=async()=>{apply.disabled=true;try{const paths=Array.from(list.querySelectorAll('input:checked')).map(el=>el.value);if(!paths.length)throw new Error('Bitte mindestens eine Datei auswählen.');const files=await Promise.all(paths.map(path=>connection.file(path)));setInputFiles(input,files);input.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();}catch(e){notify(e.message,true);}finally{apply.disabled=false;}};document.body.append(dialog);dialog.showModal();
    }catch(e){notify(e.message,true);}
  }
  function enhance(){for(const input of document.querySelectorAll('.tool-main input[type=file]')){if(enhanced.has(input))continue;enhanced.add(input);const button=document.createElement('button');button.type='button';button.className='local-file-button secondary';button.dataset.localInput=input.id;button.textContent='Aus Arbeitsordner wählen';button.onclick=()=>choose(input);const reference=document.createElement('small');reference.className='local-file-reference';const show=()=>{reference.textContent=inputFiles(input).map(file=>file.iqbLocalReference).filter(Boolean).map(ref=>ref.workspace+'/'+ref.path).join(' · ');};input.addEventListener('change',show);input.closest('label')?.after(button,reference);show();}}
  const observer=new MutationObserver(enhance);observer.observe(document.querySelector('#app'),{childList:true,subtree:true});enhance();return()=>observer.disconnect();
}
