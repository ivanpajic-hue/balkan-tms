/* BALKAN TMS — ui/status.js
   Alarmi (computed), statusne oznake
   Modul generisan iz monolita v3.0 (A0.2). */
import { daysUntil, esc } from '../core/dom.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';

function computeAlerts(){
  const out=[];const sev=d=>d==null?'info':(d<0?'isteklo':(d<=7?'hitno':(d<=30?'upozorenje':'info')));
  const push=(c,s,cat,et,ei,msg,due)=>out.push({company_id:c,severity:s,category_code:cat,entity_type:et,entity_id:ei,message:msg,due_at:due});
  Store.all('fleet_documents').forEach(fd=>{const d=daysUntil(fd.expires_at);if(d!=null&&d<=60){const v=Store.get('fleet_vehicles',fd.fleet_vehicle_id);push(fd.company_id,sev(d),'dokument_vozila','fleet_vehicle',fd.fleet_vehicle_id,(v?v.internal_no:'')+' — '+fd.doc_type+' '+(d<0?'istekla pre '+(-d)+' dana':'ističe za '+d+' dana'),fd.expires_at);}});
  Store.all('driver_documents').forEach(dd=>{const d=daysUntil(dd.expires_at);if(d!=null&&d<=60){const v=Store.get('drivers',dd.driver_id);push(dd.company_id,sev(d),'dokument_vozaca','driver',dd.driver_id,(v?v.full_name:'')+' — '+dd.doc_type+' '+(d<0?'istekla pre '+(-d)+' dana':'ističe za '+d+' dana'),dd.expires_at);}});
  Store.all('invoices').forEach(inv=>{if(inv.status==='kasni'){const c=Store.get('clients',inv.client_id);push(inv.company_id,'hitno','placanje','invoice',inv.id,'Faktura '+inv.invoice_no+' ('+(c?c.name:'')+') kasni sa naplatom',inv.issue_date);}});
  Store.all('transport_orders').forEach(o=>{if(o.status==='isporucen')push(o.company_id,'upozorenje','nefakturisano','order',o.id,'Nalog '+o.order_no+' isporučen a nije fakturisan',o.planned_delivery);});
  Store.all('service_orders').forEach(so=>{if(so.status!=='zavrseno'){const v=Store.get('fleet_vehicles',so.fleet_vehicle_id);push(so.company_id,'upozorenje','servis','fleet_vehicle',so.fleet_vehicle_id,(v?v.internal_no:'')+' na servisu: '+so.problem,so.out_of_service_to);}});
  const rank={isteklo:0,hitno:1,upozorenje:2,info:3};
  return out.filter(a=>state.companyId==='ALL'||a.company_id===state.companyId).sort((a,b)=>rank[a.severity]-rank[b.severity]);
}
const STATUS_BADGE={novi:'b-grey',planiran:'b-blue',dodeljen:'b-blue',u_toku:'b-blue',isporucen:'b-green',fakturisan:'b-amber',placen:'b-green',storniran:'b-red',nacrt:'b-grey',planirana:'b-blue',aktivna:'b-blue',zavrsena:'b-green',zakljucana:'b-green',obracunata:'b-green',fakturisana:'b-green',poslato:'b-blue',delimicno:'b-amber',placeno:'b-green',stornirano:'b-red',kasni:'b-red',ceka:'b-grey',utovareno:'b-blue',u_tranzitu:'b-blue',isporuceno:'b-green',problem:'b-red',otkazano:'b-red',na_proveri:'b-amber',odobreno:'b-blue',isplaceno:'b-green',aktivno:'b-green',servis:'b-amber',rezervno:'b-grey',prodato:'b-grey',neaktivno:'b-grey',aktivan:'b-green',neaktivan:'b-grey',otvoreno:'b-blue',odlozeno:'b-amber',info:'b-blue',upozorenje:'b-amber',hitno:'b-amber',isteklo:'b-red'};
function badge(s){return '<span class="badge '+(STATUS_BADGE[s]||'b-grey')+'">'+esc(String(s).replace(/_/g,' '))+'</span>';}
function compDot(id){const c=Store.get('companies',id);return '<span class="comp-dot" style="background:'+(c?c.accent_color:'#888')+'" title="'+esc(c?c.name:'')+'"></span>';}

export {
  computeAlerts,
  STATUS_BADGE,
  badge,
  compDot
};
