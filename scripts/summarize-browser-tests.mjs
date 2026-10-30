import {readFile, appendFile} from 'node:fs/promises';

let report;
try{report=JSON.parse(await readFile('test-results/results.json','utf8'));}
catch(error){
  if(error.code!=='ENOENT')throw error;
  console.log('No browser report was generated; see the setup/build step logs.');
  process.exit(0);
}
const lines=['## Browser tests','',
  `Passed: ${report.stats.expected} · Failed: ${report.stats.unexpected} · Skipped: ${report.stats.skipped} · Flaky: ${report.stats.flaky}`,''];
function walk(suite){
  for(const spec of suite.specs||[])for(const test of spec.tests||[]){
    lines.push(`- ${test.status==='expected'?'✓':'✗'} **${test.projectName}**: ${spec.title}`);
    for(const result of test.results||[])for(const error of result.errors||[]){
      const message=(error.message||'Unknown failure').replace(/\u001b\[[0-9;]*m/g,'');
      lines.push('', '```text',message.replace(/```/g,"'''"),'```','');
    }
  }
  for(const child of suite.suites||[])walk(child);
}
for(const suite of report.suites)walk(suite);
const markdown=lines.join('\n')+'\n';
console.log(markdown);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,markdown);
