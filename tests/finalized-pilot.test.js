import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFinalizedPilot,verifyFinalizedPilot} from '../scripts/finalized-pilot.mjs';

test('Native Pilot84 completion: 137 manual zeros, v1/v2/v3, CSV, Excel and SQLite roundtrip',async()=>{
 const {fixture,data}=await loadFinalizedPilot();
 const report=await verifyFinalizedPilot(fixture,data);
 assert.equal(report.manualResponses,137);assert.equal(report.responses,756);
});
test('Finalized pilot oracle rejects one altered native v3 score',async()=>{
 const {fixture,data}=await loadFinalizedPilot();
 const headers=data.csv[0],row=data.csv.slice(1).find(r=>r[headers.indexOf('status_v2')]);
 row[headers.indexOf('score_v3')]='1';
 await assert.rejects(verifyFinalizedPilot(fixture,data),/v3 precedence/);
});
