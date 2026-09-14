/* BALKAN TMS — core/rbac.js
   Moduli, uloge, dozvole, audit
   Modul generisan iz monolita v3.0 (A0.2). */
import { nowISO } from './dom.js';
import { state } from './state.js';
import { Store } from './store.js';

const MODULES=[
  {key:'dashboard',label:'Komandna tabla',ic:'\u25A3',sec:'Pregled'},
  {key:'clients',label:'Klijenti i partneri',ic:'\u25F4',sec:'Operativa'},
  {key:'orders',label:'Nalozi za transport',ic:'\u25A4',sec:'Operativa'},
  {key:'planning',label:'Planiranje utovara',ic:'\u25A5',sec:'Operativa'},
  {key:'trips',label:'Ture',ic:'\u27A4',sec:'Operativa'},
  {key:'expenses',label:'Troškovi',ic:'\u25F5',sec:'Finansije'},
  {key:'invoices',label:'Fakture',ic:'\u20AC',sec:'Finansije'},
  {key:'purchases',label:'Ulazni računi',ic:'\u25F6',sec:'Finansije'},
  {key:'settlements',label:'Obračun vozača',ic:'\u25F7',sec:'Finansije'},
  {key:'fleet',label:'Vozni park',ic:'\u26DF',sec:'Resursi'},
  {key:'drivers',label:'Vozači',ic:'\u2609',sec:'Resursi'},
  {key:'reports',label:'Izveštaji',ic:'\u25EB',sec:'Analitika'},
  {key:'alerts',label:'Alarmi',ic:'!',sec:'Analitika'},
  {key:'admin',label:'Administracija',ic:'\u2699',sec:'Sistem'},
];
const ROLES={
  SUPER_ADMIN:{name:'Super Admin / Vlasnik',color:'#7C3AED',all:true},
  ADMIN:{name:'Administrator',color:'#2F3E9E',perms:{dashboard:'VX',clients:'VCEDX',orders:'VCEDX',planning:'VCEDX',trips:'VCEDX',expenses:'VCEDXA',invoices:'VCEDX',purchases:'VCEDXA',settlements:'VCED',fleet:'VCEDX',drivers:'VCEDX',reports:'VX',alerts:'VCEDA',admin:'VCED'}},
  DISPECER:{name:'Dispečer',color:'#0E9488',perms:{dashboard:'VX',clients:'VCEX',orders:'VCEX',planning:'VCE',trips:'VCE',expenses:'VCE',invoices:'V',purchases:'V',settlements:'V',fleet:'V',drivers:'V',reports:'VX',alerts:'VA'}},
  FINANSIJE:{name:'Finansije',color:'#B45309',perms:{dashboard:'VX',clients:'VX',orders:'VX',planning:'V',trips:'VX',expenses:'VCEXA',invoices:'VCEDXA',purchases:'VCEDXA',settlements:'VCEXA',fleet:'VX',drivers:'V',reports:'VX',alerts:'VA'}},
  FLEET:{name:'Fleet Manager',color:'#2563EB',perms:{dashboard:'VX',clients:'V',orders:'V',planning:'V',trips:'V',expenses:'VCE',invoices:'',purchases:'VCE',settlements:'',fleet:'VCEDX',drivers:'VCEDX',reports:'VX',alerts:'VCEDA'}},
  READONLY:{name:'Menadžment (read-only)',color:'#475569',perms:{dashboard:'VX',clients:'VX',orders:'VX',planning:'V',trips:'VX',expenses:'VX',invoices:'VX',purchases:'VX',settlements:'VX',fleet:'VX',drivers:'VX',reports:'VX',alerts:'V'}},
};
function can(module,action){const r=ROLES[state.user.role];if(!r)return false;if(r.all)return true;return (r.perms[module]||'').includes(action);}
function visibleModules(){return MODULES.filter(m=>can(m.key,'V'));}
function audit(action,etype,eid,summary){Store.insert('audit_logs',{company_id:state.companyId==='ALL'?null:state.companyId,user_id:state.user.id,action,entity_type:etype,entity_id:eid,summary,at:nowISO()});}

export {
  MODULES,
  ROLES,
  can,
  visibleModules,
  audit
};
