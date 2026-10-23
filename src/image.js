import UTIF from 'utif2';
import exifr from 'exifr';
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
    const blob=new Blob([page.bytes]);let image;
    if(typeof createImageBitmap==='function')image=await createImageBitmap(blob,{imageOrientation:'none'});
    else{const url=URL.createObjectURL(blob);try{image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Dieses Bildformat konnte nicht angezeigt werden.'));img.src=url;});}finally{URL.revokeObjectURL(url);}}
    const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;if(width*height>80000000){image.close?.();throw new Error('Dieser Scan ist zu groß für die Browseransicht.');}canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(image,0,0);image.close?.();[dpiX,dpiY]=await resolution(page.bytes);
  }
  return {canvas,dpiX,dpiY};
}
