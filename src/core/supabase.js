/* BALKAN TMS — core/supabase.js
   Supabase klijent i write-through sloj
   Modul generisan iz monolita v3.0 (A0.2). */
import { SB_ANON, SB_TABLES, SB_URL } from './config.js';
import { nowISO, toast } from './dom.js';

let sb=null;
function sbClient(){if(!sb)sb=window.supabase.createClient(SB_URL,SB_ANON);return sb;}
let sbQueue=Promise.resolve();
function setSync(st){const el=document.getElementById('syncBadge');if(!el)return;el.className='syncbadge '+st;el.title=st==='saving'?'Čuvanje na server...':st==='err'?'Greška sinhronizacije — proveri internet vezu':'Sinhronizovano';}
function sbEnqueue(fn){sbQueue=sbQueue.then(fn).catch(e=>{console.error('SYNC GREŠKA',e);setSync('err');toast('⚠ Greška pri čuvanju na server: '+((e&&e.message)||e));});return sbQueue;}
function sbRowOf(row){return {id:row.id,company_id:row.company_id||null,deleted_at:row.deleted_at||null,updated_at:nowISO(),data:row};}
function sbPush(t,row){if(!SB_TABLES.includes(t)||!row||!row.id)return;const payload=sbRowOf(row);
  sbEnqueue(async()=>{setSync('saving');const {error}=await sbClient().from('tms_'+t).upsert(payload);if(error)throw error;setSync('ok');});}
function sbPushMany(t,rows){rows=(rows||[]).filter(r=>r&&r.id);if(!SB_TABLES.includes(t)||!rows.length)return;const payload=rows.map(sbRowOf);
  sbEnqueue(async()=>{setSync('saving');for(let i=0;i<payload.length;i+=200){const {error}=await sbClient().from('tms_'+t).upsert(payload.slice(i,i+200));if(error)throw error;}setSync('ok');});}
function sbWipeAll(){sbEnqueue(async()=>{setSync('saving');for(const t of SB_TABLES){const {error}=await sbClient().from('tms_'+t).delete().neq('id','');if(error)throw error;}setSync('ok');});}
async function sbFetchAll(){const db={};
  await Promise.all(SB_TABLES.map(async t=>{let rows=[],from=0;const page=1000;
    for(;;){const {data,error}=await sbClient().from('tms_'+t).select('data').range(from,from+page-1);
      if(error)throw new Error('tms_'+t+': '+error.message);
      rows=rows.concat((data||[]).map(r=>r.data));if(!data||data.length<page)break;from+=page;}
    db[t]=rows;}));
  return db;}
async function sbFetchUsers(){const {data,error}=await sbClient().from('tms_app_users').select('*');if(error)throw error;return data||[];}
function mapAppUsers(db,appUsers){
  db.users=(appUsers||[]).map(u=>({id:u.id,full_name:u.full_name||u.email,email:u.email,role:u.role,active:u.active}));
  db.user_company_access=[];
  (appUsers||[]).forEach(u=>{(Array.isArray(u.companies)?u.companies:[]).forEach(c=>db.user_company_access.push({id:'uca_'+u.id+'_'+c,user_id:u.id,company_id:c}));});}

export {
  sb,
  sbClient,
  sbQueue,
  setSync,
  sbEnqueue,
  sbRowOf,
  sbPush,
  sbPushMany,
  sbWipeAll,
  sbFetchAll,
  sbFetchUsers,
  mapAppUsers
};
