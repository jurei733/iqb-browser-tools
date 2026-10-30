// Keep large response/log collections in the worker; send only the visible page.
export function databasePage(people,{mode='responses',search='',unit='',page=0,pageSize=100}={}) {
  const rows=[],needle=String(search).toLowerCase(),unitNeedle=String(unit).toLowerCase();
  let total=0;page=Math.max(0,Math.floor(Number(page)||0));pageSize=Math.max(1,Math.min(100,Math.floor(Number(pageSize)||100)));
  const add=row=>{if(total>=page*pageSize&&rows.length<pageSize)rows.push(row);total++;};
  for(const p of people){
    if(needle&&!`${p.group} ${p.login} ${p.code}`.toLowerCase().includes(needle))continue;
    for(const b of p.booklets){
      const base={group:p.group,login:p.login,personCode:p.code,booklet:b.id};
      if(mode==='logs'&&!unitNeedle)for(const l of b.logs||[])add({...base,unit:'',scope:'Testheft',...l});
      for(const u of b.units){
        if(unitNeedle&&!`${u.id} ${u.alias}`.toLowerCase().includes(unitNeedle))continue;
        if(mode==='logs')for(const l of u.logs||[])add({...base,unit:u.id,scope:'Aufgabe',...l});
        else for(const sf of u.subforms)for(const r of sf.responses)add({...base,unit:u.id,subform:sf.id,variable:r.id,value:r.value,status:r.status,code:r.code,score:r.score});
      }
    }
  }
  return {mode,total,page,pageSize,rows};
}
