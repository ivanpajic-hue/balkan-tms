/* BALKAN TMS — modules/purchases.js
   Ulazni računi
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { $, addDays, esc, fmtDate, fmtMoney, toast, todayISO } from '../core/dom.js';
import { audit, can } from '../core/rbac.js';
import { userCompanies } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { Views } from './registry.js';
import { lk, lkName } from '../ui/lookups.js';
import { actionBtns, bindSave, closeModal, companyField, confirmDelete, field, openModal, pageHeader, saveBtn } from '../ui/modal.js';
import { compDot } from '../ui/status.js';
import { renderTable } from '../ui/table.js';

function purStatusBadge(s){return s==='placeno'?'<span class="badge b-green">plaćeno</span>':'<span class="badge b-amber">neplaćeno</span>';}
function purLink(r){if(r.link_type==='trip')return 'Tura: '+esc((Store.get('trips',r.trip_id)||{}).trip_no||'—');if(r.link_type==='vozilo')return 'Vozilo: '+esc((Store.get('fleet_vehicles',r.fleet_vehicle_id)||{}).internal_no||'—');if(r.link_type==='vozac')return 'Vozač: '+esc((Store.get('drivers',r.driver_id)||{}).full_name||'—');return 'Opšti trošak';}
Views.purchases=()=>{const rows=Store.scoped('purchase_invoices');
  const neplaceno=rows.filter(r=>r.status!=='placeno').reduce((s,r)=>s+r.amount,0);const placeno=rows.filter(r=>r.status==='placeno').reduce((s,r)=>s+r.amount,0);
  const kpi=(l,v,cls)=>'<div class="kpi '+(cls||'')+'"><div class="lab">'+l+'</div><div class="val">'+v+'</div></div>';
  return pageHeader('Ulazni računi','purchases','Nov ulazni račun',true)+
    '<div class="kpis">'+kpi('Neplaćeno',fmtMoney(neplaceno),neplaceno?'bad':'')+kpi('Plaćeno',fmtMoney(placeno),'ok')+kpi('Ukupno računa',rows.length,'')+'</div>'+
    renderTable({id:'purchases',exportName:'ulazni_racuni',columns:[
    {key:'date',label:'Datum',sortVal:r=>r.date,render:r=>compDot(r.company_id)+fmtDate(r.date)},
    {key:'supplier',label:'Dobavljač',sortVal:r=>r.supplier_name||'',render:r=>esc(r.supplier_name||(Store.get('clients',r.supplier_id)||{}).name||'—')},
    {key:'doc_ref',label:'Br. računa',render:r=>esc(r.doc_ref||'—')},
    {key:'category_code',label:'Vrsta troška',render:r=>'<span class="tag">'+esc(lkName('expense_categories',r.category_code))+'</span>'},
    {key:'link',label:'Veza',sortVal:r=>r.link_type,render:r=>'<span class="small">'+purLink(r)+'</span>'},
    {key:'neto',label:'Neto',num:true,sortVal:r=>r.neto||0,render:r=>fmtMoney(r.neto==null?r.amount:r.neto,r.currency)},
    {key:'pdv_rate',label:'PDV%',num:true,render:r=>(r.pdv_rate==null?'—':r.pdv_rate+'%')},
    {key:'amount',label:'Bruto',num:true,sortVal:r=>r.amount,render:r=>fmtMoney(r.amount,r.currency)},
    {key:'due_date',label:'Dospeće',render:r=>fmtDate(r.due_date)},
    {key:'status',label:'Status',render:r=>purStatusBadge(r.status)}],
    filters:[{key:'status',label:'Status',options:[{v:'placeno',l:'plaćeno'},{v:'neplaceno',l:'neplaćeno'}]},{key:'category_code',label:'Vrsta',options:lk('expense_categories').map(c=>({v:c.code,l:c.name}))},{key:'link_type',label:'Veza',options:[{v:'trip',l:'tura'},{v:'vozilo',l:'vozilo'},{v:'vozac',l:'vozač'},{v:'opsti',l:'opšti'}]}],
    dateFilters:[{key:'date',label:'Datum'},{key:'due_date',label:'Dospeće'}],
    rows,getRows:()=>Store.scoped('purchase_invoices'),actions:r=>(can('purchases','E')?'<button class="btn sm" onclick="togglePurPaid(\''+r.id+'\')">'+(r.status==='placeno'?'Označi neplaćeno':'Plaćeno')+'</button>':'')+actionBtns('purchases',r,'editPurchase','delPurchase')});};
window.__new_purchases=()=>openPurchaseForm();
function openPurchaseForm(id){const r=id?Store.get('purchase_invoices',id):{};const comp=r.company_id||(state.companyId==='ALL'?(userCompanies()[0]||{}).id:state.companyId);
  const trips=Store.all('trips').filter(t=>t.company_id===comp);const vehicles=Store.all('fleet_vehicles').filter(v=>v.company_id===comp);const drivers=Store.all('drivers').filter(d=>d.company_id===comp);const suppliers=Store.all('clients').filter(c=>c.company_id===comp);const cats=lk('expense_categories');
  const body='<div class="form-grid">'+companyField(r)+field({name:'date',label:'Datum računa',type:'date',value:r.date||todayISO()})+
    field({name:'supplier_name',label:'Dobavljač (naziv)',value:r.supplier_name})+field({name:'supplier_id',label:'Dobavljač iz klijenata (opc.)',type:'select',value:r.supplier_id||'',options:[{v:'',l:'—'}].concat(suppliers.map(c=>({v:c.id,l:c.name})))})+
    field({name:'doc_ref',label:'Broj računa',value:r.doc_ref})+field({name:'category_code',label:'Vrsta troška',type:'select',value:r.category_code||(cats[0]||{}).code,options:cats.map(c=>({v:c.code,l:c.name}))})+
    field({name:'neto',label:'Neto iznos',type:'number',value:r.neto==null?(r.amount||0):r.neto,attr:'step="0.01" data-pdv'})+field({name:'pdv_rate',label:'Stopa PDV (%)',type:'number',value:r.pdv_rate==null?22:r.pdv_rate,attr:'step="0.01" data-pdv'})+
    field({name:'bruto',label:'Bruto iznos',type:'number',value:r.bruto==null?(r.amount||0):r.bruto,attr:'step="0.01" data-pdv-bruto'})+field({name:'currency',label:'Valuta',type:'select',value:r.currency||'EUR',options:[{v:'EUR',l:'EUR'},{v:'RSD',l:'RSD'},{v:'USD',l:'USD'}]})+
    field({name:'link_type',label:'Vezivanje za',type:'select',value:r.link_type||'opsti',options:[{v:'opsti',l:'opšti trošak'},{v:'trip',l:'turu'},{v:'vozilo',l:'vozilo'},{v:'vozac',l:'vozača'}]})+
    field({name:'trip_id',label:'Tura (ako je vezano za turu)',type:'select',value:r.trip_id,options:[{v:'',l:'—'}].concat(trips.map(t=>({v:t.id,l:t.trip_no})))})+
    field({name:'fleet_vehicle_id',label:'Vozilo',type:'select',value:r.fleet_vehicle_id,options:[{v:'',l:'—'}].concat(vehicles.map(v=>({v:v.id,l:v.internal_no})))})+
    field({name:'driver_id',label:'Vozač',type:'select',value:r.driver_id,options:[{v:'',l:'—'}].concat(drivers.map(d=>({v:d.id,l:d.full_name})))})+
    field({name:'due_date',label:'Datum dospeća',type:'date',value:r.due_date||addDays(todayISO(),15)})+field({name:'status',label:'Status',type:'select',value:r.status||'neplaceno',options:[{v:'neplaceno',l:'neplaćeno'},{v:'placeno',l:'plaćeno'}]})+
    field({name:'note',label:'Napomena',type:'textarea',value:r.note,full:true})+'</div>';
  openModal(id?'Izmena ulaznog računa':'Nov ulazni račun',body,saveBtn());
  const root=$('#modalRoot');const gv=n=>Number(($('[name='+n+']',root)||{}).value)||0;
  root.querySelectorAll('[data-pdv]').forEach(el=>el.oninput=()=>{const b=+(gv('neto')*(1+gv('pdv_rate')/100)).toFixed(2);const bf=$('[name=bruto]',root);if(bf)bf.value=b;});
  bindSave(f=>{f.neto=Number(f.neto)||0;f.pdv_rate=Number(f.pdv_rate)||0;f.bruto=Number(f.bruto)|| +(f.neto*(1+f.pdv_rate/100)).toFixed(2);f.amount=f.bruto;if(id){Store.update('purchase_invoices',id,f);audit('update','purchase',id,'Izmena ulaznog računa');}else{const n=Store.insert('purchase_invoices',f);audit('create','purchase',n.id,'Nov ulazni račun '+(f.supplier_name||''));}toast('Ulazni račun sačuvan');closeModal();render();});}
window.editPurchase=id=>openPurchaseForm(id);
window.delPurchase=id=>confirmDelete('purchase_invoices',id,'ulazni račun');
window.togglePurPaid=id=>{const r=Store.get('purchase_invoices',id);Store.update('purchase_invoices',id,{status:r.status==='placeno'?'neplaceno':'placeno'});audit('update','purchase',id,'Status ulaznog računa');render();};

export {
  purStatusBadge,
  purLink,
  openPurchaseForm
};
