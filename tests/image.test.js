import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import exifr from 'exifr';
import {neutralizeOrientation,resolution} from '../src/image.js';
const fixture=async name=>new Uint8Array(await readFile(new URL('./fixtures/'+name,import.meta.url)));

test('all seven EXIF rotations and mirrors are neutralized without changing source bytes or DPI',async()=>{
  for(const orientation of [2,3,4,5,6,7,8]){const bytes=await fixture(`orientation${orientation}.jpg`),original=bytes.slice(),decoded=neutralizeOrientation(bytes);assert.notEqual(decoded,bytes);assert.deepEqual(bytes,original);assert.equal((await exifr.parse(bytes,{pick:['Orientation'],translateValues:false})).Orientation,orientation);assert.equal((await exifr.parse(decoded,{pick:['Orientation'],translateValues:false})).Orientation,1);assert.deepEqual(await resolution(decoded),await resolution(bytes));assert.equal(decoded.length,bytes.length);}
});
test('PNG orientation metadata is removed from the decode copy while source and pixel data are preserved',async()=>{
  const bytes=await fixture('orientation6.png'),original=bytes.slice(),decoded=neutralizeOrientation(bytes);assert.deepEqual(bytes,original);assert.equal((await exifr.parse(bytes,{pick:['Orientation'],translateValues:false})).Orientation,6);assert.equal(await exifr.parse(decoded,{pick:['Orientation'],translateValues:false}),undefined);assert.ok(decoded.length<bytes.length);assert.equal(new TextDecoder('latin1').decode(decoded).includes('IDAT'),true);
});
test('WebP metadata changes retain RIFF size and leave input intact; ordinary images need no copy',async()=>{
  const bytes=await fixture('orientation6.webp'),original=bytes.slice(),decoded=neutralizeOrientation(bytes);assert.deepEqual(bytes,original);assert.notDeepEqual(decoded,bytes);assert.equal(decoded.length,bytes.length);assert.deepEqual(decoded.slice(0,16),bytes.slice(0,16));for(const name of ['scan.png','scan.jpg','scan.bmp','scan.gif','scan.webp']){const b=await fixture(name);assert.equal(neutralizeOrientation(b),b);}
});
test('orientation handling respects array offsets and rejects truncated metadata without throwing',async()=>{
  const source=await fixture('orientation6.jpg'),buffer=new Uint8Array(source.length+24);buffer.set(source,12);const view=buffer.subarray(12,12+source.length),decoded=neutralizeOrientation(view);assert.equal((await exifr.parse(decoded,{pick:['Orientation'],translateValues:false})).Orientation,1);assert.equal(buffer[0],0);for(const b of [new Uint8Array(),new Uint8Array([255,216,255,225,255,255]),source.slice(0,25)])assert.doesNotThrow(()=>neutralizeOrientation(b));
});
