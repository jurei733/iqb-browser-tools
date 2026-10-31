// WPF uses device-independent 96-DPI units, not percentages of the viewer.
export function zoomBounds(width,height,viewportWidth,viewportHeight){
  const fit=Math.min(viewportWidth/width,viewportHeight/height);
  const min=Number.isFinite(fit)&&fit>0?fit:0;
  return {min,max:Math.max(2,min)};
}
export const clampZoom=(scale,bounds)=>Math.max(bounds.min,Math.min(bounds.max,scale));
export const stepZoom=(scale,direction,bounds)=>clampZoom(scale+direction*(bounds.max-bounds.min)*.1,bounds);
export function moveTemplate(start,delta,bounds){
  let x=start.x+delta.x,y=start.y+delta.y;if(x<bounds.left)x=bounds.left;else if(x+bounds.templateWidth>bounds.left+bounds.width)x=bounds.left+bounds.width-bounds.templateWidth;if(y<bounds.top)y=bounds.top;else if(y+bounds.templateHeight>bounds.top+bounds.height)y=bounds.top+bounds.height-bounds.templateHeight;return {x,y};
}
export function roundWpf(value){const floor=Math.floor(value);return value-floor===.5?(floor%2===0?floor:floor+1):Math.round(value);}
export const rotateTemplate=(startY,currentY,scale)=>roundWpf((startY-currentY)/scale);
export function bindScanPan(container){
  container.onpointerdown=e=>{
    if(e.button!==0||e.target.closest('.template-layer,button,input,select,a'))return;
    const start={x:e.clientX,y:e.clientY,left:container.scrollLeft,top:container.scrollTop};
    container.setPointerCapture(e.pointerId);container.classList.add('panning');e.preventDefault();
    container.onpointermove=event=>{container.scrollLeft=start.left+start.x-event.clientX;container.scrollTop=start.top+start.y-event.clientY;};
    const finish=()=>{container.onpointermove=null;container.classList.remove('panning');};
    container.onpointerup=finish;container.onpointercancel=finish;container.onlostpointercapture=finish;
  };
}
