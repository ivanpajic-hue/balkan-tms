/* BALKAN TMS — core/dom.js
   DOM i format helperi
   Modul generisan iz monolita v3.0 (A0.2). */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const uid=(p='id')=>p+'_'+Math.random().toString(36).slice(2,9);
const todayISO=()=>new Date().toISOString().slice(0,10);
const nowISO=()=>new Date().toISOString();
function addDays(iso,d){const t=new Date(iso);t.setDate(t.getDate()+d);return t.toISOString().slice(0,10);}
function daysUntil(iso){if(!iso)return null;const ms=new Date(iso)-new Date(todayISO());return Math.round(ms/86400000);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const CUR_SYM={EUR:'€',RSD:'din',USD:'$'};
function fmtMoney(n,cur='EUR'){n=Number(n||0);return n.toLocaleString('sr-RS',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(CUR_SYM[cur]||cur);}
function fmtDate(iso){if(!iso)return '—';return new Date(iso).toLocaleDateString('sr-RS');}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200);}

export {
  $,
  $$,
  uid,
  todayISO,
  nowISO,
  addDays,
  daysUntil,
  esc,
  CUR_SYM,
  fmtMoney,
  fmtDate,
  toast
};
