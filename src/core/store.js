/* BALKAN TMS — core/store.js
   Store — jedini sloj pristupa podacima
   Modul generisan iz monolita v3.0 (A0.2). */
import { SB_TABLES, TRANSACTIONAL } from './config.js';
import { nowISO, uid } from './dom.js';
import { seed } from './seed.js';
import { state } from './state.js';
import { mapAppUsers, sbFetchAll, sbFetchUsers, sbPush, sbPushMany } from './supabase.js';

const Store={
  db:null,appUsers:[],
  async loadRemote(){const [db,users]=await Promise.all([sbFetchAll(),sbFetchUsers()]);
    this.db=db;this.appUsers=users;mapAppUsers(this.db,users);this.migrate();},
  migrate(){const fresh=seed();const touched={};
    Object.keys(fresh).forEach(t=>{if(!this.db[t])this.db[t]=[];});
    ['expense_categories','settlement_item_types','fleet_doc_types','driver_doc_types','countries','settings','order_statuses','order_doc_types'].forEach(t=>{
      if((this.db.companies||[]).length&&(!this.db[t]||!this.db[t].length)){this.db[t]=fresh[t];sbPushMany(t,this.db[t]);}});
    (this.db.transport_orders||[]).forEach(o=>{if(o.fakt_eur==null){o.fakt_eur=o.agreed_price||0;o.fakt_din=0;o.interna_iznos=0;o.interna_firma_id=null;o.gotovina=0;o.interna_zarada=0;touched.transport_orders=1;}
      if(o.eur_klijent_id===undefined){o.eur_klijent_id=null;o.din_klijent_id=null;o.gotovina_klijent_id=null;touched.transport_orders=1;}
      if(o.eur_izdaje_id===undefined){o.eur_izdaje_id=o.company_id||'avto';o.interna_izdaje_id='avto';o.gotovina_izdaje_id=o.company_id||'avto';o.din_izdaje_id='transport';if(o.interna_firma_id==null||!(this.db.companies||[]).some(c=>c.id===o.interna_firma_id))o.interna_firma_id='transport';touched.transport_orders=1;}
      if(o.pickup_country==null){o.pickup_country=(String(o.pickup_location||'').split(',').pop()||'').trim();o.delivery_country=(String(o.delivery_location||'').split(',').pop()||'').trim();touched.transport_orders=1;}});
    (this.db.trips||[]).forEach(t=>{if(t.km_start===undefined){t.km_start=0;t.km_stop=t.actual_km||0;touched.trips=1;}});
    (this.db.order_vehicles||[]).forEach(v=>{if(v.condition==null){v.condition='polovna';touched.order_vehicles=1;}});
    (this.db.purchase_invoices||[]).forEach(p=>{if(p.neto==null){p.neto=p.amount||0;p.pdv_rate=0;p.bruto=p.amount||0;touched.purchase_invoices=1;}});
    Object.keys(touched).forEach(t=>sbPushMany(t,this.db[t]));},
  save(){/* v3.0: nema localStorage; upis ide preko sbPush write-through sloja */},
  isEmpty(){return !(this.db&&(this.db.companies||[]).length);},
  seedDemo(){const fresh=seed();const keepU=this.db.users,keepA=this.db.user_company_access;
    this.db=Object.assign(fresh,{users:keepU,user_company_access:keepA});this.pushAll();},
  seedBasic(){const fresh=seed();TRANSACTIONAL.forEach(t=>fresh[t]=[]);
    const keepU=this.db.users,keepA=this.db.user_company_access;
    this.db=Object.assign(fresh,{users:keepU,user_company_access:keepA});this.pushAll();},
  pushAll(){SB_TABLES.forEach(t=>sbPushMany(t,this.db[t]||[]));},
  reset(){this.seedDemo();},
  all(t){return (this.db[t]||[]).filter(r=>!r.deleted_at);},
  get(t,id){return this.all(t).find(r=>r.id===id);},
  find(t,fn){return this.all(t).filter(fn);},
  insert(t,row){row.id=row.id||uid(t.slice(0,3));row.created_at=nowISO();row.updated_at=nowISO();
    row.created_by=state.user?state.user.id:null;row.updated_by=row.created_by;
    (this.db[t]=this.db[t]||[]).push(row);sbPush(t,row);return row;},
  update(t,id,patch){const r=this.get(t,id);if(!r)return null;Object.assign(r,patch);r.updated_at=nowISO();
    r.updated_by=state.user?state.user.id:null;sbPush(t,r);return r;},
  remove(t,id){const r=this.get(t,id);if(r){r.deleted_at=nowISO();sbPush(t,r);}return r;},
  scoped(t){const rows=this.all(t);if(state.companyId==='ALL')return rows;return rows.filter(r=>r.company_id===state.companyId);}
};

export {
  Store
};
