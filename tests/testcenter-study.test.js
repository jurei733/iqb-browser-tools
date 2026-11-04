import test from 'node:test';
import assert from 'node:assert/strict';
import {runStudyComparison} from '../scripts/testcenter-study.mjs';

test('1000-person Testcenter cohort matches captured Windows imports, SQLite, Excel and comment archive', {timeout:120000},async()=>{
  const report=await runStudyComparison();
  assert.equal(report.synthetic,true);assert.equal(report.empiricalStudy,false);
  assert.equal(report.checks.length,66);assert.ok(report.checks.every(c=>c.passed));
});
