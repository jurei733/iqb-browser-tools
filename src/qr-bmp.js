import QRCode from 'qrcode';
export function qrBmp(value){
  const qr=QRCode.create(value,{errorCorrectionLevel:'Q'}).modules,size=(qr.size+8)*4,stride=size*4,bytes=new Uint8Array(54+stride*size),view=new DataView(bytes.buffer);
  bytes[0]=66;bytes[1]=77;view.setUint32(2,bytes.length,true);view.setUint32(10,54,true);view.setUint32(14,40,true);view.setInt32(18,size,true);view.setInt32(22,size,true);view.setUint16(26,1,true);view.setUint16(28,32,true);view.setInt32(38,3780,true);view.setInt32(42,3780,true);bytes.fill(255,54);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const row=Math.floor(y/4)-4,col=Math.floor(x/4)-4;if(row>=0&&row<qr.size&&col>=0&&col<qr.size&&qr.get(row,col)){const offset=54+(size-1-y)*stride+x*4;bytes.fill(0,offset,offset+3);}}
  return bytes;
}
