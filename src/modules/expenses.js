/* BALKAN TMS — modules/expenses.js
   Troškovi
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { esc, fmtDate, fmtMoney, toast, todayISO } from '../core/dom.js';
import { audit, can } from '../core/rbac.js';
import { userCompanies } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { Views } from './registry.js';
import { lk, lkName } from '../ui/lookups.js';
import { actionBtns, appendOptionAll, bindSave, closeModal, companyField, confirmDelete, field, openModal, pageHeader, quickAddLookup, saveBtn } from '../ui/modal.js';
import { compDot } from '../ui/status.js';
import { renderTable } from '../ui/table.js';

Views.expenses=()=>{const rows=Store.scoped('expenses');return pageHeader('Troškovi','expenses','Novi trošak',true)+renderTable({id:'expenses',exportName:'troskovi',columns:[
  {key:'date',label:'Datum',sortVal:r=>r.date,render:r=>compDot(r.company_id)+fmtDate(r.date)},
  {key:'category_code',label:'Kategorija',render:r=>'<span class="tag">'+esc(lkName('expense_categories',r.category_code))+'</span>'},
  {key:'trip',label:'Tura',sortVal:r=>(Store.get('trips',r.trip_id)||{}).trip_no,render:r=>esc((Store.get('trips',r.trip_id)||{}).trip_no||'—')},
  {key:'vehicle',label:'Vozilo',render:r=>esc((Store.get('fleet_vehicles',r.fleet_vehicle_id)||{}).internal_no||'—')},
  {key:'driver',label:'Vozač',render:r=>esc((Store.get('drivers',r.driver_id)||{}).full_name||'—')},
  {key:'amount',label:'Iznos',num:true,sortVal:r=>r.amount_base,render:r=>fmtMoney(r.amount,r.currency)},
  {key:'refundable',label:'Refund.',render:r=>r.refundable?'<span class="tag">da</span>':'—'},
  {key:'approved',label:'Odobreno',render:r=>r.approved?'<span class="badge b-green">da</span>':'<span class="badge b-amber">čeka</span>'}],
  filters:[{key:'category_code',label:'Kategorija',options:lk('expense_categories').map(c=>({v:c.code,l:c.name}))},{key:'approved',label:'Odobreno',options:[{v:'true',l:'da'},{v:'false',l:'ne'}],get:r=>String(r.approved)}],
  dateFilters:[{key:'date',label:'Datum'}],
  rows,getRows:()=>Store.scoped('expenses'),actions:r=>{let b='';if(can('expenses','A')&&!r.approved)b+='<button class="btn sm" onclick="approveExpense(\''+r.id+'\')">Odobri</button>';return b+actionBtns('expenses',r,'editExpense','delExpense');}});};
window.__new_expenses=()=>openExpenseForm();
function openExpenseForm(id,prefill){const r=id?Store.get('expenses',id):(prefill?Object.assign({},prefill):{});const comp=r.company_id||(state.companyId==='ALL'?(userCompanies()[0]||{}).id:state.companyId);
  const trips=Store.all('trips').filter(t=>t.company_id===comp);const vehicles=Store.all('fleet_vehicles').filter(v=>v.company_id===comp);const drivers=Store.all('drivers').filter(d=>d.company_id===comp);const cats=lk('expense_categories');const retTrip=r._returnTrip;
  const body='<div class="form-grid">'+companyField(r)+field({name:'date',label:'Datum',type:'date',value:r.date||todayISO()})+
    '<div class="field"><label>Kategorija</label><div style="display:flex;gap:6px"><select name="category_code" class="cat-sel" style="flex:1;padding:9px 11px;border:1px solid var(--border);border-radius:8px">'+cats.map(c=>'<option value="'+esc(c.code)+'" '+((r.category_code||(cats[0]||{}).code)===c.code?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select><button type="button" class="btn sm" onclick="__expNewCat()" title="Brzo dodaj kategoriju">+</button></div></div>'+
    field({name:'amount',label:'Iznos',type:'number',value:r.amount==null?0:r.amount,attr:'step="0.01"'})+field({name:'currency',label:'Valuta',type:'select',value:r.currency||'EUR',options:[{v:'EUR',l:'EUR'},{v:'RSD',l:'RSD'},{v:'USD',l:'USD'}]})+
    field({name:'payment_method',label:'Način plaćanja',type:'select',value:r.payment_method||'gotovina',options:['gotovina','kartica','transfer','gorivska kartica'].map(m=>({v:m,l:m}))})+
    field({name:'doc_ref',label:'Br. računa / slip',value:r.doc_ref})+
    field({name:'trip_id',label:'Tura',type:'select',value:r.trip_id,options:[{v:'',l:'—'}].concat(trips.map(t=>({v:t.id,l:t.trip_no})))})+
    field({name:'fleet_vehicle_id',label:'Vozilo',type:'select',value:r.fleet_vehicle_id,options:[{v:'',l:'—'}].concat(vehicles.map(v=>({v:v.id,l:v.internal_no})))})+
    field({name:'driver_id',label:'Vozač',type:'select',value:r.driver_id,options:[{v:'',l:'—'}].concat(drivers.map(d=>({v:d.id,l:d.full_name})))})+
    field({name:'refundable',label:'',type:'checkbox',value:r.refundable,cblabel:'Refundira se vozaču'})+
    field({name:'note',label:'Napomena',type:'textarea',value:r.note,full:true})+'</div>';
  openModal(id?'Izmena troška':'Novi trošak',body,saveBtn());
  window.__expNewCat=()=>quickAddLookup('expense_categories','Stavka troška',(code,name)=>appendOptionAll('.cat-sel',code,name));
  bindSave(f=>{f.amount=Number(f.amount)||0;f.fx_rate=1;f.amount_base=f.amount;f.approved=id?r.approved:can('expenses','A');if(id){Store.update('expenses',id,f);audit('update','expense',id,'Izmena troška');}else{const n=Store.insert('expenses',f);audit('create','expense',n.id,'Nov trošak '+f.category_code);}toast('Trošak sačuvan');closeModal();if(retTrip)viewTrip(retTrip);else render();});}
window.editExpense=id=>openExpenseForm(id);
window.delExpense=id=>confirmDelete('expenses',id,'trošak');
window.approveExpense=id=>{Store.update('expenses',id,{approved:true,approved_by:state.user.id});audit('approve','expense',id,'Odobren trošak');toast('Trošak odobren');render();};

export {
  openExpenseForm
};
