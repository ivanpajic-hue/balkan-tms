/* BALKAN TMS — modules/invoices.js
   Fakture
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { $, $$, esc, fmtDate, fmtMoney, toast, todayISO } from '../core/dom.js';
import { audit, can } from '../core/rbac.js';
import { userCompanies } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { invoicedSum } from './orders.js';
import { Views } from './registry.js';
import { actionBtns, bindSave, closeModal, companyField, confirmDelete, field, openModal, pageHeader, saveBtn } from '../ui/modal.js';
import { badge, compDot } from '../ui/status.js';
import { renderTable } from '../ui/table.js';

function paidSum(invId){return Store.all('payments').filter(p=>p.invoice_id===invId).reduce((s,p)=>s+p.amount,0);}
Views.invoices=()=>{const rows=Store.scoped('invoices');return pageHeader('Fakture','invoices','Nova faktura',true)+renderTable({id:'invoices',exportName:'fakture',columns:[
  {key:'invoice_no',label:'Broj',render:r=>compDot(r.company_id)+'<b>'+esc(r.invoice_no)+'</b>'},
  {key:'client',label:'Klijent',sortVal:r=>(Store.get('clients',r.client_id)||{}).name,render:r=>esc((Store.get('clients',r.client_id)||{}).name||'—')},
  {key:'issue_date',label:'Izdata',render:r=>fmtDate(r.issue_date)},
  {key:'total_gross',label:'Iznos',num:true,sortVal:r=>r.total_gross,render:r=>fmtMoney(r.total_gross,r.currency)},
  {key:'paid',label:'Plaćeno',num:true,sortVal:r=>paidSum(r.id),render:r=>fmtMoney(paidSum(r.id),r.currency)},
  {key:'status',label:'Status',render:r=>badge(r.status)},
  {key:'sef_status',label:'SEF',render:r=>'<span class="tag">'+esc(r.sef_status)+'</span>'}],
  filters:[{key:'status',label:'Status',options:['nacrt','poslato','delimicno','placeno','kasni','stornirano'].map(s=>({v:s,l:s}))}],
  dateFilters:[{key:'issue_date',label:'Izdata'}],
  rows,getRows:()=>Store.scoped('invoices'),actions:r=>'<button class="btn sm" onclick="viewInvoice(\''+r.id+'\')">Pregled</button>'+(can('invoices','E')?'<button class="btn sm" onclick="addPayment(\''+r.id+'\')">+ Uplata</button>':'')+actionBtns('invoices',r,null,'delInvoice')});};
window.__new_invoices=()=>openInvoiceForm();
function nextInvoiceNo(c){const y=new Date().getFullYear();const pre=(c==='avto'?'AV-':'TR-')+y+'-';const nums=Store.all('invoices').filter(i=>i.company_id===c&&String(i.invoice_no).indexOf(String(y))>-1).map(i=>parseInt(String(i.invoice_no).split('-').pop())).filter(n=>!isNaN(n));return pre+String((nums.length?Math.max(...nums):0)+1).padStart(4,'0');}
window.delInvoice=id=>confirmDelete('invoices',id,'fakturu');
function openInvoiceForm(){const comp=state.companyId==='ALL'?(userCompanies()[0]||{}).id:state.companyId;const clients=Store.all('clients').filter(c=>c.company_id===comp);
  const body='<div class="pill-note">Faktura obuhvata naloge <b>istog klijenta</b> i <b>iste kompanije</b>. Dozvoljeno je <b>više faktura po nalogu</b> — nudi se preostali iznos za fakturisanje, koji možete izmeniti.</div><div class="form-grid">'+companyField({company_id:comp})+field({name:'client_id',label:'Klijent',type:'select',value:'',options:[{v:'',l:'— izaberi —'}].concat(clients.map(c=>({v:c.id,l:c.name}))),attr:'id="invClient"'})+'</div><div id="invOrders" class="muted small" style="margin-top:10px">Izaberite klijenta da vidite naloge.</div>';
  openModal('Nova faktura',body,'<button class="btn" data-close>Otkaži</button><button class="btn pri" id="invCreate" disabled>Kreiraj fakturu</button>');$$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
  const compSel=()=>{const el=$('[name=company_id]',$('#modalRoot'));return el?el.value:comp;};
  function refresh(){const cid=$('#invClient').value;const company=compSel();const box=$('#invOrders');if(!cid){box.innerHTML='Izaberite klijenta.';$('#invCreate').disabled=true;return;}
    const ords=Store.all('transport_orders').filter(o=>o.company_id===company&&o.client_id===cid&&['isporucen','fakturisan'].includes(o.status)).map(o=>({o,rem:+(o.agreed_price-invoicedSum(o.id)).toFixed(2)})).filter(x=>x.rem>0.005);
    if(!ords.length){box.innerHTML='<div class="pill-note">Nema naloga sa preostalim iznosom za fakturisanje za ovog klijenta.</div>';$('#invCreate').disabled=true;return;}
    box.innerHTML='<div class="subhead" style="border:0;padding-top:0">Nalozi sa preostalim iznosom</div>'+ords.map(x=>'<label style="display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)"><input type="checkbox" class="ordck" value="'+x.o.id+'" style="width:auto"><span style="flex:1"><b>'+esc(x.o.order_no)+'</b> · '+esc(x.o.pickup_location)+' → '+esc(x.o.delivery_location)+'<div class="small muted">ukupno '+fmtMoney(x.o.agreed_price)+' · preostalo '+fmtMoney(x.rem)+'</div></span><input type="number" class="ordamt" data-id="'+x.o.id+'" value="'+x.rem+'" step="0.01" style="width:110px;padding:6px 8px;border:1px solid var(--border);border-radius:8px"></span></label>').join('');
    $$('.ordck',box).forEach(ck=>ck.onchange=()=>{$('#invCreate').disabled=!$$('.ordck:checked',box).length;});}
  $('#invClient').onchange=refresh;const ce=$('[name=company_id]',$('#modalRoot'));if(ce&&ce.tagName==='SELECT')ce.onchange=()=>{$('#invClient').innerHTML='<option value="">— izaberi —</option>'+Store.all('clients').filter(c=>c.company_id===compSel()).map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');refresh();};
  $('#invCreate').onclick=()=>{const company=compSel();const cid=$('#invClient').value;const picked=$$('#invOrders .ordck:checked').map(ck=>{const amt=Number(($('.ordamt[data-id="'+ck.value+'"]')||{}).value)||0;return{id:ck.value,price:amt};}).filter(p=>p.price>0);if(!picked.length){toast('Unesite iznos za bar jedan nalog');return;}
    const inv=Store.insert('invoices',{company_id:company,invoice_no:nextInvoiceNo(company),client_id:cid,supply_date:todayISO(),issue_date:todayISO(),currency:'EUR',total_net:0,total_vat:0,total_gross:0,status:'nacrt',sef_status:'nije_poslato',note:''});
    let net=0;picked.forEach(p=>{const o=Store.get('transport_orders',p.id);Store.insert('invoice_items',{invoice_id:inv.id,company_id:company,order_id:p.id,trip_id:null,description:'Transport vozila (nalog '+o.order_no+')',qty:1,unit_price:p.price,vat_rate:0,line_net:p.price,line_vat:0,line_gross:p.price});const fully=invoicedSum(p.id)+0.005>=o.agreed_price;Store.update('transport_orders',p.id,{status:fully?'fakturisan':o.status});net+=p.price;});
    Store.update('invoices',inv.id,{total_net:net,total_vat:0,total_gross:net});audit('create','invoice',inv.id,'Kreirana faktura '+inv.invoice_no+' ('+picked.length+' naloga)');toast('Faktura kreirana');closeModal();render();viewInvoice(inv.id);};}
window.viewInvoice=id=>{const inv=Store.get('invoices',id);const c=Store.get('clients',inv.client_id);const comp=Store.get('companies',inv.company_id);const items=Store.all('invoice_items').filter(i=>i.invoice_id===id);const pays=Store.all('payments').filter(p=>p.invoice_id===id);const paid=pays.reduce((s,p)=>s+p.amount,0);
  const body='<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="b800" style="font-size:16px">'+esc(comp.name)+'</div><div class="small muted">'+esc(comp.address)+'<br>PIB/VAT: '+esc(comp.vat_id)+'</div></div><div style="text-align:right"><div class="b800" style="font-size:18px">Faktura '+esc(inv.invoice_no)+'</div><div class="small muted">Izdata: '+fmtDate(inv.issue_date)+'<br>Promet: '+fmtDate(inv.supply_date)+'</div></div></div>'+
    '<div class="section-title">Kupac</div><div>'+esc(c?c.name:'')+' · '+esc(c?c.country:'')+' · VAT '+esc(c?c.vat_id:'')+'</div>'+
    '<table class="mini-table" style="margin-top:14px"><thead><tr><th>Opis</th><th class="num">Kol.</th><th class="num">Cena</th><th class="num">PDV%</th><th class="num">Iznos</th></tr></thead><tbody>'+items.map(it=>'<tr><td>'+esc(it.description)+'</td><td class="num">'+it.qty+'</td><td class="num">'+fmtMoney(it.unit_price)+'</td><td class="num">'+it.vat_rate+'%</td><td class="num">'+fmtMoney(it.line_gross)+'</td></tr>').join('')+'</tbody></table>'+
    '<div style="text-align:right;margin-top:12px"><div>Osnovica: <b>'+fmtMoney(inv.total_net)+'</b></div><div>PDV: <b>'+fmtMoney(inv.total_vat)+'</b></div><div style="font-size:17px;margin-top:4px">Ukupno: <b>'+fmtMoney(inv.total_gross,inv.currency)+'</b></div><div class="small muted">Plaćeno: '+fmtMoney(paid)+' · Preostalo: '+fmtMoney(inv.total_gross-paid)+'</div></div>'+
    '<div class="section-title">Status</div><div class="flex">'+badge(inv.status)+' <span class="tag">SEF: '+esc(inv.sef_status)+'</span></div>'+(pays.length?'<div class="section-title">Uplate</div><table class="mini-table"><tbody>'+pays.map(p=>'<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.method)+'</td><td class="num">'+fmtMoney(p.amount)+'</td></tr>').join('')+'</tbody></table>':'');
  let footer='<button class="btn no-print" onclick="window.print()">Štampa / PDF</button>';
  if(can('invoices','E')){footer+='<button class="btn no-print" onclick="addPayment(\''+id+'\')">+ Uplata</button><select id="invStatus" class="no-print" style="padding:8px;border:1px solid var(--border);border-radius:8px">'+['nacrt','poslato','delimicno','placeno','kasni','stornirano'].map(s=>'<option '+(inv.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select><button class="btn pri no-print" id="invSaveStatus">Sačuvaj status</button>';}
  footer+='<button class="btn" data-close>Zatvori</button>';openModal('Pregled fakture',body,footer,true);$$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
  const ss=$('#invSaveStatus');if(ss)ss.onclick=()=>{const st=$('#invStatus').value;Store.update('invoices',id,{status:st});if(st==='placeno')Store.all('invoice_items').filter(i=>i.invoice_id===id&&i.order_id).forEach(i=>Store.update('transport_orders',i.order_id,{status:'placen'}));audit('update','invoice',id,'Status fakture → '+st);toast('Status ažuriran');closeModal();render();};};
window.addPayment=id=>{const inv=Store.get('invoices',id);const remaining=inv.total_gross-paidSum(id);
  const body='<div class="form-grid">'+field({name:'date',label:'Datum',type:'date',value:todayISO()})+field({name:'amount',label:'Iznos',type:'number',value:remaining})+field({name:'method',label:'Način',type:'select',value:'transfer',options:['transfer','kartica','gotovina'].map(m=>({v:m,l:m}))})+'</div>';
  openModal('Nova uplata — '+inv.invoice_no,body,saveBtn());bindSave(f=>{f.amount=Number(f.amount)||0;f.invoice_id=id;f.company_id=inv.company_id;f.currency=inv.currency;Store.insert('payments',f);const paid=paidSum(id);const st=paid>=inv.total_gross?'placeno':(paid>0?'delimicno':inv.status);Store.update('invoices',id,{status:st});if(st==='placeno')Store.all('invoice_items').filter(i=>i.invoice_id===id&&i.order_id).forEach(i=>Store.update('transport_orders',i.order_id,{status:'placen'}));audit('update','invoice',id,'Uplata '+fmtMoney(f.amount));toast('Uplata zabeležena');closeModal();render();});};

export {
  paidSum,
  nextInvoiceNo,
  openInvoiceForm
};
