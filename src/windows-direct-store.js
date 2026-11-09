// The original direct Testcenter-Xlsx command reuses the CSV intermediate store.
// Keep this state separate from databases and opt into it only for that command.
export function appendWindowsDirect(previous,incoming){
 const identity=p=>String(p.group??'')+String(p.login??'')+String(p.code??'');
 const seen=new Set(previous.map(identity));
 for(const p of incoming){const key=identity(p);if(seen.has(key))throw new Error('Diese Testpersonen sind im direkten Windows-Datenbestand bereits vorhanden. Bitte den direkten Datenbestand leeren oder die Übernahme vorheriger Daten ausschalten.');seen.add(key);}
 return [...previous,...incoming].sort((a,b)=>identity(a).localeCompare(identity(b),'de'));
}
