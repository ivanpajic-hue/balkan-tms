/* BALKAN TMS — modules/settlements.js
   Obračun vozača
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { $, $$, addDays, esc, fmtDate, fmtMoney, toast, todayISO } from '../core/dom.js';
import { audit, can } from '../core/rbac.js';
import { userCompanies } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { Views } from './registry.js';
import { lk, lkName } from '../ui/lookups.js';
import { bindSave, closeModal, companyField, field, openModal, pageHeader, readForm, saveBtn } from '../ui/modal.js';
import { badge, compDot } from '../ui/status.js';
import { renderTable } from '../ui/table.js';

Views.settlements=()=>{const rows=Store.scoped('driver_settlements');return pageHeader('Obračun vozača','settlements','Novi obračun',true)+renderTable({id:'settlements',exportName:'obracuni',columns:[
  {key:'driver',label:'Vozač',sortVal:r=>(Store.get('drivers',r.driver_id)||{}).full_name,render:r=>compDot(r.company_id)+esc((Store.get('drivers',r.driver_id)||{}).full_name||'—')},
  {key:'period',label:'Period',render:r=>fmtDate(r.period_from)+' – '+fmtDate(r.period_to)},
  {key:'total_km',label:'km',num:true,render:r=>(r.total_km||0).toLocaleString('sr-RS')},
  {key:'base_amount',label:'Osnovica',num:true,render:r=>fmtMoney(r.base_amount)},
  {key:'bonus_total',label:'Bonus',num:true,render:r=>fmtMoney(r.bonus_total)},
  {key:'malus_total',label:'Malus',num:true,render:r=>fmtMoney(r.malus_total)},
  {key:'total_amount',label:'Za isplatu',num:true,sortVal:r=>r.total_amount,render:r=>'<b>'+fmtMoney(r.total_amount)+'</b>'},
  {key:'status',label:'Status',render:r=>badge(r.status)}],
  rows,getRows:()=>Store.scoped('driver_settlements'),actions:r=>'<button class="btn sm" onclick="viewSettlement(\''+r.id+'\')">Pregled</button>'+(can('settlements','A')&&r.status!=='isplaceno'?'<button class="btn sm" onclick="approveSettlement(\''+r.id+'\')">'+(r.status==='odobreno'?'Isplati':'Odobri')+'</button>':'')});};
window.__new_settlements=()=>openSettlementForm();
function openSettlementForm(prefill){prefill=prefill||{};const comp=prefill.company_id||(state.companyId==='ALL'?(userCompanies()[0]||{}).id:state.companyId);const drivers=Store.all('drivers').filter(d=>d.company_id===comp);
  const body='<div class="pill-note">Kreira se <b>prazan obračun</b> (bez podrazumevanih stavki). Stavke i bonus/malus dodajete dugmetom <b>+</b> u pregledu — biraju se iz administracije.</div><div class="form-grid">'+companyField({company_id:comp})+field({name:'driver_id',label:'Vozač',type:'select',value:prefill.driver_id||'',options:[{v:'',l:'—'}].concat(drivers.map(d=>({v:d.id,l:d.full_name}))),attr:'id="setDriver"'})+field({name:'period_from',label:'Period od',type:'date',value:prefill.period_from||addDays(todayISO(),-30)})+field({name:'period_to',label:'Period do',type:'date',value:prefill.period_to||todayISO()})+field({name:'advance_total',label:'Akontacije (€)',type:'number',value:0})+field({name:'refund_total',label:'Refundacija (€)',type:'number',value:0})+'</div><div id="setPreview" class="muted small" style="margin-top:8px">Izaberite vozača i period.</div>';
  openModal('Novi obračun vozača',body,'<button class="btn" data-close>Otkaži</button><button class="btn pri" id="setCreate">Kreiraj obračun</button>');$$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
  function eligible(){const did=$('#setDriver').value;const f=readForm($('#modalRoot'));if(!did)return[];return Store.all('trips').filter(t=>(t.driver_ids||[]).includes(did)&&['zakljucana','obracunata'].includes(t.status)&&t.start_date>=f.period_from&&t.start_date<=f.period_to);}
  function refresh(){const tr=eligible();const km=tr.reduce((s,t)=>s+(t.actual_km||t.planned_km||0),0);$('#setPreview').innerHTML=tr.length?'Zaključane ture u periodu: <b>'+tr.map(t=>t.trip_no).join(', ')+'</b> · ukupno km: <b>'+km.toLocaleString('sr-RS')+'</b> (informativno — stavke dodajete u pregledu).':'<div class="pill-note">Nema zaključanih tura za izabrani period (obračun možete kreirati i ručno popuniti).</div>';}
  $('#modalRoot').addEventListener('input',refresh);$('#setDriver').addEventListener('change',refresh);
  $('#setCreate').onclick=()=>{const did=$('#setDriver').value;if(!did){toast('Izaberite vozača');return;}const f=readForm($('#modalRoot'));
    const s=Store.insert('driver_settlements',{company_id:f.company_id,driver_id:did,period_from:f.period_from,period_to:f.period_to,total_km:0,base_amount:0,bonus_total:0,malus_total:0,advance_total:Number(f.advance_total||0),refund_total:Number(f.refund_total||0),total_amount:Number(f.refund_total||0)-Number(f.advance_total||0),status:'nacrt',approved_by:null});
    audit('create','settlement',s.id,'Kreiran obračun vozača');toast('Obračun kreiran — dodajte stavke');closeModal();render();viewSettlement(s.id);};}
function recomputeSettlement(id){const s=Store.get('driver_settlements',id);const items=Store.all('settlement_items').filter(i=>i.settlement_id===id);const bm=Store.all('bonuses_maluses').filter(b=>b.settlement_id===id);
  const base=items.reduce((a,i)=>a+(i.amount||0),0);const bonus=bm.filter(b=>b.kind==='bonus').reduce((a,b)=>a+(b.amount||0),0);const malus=bm.filter(b=>b.kind==='malus').reduce((a,b)=>a+(b.amount||0),0);
  const km=items.reduce((a,i)=>a+((i.rule_code||'').indexOf('km')>-1?(i.qty||0):0),0);
  const total=base+bonus-malus-(s.advance_total||0)+(s.refund_total||0);
  Store.update('driver_settlements',id,{base_amount:base,bonus_total:bonus,malus_total:malus,total_km:km,total_amount:total});}
window.addSettlementItem=id=>{const s=Store.get('driver_settlements',id);const sit=lk('settlement_item_types');const trips=Store.all('trips').filter(t=>(t.driver_ids||[]).includes(s.driver_id));
  const def=sit[0]||{code:'',default_rate:0};
  const body='<div class="form-grid">'+field({name:'rule_code',label:'Stavka (iz administracije)',type:'select',value:def.code,options:sit.map(t=>({v:t.code,l:t.name+' ('+t.unit+')'})),attr:'id="siRule"'})+field({name:'trip_id',label:'Vezana tura (opc.)',type:'select',value:'',options:[{v:'',l:'—'}].concat(trips.map(t=>({v:t.id,l:t.trip_no})))})+field({name:'qty',label:'Količina',type:'number',value:0,attr:'step="0.01" id="siQty"'})+field({name:'rate',label:'Cena',type:'number',value:def.default_rate,attr:'step="0.01" id="siRate"'})+'<div class="field full"><label>Iznos</label><div id="siAmt" class="recon ok">0</div></div></div>';
  openModal('Dodaj stavku obračuna',body,saveBtn());const root=$('#modalRoot');
  function amt(){return +(((Number(($('#siQty')||{}).value)||0))*((Number(($('#siRate')||{}).value)||0))).toFixed(2);}
  function upd(){$('#siAmt').textContent=fmtMoney(amt());}
  const rs=$('#siRule');if(rs)rs.onchange=()=>{const t=sit.find(x=>x.code===rs.value);if(t&&$('#siRate'))$('#siRate').value=t.default_rate;upd();};
  root.querySelectorAll('#siQty,#siRate').forEach(el=>el.oninput=upd);upd();
  bindSave(f=>{const a=amt();Store.insert('settlement_items',{settlement_id:id,company_id:s.company_id,trip_id:f.trip_id||null,rule_code:f.rule_code,qty:Number(f.qty)||0,rate:Number(f.rate)||0,amount:a});if(f.trip_id){const t=Store.get('trips',f.trip_id);if(t&&t.status==='zakljucana')Store.update('trips',f.trip_id,{status:'obracunata'});}recomputeSettlement(id);audit('update','settlement',id,'Stavka obračuna');toast('Stavka dodata');closeModal();viewSettlement(id);});};
window.delSettlementItem=(iid,sid)=>{Store.remove('settlement_items',iid);recomputeSettlement(sid);viewSettlement(sid);};
window.addBonusMalus=id=>{const s=Store.get('driver_settlements',id);
  const body='<div class="form-grid">'+field({name:'kind',label:'Vrsta',type:'select',value:'bonus',options:[{v:'bonus',l:'Bonus (+)'},{v:'malus',l:'Malus (−)'}]})+field({name:'label',label:'Opis',value:''})+field({name:'amount',label:'Iznos (€)',type:'number',value:0,attr:'step="0.01"'})+'</div>';
  openModal('Dodaj bonus / malus',body,saveBtn());bindSave(f=>{Store.insert('bonuses_maluses',{settlement_id:id,company_id:s.company_id,kind:f.kind,code:f.kind,label:f.label||(f.kind==='bonus'?'Bonus':'Malus'),amount:Number(f.amount)||0,note:''});recomputeSettlement(id);audit('update','settlement',id,'Bonus/malus');toast('Dodato');closeModal();viewSettlement(id);});};
window.delBonusMalus=(bid,sid)=>{Store.remove('bonuses_maluses',bid);recomputeSettlement(sid);viewSettlement(sid);};
window.viewSettlement=id=>{const s=Store.get('driver_settlements',id);const d=Store.get('drivers',s.driver_id);const items=Store.all('settlement_items').filter(i=>i.settlement_id===id);const bm=Store.all('bonuses_maluses').filter(b=>b.settlement_id===id);const ed=can('settlements','E')&&s.status!=='isplaceno';
  const body='<div class="detail-grid"><div class="di"><div class="k">Vozač</div><div class="v">'+esc(d?d.full_name:'')+'</div></div><div class="di"><div class="k">Period</div><div class="v">'+fmtDate(s.period_from)+' – '+fmtDate(s.period_to)+'</div></div><div class="di"><div class="k">Status</div><div class="v">'+badge(s.status)+'</div></div><div class="di"><div class="k">Ukupno km</div><div class="v">'+(s.total_km||0).toLocaleString('sr-RS')+'</div></div></div>'+
    '<div class="section-title">Stavke obračuna ('+items.length+')'+(ed?' <button class="btn sm" style="float:right" onclick="addSettlementItem(\''+id+'\')">+ Stavka</button>':'')+'</div><table class="mini-table"><thead><tr><th>Stavka</th><th>Tura</th><th class="num">Količina</th><th class="num">Cena</th><th class="num">Iznos</th>'+(ed?'<th></th>':'')+'</tr></thead><tbody>'+(items.length?items.map(i=>'<tr><td>'+esc(lkName('settlement_item_types',i.rule_code))+'</td><td>'+esc((Store.get('trips',i.trip_id)||{}).trip_no||'—')+'</td><td class="num">'+(i.qty||0).toLocaleString('sr-RS')+'</td><td class="num">'+i.rate+'</td><td class="num">'+fmtMoney(i.amount)+'</td>'+(ed?'<td class="num"><button class="btn sm danger" onclick="delSettlementItem(\''+i.id+'\',\''+id+'\')">×</button></td>':'')+'</tr>').join(''):'<tr><td colspan="'+(ed?6:5)+'" class="muted" style="padding:12px">Nema stavki — dodajte ih dugmetom „+ Stavka".</td></tr>')+'</tbody></table>'+
    '<div class="section-title">Bonus / Malus ('+bm.length+')'+(ed?' <button class="btn sm" style="float:right" onclick="addBonusMalus(\''+id+'\')">+ Bonus/Malus</button>':'')+'</div><table class="mini-table"><thead><tr><th>Vrsta</th><th>Opis</th><th class="num">Iznos</th>'+(ed?'<th></th>':'')+'</tr></thead><tbody>'+(bm.length?bm.map(b=>'<tr><td>'+(b.kind==='bonus'?'<span class="badge b-green">bonus</span>':'<span class="badge b-red">malus</span>')+'</td><td>'+esc(b.label)+'</td><td class="num">'+(b.kind==='malus'?'-':'+')+fmtMoney(b.amount)+'</td>'+(ed?'<td class="num"><button class="btn sm danger" onclick="delBonusMalus(\''+b.id+'\',\''+id+'\')">×</button></td>':'')+'</tr>').join(''):'<tr><td colspan="'+(ed?4:3)+'" class="muted" style="padding:12px">—</td></tr>')+'</tbody></table>'+
    '<div style="text-align:right;margin-top:12px"><div>Osnovica (stavke): <b>'+fmtMoney(s.base_amount)+'</b></div><div>Bonus: <b>+'+fmtMoney(s.bonus_total)+'</b> · Malus: <b>-'+fmtMoney(s.malus_total)+'</b></div><div>Akontacije: <b>-'+fmtMoney(s.advance_total)+'</b> · Refundacija: <b>+'+fmtMoney(s.refund_total)+'</b></div><div style="font-size:17px;margin-top:4px">Za isplatu: <b>'+fmtMoney(s.total_amount)+'</b></div></div>';
  openModal('Obračun — '+(d?d.full_name:''),body,'<button class="btn no-print" onclick="window.print()">Štampa / PDF</button><button class="btn" data-close>Zatvori</button>',true);$$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);};
window.approveSettlement=id=>{const s=Store.get('driver_settlements',id);const next=s.status==='odobreno'?'isplaceno':'odobreno';Store.update('driver_settlements',id,{status:next,approved_by:state.user.id});audit('approve','settlement',id,'Obračun → '+next);toast('Obračun: '+next);render();};

export {
  openSettlementForm,
  recomputeSettlement
};
