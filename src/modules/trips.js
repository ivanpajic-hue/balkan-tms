/* BALKAN TMS — modules/trips.js
   Ture
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { $, $$, addDays, esc, fmtDate, fmtMoney, toast, todayISO } from '../core/dom.js';
import { audit, can } from '../core/rbac.js';
import { userCompanies } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { openExpenseForm } from './expenses.js';
import { Views } from './registry.js';
import { openSettlementForm } from './settlements.js';
import { lkName } from '../ui/lookups.js';
import { actionBtns, bindSave, closeModal, companyField, confirmDelete, field, openModal, pageHeader, saveBtn } from '../ui/modal.js';
import { badge, compDot } from '../ui/status.js';
import { renderTable } from '../ui/table.js';

function tripRoute(tripId){const ords=Store.all('trip_orders').filter(x=>x.trip_id===tripId).map(x=>Store.get('transport_orders',x.order_id)).filter(Boolean);
  const seq=[];ords.forEach(o=>{[o.pickup_country,o.delivery_country].forEach(c=>{if(c&&!seq.includes(c))seq.push(c);});});
  return seq.join(' → ');}
function refreshTripRoute(tripId){const r=tripRoute(tripId);if(r)Store.update('trips',tripId,{route:r});return r;}
Views.trips=()=>{const rows=Store.scoped('trips');return pageHeader('Ture','trips','Nova tura',true)+renderTable({id:'trips',exportName:'ture',columns:[
  {key:'trip_no',label:'Tura',render:r=>compDot(r.company_id)+'<b>'+esc(r.trip_no)+'</b>'},
  {key:'route',label:'Ruta'},
  {key:'truck',label:'Vozilo',sortVal:r=>(Store.get('fleet_vehicles',r.truck_id)||{}).internal_no,render:r=>esc((Store.get('fleet_vehicles',r.truck_id)||{}).internal_no||'—')},
  {key:'driver',label:'Vozač',render:r=>esc((r.driver_ids||[]).map(d=>(Store.get('drivers',d)||{}).full_name).join(', ')||'—')},
  {key:'start_date',label:'Početak',render:r=>fmtDate(r.start_date)},
  {key:'orders',label:'Nalozi',num:true,sortVal:r=>Store.all('trip_orders').filter(x=>x.trip_id===r.id).length,render:r=>Store.all('trip_orders').filter(x=>x.trip_id===r.id).length},
  {key:'actual_km',label:'km',num:true,render:r=>(r.actual_km||r.planned_km||0).toLocaleString('sr-RS')},
  {key:'status',label:'Status',render:r=>badge(r.status)}],
  filters:[{key:'status',label:'Status',options:['nacrt','planirana','aktivna','zavrsena','zakljucana','obracunata','fakturisana'].map(s=>({v:s,l:s}))}],
  dateFilters:[{key:'start_date',label:'Početak'}],
  rows,getRows:()=>Store.scoped('trips'),actions:r=>'<button class="btn sm" onclick="viewTrip(\''+r.id+'\')">Detalji</button>'+actionBtns('trips',r,'editTrip','delTrip')});};
window.__new_trips=()=>openTripForm();
function nextTripNo(c){const pre=c==='avto'?'AV-T-':'TR-T-';const nums=Store.all('trips').filter(t=>t.company_id===c).map(t=>parseInt(String(t.trip_no).replace(/\D/g,'')||'0')).filter(n=>!isNaN(n));return pre+((nums.length?Math.max(...nums):(c==='avto'?220:330))+1);}
function openTripForm(id){const r=id?Store.get('trips',id):{};const comp=r.company_id||(state.companyId==='ALL'?(userCompanies()[0]||{}).id:state.companyId);
  const trucks=Store.all('fleet_vehicles').filter(v=>v.company_id===comp&&v.kind==='truck');const trailers=Store.all('fleet_vehicles').filter(v=>v.company_id===comp&&v.kind==='trailer');const drivers=Store.all('drivers').filter(d=>d.company_id===comp);
  const derived=id?tripRoute(id):'';const drvOpt=[{v:'',l:'—'}].concat(drivers.map(d=>({v:d.id,l:d.full_name})));
  const body='<div class="form-grid">'+companyField(r)+field({name:'status',label:'Status',type:'select',value:r.status||'nacrt',options:['nacrt','planirana','aktivna','zavrsena','zakljucana','obracunata','fakturisana'].map(s=>({v:s,l:s}))})+
    field({name:'truck_id',label:'Kamion',type:'select',value:r.truck_id,options:[{v:'',l:'—'}].concat(trucks.map(v=>({v:v.id,l:v.internal_no+' '+v.make})))})+
    field({name:'trailer_id',label:'Prikolica',type:'select',value:r.trailer_id,options:[{v:'',l:'—'}].concat(trailers.map(v=>({v:v.id,l:v.internal_no+' '+v.capacity})))})+
    field({name:'driver_id',label:'Vozač 1',type:'select',value:(r.driver_ids||[])[0]||'',options:drvOpt})+
    field({name:'driver2_id',label:'Vozač 2 (opciono)',type:'select',value:(r.driver_ids||[])[1]||'',options:drvOpt})+
    field({name:'start_date',label:'Početni datum',type:'date',value:r.start_date||todayISO()})+field({name:'end_date',label:'Završni datum',type:'date',value:r.end_date||addDays(todayISO(),3)})+
    field({name:'km_start',label:'KM start',type:'number',value:r.km_start==null?'':r.km_start,attr:'data-km step="1"'})+field({name:'km_stop',label:'KM stop',type:'number',value:r.km_stop==null?'':r.km_stop,attr:'data-km step="1"'})+
    '<div class="field"><label>Pređeno (KM stop − KM start)</label><div id="tripKm" class="km-out">—</div></div>'+
    field({name:'route',label:'Ruta (auto iz država naloga; izmenjivo)',value:derived||r.route})+
    '</div><div class="hint-inline">Ruta se automatski sastavlja iz država utovara/istovara povezanih naloga (bez dupliranja). Pređena kilometraža se računa iz KM start/stop.</div>';
  openModal(id?'Izmena ture':'Nova tura',body,saveBtn());
  const root=$('#modalRoot');function kmCalc(){const a=Number(($('[name=km_start]',root)||{}).value)||0,b=Number(($('[name=km_stop]',root)||{}).value)||0;const d=b-a;const el=$('#tripKm');if(el){el.textContent=(d>0?d.toLocaleString('sr-RS'):'0')+' km';el.style.color=d<0?'var(--bad)':'var(--text)';}}
  root.querySelectorAll('[data-km]').forEach(el=>el.oninput=kmCalc);kmCalc();
  bindSave(f=>{f.km_start=Number(f.km_start)||0;f.km_stop=Number(f.km_stop)||0;f.actual_km=Math.max(0,f.km_stop-f.km_start);f.planned_km=(id&&Store.get('trips',id).planned_km)||f.actual_km;
    f.driver_ids=[f.driver_id,f.driver2_id].filter(Boolean);delete f.driver_id;delete f.driver2_id;
    if(id){const cur=Store.get('trips',id);if(f.status==='zakljucana'&&cur.status!=='zakljucana'){const pend=Store.all('expenses').filter(e=>e.trip_id===id&&!e.approved);if(pend.length){toast('Tura ima neodobrene troškove — ne može se zaključati');return;}audit('lock','trip',id,'Zaključavanje ture '+cur.trip_no);}const dr=tripRoute(id);if(dr)f.route=dr;Store.update('trips',id,f);audit('update','trip',id,'Izmena ture');}
    else{f.trip_no=nextTripNo(f.company_id);const n=Store.insert('trips',f);audit('create','trip',n.id,'Nova tura '+f.trip_no);}
    toast('Tura sačuvana');closeModal();render();});}
window.editTrip=id=>openTripForm(id);
window.delTrip=id=>confirmDelete('trips',id,'turu');
window.viewTrip=id=>{const t=Store.get('trips',id);const truck=Store.get('fleet_vehicles',t.truck_id);
  const orders=Store.all('trip_orders').filter(x=>x.trip_id===id).map(x=>Store.get('transport_orders',x.order_id)).filter(Boolean);
  const stops=Store.all('trip_stops').filter(s=>s.trip_id===id).sort((a,b)=>a.seq-b.seq);const expenses=Store.all('expenses').filter(e=>e.trip_id===id);
  const rev=orders.reduce((s,o)=>s+o.agreed_price,0);const cost=expenses.reduce((s,e)=>s+e.amount_base,0);
  const body='<div class="detail-grid"><div class="di"><div class="k">Tura</div><div class="v">'+compDot(t.company_id)+'<b>'+esc(t.trip_no)+'</b></div></div>'+
    '<div class="di"><div class="k">Status</div><div class="v">'+badge(t.status)+'</div></div><div class="di"><div class="k">Vozilo</div><div class="v">'+esc(truck?truck.internal_no+' '+truck.make:'—')+'</div></div>'+
    '<div class="di"><div class="k">Vozač</div><div class="v">'+esc((t.driver_ids||[]).map(d=>(Store.get('drivers',d)||{}).full_name).join(', ')||'—')+'</div></div>'+
    '<div class="di"><div class="k">Ruta</div><div class="v">'+esc(tripRoute(id)||t.route||'—')+'</div></div><div class="di"><div class="k">KM start / stop</div><div class="v">'+((t.km_start||0).toLocaleString('sr-RS'))+' → '+((t.km_stop||0).toLocaleString('sr-RS'))+'</div></div>'+
    '<div class="di"><div class="k">Pređeno km</div><div class="v"><b>'+((t.actual_km||0).toLocaleString('sr-RS'))+'</b></div></div>'+
    '<div class="di"><div class="k">Prihod</div><div class="v">'+fmtMoney(rev)+'</div></div><div class="di"><div class="k">Trošak</div><div class="v">'+fmtMoney(cost)+'</div></div>'+
    '<div class="di"><div class="k">Profit</div><div class="v b800" style="color:'+(rev-cost>=0?'var(--ok)':'var(--bad)')+'">'+fmtMoney(rev-cost)+'</div></div></div>'+
    '<div class="section-title">Nalozi na turi ('+orders.length+')</div><table class="mini-table"><thead><tr><th>Nalog</th><th>Klijent</th><th>Relacija</th><th class="num">Cena</th><th>Status</th></tr></thead><tbody>'+(orders.length?orders.map(o=>'<tr><td><b>'+esc(o.order_no)+'</b></td><td>'+esc((Store.get('clients',o.client_id)||{}).name||'')+'</td><td class="small">'+esc(o.pickup_location)+' → '+esc(o.delivery_location)+'</td><td class="num">'+fmtMoney(o.agreed_price)+'</td><td>'+badge(o.status)+'</td></tr>').join(''):'<tr><td colspan="5" class="muted" style="padding:12px">Nema povezanih naloga.</td></tr>')+'</tbody></table>'+
    '<div class="section-title">Stopovi ('+stops.length+')</div><table class="mini-table"><thead><tr><th>#</th><th>Tip</th><th>Lokacija</th><th>Plan</th><th>Status</th></tr></thead><tbody>'+(stops.map(s=>'<tr><td>'+s.seq+'</td><td><span class="tag">'+esc(s.stop_type)+'</span></td><td>'+esc(s.location)+'</td><td>'+fmtDate(s.planned_time)+'</td><td class="small">'+esc(s.status)+'</td></tr>').join('')||'<tr><td colspan="5" class="muted">—</td></tr>')+'</tbody></table>'+
    '<div class="section-title">Troškovi ('+expenses.length+') · ukupno '+fmtMoney(cost)+(can('expenses','C')?' <button class="btn sm" style="float:right" onclick="addTripExpense(\''+id+'\')">+ Trošak</button>':'')+'</div><table class="mini-table"><thead><tr><th>Datum</th><th>Kategorija</th><th class="num">Iznos</th><th>Odobreno</th></tr></thead><tbody>'+(expenses.map(e=>'<tr><td>'+fmtDate(e.date)+'</td><td>'+esc(lkName('expense_categories',e.category_code))+'</td><td class="num">'+fmtMoney(e.amount,e.currency)+'</td><td>'+(e.approved?'<span class="badge b-green">da</span>':'<span class="badge b-amber">čeka</span>')+'</td></tr>').join('')||'<tr><td colspan="4" class="muted">—</td></tr>')+'</tbody></table>';
  let footer='';if(can('expenses','C'))footer+='<button class="btn" onclick="addTripExpense(\''+id+'\')">+ Trošak</button>';
  if(can('settlements','C')&&(t.driver_ids||[]).length)footer+='<button class="btn" onclick="tripSettlement(\''+id+'\')">+ Obračun vozača</button>';
  if(can('trips','E')&&['zavrsena','aktivna'].includes(t.status)){const pend=expenses.filter(e=>!e.approved).length;footer+='<button class="btn pri" onclick="lockTrip(\''+id+'\')" '+(pend?'disabled title="Neodobreni troškovi"':'')+'>Zaključaj turu</button>';}
  footer+='<button class="btn" data-close>Zatvori</button>';openModal('Tura '+t.trip_no,body,footer,true);$$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);};
window.addTripExpense=tid=>{const t=Store.get('trips',tid);closeModal();openExpenseForm(null,{trip_id:tid,company_id:t.company_id,driver_id:(t.driver_ids||[])[0]||'',_returnTrip:tid});};
window.tripSettlement=tid=>{const t=Store.get('trips',tid);closeModal();openSettlementForm({company_id:t.company_id,driver_id:(t.driver_ids||[])[0]||'',period_from:t.start_date,period_to:t.end_date||todayISO()});};
window.lockTrip=id=>{const t=Store.get('trips',id);if(Store.all('expenses').filter(e=>e.trip_id===id&&!e.approved).length){toast('Tura ima neodobrene troškove');return;}if(Store.all('trip_stops').filter(s=>s.trip_id===id&&s.status==='u toku').length){toast('Tura ima aktivne stopove');return;}Store.update('trips',id,{status:'zakljucana'});audit('lock','trip',id,'Zaključana tura '+t.trip_no);toast('Tura zaključana — spremna za obračun');closeModal();render();};

export {
  tripRoute,
  refreshTripRoute,
  nextTripNo,
  openTripForm
};
