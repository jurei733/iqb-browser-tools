// Manual parity probe, outside the passing finite reference corpus.
// Exit 1 demonstrates the open precision loss; it is not a Windows capture.
import {parseWindowsLogCSV} from '../src/windows-csv.js';
const inputs=['9007199254740992','9007199254740993'];
const header='groupname;loginname;code;bookletname;unitname;timestamp;logentry\n';
const records=inputs.map(input=>({input,exactInput:BigInt(input).toString(),browser:parseWindowsLogCSV(header+'g;p;;B;u;'+input+';NOTE')[0].timestamp}));
const collision=records[0].browser===records[1].browser;
const oracleCollision=JSON.parse('{"timestamp":'+inputs[0]+'}').timestamp===JSON.parse('{"timestamp":'+inputs[1]+'}').timestamp;
console.log(JSON.stringify({records,collision,oracleCollision,originalContract:'UnitLineDataLog.timestamp: System.Int64',nativeExecutionForTheseInputs:false,usualCalendarTimestamp:false},null,2));
process.exitCode=collision?1:0;
