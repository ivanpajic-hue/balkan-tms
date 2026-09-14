/* BALKAN TMS — modules/planning.js
   Planiranje utovara
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { $, $$, esc, fmtDate, toast } from '../core/dom.js';
import { audit, can } from '../core/rbac.js';
import { companyName } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { vehCount } from './orders.js';
import { Views } from './registry.js';
import { refreshTripRoute } from './trips.js';
import { closeModal, openModal } from '../ui/modal.js';
import { badge, compDot } from '../ui/status.js';

const planFilter={from:'',to:''};
window.setPlanFilter=(k,v)=>{planFilter[k]=v;render();};
let _planDrag=null;
function planCapacityOf(t){const tr=Store.get('fleet_vehicles',t.trailer_id)||Store.get('fleet_vehicles',t.truck_id)||{};const c=Number(tr.capacity);return c>0?c:0;}
Views.planning=()=>{const inR=(d)=>(!planFilter.from||(d&&d>=planFilter.from))&&(!planFilter.to||(d&&d<=planFilter.to));
  const onTrip=oid=>Store.all('trip_orders').some(t=>t.order_id===oid);
  const editable=can('planning','E');
  const unplanned=Store.scoped('transport_orders').filter(o=>['novi','planiran'].includes(o.status)&&!onTrip(o.id)&&inR(o.planned_pickup));
  const trips=Store.scoped('trips').filter(t=>['nacrt','planirana','aktivna'].includes(t.status)&&inR(t.start_date));
  const ordCard=(o,inTripId)=>{const cli=(Store.get('clients',o.client_id)||{}).name||'';const vc=vehCount(o.id);
    const rel=esc(o.pickup_location)+(o.pickup_country?' ('+esc(o.pickup_country)+')':'')+' → '+esc(o.delivery_location)+(o.delivery_country?' ('+esc(o.delivery_country)+')':'');
    return '<div class="ord-chip" '+(editable?'draggable="true" ondragstart="planDragStart(event,\''+o.id+'\')" ondragend="planDragEnd(event)"':'')+'>'+
      '<div class="oc-top">'+compDot(o.company_id)+'<b>'+esc(o.order_no)+'</b>'+(vc?'<span class="oc-cnt" title="vozila u nalogu">'+vc+' 🚗</span>':'')+
        (editable&&inTripId?'<button draggable="false" class="oc-x" title="Vrati u neplanirano" onclick="planUnassign(\''+o.id+'\')">×</button>':'')+'</div>'+
      '<div class="oc-cli">'+esc(cli)+'</div><div class="oc-rel">'+rel+'</div>'+
      '<div class="oc-foot"><span>utovar '+fmtDate(o.planned_pickup)+'</span>'+
        (editable&&!inTripId?'<button draggable="false" class="btn sm" onclick="assignOrder(\''+o.id+'\')">Na turu →</button>':'')+'</div></div>';};
  const unplannedCol='<div class="plan-col plan-unplan" ondragover="planDragOver(event)" ondragleave="planDragLeave(event)" ondrop="planDrop(event,\'__UNPLANNED__\')">'+
    '<div class="pc-head">Neplanirani nalozi <span class="pc-badge">'+unplanned.length+'</span></div>'+
    '<div class="pc-body">'+(unplanned.length?unplanned.map(o=>ordCard(o,null)).join(''):'<div class="empty"><div class="big">Sve isplanirano</div>Nema naloga za period.</div>')+'</div></div>';
  const tripCol=t=>{const ords=Store.all('trip_orders').filter(x=>x.trip_id===t.id).map(x=>Store.get('transport_orders',x.order_id)).filter(Boolean);
    const veh=ords.reduce((s,o)=>s+vehCount(o.id),0);const cap=planCapacityOf(t);const truck=Store.get('fleet_vehicles',t.truck_id);
    const over=cap&&veh>cap;const pct=cap?Math.min(100,Math.round(veh/cap*100)):0;
    const capHtml=cap?'<div class="cap-bar'+(over?' over':'')+'"><span style="width:'+pct+'%"></span></div><div class="cap-lbl">'+veh+' / '+cap+' vozila'+(over?' · prekoračeno':'')+'</div>':'<div class="cap-lbl">'+veh+' vozila</div>';
    return '<div class="plan-col trip-col" ondragover="planDragOver(event)" ondragleave="planDragLeave(event)" ondrop="planDrop(event,\''+t.id+'\')">'+
      '<div class="pc-head" onclick="viewTrip(\''+t.id+'\')" style="cursor:pointer">'+compDot(t.company_id)+'<b>'+esc(t.trip_no)+'</b><span class="sp"></span>'+badge(t.status)+'</div>'+
      '<div class="tc-meta">'+fmtDate(t.start_date)+' · '+esc(truck?truck.internal_no:'—')+(t.route?' · '+esc(t.route):'')+'</div>'+capHtml+
      '<div class="pc-body">'+(ords.length?ords.map(o=>ordCard(o,t.id)).join(''):'<div class="tc-hint">Prevuci nalog ovde</div>')+'</div></div>';};
  return '<div class="crumb">Operativa · '+esc(companyName(state.companyId))+'</div><div class="page-h"><h1>Planiranje utovara</h1><div class="sp"></div></div>'+
    '<div class="toolbar no-print"><span class="dfilt">Period (utovar/početak): <input type="date" value="'+esc(planFilter.from)+'" onchange="setPlanFilter(\'from\',this.value)"><input type="date" value="'+esc(planFilter.to)+'" onchange="setPlanFilter(\'to\',this.value)"></span>'+((planFilter.from||planFilter.to)?'<button class="btn sm" onclick="setPlanFilter(\'from\',\'\');setPlanFilter(\'to\',\'\')">Poništi</button>':'')+'</div>'+
    '<div class="pill-note">Prevuci nalog na turu (drag-and-drop) ili koristi „Na turu →" na dodir. Prevlačenjem između tura premeštaš nalog; prevuci nazad u „Neplanirani" da otkažeš raspored.</div>'+
    '<div class="plan-board"><div class="plan-board-l">'+unplannedCol+'</div><div class="plan-board-r">'+(trips.length?trips.map(tripCol).join(''):'<div class="card"><div class="empty"><div class="big">Nema otvorenih tura</div>Kreiraj turu u modulu Ture.</div></div>')+'</div></div>';};
window.planDragStart=(ev,oid)=>{_planDrag=oid;try{ev.dataTransfer.setData('text/plain',oid);ev.dataTransfer.effectAllowed='move';}catch(e){}ev.currentTarget.classList.add('dragging');};
window.planDragEnd=(ev)=>{_planDrag=null;ev.currentTarget.classList.remove('dragging');document.querySelectorAll('.plan-col.drop-hover').forEach(c=>c.classList.remove('drop-hover'));};
window.planDragOver=(ev)=>{ev.preventDefault();try{ev.dataTransfer.dropEffect='move';}catch(e){}ev.currentTarget.classList.add('drop-hover');};
window.planDragLeave=(ev)=>{ev.currentTarget.classList.remove('drop-hover');};
window.planDrop=(ev,target)=>{ev.preventDefault();ev.currentTarget.classList.remove('drop-hover');let oid='';try{oid=ev.dataTransfer.getData('text/plain');}catch(e){}oid=oid||_planDrag;_planDrag=null;if(!oid)return;if(target==='__UNPLANNED__')planUnassign(oid);else planAssignCore(oid,target);};
window.planAssignCore=(orderId,tripId)=>{const o=Store.get('transport_orders',orderId),trip=Store.get('trips',tripId);if(!o||!trip)return;if(o.company_id!==trip.company_id){toast('Različite kompanije — nalog i tura moraju biti iste firme');return;}const ex=Store.all('trip_orders').find(x=>x.order_id===orderId);let oldTrip=null;if(ex){if(ex.trip_id===tripId)return;oldTrip=ex.trip_id;Store.update('trip_orders',ex.id,{trip_id:tripId});}else{Store.insert('trip_orders',{trip_id:tripId,order_id:orderId,company_id:o.company_id});}Store.update('transport_orders',orderId,{status:'dodeljen'});refreshTripRoute(tripId);if(oldTrip)refreshTripRoute(oldTrip);audit('update','order',orderId,'Nalog '+o.order_no+' → tura '+trip.trip_no+(oldTrip?' (premešten)':''));toast('Nalog → '+trip.trip_no);render();};
window.planUnassign=(orderId)=>{const ex=Store.all('trip_orders').find(x=>x.order_id===orderId);if(!ex)return;const tid=ex.trip_id;const o=Store.get('transport_orders',orderId)||{};Store.remove('trip_orders',ex.id);Store.update('transport_orders',orderId,{status:'novi'});refreshTripRoute(tid);audit('update','order',orderId,'Nalog '+(o.order_no||'')+' uklonjen sa ture');toast('Vraćeno u neplanirano');render();};
window.assignOrder=orderId=>{const o=Store.get('transport_orders',orderId);const trips=Store.all('trips').filter(t=>t.company_id===o.company_id&&['nacrt','planirana','aktivna'].includes(t.status));
  if(!trips.length){toast('Nema otvorenih tura — kreirajte turu prvo');go('trips');return;}
  const body='<div class="field"><label>Dodeli nalog '+esc(o.order_no)+' turi</label><select id="assignSel">'+trips.map(t=>'<option value="'+t.id+'">'+esc(t.trip_no)+' — '+esc(t.route)+'</option>').join('')+'</select></div>';
  openModal('Dodela naloga turi',body,'<button class="btn" data-close>Otkaži</button><button class="btn pri" id="doAssign">Dodeli</button>');$$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
  $('#doAssign').onclick=()=>{const tid=$('#assignSel').value;Store.insert('trip_orders',{trip_id:tid,order_id:orderId,company_id:o.company_id});Store.update('transport_orders',orderId,{status:'dodeljen'});refreshTripRoute(tid);audit('update','order',orderId,'Nalog dodeljen turi');toast('Nalog dodeljen turi');closeModal();render();};};

export {
  planFilter,
  _planDrag,
  planCapacityOf
};
