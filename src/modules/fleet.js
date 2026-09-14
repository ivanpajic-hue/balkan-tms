/* BALKAN TMS — modules/fleet.js
   Vozni park
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { $, $$, addDays, daysUntil, esc, fmtDate, toast, todayISO } from '../core/dom.js';
import { audit, can } from '../core/rbac.js';
import { userCompanies } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { Views } from './registry.js';
import { lk } from '../ui/lookups.js';
import { actionBtns, bindSave, closeModal, companyField, confirmDelete, field, openModal, pageHeader, saveBtn } from '../ui/modal.js';
import { badge, compDot } from '../ui/status.js';
import { renderTable } from '../ui/table.js';

function nextFleetAlert(vid){const docs=Store.all('fleet_documents').filter(d=>d.fleet_vehicle_id===vid&&d.expires_at).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at));if(!docs.length)return '—';const d=docs[0];const du=daysUntil(d.expires_at);const cls=du<0?'b-red':(du<=30?'b-amber':'b-grey');return '<span class="badge '+cls+'">'+esc(d.doc_type)+' '+(du<0?'isteklo':du+'d')+'</span>';}
Views.fleet=()=>{const rows=Store.scoped('fleet_vehicles');return pageHeader('Vozni park','fleet','Novo vozilo',true)+renderTable({id:'fleet',exportName:'vozni_park',columns:[
  {key:'internal_no',label:'Oznaka',render:r=>compDot(r.company_id)+'<b>'+esc(r.internal_no)+'</b>'},
  {key:'kind',label:'Vrsta',render:r=>'<span class="tag">'+esc(r.kind)+'</span>'},
  {key:'plate',label:'Registracija'},
  {key:'make',label:'Marka/model',render:r=>esc(r.make+' '+r.model)},
  {key:'capacity',label:'Kapacitet'},
  {key:'assigned',label:'Vozač',render:r=>esc((Store.get('drivers',r.assigned_driver_id)||{}).full_name||'—')},
  {key:'next_alert',label:'Sledeći rok',render:r=>nextFleetAlert(r.id)},
  {key:'status',label:'Status',render:r=>badge(r.status)}],
  filters:[{key:'kind',label:'Vrsta',options:[{v:'truck',l:'kamion'},{v:'trailer',l:'prikolica'},{v:'service',l:'službeno'}]},{key:'status',label:'Status',options:['aktivno','servis','rezervno','prodato','neaktivno'].map(s=>({v:s,l:s}))}],
  rows,getRows:()=>Store.scoped('fleet_vehicles'),actions:r=>'<button class="btn sm" onclick="viewFleet(\''+r.id+'\')">Dokumenti</button>'+actionBtns('fleet',r,'editFleet','delFleet')});};
window.__new_fleet=()=>openFleetForm();
function openFleetForm(id){const r=id?Store.get('fleet_vehicles',id):{};const comp=r.company_id||(state.companyId==='ALL'?(userCompanies()[0]||{}).id:state.companyId);const drivers=Store.all('drivers').filter(d=>d.company_id===comp);
  const body='<div class="form-grid">'+companyField(r)+field({name:'kind',label:'Vrsta',type:'select',value:r.kind||'truck',options:[{v:'truck',l:'kamion'},{v:'trailer',l:'prikolica/transporter'},{v:'service',l:'službeno'}]})+field({name:'internal_no',label:'Interna oznaka',value:r.internal_no})+field({name:'plate',label:'Registracija',value:r.plate})+field({name:'vin',label:'VIN',value:r.vin})+field({name:'make',label:'Marka',value:r.make})+field({name:'model',label:'Model',value:r.model})+field({name:'year',label:'Godina',type:'number',value:r.year})+field({name:'vehicle_type',label:'Tip',value:r.vehicle_type})+field({name:'capacity',label:'Kapacitet',value:r.capacity})+field({name:'current_km',label:'Kilometraža',type:'number',value:r.current_km==null?0:r.current_km})+field({name:'assigned_driver_id',label:'Zaduženi vozač',type:'select',value:r.assigned_driver_id,options:[{v:'',l:'—'}].concat(drivers.map(d=>({v:d.id,l:d.full_name})))})+field({name:'status',label:'Status',type:'select',value:r.status||'aktivno',options:['aktivno','servis','rezervno','prodato','neaktivno'].map(s=>({v:s,l:s}))})+'</div>';
  openModal(id?'Izmena vozila':'Novo vozilo',body,saveBtn());bindSave(f=>{f.year=Number(f.year)||null;f.current_km=Number(f.current_km)||0;if(id){Store.update('fleet_vehicles',id,f);audit('update','fleet_vehicle',id,'Izmena vozila');}else{const n=Store.insert('fleet_vehicles',f);audit('create','fleet_vehicle',n.id,'Novo vozilo '+f.internal_no);}toast('Vozilo sačuvano');closeModal();render();});}
window.editFleet=id=>openFleetForm(id);
window.delFleet=id=>confirmDelete('fleet_vehicles',id,'vozilo');
window.viewFleet=id=>{const v=Store.get('fleet_vehicles',id);const docs=Store.all('fleet_documents').filter(d=>d.fleet_vehicle_id===id);
  const body='<div class="detail-grid"><div class="di"><div class="k">Vozilo</div><div class="v">'+compDot(v.company_id)+'<b>'+esc(v.internal_no)+'</b> '+esc(v.make+' '+v.model)+'</div></div><div class="di"><div class="k">Registracija</div><div class="v">'+esc(v.plate)+'</div></div><div class="di"><div class="k">Kilometraža</div><div class="v">'+(v.current_km||0).toLocaleString('sr-RS')+' km</div></div><div class="di"><div class="k">Status</div><div class="v">'+badge(v.status)+'</div></div></div>'+
    '<div class="section-title">Dokumenti i rokovi ('+docs.length+') '+(can('fleet','E')?'<button class="btn sm" style="float:right" onclick="addFleetDoc(\''+id+'\')">+ Rok</button>':'')+'</div><table class="mini-table"><thead><tr><th>Tip</th><th>Ističe</th><th>Status</th>'+(can('fleet','E')?'<th></th>':'')+'</tr></thead><tbody>'+(docs.length?docs.map(d=>{const du=daysUntil(d.expires_at);return '<tr><td>'+esc(d.doc_type)+'</td><td>'+fmtDate(d.expires_at)+'</td><td>'+(du<0?badge('isteklo'):(du<=30?'<span class="badge b-amber">'+du+' dana</span>':'<span class="badge b-green">'+du+' dana</span>'))+'</td>'+(can('fleet','E')?'<td class="num"><button class="btn sm danger" onclick="delFleetDoc(\''+d.id+'\',\''+id+'\')">×</button></td>':'')+'</tr>';}).join(''):'<tr><td colspan="4" class="muted" style="padding:12px">Nema unetih dokumenata.</td></tr>')+'</tbody></table>';
  openModal('Vozilo '+v.internal_no,body,'<button class="btn" data-close>Zatvori</button>',true);$$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);};
window.addFleetDoc=vid=>{const v=Store.get('fleet_vehicles',vid);const types=lk('fleet_doc_types');const def=types[0]||{code:'ostalo',default_days:180};const body='<div class="form-grid">'+field({name:'doc_type',label:'Tip dokumenta / alarma',type:'select',value:def.code,options:types.map(t=>({v:t.code,l:t.name})),attr:'id="fdType"'})+field({name:'expires_at',label:'Ističe',type:'date',value:addDays(todayISO(),def.default_days||180),attr:'id="fdExp"'})+field({name:'note',label:'Napomena',value:'',full:true})+'</div><div class="hint-inline">Tipovi se uređuju u Administraciji → Šifarnici.</div>';openModal('Novi rok / dokument',body,saveBtn());const ts=$('#fdType');if(ts)ts.onchange=()=>{const t=types.find(x=>x.code===ts.value);if(t&&$('#fdExp'))$('#fdExp').value=addDays(todayISO(),t.default_days||180);};bindSave(f=>{f.fleet_vehicle_id=vid;f.company_id=v.company_id;Store.insert('fleet_documents',f);audit('create','fleet_document',vid,'Dokument vozila '+f.doc_type);toast('Rok dodat');closeModal();viewFleet(vid);});};
window.delFleetDoc=(did,vid)=>{Store.remove('fleet_documents',did);viewFleet(vid);};

export {
  nextFleetAlert,
  openFleetForm
};
