import UTIF from 'utif2';
import exifr from 'exifr';
// Coding frames refer to stored pixels. Current browsers can apply EXIF rotation
// even when createImageBitmap is called with imageOrientation: 'none'. Change
// only the orientation entry in a decode copy; preserve the source and its DPI.
export function neutralizeOrientation(source){
  const view=new DataView(source.buffer,source.byteOffset,source.byteLength);let result=source;
  const tiff=(base,end)=>{if(base+8>end)return;const order=view.getUint16(base),le=order===0x4949;if(!le&&order!==0x4d4d||view.getUint16(base+2,le)!==42)return;const first=base+view.getUint32(base+4,le);if(first<base+8||first+2>end)return;const count=view.getUint16(first,le);if(first+2+count*12>end)return;for(let n=0;n<count;n++){const entry=first+2+n*12;if(view.getUint16(entry,le)===274&&view.getUint16(entry+2,le)===3&&view.getUint32(entry+4,le)===1){const orientation=view.getUint16(entry+8,le);if(orientation>=2&&orientation<=8){if(result===source)result=source.slice();new DataView(result.buffer,result.byteOffset,result.byteLength).setUint16(entry+8,1,le);}return;}}};
  if(source[0]===255&&source[1]===216){for(let offset=2;offset+4<=source.length;){if(source[offset]!==255)break;const marker=source[offset+1];if(marker===0xda||marker===0xd9)break;const length=view.getUint16(offset+2),end=offset+2+length;if(length<2||end>source.length)break;if(marker===0xe1&&length>=16&&String.fromCharCode(...source.subarray(offset+4,offset+10))==='Exif\0\0')tiff(offset+10,end);offset=end;}}
  else if(source.length>=12&&String.fromCharCode(...source.subarray(0,4))==='RIFF'&&String.fromCharCode(...source.subarray(8,12))==='WEBP'){for(let offset=12;offset+8<=source.length;){const length=view.getUint32(offset+4,true),start=offset+8,end=start+length;if(end>source.length)break;if(String.fromCharCode(...source.subarray(offset,offset+4))==='EXIF'){const base=String.fromCharCode(...source.subarray(start,start+6))==='Exif\0\0'?start+6:start;tiff(base,end);}offset=end+(length%2);}}
  // PNG eXIf CRC covers the metadata bytes. Remove that optional decode-only
  // chunk rather than making an invalid CRC; retain the original for DPI reads.
  else if(source.length>=8&&view.getUint32(0)===0x89504e47){const pieces=[source.subarray(0,8)];let found=false;for(let offset=8;offset+12<=source.length;){const length=view.getUint32(offset),end=offset+12+length;if(end>source.length)return source;if(String.fromCharCode(...source.subarray(offset+4,offset+8))==='eXIf')found=true;else pieces.push(source.subarray(offset,end));offset=end;}if(found){result=new Uint8Array(pieces.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of pieces){result.set(p,offset);offset+=p.length;}}}
  return result;
}
export async function resolution(bytes) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length>24&&view.getUint32(0)===0x89504e47){for(let offset=8;offset+12<=bytes.length;){const length=view.getUint32(offset),type=String.fromCharCode(...bytes.slice(offset+4,offset+8));if(offset+12+length>bytes.length)break;if(type==='pHYs'&&length>=9&&bytes[offset+16]===1)return [view.getUint32(offset+8)*.0254,view.getUint32(offset+12)*.0254];offset+=12+length;}}
  if(bytes[0]===255&&bytes[1]===216){try{const meta=await exifr.parse(bytes,{pick:['XResolution','YResolution','ResolutionUnit'],translateValues:false});if(meta?.XResolution&&meta?.YResolution){const factor=meta.ResolutionUnit===3?2.54:1;return [Number(meta.XResolution)*factor,Number(meta.YResolution)*factor];}}catch{}
    for(let offset=2;offset+4<bytes.length;){if(bytes[offset]!==255)break;const marker=bytes[offset+1];if(marker===0xda||marker===0xd9)break;const length=view.getUint16(offset+2);if(length<2||offset+length+2>bytes.length)break;if(marker===0xe0&&length>=16&&String.fromCharCode(...bytes.slice(offset+4,offset+9))==='JFIF\0'){const unit=bytes[offset+11],x=view.getUint16(offset+12),y=view.getUint16(offset+14);if(unit&&x&&y)return [x*(unit===2?2.54:1),y*(unit===2?2.54:1)];}offset+=length+2;}
  }
  return [96,96];
}
export async function decodeCanvas(page) {
  const canvas=document.createElement('canvas');let dpiX=96,dpiY=96;
  if(/\.tiff?$/i.test(page.path)){
    const bytes=page.bytes,buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),ifd=UTIF.decode(buffer)[0];if(!ifd)throw new Error('TIFF enthält kein Bild.');
    if(Number(ifd.t256?.[0])*Number(ifd.t257?.[0])>80000000)throw new Error('Dieser Scan ist zu groß für die Browseransicht.');
    UTIF.decodeImage(buffer,ifd);canvas.width=ifd.width;canvas.height=ifd.height;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(ifd)),ifd.width,ifd.height),0,0);const factor=ifd.t296?.[0]===3?2.54:1;dpiX=(ifd.t282?.[0]||96)*factor;dpiY=(ifd.t283?.[0]||96)*factor;
  }else{
    const type={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',bmp:'image/bmp',webp:'image/webp'}[page.path.split('.').at(-1).toLowerCase()]||'';
    const blob=new Blob([neutralizeOrientation(page.bytes)],{type});let image;
    if(typeof createImageBitmap==='function'){try{image=await createImageBitmap(blob,{imageOrientation:'none'});}catch{ /* Some engines expose this API but reject a supported image format. */ }}
    if(!image){const url=URL.createObjectURL(blob);try{image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Dieses Bildformat konnte nicht angezeigt werden.'));img.src=url;});}finally{URL.revokeObjectURL(url);}}
    const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;if(width*height>80000000){image.close?.();throw new Error('Dieser Scan ist zu groß für die Browseransicht.');}canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(image,0,0);image.close?.();[dpiX,dpiY]=await resolution(page.bytes);
  }
  return {canvas,dpiX,dpiY};
}
