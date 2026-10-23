// Keep the actual panels, including selected Files and download handlers, in
// memory while switching tasks. Form contents are never written to storage.
export class ToolPanels {
  panels=new Map();
  remember(panel){
    if(!panel?.dataset.tool)return;
    panel.querySelectorAll('input[type=password]').forEach(input=>input.value='');
    this.panels.set(panel.dataset.tool,panel);
  }
  take(tool){return this.panels.get(tool);}
}
export function clearOutputs(panel){panel?.querySelector('#outputs')?.replaceChildren();}
export function bindOutputInvalidation(panel){
  for(const event of ['input','change'])panel.addEventListener(event,e=>{
    if(e.target.matches('input,select,textarea'))clearOutputs(panel);
  });
}
export const dialogIsOpen=()=>!!document.querySelector('dialog[open]');
