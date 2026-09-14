/* BALKAN TMS — modules/reports.js
   Izveštaji
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { addDays, esc, fmtDate, fmtMoney, todayISO } from '../core/dom.js';
import { companyName } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { Views } from './registry.js';
import { tripRoute } from './trips.js';
import { svgBars, svgDonut, svgGroupedBars, svgLine } from '../ui/charts.js';
import { lkName } from '../ui/lookups.js';
import { badge } from '../ui/status.js';
import { renderTable } from '../ui/table.js';

const repFilter={from:addDays(todayISO(),-90),to:todayISO()};
window.setRepFilter=(k,v)=>{repFilter[k]=v;render();};
function monthsBetween(from,to){const out=[];let d=new Date(from.slice(0,7)+'-01');const end=new Date(to.slice(0,7)+'-01');while(d<=end){out.push(d.toISOString().slice(0,7));d.setMonth(d.getMonth()+1);}return out.length?out:[todayISO().slice(0,7)];}
Views.reports=()=>{
  const inP=d=>d&&d>=repFilter.from&&d<=repFilter.to;
  const orders=Store.scoped('transport_orders'),trips=Store.scoped('trips'),invoices=Store.scoped('invoices'),expenses=Store.scoped('expenses'),purch=Store.scoped('purchase_invoices');
  // === BILANS USPEHA (realizovano u periodu) ===
  const payIn=Store.scoped('payments').filter(p=>inP(p.date));const prihodNaplata=payIn.reduce((s,p)=>s+p.amount,0);
  const expIn=expenses.filter(e=>inP(e.date));const rashodTrip=expIn.reduce((s,e)=>s+e.amount_base,0);
  const purIn=purch.filter(p=>p.status==='placeno'&&inP(p.date));const rashodPur=purIn.reduce((s,p)=>s+p.amount,0);
  const setIn=Store.scoped('driver_settlements').filter(s=>s.status==='isplaceno'&&inP(s.period_to));const rashodSet=setIn.reduce((s,x)=>s+(x.total_amount||0),0);
  const rashodi=rashodTrip+rashodPur+rashodSet;const rezultat=prihodNaplata-rashodi;
  const plRow=(l,v,cls)=>'<tr'+(cls==='total'?' class="total"':'')+'><td>'+l+'</td><td class="num '+(cls==='neg'?'neg':(cls==='pos'?'pos':''))+'">'+fmtMoney(v)+'</td></tr>';
  const bilans='<div class="card" style="margin-bottom:16px"><div class="ch">Bilans uspeha (realizovano) · '+fmtDate(repFilter.from)+' – '+fmtDate(repFilter.to)+'</div><div class="cb" style="padding:0"><table class="pl-table"><tbody>'+
    plRow('PRIHODI — naplaćene fakture',prihodNaplata,'pos')+
    plRow('Rashodi — troškovi tura',-rashodTrip,'neg')+
    plRow('Rashodi — ulazni računi (plaćeni)',-rashodPur,'neg')+
    plRow('Rashodi — isplaćeni obračuni vozača',-rashodSet,'neg')+
    plRow('REZULTAT PERIODA',rezultat,'total')+
    '</tbody></table></div></div>';
  // === Grafikoni ===
  const months=monthsBetween(repFilter.from,repFilter.to);
  const mLabels=months.map(m=>m.slice(5)+'/'+m.slice(2,4));
  const revByMonth=months.map(m=>Store.scoped('payments').filter(p=>p.date&&p.date.slice(0,7)===m).reduce((s,p)=>s+p.amount,0));
  const expByMonth=months.map(m=>expenses.filter(e=>e.date&&e.date.slice(0,7)===m).reduce((s,e)=>s+e.amount_base,0).valueOf());
  const byCat={};expIn.forEach(e=>{byCat[e.category_code]=(byCat[e.category_code]||0)+e.amount_base;});purIn.forEach(p=>{byCat[p.category_code]=(byCat[p.category_code]||0)+p.amount;});
  const catData=Object.keys(byCat).map(k=>({label:lkName('expense_categories',k),value:Math.round(byCat[k])}));
  const revComp=Store.all('companies').filter(c=>state.companyId==='ALL'||c.id===state.companyId).map(c=>({label:c.short_name,color:c.accent_color,value:Store.all('invoices').filter(i=>i.company_id===c.id).reduce((s,i)=>s+i.total_gross,0)}));
  // profit po klijentu (svi podaci)
  const byClient={};orders.forEach(o=>{const c=Store.get('clients',o.client_id);if(!c)return;byClient[c.id]=byClient[c.id]||{name:c.name,rev:0,cost:0};byClient[c.id].rev+=o.agreed_price;});
  trips.forEach(t=>{const ords=Store.all('trip_orders').filter(x=>x.trip_id===t.id).map(x=>Store.get('transport_orders',x.order_id)).filter(Boolean);const cost=Store.all('expenses').filter(e=>e.trip_id===t.id).reduce((s,e)=>s+e.amount_base,0);const rev=ords.reduce((s,o)=>s+o.agreed_price,0)||1;ords.forEach(o=>{const c=byClient[o.client_id];if(c)c.cost+=cost*(o.agreed_price/rev);});});
  const cliData=Object.values(byClient).sort((a,b)=>(b.rev-b.cost)-(a.rev-a.cost)).slice(0,8).map(c=>({label:c.name.slice(0,10),value:Math.round(c.rev-c.cost)}));
  const unpaid=invoices.filter(i=>['poslato','delimicno','kasni'].includes(i.status));
  const kmTot=trips.reduce((a,t)=>{a.l+=(t.loaded_km||0);a.e+=(t.empty_km||0);return a;},{l:0,e:0});
  const chartCard=(t,inner)=>'<div class="card"><div class="ch">'+t+'</div><div class="cb">'+inner+'</div></div>';
  const profitByMonth=months.map((m,i)=>Math.round(revByMonth[i]-expByMonth[i]));
  const stByStatus={};orders.forEach(o=>{stByStatus[o.status]=(stByStatus[o.status]||0)+1;});
  const stData=Object.keys(stByStatus).map(k=>({label:lkName('order_statuses',k),value:stByStatus[k]}));
  const charts='<div class="chart-grid" style="margin-bottom:16px">'+
    chartCard('Naplata vs troškovi po mesecima',svgGroupedBars(mLabels,[{name:'Naplata',color:'#15A34A',values:revByMonth},{name:'Troškovi',color:'#DC2626',values:expByMonth}],{fmt:v=>Math.round(v)}))+
    chartCard('Profit po mesecima (naplata − troškovi)',svgLine(mLabels,profitByMonth,{fmt:v=>Math.round(v/1000)+'k'}))+
    chartCard('Rashodi po vrsti (period)',catData.length?svgDonut(catData):'<div class="muted small">Nema rashoda u periodu.</div>')+
    chartCard('Nalozi po statusu',stData.length?svgDonut(stData):'<div class="muted small">—</div>')+
    chartCard('Prihod po kompaniji (fakturisano)',svgBars(revComp,{fmt:v=>Math.round(v/1000)+'k'}))+
    chartCard('Profit po klijentu (top 8)',cliData.length?svgBars(cliData,{fmt:v=>Math.round(v/1000)+'k'}):'<div class="muted small">—</div>')+'</div>';
  const sec=(title,id,cols,rows,name)=>'<div class="card" style="margin-bottom:16px"><div class="ch">'+title+'</div><div class="cb" style="padding:0">'+renderTable({id:id,exportName:name,columns:cols,rows:rows})+'</div></div>';
  return '<div class="crumb">Analitika · '+esc(companyName(state.companyId))+'</div><div class="page-h"><h1>Izveštaji</h1><div class="sp"></div><button class="btn sm no-print" onclick="window.print()">Štampa svega</button></div>'+
    '<div class="toolbar no-print"><span class="dfilt">Period bilansa/grafikona: <input type="date" value="'+esc(repFilter.from)+'" onchange="setRepFilter(\'from\',this.value)"><input type="date" value="'+esc(repFilter.to)+'" onchange="setRepFilter(\'to\',this.value)"></span></div>'+
    bilans+charts+
    '<div class="grid2"><div class="kpi"><div class="lab">Pun km (ukupno)</div><div class="val">'+kmTot.l.toLocaleString('sr-RS')+'</div></div><div class="kpi"><div class="lab">Prazan km (ukupno)</div><div class="val">'+kmTot.e.toLocaleString('sr-RS')+'</div><div class="hint">udeo praznih: '+(kmTot.l+kmTot.e?Math.round(kmTot.e/(kmTot.l+kmTot.e)*100):0)+'%</div></div></div><div style="height:16px"></div>'+
    sec('Profitabilnost po klijentu','rep_cli',[{key:'name',label:'Klijent'},{key:'rev',label:'Prihod',num:true,sortVal:r=>r.rev,render:r=>fmtMoney(r.rev),exportVal:r=>Math.round(r.rev)},{key:'cost',label:'Trošak',num:true,sortVal:r=>r.cost,render:r=>fmtMoney(Math.round(r.cost)),exportVal:r=>Math.round(r.cost)},{key:'profit',label:'Profit',num:true,sortVal:r=>r.rev-r.cost,render:r=>'<b style="color:'+(r.rev-r.cost>=0?'var(--ok)':'var(--bad)')+'">'+fmtMoney(Math.round(r.rev-r.cost))+'</b>',exportVal:r=>Math.round(r.rev-r.cost)}],Object.values(byClient),'profit_po_klijentu')+
    sec('Troškovi/rashodi po vrsti (period)','rep_cat',[{key:'cat',label:'Vrsta'},{key:'amount',label:'Iznos',num:true,sortVal:r=>r.amount,render:r=>fmtMoney(r.amount),exportVal:r=>Math.round(r.amount)}],Object.keys(byCat).map(k=>({cat:lkName('expense_categories',k),amount:byCat[k]})),'rashodi_po_vrsti')+
    sec('Neplaćene / kasne fakture','rep_unp',[{key:'invoice_no',label:'Faktura'},{key:'client',label:'Klijent',sortVal:r=>(Store.get('clients',r.client_id)||{}).name,render:r=>esc((Store.get('clients',r.client_id)||{}).name||'')},{key:'issue_date',label:'Izdata',render:r=>fmtDate(r.issue_date)},{key:'total_gross',label:'Iznos',num:true,sortVal:r=>r.total_gross,render:r=>fmtMoney(r.total_gross),exportVal:r=>r.total_gross},{key:'status',label:'Status',render:r=>badge(r.status)}],unpaid,'neplacene_fakture')+
    (()=>{const byRoute={};trips.forEach(t=>{const rt=tripRoute(t.id)||t.route||'—';byRoute[rt]=byRoute[rt]||{route:rt,count:0,km:0};byRoute[rt].count++;byRoute[rt].km+=(t.actual_km||0);});return sec('Najčešće rute','rep_routes',[{key:'route',label:'Ruta'},{key:'count',label:'Broj tura',num:true,sortVal:r=>r.count,render:r=>r.count},{key:'km',label:'Ukupno km',num:true,sortVal:r=>r.km,render:r=>r.km.toLocaleString('sr-RS'),exportVal:r=>r.km}],Object.values(byRoute).sort((a,b)=>b.count-a.count),'rute');})();
};

export {
  repFilter,
  monthsBetween
};
