import QRCode from 'qrcode';
import MaskPattern from 'qrcode/lib/core/mask-pattern.js';
function windowsModules(value){
  let selected,lowest=Infinity;
  for(let maskPattern=0;maskPattern<8;maskPattern++){
    const modules=QRCode.create(value,{errorCorrectionLevel:'Q',maskPattern}).modules;
    let black=0;for(const bit of modules.data)black+=bit;
    // QRCoder 1.4.3, used by the original: choose the closer neighbouring
    // multiple of five for penalty 4; retain the first mask on a tie.
    // https://github.com/codebude/QRCoder/blob/v1.4.3/QRCoder/QRCodeGenerator.cs
    const lower=Math.floor((black/modules.data.length*100)/5)*5;
    const balance=Math.min(Math.abs(lower-50),Math.abs(lower-45))*2;
    const score=MaskPattern.getPenaltyN1(modules)+MaskPattern.getPenaltyN2(modules)+MaskPattern.getPenaltyN3(modules)+balance;
    if(score<lowest){lowest=score;selected=modules;}
  }
  return selected;
}
export function qrBmp(value){
  const qr=windowsModules(value),size=(qr.size+8)*4,stride=size*4,bytes=new Uint8Array(54+stride*size),view=new DataView(bytes.buffer);
  bytes[0]=66;bytes[1]=77;view.setUint32(2,bytes.length,true);view.setUint32(10,54,true);view.setUint32(14,40,true);view.setInt32(18,size,true);view.setInt32(22,size,true);view.setUint16(26,1,true);view.setUint16(28,32,true);view.setInt32(38,3780,true);view.setInt32(42,3780,true);bytes.fill(255,54);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const row=Math.floor(y/4)-4,col=Math.floor(x/4)-4;if(row>=0&&row<qr.size&&col>=0&&col<qr.size&&qr.get(row,col)){const offset=54+(size-1-y)*stride+x*4;bytes.fill(0,offset,offset+3);}}
  return bytes;
}
