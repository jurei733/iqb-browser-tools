// Local collision regression; native evidence is frozen separately in fixtures/int64-native.
// Exit 0 confirms distinct values in both the product and the reference reader.
import {parseJSON,stringifyJSON} from '../src/json.js';
import {parseWindowsLogCSV} from '../src/windows-csv.js';
const inputs=['9007199254740992','9007199254740993'];
const header='groupname;loginname;code;bookletname;unitname;timestamp;logentry\n';
const records=inputs.map(input=>({input,exactInput:BigInt(input).toString(),browser:parseWindowsLogCSV(header+'g;p;;B;u;'+input+';NOTE')[0].timestamp}));
const collision=records[0].browser===records[1].browser;
const oracleCollision=parseJSON('{"timestamp":'+inputs[0]+'}').timestamp===parseJSON('{"timestamp":'+inputs[1]+'}').timestamp;
console.log(stringifyJSON({records,collision,oracleCollision,originalContract:'UnitLineDataLog.timestamp: System.Int64',nativeEvidence:"tests/fixtures/int64-native/source.json",usualCalendarTimestamp:false},null,2));
process.exitCode=collision||oracleCollision?1:0;
