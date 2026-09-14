/* BALKAN TMS — modules/clients.js
   Klijenti i partneri
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { esc, toast } from '../core/dom.js';
import { audit } from '../core/rbac.js';
import { Store } from '../core/store.js';
import { Views } from './registry.js';
import { actionBtns, bindSave, closeModal, companyField, confirmDelete, field, openModal, pageHeader, saveBtn } from '../ui/modal.js';
import { badge, compDot } from '../ui/status.js';
import { renderTable } from '../ui/table.js';

Views.clients=()=>{const rows=Store.scoped('clients');return pageHeader('Klijenti i partneri','clients','Novi klijent',true)+renderTable({id:'clients',exportName:'klijenti',columns:[
  {key:'name',label:'Naziv',render:r=>compDot(r.company_id)+esc(r.name)},
  {key:'type',label:'Tip',render:r=>'<span class="tag">'+esc(r.type)+'</span>'},
  {key:'country',label:'Država'},{key:'vat_id',label:'PIB/VAT'},
  {key:'payment_terms_days',label:'Rok plać.',num:true,render:r=>r.payment_terms_days+' d'},
  {key:'rating',label:'Ocena',render:r=>'<span class="tag">'+esc(r.rating)+'</span>'},
  {key:'status',label:'Status',render:r=>badge(r.status)}],
  filters:[{key:'type',label:'Tip',options:[...new Set(rows.map(r=>r.type))].map(t=>({v:t,l:t}))},{key:'status',label:'Status',options:[{v:'aktivan',l:'aktivan'},{v:'neaktivan',l:'neaktivan'}]}],
  rows,getRows:()=>Store.scoped('clients'),actions:r=>actionBtns('clients',r,'editClient','delClient')});};
window.__new_clients=()=>openClientForm();
function openClientForm(id){const r=id?Store.get('clients',id):{};
  const body='<div class="form-grid">'+companyField(r)+field({name:'name',label:'Naziv',value:r.name,full:true})+
    field({name:'type',label:'Tip',type:'select',value:r.type||'klijent',options:['klijent','primalac','posiljalac','aukcija','dealer','fizicko','dobavljac','servis','podizvodjac'].map(t=>({v:t,l:t}))})+
    field({name:'country',label:'Država',value:r.country})+field({name:'vat_id',label:'PIB / VAT ID',value:r.vat_id})+
    field({name:'payment_terms_days',label:'Rok plaćanja (dana)',type:'number',value:r.payment_terms_days==null?30:r.payment_terms_days})+
    field({name:'rating',label:'Ocena',type:'select',value:r.rating||'A',options:[{v:'A',l:'A — pouzdan'},{v:'B',l:'B'},{v:'C',l:'C — rizik naplate'}]})+
    field({name:'status',label:'Status',type:'select',value:r.status||'aktivan',options:[{v:'aktivan',l:'aktivan'},{v:'neaktivan',l:'neaktivan'}]})+
    field({name:'address',label:'Adresa',value:r.address,full:true})+field({name:'note',label:'Napomena o naplati',type:'textarea',value:r.note,full:true})+'</div>';
  openModal(id?'Izmena klijenta':'Novi klijent',body,saveBtn());
  bindSave(f=>{f.payment_terms_days=Number(f.payment_terms_days)||0;if(id){Store.update('clients',id,f);audit('update','client',id,'Izmena klijenta '+f.name);}else{const n=Store.insert('clients',f);audit('create','client',n.id,'Nov klijent '+f.name);}toast('Klijent sačuvan');closeModal();render();});}
window.editClient=id=>openClientForm(id);
window.delClient=id=>confirmDelete('clients',id,'klijenta');

export {
  openClientForm
};
