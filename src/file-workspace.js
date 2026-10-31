const supported=/\.(zip|xml|png|jpe?g|tiff?|bmp|gif|webp|result(?:-\d+)?)$/i;
export class FileWorkspace {
  constructor(directory){this.directory=directory;this.pending=Promise.resolve();}
  async files(){
    const files=[];
    const walk=async(dir,prefix='')=>{for await(const [name,handle]of dir.entries()){const path=prefix+name;if(handle.kind==='directory')await walk(handle,path+'/');else if(supported.test(name)){const file=await handle.getFile();files.push({name,webkitRelativePath:path,arrayBuffer:()=>file.arrayBuffer()});}}};
    await walk(this.directory);return files;
  }
  save(label,bytes){
    const filename=(String(label).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150)||'Kodierung')+'.result',copy=new Uint8Array(bytes);
    const operation=async()=>{const handle=await this.directory.getFileHandle(filename,{create:true}),stream=await handle.createWritable();try{await stream.write(copy);await stream.close();}catch(error){await stream.abort?.().catch(()=>{});throw error;}return filename;};
    const result=this.pending.catch(()=>{}).then(operation);this.pending=result;return result;
  }
}
