// itc-ToolBox 3.3.0.2 uses physical lines and String.Split here, rather than
// an RFC CSV reader. Keep its lossy behaviour confined to Windows mode.
import {compactInteger} from './timestamps.js';
export function splitWindowsLog(value) {
  const text=String(value??'');let at=text.indexOf(' : ');
  if(at>0){let parameter=text.slice(at+3);if(parameter.startsWith('"')&&parameter.endsWith('"'))parameter=parameter.slice(1,-1).replace(/""/g,'"').replace(/\\\\/g,'\\');return {key:text.slice(0,at),parameter};}
  at=text.indexOf(' = ');
  return at>0?{key:text.slice(0,at),parameter:text.slice(at+3)}:{key:text,parameter:''};
}

function logTimestamp(stamp,line) {
  const parts=(stamp.includes('E+')?/^([+-]?)(\d+)(?:,(\d*))?E\+(\d+)$/:/^([+-]?)(\d+)$/).exec(stamp);
  const invalid=()=>new Error(`Windows-Log-CSV, Zeile ${line}: Ungültiger Int64-Zeitstempel.`);
  if(!parts)throw invalid();
  let value=BigInt(parts[2]+(parts[3]||''));
  if(value!==0n){
    const scale=Number(parts[4]||0)-(parts[3]||'').length,digits=value.toString().length;
    if(scale+digits>19||-scale>digits)throw invalid();
    if(scale<0){const divisor=10n**BigInt(-scale);if(value%divisor!==0n)throw invalid();value/=divisor;}
    else value*=10n**BigInt(scale);
    if(parts[1]==='-')value=-value;
  }
  if(value < -9223372036854775808n||value > 9223372036854775807n)throw invalid();
  return compactInteger(value);
}

export function parseWindowsLogCSV(source,{onWarning=()=>{}}={}) {
  const lines=String(source).replace(/^\uFEFF/,'').split(/\r\n|\n|\r/),header=lines.shift().replace(/"/g,'');
  if(lines.at(-1)==='')lines.pop();
  const modern=header==='groupname;loginname;code;bookletname;unitname;originalUnitId;timestamp;logentry';
  if(!modern&&header!=='groupname;loginname;code;bookletname;unitname;timestamp;logentry')throw new Error('Windows-Log-CSV: Unbekannte Spaltenfolge.');
  const count=modern?8:7,offset=modern?1:0,strip=value=>value.startsWith('"')?value.slice(1):value,rows=[];let skipped=0;
  for(const [index,line]of lines.entries()){
    let fields=line.split('";').filter(Boolean);if(fields.length!==count)fields=line.split(';');
    if(fields.length!==count){skipped++;continue;}
    const timestamp=logTimestamp(strip(fields[5+offset]).trim(),index+2);
    let logentry=fields[6+offset];if(logentry.startsWith('"'))logentry=logentry.slice(1,-1).replace(/""/g,'"');
    const unitname=strip(fields[4]);
    // Preserve the original v2024 fallback to field 4 for unquoted unit IDs.
    const originalUnitId=unitname?(modern?(fields[5].startsWith('"')?fields[5].slice(1):fields[4]):unitname):'';
    rows.push({groupname:strip(fields[0]),loginname:strip(fields[1]),code:strip(fields[2]),bookletname:strip(fields[3]).toUpperCase(),unitname,originalUnitId:originalUnitId||unitname,timestamp,logentry});
  }
  if(skipped)onWarning(`Windows-Modus: ${skipped} Logzeilen wie im Windows-Original übersprungen. Der Standardmodus oder API-Import erhält diese Daten.`);
  return rows;
}
