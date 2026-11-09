// Keep application-owned File objects separate from native FileList wrappers.
// WebKit can expose wrappers that do not retain custom path properties.
const assigned=new WeakMap();
export function setInputFiles(input,files){
  const originals=Array.from(files),transfer=new DataTransfer();
  originals.forEach(file=>transfer.items.add(file));
  input.files=transfer.files;
  assigned.set(input,{list:input.files,native:Array.from(input.files),originals});
}
export function inputFiles(input){
  const current=Array.from(input.files||[]),saved=assigned.get(input);
  if(saved&&input.files===saved.list&&current.length===saved.native.length&&current.every((file,i)=>file===saved.native[i]))return saved.originals.slice();
  assigned.delete(input);
  return current;
}
