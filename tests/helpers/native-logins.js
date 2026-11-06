import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {LETTERS,NUMBERS} from '../../src/toolbox.js';
const codePattern=length=>new RegExp('^'+Array.from({length},(_,i)=>`[${i%2?NUMBERS:LETTERS}]`).join('')+'$');
export function codeShape(value,length,prefixes=false){
 const match=prefixes?value.match(/^(T\d{2}_|RS_|RV_|TL_)?(.*)$/):['',null,value];
 assert.ok(match);assert.match(match[2],codePattern(length));return (match[1]||'')+`<${length}>`;
}
export function groupShape(value){const match=value.match(/^(.*)_([^_]+)$/);if(!match)return value;assert.match(match[2],codePattern(4));return match[1]+'_<4>';}
export function loginRowsShape(rows,options){
 assert.equal(new Set(rows.map(r=>r.name)).size,rows.length,'generated login names must be unique');
 return rows.map(row=>({...row,name:codeShape(row.name,options.length,true),group:groupShape(row.group),password:options.passwordLength?codeShape(row.password,options.passwordLength):row.password}));
}
export function loginXMLTree(bytes,{renew=false,length=5,passwordLength=0}={}){
 const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'text/xml');
 const names=Array.from(doc.getElementsByTagName('Login')).map(e=>e.getAttribute('name'));assert.equal(new Set(names).size,names.length);
 function tree(el){
  const attrs=Array.from(el.attributes).map(a=>{let value=a.value;if(renew&&el.nodeName==='Login'&&a.name==='name')value=codeShape(value,length,true);if(renew&&el.nodeName==='Login'&&a.name==='pw')value=codeShape(value,passwordLength);if(renew&&el.nodeName==='Group'&&a.name==='id')value=groupShape(value);return [a.name,value];}).sort();
  const children=Array.from(el.childNodes).filter(c=>c.nodeType===1);return {name:el.nodeName,attrs:Object.fromEntries(attrs),content:children.length?children.map(tree):el.textContent};
 }
 return tree(doc.documentElement);
}
