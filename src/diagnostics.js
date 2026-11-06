export function messageText(messages){
  return messages.map(message=>{const value=String(message);return (value.startsWith('h:')?'\r\n\r\n':'\r\n')+value.replace(/^[hew]:/,'');}).join('')+'\r\n';
}
export function windowsTextBytes(value){
  const bytes=new Uint8Array(2+value.length*2);bytes[0]=255;bytes[1]=254;
  for(let i=0;i<value.length;i++){const code=value.charCodeAt(i);bytes[2+i*2]=code&255;bytes[3+i*2]=code>>>8;}return bytes;
}
export class Diagnostics {
  entries=[];
  add(message,{level='info',operation='',time=new Date()}={}){
    this.entries.push({time:time.toISOString(),level,operation,message:String(message)});
  }
  text(){return '\ufeffIQB-Werkzeuge – vollständiges Verarbeitungsprotokoll\r\n'+this.entries.map(e=>`${e.time}\t${e.level.toUpperCase()}\t${e.operation}\t${e.message.replace(/\r?\n/g,'\r\n\t')}`).join('\r\n')+'\r\n';}
}
