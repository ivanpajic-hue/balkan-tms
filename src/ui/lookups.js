/* BALKAN TMS — ui/lookups.js
   Šifarnici — helperi
   Modul generisan iz monolita v3.0 (A0.2). */
import { state } from '../core/state.js';
import { Store } from '../core/store.js';

function lk(table){const cid=state.companyId;return Store.all(table).filter(r=>r.active!==false&&(r.company_id==null||cid==='ALL'||r.company_id===cid)).sort((a,b)=>String(a.name||a.code).localeCompare(String(b.name||b.code)));}
function lkOpts(table,empty){const o=lk(table).map(r=>({v:r.code,l:r.name||r.code}));return empty?[{v:'',l:empty}].concat(o):o;}
function lkName(table,code){const r=Store.all(table).find(x=>x.code===code);return r?(r.name||r.code):code;}
function setting(key,def){const r=Store.all('settings').find(s=>s.key===key);return r?r.value:def;}
function setSetting(key,val){const r=Store.all('settings').find(s=>s.key===key);if(r)Store.update('settings',r.id,{value:val});else Store.insert('settings',{company_id:null,key,value:val});}
function countryOpts(empty){const o=lk('countries').map(c=>({v:c.code,l:c.code+' — '+c.name}));return empty?[{v:'',l:empty}].concat(o):o;}

export {
  lk,
  lkOpts,
  lkName,
  setting,
  setSetting,
  countryOpts
};
