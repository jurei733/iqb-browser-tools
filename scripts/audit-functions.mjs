import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const out=resolve(process.argv[2]||'work/function-audit');await mkdir(out,{recursive:true});
const json=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
const matrix=await json('docs/function-matrix.json'),inventory=await json('docs/original-inventory.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const snapshot={};for(const path of (await readdir('src')).sort())snapshot['src/'+path]=hash(await readFile('src/'+path));
for(const path of ['scripts/local-app.mjs','scripts/lib/local-server.mjs'])snapshot[path]=hash(await readFile(path));
const ciPath=matrix.ciReport||'tests/results/function-audit-ci-20261031-parity.json';
const ids=new Set();
for(const f of matrix.features){
  assert(!ids.has(f.id),'Duplicate feature '+f.id);ids.add(f.id);
  for(const source of [f.original,...(f.additionalOriginalSources||[])]){
    const original=inventory.files.find(p=>p.path===source.path);
    assert(original&&original.sha256===source.sha256,'Original provenance mismatch '+f.id);
  }
  for(const file of f.implementation)await readFile(file);
  assert(f.note||f.evidence.length,'Feature needs test evidence or a reason '+f.id);
}
const main=inventory.surfaces.find(s=>s.path==='toolbox/MainWindow.xaml');
const entrypoints=main.controls.map(c=>c.click||c.command).filter(Boolean);
for(const key of entrypoints)assert(ids.has(matrix.entrypoints[key]),'Unmapped active original entry point '+key);

function run(script,args,log){
  const result=spawnSync(process.execPath,[script,...args],{encoding:'utf8',maxBuffer:20*1024*1024});
  return writeFile(join(out,log),(result.stdout||'')+(result.stderr||'')).then(()=>{
    if(result.error)throw result.error;return result;
  });
}
const nodeFiles=(await readdir('tests')).filter(f=>f.endsWith('.test.js')).sort().map(f=>'tests/'+f);
const nodeResult=await run('--test',['--test-reporter=tap',...nodeFiles],'node-tests.tap');
const nodeChecks=[...nodeResult.stdout.matchAll(/^(ok|not ok) \d+ - (.+)$/gm)].map(m=>({name:m[2],passed:m[1]==='ok'}));
assert(nodeChecks.length,'No Node test results');
const reference='tests/fixtures/windows-reference',native=await json(reference+'/windows-results/original-windows.json');
const provenance=await json('PROVENANCE.json');
const originalHashes=new Map(Object.values(provenance.packages).flatMap(p=>p.files).map(f=>[f.path.split('/').at(-1),f.sha256]));
for(const [name,sha]of Object.entries(native.hashes))assert.equal(sha,originalHashes.get(name),'Original assembly changed '+name);
const convertersPath=join(out,'windows-converters.json'),filesPath=join(out,'windows-files.json');
const converterResult=await run('scripts/compare-windows-converters.mjs',[reference+'/windows-results/original-windows.json',convertersPath],'windows-converters.log');
const fileResult=await run('scripts/compare-windows-files.mjs',[reference+'/windows-results',filesPath,reference+'/inputs'],'windows-files.log');
const converters=await json(convertersPath),files=await json(filesPath);
const differentialPath=join(out,'windows-differential.json');
const differentialResult=await run('scripts/analyze-windows-differential.mjs',[differentialPath],'windows-differential.log');
const differential=await json(differentialPath);
const edgesPath=join(out,'windows-edges.json');
const edgesResult=await run('scripts/analyze-windows-edges.mjs',[edgesPath],'windows-edges.log');
const edgeReport=await json(edgesPath);
const nativeWindowsPath=join(out,'native-windows.json');
const nativeWindowsResult=await run('scripts/compare-native-windows.mjs',['tests/fixtures/windows-native/reference.json',nativeWindowsPath],'native-windows.log');
const nativeWindows=await json(nativeWindowsPath);
const freshWindows=await json('tests/results/equivalence-fresh-reference-20261103.json');
for(const [name,sha]of Object.entries(freshWindows.captured.hashes))assert.equal(sha,originalHashes.get(name),'Fresh Windows assembly changed '+name);

for(const [name,expected]of Object.entries(native.inputHashes||{}))assert.equal(hash(await readFile(join(reference,'inputs',name.replaceAll('\\','/')))),expected,'Changed native reference input '+name);
const browsers=[];
for(const name of (await readdir('tests/results')).filter(n=>/^function-audit-\d{8}(?:-\d{6})?-(?:chromium|safari|firefox|webkit)\.json$/.test(n))){
  const report=await json('tests/results/'+name);
  let current=Object.keys(snapshot).every(p=>report.applicationFiles?.[p]===snapshot[p]);for(const [path,sha]of Object.entries(report.testFiles||{}))if(hash(await readFile(path))!==sha)current=false;
  browsers.push({path:'tests/results/'+name,current,...report});
}
const readNodeNames=async file=>[...(await readFile(file,'utf8')).matchAll(/\btest\(['"]([^'"\n]+)['"]/g)].map(m=>m[1]);
const resolveEvidence=async evidence=>{
  const pattern=new RegExp(evidence.pattern);
  let checks=[],current=true;
  if(evidence.kind==='node'){
    const names=(await readNodeNames(evidence.file)).filter(name=>pattern.test(name));
    assert(names.length,'No matching test definition '+JSON.stringify(evidence));
    checks=nodeChecks.filter(c=>names.includes(c.name));
  }else if(evidence.kind==='windows-files')checks=files.checks.filter(c=>pattern.test(c.name));
  else if(evidence.kind==='windows-converters')checks=converters.checks.filter(c=>pattern.test(c.name));
  else if(evidence.kind==='browser'){
    checks=browsers.flatMap(r=>r.checks.filter(c=>pattern.test(c.name)).map(c=>({...c,browser:r.userAgent,report:r.path,current:r.current})));
    if(checks.some(c=>c.current))checks=checks.filter(c=>c.current);current=checks.length>0&&checks.every(c=>c.current);
  }else if(evidence.kind==='ci-browser'){
    const report=await json(evidence.path);
    current=Object.keys(snapshot).every(p=>report.applicationFiles?.[p]===snapshot[p]);
    for(const [path,sha]of Object.entries(report.testFiles))if(hash(await readFile(path))!==sha)current=false;
    checks=report.jobs.flatMap(job=>job.checks.filter(c=>pattern.test(c.name)).map(c=>({...c,browser:job.browser,jobUrl:job.url})));
  }else if(evidence.kind==='historical-browser'){
    const report=await json(evidence.path);checks=report.checks.filter(c=>pattern.test(c.name));current=false;
  }else throw new Error('Unknown evidence kind '+evidence.kind);
  assert(checks.length,'No matching execution '+JSON.stringify(evidence));
  return {...evidence,current,passed:checks.every(c=>c.passed),checks};
};
const ci=await json(ciPath);
const features=[];
for(const f of matrix.features){
  const evidence=await Promise.all(f.evidence.map(resolveEvidence));
  const nativeProof=evidence.some(e=>e.kind.startsWith('windows-')&&e.passed);
  const browserOrNode=evidence.some(e=>e.passed&&e.current);
  const failed=evidence.some(e=>!e.passed);
  features.push({...f,evidence,result:failed?'Prüfung fehlgeschlagen':f.assessment==='missing'?'Fehlt':f.assessment==='excluded'?'Im Original nicht erreichbar':f.assessment==='difference'?'Dokumentierte Abweichung':f.assessment==='partial'?'Teilnachweis / offen':f.assessment==='extension'?'Browser-Erweiterung':nativeProof?'Windows-Vergleich bestanden':browserOrNode?'Browser-/Modultest bestanden':'Aktueller Nachweis offen'});
}
const counts={};for(const f of features)counts[f.result]=(counts[f.result]||0)+1;
const report={date:matrix.date,generatedAt:new Date().toISOString(),scope:matrix.scope,
  completeEquivalence:false,realProductionDataTested:false,codeSnapshot:snapshot,
  originalInventory:{files:inventory.files.length,surfaces:inventory.surfaces.length,controls:inventory.surfaces.reduce((n,s)=>n+s.controls.length,0),mainToolboxEntrypoints:entrypoints.length,mappedEntrypoints:entrypoints.length},
  checks:{nativeWindows:nativeWindows.summary,edges:edgeReport.summary,differential:{...differential.summary,nativeFinished:differential.nativeFinished,culture:differential.culture,normalizationApplied:false},freshWindows:{finished:freshWindows.captured.finished,nativeOperations:freshWindows.captured.results.length,files:freshWindows.comparison.passed,fileTotal:freshWindows.comparison.total},ci:{runId:ci.runId,runUrl:ci.runUrl,localStarter:ci.localStarter||[],jobs:ci.jobs.map(j=>({browser:j.browser,passed:j.passed,total:j.total,compatibility:j.compatibility,conclusion:j.conclusion}))},node:{passed:nodeChecks.filter(c=>c.passed).length,total:nodeChecks.length,exitCode:nodeResult.status},windows:{finished:native.finished,platform:native.platform,inputHashes:native.inputHashes||{},converters:converters.passed,converterTotal:converters.total,files:files.passed,fileTotal:files.total},browsers:browsers.map(r=>({path:r.path,userAgent:r.userAgent,current:r.current,passed:r.passed,total:r.total,finished:r.finished}))},counts,features,
  limitations:['Neue native Windows-Prüfung: 1214/1214 im 64-Bit-Profil; 1214/1214 im 32-Bit-Profil. Die beiden früheren G17-Textabweichungen sind behoben. Separate Zahlenproben vergleichen Binärwerte und G15/G17/R. 13 API-Fälle in beiden Architekturen und 22 bidirektionale Kodiererfälle plus zwei Fehlerablehnungen bestehen.','Historischer ARM-Lauf: 118/118 Fälle im 64-Bit-Profil, 112/118 im 32-Bit-Prozess; sechs unterschiedliche Zahlenausgaben der Originalassembly bleiben dokumentiert. Kodierer: 22 bidirektionale Ergebnisdateien und zwei XML-Steuerzeichen-Ablehnungen.','Strenger Konverterkorpus: 401 reguläre Ausgaben und sieben API-Fälle; 146 weitere Fälle beweisen Fehlererkennung und ERROR-Antwort versus Ausnahme, keine identischen Fehlermeldungen.','Erweiterter Standardmodus unterscheidet sich in 177 regulären Korpusfällen; für die Originalwerte ist der Windows-Modus erforderlich.','Synthetische Daten; keine echten/anonymisierten Arbeitsbestände.','Windows-Dateivergleich prüft Inhalte/Struktur; keine pixelgleiche Oberfläche oder identischen Zufallsbytes.','Testcenter-Verträge und ältere reale Demo-Läufe ersetzen keinen direkten Windows-Netzwerkvergleich aller Serverversionen.','Fehlende/teilweise geprüfte Funktionen werden nicht als gleichwertig gezählt.','Jede Matrixzeile beschreibt einen Nutzerauftrag; sie ist kein Nachweis aller Eingabe-, Größen- oder Fehlerkombinationen.',...(matrix.limitations||[]),`Aktuelle CI: ${ci.jobs.map(j=>j.browser+' '+j.passed+'/'+j.total+' Suiten, '+j.compatibility.passed+'/'+j.compatibility.total+' Kompatibilitätschecks').join('; ')}. Belege: ${ciPath}. Artefaktstatus steht je Job im Nachweis.`]};
await writeFile(join(out,'function-audit.json'),JSON.stringify(report,null,2)+'\n');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=features.map(f=>`<tr data-app="${esc(f.app)}" data-result="${esc(f.result)}"><td>${esc(f.id)}</td><td><b>${esc(f.function)}</b><p>${esc(f.note)}</p><small>Prüfziel: ${esc(f.acceptance)}</small></td><td>${esc(f.result)}</td><td>${[f.original,...(f.additionalOriginalSources||[])].map(s=>`<code>${esc(s.path)}:${s.line}</code><br><small>${esc(s.anchor)}</small>`).join('<br>')}<details><summary>Umsetzung und Belege (${f.evidence.length})</summary><p>${f.implementation.map(esc).join('<br>')}</p>${f.evidence.map(e=>`<p><b>${esc(e.kind)}</b> ${e.current?'aktueller Nachweis':'historischer oder älterer Stand'}<br>${e.checks.map(c=>esc((c.passed?'✓ ':'✗ ')+c.name)).join('<br>')}</p>`).join('')||'<p>Kein automatischer Ausführungsnachweis. Begründung und offener Prüfauftrag stehen links.</p>'}</details></td></tr>`).join('\n');
const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Funktionsvergleich der IQB-Werkzeuge</title><style>body{font:16px system-ui;color:#182b43;margin:32px auto;padding:0 20px;max-width:1500px;line-height:1.5}h1{font-size:30px}table{border-collapse:collapse;width:100%}td,th{padding:12px;text-align:left;border-bottom:1px solid #ccd5df;vertical-align:top}th{background:#edf2f6;position:sticky;top:0}td:first-child{white-space:nowrap}td:nth-child(2){width:38%}code,small{font-size:12px;overflow-wrap:anywhere}p{margin:6px 0}input,select{font:inherit;padding:8px;margin:12px 10px 16px 0;max-width:100%}details{margin-top:8px}summary{cursor:pointer}.notice{background:#fff4d9;padding:16px;border-left:5px solid #a77512}li{margin:5px 0}</style><h1>Funktionsvergleich der IQB-Werkzeuge</h1><p>Stand ${esc(report.date)} · ${features.length} Funktionspunkte · IQB-Kodieren 4.3.0.3 / itc-ToolBox 3.3.0.2</p><p class="notice"><b>Vollständige Gleichheit ist nicht nachgewiesen.</b> Der neue direkte Windows-x64-Referenzlauf prüft 1214 Eingaben je Prozessarchitektur: Das 64-Bit-Profil besteht 1214/1214 Vergleiche, das 32-Bit-Profil 1214/1214. Die beiden früheren Textabweichungen sind behoben. Fehlerkategorien sind kein Nachweis identischer Meldungstexte. Der erweiterte Standardmodus ist nicht identisch mit dem Original. Die reine Onlinefassung bleibt bei Betriebssystemkonto und dauerhaftem Dateizugriff eingeschränkt. Der lokale Starter ergänzt diese Funktionen auf dem Arbeitsplatz. Vollständige 1:1-Identität wird deshalb weiterhin nicht behauptet. Jede Zeile zeigt Original- und Browserbelege.</p><p>Inventar: ${report.originalInventory.files} Quelldateien, ${report.originalInventory.surfaces} XAML-Oberflächen, ${report.originalInventory.controls} Controls. Alle ${entrypoints.length} aktiven Toolbox-Haupteinstiege sind zugeordnet.</p><p>Aktueller Prüflauf: ${report.checks.node.passed}/${report.checks.node.total} Node-Tests; ${converters.passed}/${converters.total} Windows-Konverter- und ${files.passed}/${files.total} Windows-Datei-/Verhaltensvergleiche. Native Windows-Ausführung: ${esc(native.finished)}. Erneuter 38-Operationen-Lauf: ${esc(freshWindows.captured.finished)}.</p><p>Strenger Konverterkorpus: ${differential.summary.strictValues.passed}/${differential.summary.strictValues.total} reguläre Ausgaben; ${differential.summary.errorHandling.passed}/${differential.summary.errorHandling.total} reine Fehlererkennung und Fehlerdarstellung; ${differential.summary.apiUnits.passed}/${differential.summary.apiUnits.total} API-Fälle. Keine Wertanpassungen oder Sortierung der Ergebnislisten. <a href="https://iqb-browser-tools-jr-20261103.iqb-e-v-8867.chatgpt.site/equivalence.html">Umfang und Gegenbeispiele</a>.</p><p>Historischer ARM-Lauf: ${edgeReport.summary.windows64.passed}/${edgeReport.summary.converterInputs} im 64-Bit-Konverterprofil; ${edgeReport.summary.windows32.passed}/${edgeReport.summary.converterInputs} im 32-Bit-Prozess. Die Originalassembly liefert sechs unterschiedliche Zahlenausgaben. Kodierer: ${edgeReport.summary.coding.bidirectional} bidirektionale Dateivergleiche und ${edgeReport.summary.coding.errorDetection} Steuerzeichen-Ablehnungen. Der historische ARM-Lauf wird durch den direkten Windows-x64-Runner ergänzt: 1214/1214 im 64-Bit-Profil, 1214/1214 im 32-Bit-Profil; keine bekannten Ausnahmen im Prüfkorpus.</p><p>Optionaler lokaler Starter: ${(ci.localStarter||[]).map(j=>esc(j.platform)+' '+j.passed+'/'+j.total+' Tests').join('; ')}. Die Startertests verwenden Arbeitsplatzkonten der CI-Systeme, keine produktive IQB-Domänenanmeldung.</p><p>${browsers.map(r=>`${r.passed}/${r.total} Browserprüfungen (${esc(r.userAgent)}, ${r.current?'aktueller Code':'früherer Code'}).`).join('<br>')}</p><ul>${Object.entries(counts).map(([k,v])=>`<li>${esc(k)}: <b>${v}</b></li>`).join('')}</ul><label>Suche <input id="query" type="search" placeholder="z. B. SQLite, K-18, Kommentar"></label><label>Anwendung <select id="app"><option value="">Alle</option>${[...new Set(features.map(f=>f.app))].map(v=>`<option>${esc(v)}</option>`).join('')}</select></label><label>Ergebnis <select id="result"><option value="">Alle</option>${Object.keys(counts).map(v=>`<option>${esc(v)}</option>`).join('')}</select></label><p id="shown"></p><table><thead><tr><th>ID</th><th>Funktion und Abweichungen</th><th>Ergebnis</th><th>Originalquelle / Belege</th></tr></thead><tbody>${rows}</tbody></table><h2>Prüfgrenzen</h2><ul>${report.limitations.map(v=>`<li>${esc(v)}</li>`).join('')}</ul><p>Reproduzieren: <code>pnpm audit:functions</code>. Originalinventar: <code>docs/original-inventory.json</code>; Matrix: <code>docs/function-matrix.json</code>; maschinenlesbares Ergebnis neben diesem Bericht.</p><script>const inputs=['query','app','result'].map(id=>document.getElementById(id));function filter(){let n=0;for(const row of document.querySelectorAll('tbody tr')){const show=(!inputs[0].value||row.textContent.toLowerCase().includes(inputs[0].value.toLowerCase()))&&(!inputs[1].value||row.dataset.app===inputs[1].value)&&(!inputs[2].value||row.dataset.result===inputs[2].value);row.hidden=!show;if(show)n++;}document.getElementById('shown').textContent=n+' Funktionspunkte angezeigt';}inputs.forEach(el=>el.addEventListener('input',filter));filter();</script></html>`;
await writeFile(join(out,'function-audit.html'),html);
console.log(JSON.stringify({features:features.length,checks:report.checks,counts,report:relative(root,join(out,'function-audit.html'))},null,2));
if(nodeResult.status||converterResult.status||fileResult.status||differentialResult.status||edgesResult.status||nativeWindowsResult.status||features.some(f=>f.evidence.some(e=>!e.passed)))process.exitCode=1;
