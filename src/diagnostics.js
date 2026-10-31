export class Diagnostics {
  entries=[];
  add(message,{level='info',operation='',time=new Date()}={}){
    this.entries.push({time:time.toISOString(),level,operation,message:String(message)});
  }
  text(){return '\ufeffIQB-Werkzeuge – vollständiges Verarbeitungsprotokoll\r\n'+this.entries.map(e=>`${e.time}\t${e.level.toUpperCase()}\t${e.operation}\t${e.message.replace(/\r?\n/g,'\r\n\t')}`).join('\r\n')+'\r\n';}
}
