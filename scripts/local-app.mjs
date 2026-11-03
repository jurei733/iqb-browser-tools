import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {homedir,platform} from 'node:os';
import {execFile} from 'node:child_process';
import {createLocalApp} from './lib/local-server.mjs';
const args=process.argv.slice(2),options={dist:fileURLToPath(new URL('../dist',import.meta.url)),configFile:join(homedir(),'.iqb-browser-tools','local.json'),port:4175};let open=false;
for(let i=0;i<args.length;i++){
  const option=args[i];if(option==='--workspace'){const path=args[++i];if(!path||path.startsWith('--'))throw new Error('Nach --workspace fehlt der Ordnerpfad.');options.workspace=resolve(path);}else if(option==='--port'){options.port=Number(args[++i]);if(!Number.isInteger(options.port)||options.port<1||options.port>65535)throw new Error('Ungültiger Port.');}else if(option==='--open')open=true;else if(option==='--help'){console.log('IQB lokal: node scripts/local-app.mjs [--workspace "/absoluter/Arbeitsordner"] [--port 4175] [--open]\nIm Browser einen Arbeitsordner verbinden und bei Bedarf für den nächsten Start merken.');process.exit(0);}else throw new Error('Unbekannte Option: '+option);
}
try{
  const app=await createLocalApp(options);console.log('IQB-Werkzeuge lokal: '+app.url+'\nZum Beenden Strg+C. Dateien bleiben auf diesem Gerät.');
  if(open){const system=platform();const command=system==='darwin'?'open':system==='win32'?'rundll32.exe':'xdg-open';const params=system==='win32'?['url.dll,FileProtocolHandler',app.url]:[app.url];execFile(command,params,error=>{if(error)console.error('Bitte die angezeigte Adresse im Browser öffnen.');});}
  const stop=()=>app.close().then(()=>process.exit(0));process.once('SIGINT',stop);process.once('SIGTERM',stop);
}catch(e){console.error(e.code==='EADDRINUSE'?'Port belegt. Bereits gestartete Anwendung öffnen oder --port wählen.':e.message+'\nBitte zuerst pnpm build ausführen bzw. dist aus dem ZIP verwenden.');process.exitCode=1;}
