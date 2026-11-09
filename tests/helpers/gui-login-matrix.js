import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import {loadWorkbook,loginRows,named} from '../../src/toolbox.js';
import {codeShape,loginRowsShape,loginXMLTree} from './native-logins.js';
import {workbookCells} from '../../scripts/testcenter-study.mjs';

export const matrixRoot=new URL('../fixtures/gui-login-matrix-20261109/',import.meta.url);
const archives=new Map();
export async function matrixFiles(c){
  const bundle=Math.floor(c.sequence/4).toString().padStart(2,'0');
  if(!archives.has(bundle))archives.set(bundle,unzipSync(await readFile(new URL('cases-'+bundle+'.zip',matrixRoot))));
  const files=archives.get(bundle);
  return {files,input:files['inputs/'+c.id+'.xlsx'],native:files['native/'+c.id+'.xlsx'],names:c.separate?c.groupIDs.map(id=>id+'.xml'):[c.id+'.xml']};
}

export async function compareMatrixGeneration(c,outputs,reference){
  const {files,native,names}=reference;
  const actual=await loadWorkbook(outputs['Logins-browser.xlsx']),expected=await loadWorkbook(native);
  assert.deepEqual(loginRowsShape(loginRows(actual),c),loginRowsShape(loginRows(expected),c),c.id+' login rows');
  assert.deepEqual(Object.keys(outputs).filter(n=>n.endsWith('.xml')),names,c.id+' filenames');
  for(const name of names)assert.deepEqual(loginXMLTree(outputs[name],{renew:true,...c}),loginXMLTree(files['native/'+name],{renew:true,...c}),c.id+' '+name);
  for(const workbook of [actual,expected]){
    const name=named(workbook,'loginsCol.Name'),password=named(workbook,'loginsCol.Password');
    for(let i=0;i<loginRows(workbook).length;i++){
      const row=name.row+1+i,n=name.sheet.getCell(name.col+row),p=password.sheet.getCell(password.col+row);
      n.value=codeShape(n.text,c.length,true);
      if(c.passwordLength)p.value=codeShape(p.text,c.passwordLength);
    }
  }
  assert.deepEqual(workbookCells(actual),workbookCells(expected),c.id+' every normalized workbook cell');
}

export async function compareMatrixReopen(c,outputs,reference){
  const {files,names}=reference;
  assert.deepEqual(Object.keys(outputs).filter(n=>n.endsWith('.xml')),names,c.id+' reopened filenames');
  for(const name of names)assert.deepEqual(Buffer.from(outputs[name]),Buffer.from(files['reopened/'+name]),c.id+' byte-exact reopened XML');
  assert.deepEqual(workbookCells(await loadWorkbook(outputs['Logins-browser.xlsx'])),workbookCells(await loadWorkbook(files['reopened/'+c.id+'.xlsx'])),c.id+' every reopened workbook cell');
}
