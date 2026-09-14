/* BALKAN TMS — app/shell.js
   Ljuska: navigacija, pretraga
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from './router.js';
import { $, $$, esc } from '../core/dom.js';
import { ROLES, can, visibleModules } from '../core/rbac.js';
import { canSeeAll, userCompanies } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { closeModal, openModal } from '../ui/modal.js';

function avatarColor(role){return (ROLES[role]||{}).color||'#2F3E9E';}
function initials(name){return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();}
function mountShell(){
  // nav grouped by sec
  const mods=visibleModules();const secs=[];mods.forEach(m=>{if(!secs.includes(m.sec))secs.push(m.sec);});
  $('#nav').innerHTML=secs.map(sec=>'<div class="sec">'+esc(sec)+'</div>'+mods.filter(m=>m.sec===sec).map(m=>'<a href="#" data-route="'+m.key+'"><span class="ic">'+m.ic+'</span>'+esc(m.label)+'</a>').join('')).join('')+'<div class="sec">Nalog</div><a href="#" onclick="openMyPassword();return false"><span class="ic">\u26BF</span>Promena lozinke</a><a href="#" onclick="logout();return false"><span class="ic">⎋</span>Odjava</a>';
  $$('#nav a[data-route]').forEach(a=>a.onclick=e=>{e.preventDefault();go(a.dataset.route);});
  // company switch
  const comps=userCompanies();let cs=comps.map(c=>'<button data-c="'+c.id+'">'+esc((c.name||c.short_name).replace(/\s*d\.o\.o\.?\s*$/i,''))+'</button>').join('');if(canSeeAll())cs+='<button data-c="ALL">OBE</button>';
  $('#companySwitch').innerHTML=cs;$$('#companySwitch button').forEach(b=>b.onclick=()=>{state.companyId=b.dataset.c;render();});
  // quick actions
  let qa='';if(can('orders','C'))qa+='<button class="btn sm" onclick="openOrderForm()">+ Nalog</button>';if(can('trips','C'))qa+='<button class="btn sm" onclick="openTripForm()">+ Tura</button>';if(can('invoices','C'))qa+='<button class="btn sm" onclick="openInvoiceForm()">+ Faktura</button>';if(can('expenses','C'))qa+='<button class="btn sm" onclick="openExpenseForm()">+ Trošak</button>';
  qa+='<button class="btn sm" onclick="refreshData()" title="Osveži podatke sa servera">⟳</button>';
  $('#quickActions').innerHTML=qa;
  // user chip
  $('#userChip').innerHTML='<span class="avatar" style="background:'+avatarColor(state.user.role)+'">'+initials(state.user.full_name)+'</span><span><div class="nm">'+esc(state.user.full_name)+'</div><div class="rl">'+esc(ROLES[state.user.role].name)+'</div></span>';
  // global search
  $('#globalSearch').oninput=e=>{const q=e.target.value.trim();if(q.length>=2)globalSearch(q);};
  $('#globalSearch').onkeydown=e=>{if(e.key==='Enter'&&e.target.value.trim().length>=1)globalSearch(e.target.value.trim());};
}
function globalSearch(q){const ql=q.toLowerCase();const hits=[];
  Store.scoped('transport_orders').forEach(o=>{if((o.order_no+' '+o.pickup_location+' '+o.delivery_location).toLowerCase().includes(ql))hits.push({t:'Nalog',l:o.order_no+' · '+o.pickup_location+'→'+o.delivery_location,fn:'viewOrder(\''+o.id+'\')'});});
  Store.scoped('clients').forEach(c=>{if(c.name.toLowerCase().includes(ql))hits.push({t:'Klijent',l:c.name,fn:'go(\'clients\')'});});
  Store.scoped('trips').forEach(t=>{if((t.trip_no+' '+t.route).toLowerCase().includes(ql))hits.push({t:'Tura',l:t.trip_no+' · '+t.route,fn:'viewTrip(\''+t.id+'\')'});});
  Store.scoped('fleet_vehicles').forEach(v=>{if((v.internal_no+' '+v.plate+' '+v.make).toLowerCase().includes(ql))hits.push({t:'Vozilo',l:v.internal_no+' · '+v.plate,fn:'viewFleet(\''+v.id+'\')'});});
  Store.scoped('invoices').forEach(i=>{if(i.invoice_no.toLowerCase().includes(ql))hits.push({t:'Faktura',l:i.invoice_no,fn:'viewInvoice(\''+i.id+'\')'});});
  const body=hits.length?hits.slice(0,30).map(h=>'<div class="alert-row" style="cursor:pointer" onclick="closeModal();'+h.fn+'"><span class="tag">'+h.t+'</span><div style="flex:1">'+esc(h.l)+'</div></div>').join(''):'<div class="muted">Nema rezultata za „'+esc(q)+'".</div>';
  openModal('Rezultati pretrage: '+esc(q),body,'<button class="btn" data-close>Zatvori</button>');$$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
}

export {
  avatarColor,
  initials,
  mountShell,
  globalSearch
};
