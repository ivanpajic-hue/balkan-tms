/* BALKAN TMS — modules/alerts.js
   Alarmi
   Modul generisan iz monolita v3.0 (A0.2). */
import { esc, fmtDate } from '../core/dom.js';
import { companyName } from '../core/session.js';
import { state } from '../core/state.js';
import { Views } from './registry.js';
import { badge, compDot, computeAlerts } from '../ui/status.js';

Views.alerts=()=>{const alerts=computeAlerts();
  const counts={isteklo:0,hitno:0,upozorenje:0,info:0};alerts.forEach(a=>counts[a.severity]++);
  const kpi=(l,v,cls)=>'<div class="kpi '+cls+'"><div class="lab">'+l+'</div><div class="val">'+v+'</div></div>';
  return '<div class="crumb">Analitika · '+esc(companyName(state.companyId))+'</div><div class="page-h"><h1>Alarm centar</h1><div class="sp"></div></div>'+
    '<div class="kpis">'+kpi('Isteklo',counts.isteklo,counts.isteklo?'bad':'')+kpi('Hitno',counts.hitno,counts.hitno?'warn':'')+kpi('Upozorenje',counts.upozorenje,'')+kpi('Info',counts.info,'')+'</div>'+
    '<div class="card"><div class="ch">Svi alarmi ('+alerts.length+')</div><div class="cb">'+(alerts.length?alerts.map(a=>'<div class="alert-row"><div class="sev '+a.severity+'"></div><div style="flex:1"><div>'+compDot(a.company_id)+esc(a.message)+'</div><div class="small muted">'+esc(a.category_code)+' · rok: '+fmtDate(a.due_at)+'</div></div>'+badge(a.severity)+'</div>').join(''):'<div class="muted">Nema aktivnih alarma.</div>')+'</div></div>'+
    '<div class="hint-inline" style="margin-top:10px">Alarmi se generišu automatski iz rokova dokumenata, statusa faktura, isporučenih nefakturisanih naloga i servisa. (Phase 2: ručno zatvaranje uz komentar + email/WhatsApp.)</div>';
};
