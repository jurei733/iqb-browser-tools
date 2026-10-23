import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import exifr from 'exifr';
import UTIF from 'utif2';
import {neutralizeOrientation,resolution,tiffResolution} from '../src/image.js';
const fixture=async name=>new Uint8Array(await readFile(new URL('./fixtures/'+name,import.meta.url)));

test('BMP uses the independent physical resolutions confirmed by the Windows decoder',async()=>{
 const bytes=await fixture('anisotropic.bmp'),[x,y]=await resolution(bytes);
 assert.ok(Math.abs(x-191.99859619140625)<.001);assert.ok(Math.abs(y-96.01200103759767)<.001);
 const padded=new Uint8Array(bytes.length+9);padded.set(bytes,9);assert.deepEqual(await resolution(padded.subarray(9)),[x,y]);
 const invalid=bytes.slice();new DataView(invalid.buffer).setInt32(38,-1,true);new DataView(invalid.buffer).setInt32(42,0,true);assert.deepEqual(await resolution(invalid),[96,96]);
 assert.deepEqual(await resolution(bytes.slice(0,45)),[96,96]);
});
test('TIFF rational resolution tags preserve physical dimensions instead of falling back to 96 DPI',async()=>{
 const bytes=await fixture('anisotropic.tif'),ifd=UTIF.decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))[0];assert.deepEqual(tiffResolution(ifd),[192,96]);
 assert.deepEqual(tiffResolution({t282:[[150,2]],t283:[[75,2]],t296:[3]}),[190.5,95.25]);
 assert.deepEqual(tiffResolution({t282:[[1,0]],t283:[[0,1]]}),[96,96]);
});

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
