/* BALKAN TMS — modules/drivers.js
   Vozači
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { $, $$, addDays, daysUntil, esc, fmtDate, toast, todayISO } from '../core/dom.js';
import { audit, can } from '../core/rbac.js';
import { Store } from '../core/store.js';
import { Views } from './registry.js';
import { lk } from '../ui/lookups.js';
import { actionBtns, bindSave, closeModal, companyField, confirmDelete, field, openModal, pageHeader, saveBtn } from '../ui/modal.js';
import { badge, compDot } from '../ui/status.js';
import { renderTable } from '../ui/table.js';

Views.drivers=()=>{const rows=Store.scoped('drivers');return pageHeader('Vozači','drivers','Novi vozač',true)+renderTable({id:'drivers',exportName:'vozaci',columns:[
  {key:'full_name',label:'Ime i prezime',render:r=>compDot(r.company_id)+esc(r.full_name)},
  {key:'phone',label:'Telefon'},
  {key:'license_categories',label:'Kategorije'},
  {key:'hire_date',label:'Saradnja od',render:r=>fmtDate(r.hire_date)},
  {key:'docs',label:'Dokumenti rok',render:r=>nextDriverAlert(r.id)},
  {key:'status',label:'Status',render:r=>badge(r.status)}],
  rows,getRows:()=>Store.scoped('drivers'),actions:r=>'<button class="btn sm" onclick="viewDriver(\''+r.id+'\')">Dokumenti</button>'+actionBtns('drivers',r,'editDriver','delDriver')});};
window.__new_drivers=()=>openDriverForm();
function nextDriverAlert(did){const docs=Store.all('driver_documents').filter(d=>d.driver_id===did&&d.expires_at).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at));if(!docs.length)return '—';const d=docs[0];const du=daysUntil(d.expires_at);const cls=du<0?'b-red':(du<=30?'b-amber':'b-grey');return '<span class="badge '+cls+'">'+esc(d.doc_type)+' '+(du<0?'isteklo':du+'d')+'</span>';}
function openDriverForm(id){const r=id?Store.get('drivers',id):{};const body='<div class="form-grid">'+companyField(r)+field({name:'full_name',label:'Ime i prezime',value:r.full_name,full:true})+field({name:'phone',label:'Telefon',value:r.phone})+field({name:'email',label:'Email',value:r.email})+field({name:'license_categories',label:'Kategorije dozvole',value:r.license_categories})+field({name:'hire_date',label:'Saradnja od',type:'date',value:r.hire_date||todayISO()})+field({name:'status',label:'Status',type:'select',value:r.status||'aktivan',options:[{v:'aktivan',l:'aktivan'},{v:'neaktivan',l:'neaktivan'}]})+field({name:'note',label:'Napomena',type:'textarea',value:r.note,full:true})+'</div>';openModal(id?'Izmena vozača':'Novi vozač',body,saveBtn());bindSave(f=>{if(id){Store.update('drivers',id,f);audit('update','driver',id,'Izmena vozača');}else{const n=Store.insert('drivers',f);audit('create','driver',n.id,'Nov vozač '+f.full_name);}toast('Vozač sačuvan');closeModal();render();});}
window.editDriver=id=>openDriverForm(id);
window.delDriver=id=>confirmDelete('drivers',id,'vozača');
window.viewDriver=id=>{const v=Store.get('drivers',id);const docs=Store.all('driver_documents').filter(d=>d.driver_id===id);
  const body='<div class="detail-grid"><div class="di"><div class="k">Vozač</div><div class="v">'+compDot(v.company_id)+'<b>'+esc(v.full_name)+'</b></div></div><div class="di"><div class="k">Telefon</div><div class="v">'+esc(v.phone)+'</div></div><div class="di"><div class="k">Kategorije</div><div class="v">'+esc(v.license_categories)+'</div></div><div class="di"><div class="k">Status</div><div class="v">'+badge(v.status)+'</div></div></div>'+
    '<div class="section-title">Dokumenti i rokovi ('+docs.length+') '+(can('drivers','E')?'<button class="btn sm" style="float:right" onclick="addDriverDoc(\''+id+'\')">+ Dokument</button>':'')+'</div><table class="mini-table"><thead><tr><th>Tip</th><th>Ističe</th><th>Status</th>'+(can('drivers','E')?'<th></th>':'')+'</tr></thead><tbody>'+(docs.length?docs.map(d=>{const du=daysUntil(d.expires_at);return '<tr><td>'+esc(d.doc_type)+'</td><td>'+fmtDate(d.expires_at)+'</td><td>'+(du<0?badge('isteklo'):(du<=30?'<span class="badge b-amber">'+du+' dana</span>':'<span class="badge b-green">'+du+' dana</span>'))+'</td>'+(can('drivers','E')?'<td class="num"><button class="btn sm danger" onclick="delDriverDoc(\''+d.id+'\',\''+id+'\')">×</button></td>':'')+'</tr>';}).join(''):'<tr><td colspan="4" class="muted" style="padding:12px">Nema dokumenata.</td></tr>')+'</tbody></table>';
  openModal('Vozač '+v.full_name,body,'<button class="btn" data-close>Zatvori</button>',true);$$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);};
window.addDriverDoc=did=>{const v=Store.get('drivers',did);const types=lk('driver_doc_types');const def=types[0]||{code:'ostalo',default_days:365};const body='<div class="form-grid">'+field({name:'doc_type',label:'Tip dokumenta / alarma',type:'select',value:def.code,options:types.map(t=>({v:t.code,l:t.name})),attr:'id="ddType"'})+field({name:'expires_at',label:'Ističe',type:'date',value:addDays(todayISO(),def.default_days||365),attr:'id="ddExp"'})+field({name:'note',label:'Napomena',value:'',full:true})+'</div><div class="hint-inline">Tipovi se uređuju u Administraciji → Šifarnici.</div>';openModal('Novi dokument vozača',body,saveBtn());const ts=$('#ddType');if(ts)ts.onchange=()=>{const t=types.find(x=>x.code===ts.value);if(t&&$('#ddExp'))$('#ddExp').value=addDays(todayISO(),t.default_days||365);};bindSave(f=>{f.driver_id=did;f.company_id=v.company_id;Store.insert('driver_documents',f);audit('create','driver_document',did,'Dokument vozača '+f.doc_type);toast('Dokument dodat');closeModal();viewDriver(did);});};
window.delDriverDoc=(did,vid)=>{Store.remove('driver_documents',did);viewDriver(vid);};

export {
  nextDriverAlert,
  openDriverForm
};
