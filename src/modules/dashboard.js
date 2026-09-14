/* BALKAN TMS — modules/dashboard.js
   Komandna tabla
   Modul generisan iz monolita v3.0 (A0.2). */
import { daysUntil, esc, fmtDate, fmtMoney, todayISO } from '../core/dom.js';
import { companyName } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { Views } from './registry.js';
import { badge, compDot, computeAlerts } from '../ui/status.js';

Views.dashboard=()=>{
  const orders=Store.scoped('transport_orders'),trips=Store.scoped('trips'),invoices=Store.scoped('invoices'),expenses=Store.scoped('expenses');
  const activeTrips=trips.filter(t=>t.status==='aktivna').length;const today=todayISO();
  const loadsToday=orders.filter(o=>o.planned_pickup===today).length;
  const loadsWeek=orders.filter(o=>{const d=daysUntil(o.planned_pickup);return d!=null&&d>=0&&d<=7;}).length;
  const inTransport=Store.scoped('order_vehicles').filter(v=>v.status==='u_tranzitu').length;
  const noInvoice=orders.filter(o=>o.status==='isporucen').length;
  const unpaid=invoices.filter(i=>['poslato','delimicno','kasni'].includes(i.status));
  const unpaidSum=unpaid.reduce((s,i)=>s+i.total_gross,0);
  const monthExp=expenses.filter(e=>e.date>=today.slice(0,7)+'-01').reduce((s,e)=>s+e.amount_base,0);
  const alerts=computeAlerts();const expiring=alerts.filter(a=>['hitno','isteklo'].includes(a.severity)).length;
  const onService=Store.scoped('fleet_vehicles').filter(v=>v.status==='servis').length;
  const revByComp=Store.all('companies').filter(c=>state.companyId==='ALL'||c.id===state.companyId).map(c=>({label:c.short_name,color:c.accent_color,value:Store.all('invoices').filter(i=>i.company_id===c.id).reduce((s,i)=>s+i.total_gross,0)}));
  const maxRev=Math.max(1,...revByComp.map(r=>r.value));
  const profitRows=trips.filter(t=>['zakljucana','obracunata','fakturisana'].includes(t.status)).map(t=>{const ords=Store.all('trip_orders').filter(x=>x.trip_id===t.id).map(x=>Store.get('transport_orders',x.order_id)).filter(Boolean);const rev=ords.reduce((s,o)=>s+o.agreed_price,0);const cost=Store.all('expenses').filter(e=>e.trip_id===t.id).reduce((s,e)=>s+e.amount_base,0);return{t,rev,cost,profit:rev-cost};});
  const kpi=(l,v,h,cls)=>'<div class="kpi '+(cls||'')+'"><div class="lab">'+l+'</div><div class="val">'+v+'</div>'+(h?'<div class="hint">'+h+'</div>':'')+'</div>';
  return '<div class="crumb">Pregled · '+esc(companyName(state.companyId))+'</div><div class="page-h"><h1>Komandna tabla</h1><div class="sp"></div><button class="btn sm no-print" onclick="window.print()">Štampa</button></div>'+
    '<div class="kpis">'+kpi('Aktivne ture',activeTrips,'trenutno na putu')+kpi('Utovari danas / 7 dana',loadsToday+' / '+loadsWeek,'planirani polasci')+kpi('Vozila u transportu',inTransport,'u tranzitu')+kpi('Isporučeno bez fakture',noInvoice,'za fakturisanje',noInvoice?'warn':'')+kpi('Neplaćene fakture',fmtMoney(unpaidSum),unpaid.length+' faktura',unpaidSum?'bad':'')+kpi('Troškovi ovog meseca',fmtMoney(monthExp),'')+kpi('Vozila na servisu',onService,'',onService?'warn':'')+kpi('Hitni alarmi',expiring,'ističe/isteklo',expiring?'bad':'')+'</div>'+
    '<div class="grid2"><div class="card"><div class="ch">Prihod po kompaniji (fakturisano)</div><div class="cb"><div class="bars">'+revByComp.map(r=>'<div class="bar-col"><div class="bv">'+fmtMoney(r.value)+'</div><div class="bar" style="height:'+(Math.round(r.value/maxRev*120)+8)+'px;background:'+r.color+'"></div><div class="bl">'+esc(r.label)+'</div></div>').join('')+'</div></div></div>'+
    '<div class="card"><div class="ch">Alarmi koji uskoro ističu</div><div class="cb">'+(alerts.slice(0,6).map(a=>'<div class="alert-row"><div class="sev '+a.severity+'"></div><div style="flex:1"><div>'+esc(a.message)+'</div><div class="small muted">'+esc(a.category_code)+' · '+fmtDate(a.due_at)+'</div></div>'+badge(a.severity)+'</div>').join('')||'<div class="muted small">Nema aktivnih alarma.</div>')+'</div></div></div>'+
    '<div class="card" style="margin-top:16px"><div class="ch">Profitabilnost po zaključanim turama</div><div class="cb" style="padding:0"><table><thead><tr><th>Tura</th><th>Ruta</th><th class="num">Prihod</th><th class="num">Trošak</th><th class="num">Profit</th><th>Marža</th></tr></thead><tbody>'+(profitRows.length?profitRows.map(p=>'<tr><td>'+compDot(p.t.company_id)+esc(p.t.trip_no)+'</td><td>'+esc(p.t.route)+'</td><td class="num">'+fmtMoney(p.rev)+'</td><td class="num">'+fmtMoney(p.cost)+'</td><td class="num b800" style="color:'+(p.profit>=0?'var(--ok)':'var(--bad)')+'">'+fmtMoney(p.profit)+'</td><td>'+(p.rev?Math.round(p.profit/p.rev*100):0)+'%</td></tr>').join(''):'<tr><td colspan="6"><div class="empty">Nema zaključanih tura.</div></td></tr>')+'</tbody></table></div></div>';
};
