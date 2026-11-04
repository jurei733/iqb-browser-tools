import {parse,stringify} from 'lossless-json';

// Keep integer response values exact before they become export strings. BigInt
// also survives structured cloning when reports cross the worker boundary.
export const parseJSON=source=>parse(source,undefined,{
  parseNumber:value=>/^-?\d+$/.test(value)&&!Number.isSafeInteger(Number(value))?BigInt(value):Number(value),
  onDuplicateKey:({newValue})=>newValue
});
export const stringifyJSON=(value,replacer,space)=>stringify(value,replacer,space);
