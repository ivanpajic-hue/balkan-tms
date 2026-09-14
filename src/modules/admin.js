/* BALKAN TMS — modules/admin.js
   Administracija
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { KEY, SB_ANON, SB_URL } from '../core/config.js';
import { $, $$, esc, fmtMoney, toast } from '../core/dom.js';
import { MODULES, ROLES, audit, can } from '../core/rbac.js';
import { companyName } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { mapAppUsers, sbClient, sbFetchUsers, sbWipeAll } from '../core/supabase.js';
import { Views } from './registry.js';
import { setSetting, setting } from '../ui/lookups.js';
import { bindSave, closeModal, confirmDelete, field, openModal, saveBtn } from '../ui/modal.js';
import { compDot } from '../ui/status.js';

const collapsed={};
const LOOKUP_DEFS=[
  {table:'order_statuses',title:'Statusi naloga',fields:[{name:'code',label:'Šifra'},{name:'name',label:'Naziv'}]},
  {table:'order_doc_types',title:'Tipovi dokumentacije naloga',fields:[{name:'code',label:'Šifra'},{name:'name',label:'Naziv'}]},
  {table:'expense_categories',title:'Stavke troškova / ulaznih računa',fields:[{name:'code',label:'Šifra'},{name:'name',label:'Naziv'}]},
  {table:'settlement_item_types',title:'Stavke obračuna vozača',fields:[{name:'code',label:'Šifra'},{name:'name',label:'Naziv'},{name:'unit',label:'Jedinica'},{name:'default_rate',label:'Podraz. cena',type:'number'}]},
  {table:'fleet_doc_types',title:'Stavke alarma / dokumenata vozila',fields:[{name:'code',label:'Šifra'},{name:'name',label:'Naziv'},{name:'default_days',label:'Podraz. rok (dana)',type:'number'}]},
  {table:'driver_doc_types',title:'Stavke alarma / dokumenata vozača',fields:[{name:'code',label:'Šifra'},{name:'name',label:'Naziv'},{name:'default_days',label:'Podraz. rok (dana)',type:'number'}]},
  {table:'countries',title:'Šifre država',fields:[{name:'code',label:'Šifra (npr. DE)'},{name:'name',label:'Naziv države'}]},
];
function lookupCard(def){const rows=Store.all(def.table).filter(r=>r.company_id==null||state.companyId==='ALL'||r.company_id===state.companyId);const canEd=can('admin','E');const canC=can('admin','C');const cid='clp_'+def.table;const col=collapsed[cid]!==false;
  return '<div class="card'+(col?' collapsed':'')+'" style="margin-bottom:12px"><div class="ch clp" onclick="toggleCollapse(\''+cid+'\')">'+esc(def.title)+' <span class="small muted">('+rows.length+')</span>'+(canC?' <button class="btn sm" onclick="event.stopPropagation();openLookupForm(\''+def.table+'\')">+ Dodaj</button>':'')+'<span class="chev">▾</span></div><div class="cb" style="padding:0"><table><thead><tr>'+def.fields.map(f=>'<th>'+esc(f.label)+'</th>').join('')+'<th>Aktivno</th>'+(canEd?'<th class="num">Akcije</th>':'')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+def.fields.map(f=>'<td>'+esc(r[f.name]==null?'—':r[f.name])+'</td>').join('')+'<td>'+(r.active!==false?'<span class="badge b-green">da</span>':'<span class="badge b-grey">ne</span>')+'</td>'+(canEd?'<td class="num"><div class="row-act"><button class="btn sm" onclick="openLookupForm(\''+def.table+'\',\''+r.id+'\')">Izmeni</button><button class="btn sm danger" onclick="delLookup(\''+def.table+'\',\''+r.id+'\')">×</button></div></td>':'')+'</tr>').join(''):'<tr><td colspan="'+(def.fields.length+2)+'" class="muted" style="padding:12px">Nema stavki.</td></tr>')+'</tbody></table></div></div>';}
window.toggleCollapse=id=>{collapsed[id]=collapsed[id]===false?true:false;render();};
window.openLookupForm=(table,id)=>{const def=LOOKUP_DEFS.find(d=>d.table===table);const r=id?Store.get(table,id):{};
  const body='<div class="form-grid">'+def.fields.map(f=>field({name:f.name,label:f.label,type:f.type||'text',value:r[f.name]})).join('')+field({name:'active',label:'',type:'checkbox',value:r.active!==false,cblabel:'Aktivno'})+'</div>';
  openModal((id?'Izmena':'Nova stavka')+' — '+def.title,body,saveBtn());
  bindSave(f=>{def.fields.forEach(x=>{if(x.type==='number')f[x.name]=Number(f[x.name])||0;});if(id){Store.update(table,id,f);audit('update',table,id,'Izmena šifarnika '+table);}else{f.company_id=null;const n=Store.insert(table,f);audit('create',table,n.id,'Nova stavka šifarnika '+table);}toast('Šifarnik ažuriran');closeModal();render();});};
window.delLookup=(table,id)=>{const r=Store.get(table,id);confirmDelete(table,id,'stavku „'+(r.name||r.code)+'"');};
window.openParams=()=>{const body='<div class="form-grid">'+field({name:'interna_zarada_default',label:'Preporučena (minimalna) interna zarada za fakturisanje',type:'number',value:setting('interna_zarada_default',0),attr:'step="0.01"'})+'</div><div class="hint-inline">Odnosi se na fakturisanje: nalog se ne može sačuvati ako je interna zarada (Iznos naloga − EUR − INTERNA − GOTOVINA) ispod ove vrednosti.</div>';openModal('Parametri',body,saveBtn());bindSave(f=>{setSetting('interna_zarada_default',Number(f.interna_zarada_default)||0);toast('Parametri sačuvani');closeModal();render();});};
window.openCompanyForm=id=>{const r=Store.get('companies',id)||{};
  const body='<div class="form-grid">'+field({name:'name',label:'Naziv firme',value:r.name,full:true})+field({name:'short_name',label:'Skraćeno',value:r.short_name})+field({name:'vat_id',label:'PIB / VAT',value:r.vat_id})+field({name:'reg_no',label:'Matični broj',value:r.reg_no})+field({name:'address',label:'Adresa',value:r.address,full:true})+field({name:'country',label:'Država',value:r.country})+field({name:'currency',label:'Valuta',value:r.currency||'EUR'})+field({name:'accent_color',label:'Boja firme',type:'color',value:r.accent_color||'#2563EB'})+'</div><div class="hint-inline">Ovi podaci se koriste u zaglavlju dokumenata (fakture, obračuni, izveštaji).</div>';
  openModal('Podaci firme — zaglavlje dokumenata',body,saveBtn());
  bindSave(f=>{Store.update('companies',id,f);audit('update','company',id,'Izmena podataka firme '+f.name);toast('Podaci firme sačuvani');closeModal();render();});};
Views.admin=()=>{
  const users=Store.all('users');const logs=Store.all('audit_logs').slice().reverse().slice(0,40);
  const sif=can('admin','V')?('<div class="section-title">Šifarnici — definišu stavke u nalozima, turama, troškovima, obračunu i alarmima</div>'+LOOKUP_DEFS.map(lookupCard).join('')+'<div class="card" style="margin-bottom:16px"><div class="ch">Parametri'+(can('admin','E')?' <button class="btn sm" style="margin-left:auto" onclick="openParams()">Izmeni</button>':'')+'</div><div class="cb"><div class="detail-grid"><div class="di"><div class="k">Preporučena interna zarada (fakturisanje)</div><div class="v">'+fmtMoney(setting('interna_zarada_default',0))+'</div></div></div></div></div>'):'';
  const canUserAdmin=(state.user.role==='SUPER_ADMIN'||state.user.role==='ADMIN');
  const userRows='<div class="card" style="margin-bottom:16px"><div class="ch">Korisnici i pristup (online nalozi)'+(canUserAdmin?' <button class="btn sm" style="margin-left:auto" onclick="openNewUserForm()">+ Novi korisnik</button>':'')+'</div><div class="cb" style="padding:0"><table><thead><tr><th>Korisnik</th><th>Rola</th><th>Kompanije</th><th>Status</th><th>Moduli (V)</th>'+(canUserAdmin?'<th class="num">Akcije</th>':'')+'</tr></thead><tbody>'+users.map(u=>{const acc=Store.find('user_company_access',a=>a.user_id===u.id).map(a=>(Store.get('companies',a.company_id)||{}).short_name).join(', ');const role=ROLES[u.role]||ROLES.READONLY;const mods=role.all?'sve':visibleModulesFor(ROLES[u.role]?u.role:'READONLY').length+' modula';return '<tr><td><b>'+esc(u.full_name)+'</b><div class="small muted">'+esc(u.email)+'</div></td><td>'+esc(role.name)+'</td><td>'+esc(acc||'—')+'</td><td>'+(u.active?'<span class="tag">aktivan</span>':'<span class="tag" style="color:var(--bad)">deaktiviran</span>')+'</td><td class="small">'+mods+'</td>'+(canUserAdmin?'<td class="num"><button class="btn sm" onclick="openUserAdminForm(\''+u.id+'\')">Izmeni</button></td>':'')+'</tr>';}).join('')+'</tbody></table></div></div>';
  const matrix='<div class="card'+(collapsed['clp_matrix']?' collapsed':'')+'" style="margin-bottom:16px"><div class="ch clp" onclick="toggleCollapse(\'clp_matrix\')">Matrica dozvola (V/C/E/D/X/A)<span class="chev">▾</span></div><div class="cb" style="padding:0;overflow-x:auto"><table><thead><tr><th>Modul</th>'+Object.keys(ROLES).map(rk=>'<th>'+esc(ROLES[rk].name.split(' ')[0])+'</th>').join('')+'</tr></thead><tbody>'+MODULES.map(m=>'<tr><td>'+esc(m.label)+'</td>'+Object.keys(ROLES).map(rk=>{const r=ROLES[rk];const p=r.all?'VCEDXA':(r.perms[m.key]||'—');return '<td class="small">'+esc(p||'—')+'</td>';}).join('')+'</tr>').join('')+'</tbody></table></div></div>';
  const audit='<div class="card'+(collapsed['clp_audit']?' collapsed':'')+'"><div class="ch clp" onclick="toggleCollapse(\'clp_audit\')">Audit log (poslednjih 40)<span class="chev">▾</span></div><div class="cb" style="padding:0"><table><thead><tr><th>Vreme</th><th>Korisnik</th><th>Akcija</th><th>Entitet</th><th>Opis</th></tr></thead><tbody>'+(logs.length?logs.map(l=>'<tr><td class="small">'+new Date(l.at).toLocaleString('sr-RS')+'</td><td>'+esc((Store.get('users',l.user_id)||{}).full_name||'')+'</td><td><span class="tag">'+esc(l.action)+'</span></td><td class="small">'+esc(l.entity_type)+'</td><td class="small">'+esc(l.summary)+'</td></tr>').join(''):'<tr><td colspan="5" class="muted">—</td></tr>')+'</tbody></table></div></div>';
  const tools='<div class="card" style="margin-bottom:16px"><div class="ch">Podaci — online baza (Supabase)</div><div class="cb flex" style="flex-wrap:wrap;gap:8px"><button class="btn" onclick="refreshData()">⟳ Osveži sa servera</button><button class="btn" onclick="exportJSON()">Export cele baze (JSON)</button>'+(state.user.role==='SUPER_ADMIN'?'<button class="btn" onclick="importJSON()">Import (JSON) → server</button><button class="btn" onclick="migrateLocal()">Prebaci lokalne v2.x podatke</button><button class="btn danger" onclick="resetData()">Reset na demo podatke</button>':'')+'</div><div class="cb hint-inline" style="padding-top:0">Import, prebacivanje i reset menjaju podatke na serveru za sve korisnike (samo Super Admin).</div></div>';
  const compCard='<div class="card" style="margin-bottom:16px"><div class="ch">Podaci firmi (zaglavlje dokumenata)</div><div class="cb" style="padding:0"><table><thead><tr><th>Firma</th><th>PIB/VAT</th><th>Matični</th><th>Adresa</th>'+(can('admin','E')?'<th class="num">Akcije</th>':'')+'</tr></thead><tbody>'+Store.all('companies').map(c=>'<tr><td>'+compDot(c.id)+'<b>'+esc(c.name)+'</b></td><td>'+esc(c.vat_id||'—')+'</td><td>'+esc(c.reg_no||'—')+'</td><td class="small">'+esc(c.address||'—')+'</td>'+(can('admin','E')?'<td class="num"><button class="btn sm" onclick="openCompanyForm(\''+c.id+'\')">Izmeni</button></td>':'')+'</tr>').join('')+'</tbody></table></div></div>';
  return '<div class="crumb">Sistem · '+esc(companyName(state.companyId))+'</div><div class="page-h"><h1>Administracija</h1><div class="sp"></div></div>'+tools+compCard+sif+userRows+matrix+audit;
};
function visibleModulesFor(role){const r=ROLES[role];return MODULES.filter(m=>r.all||(r.perms[m.key]||'').includes('V'));}
window.exportJSON=()=>{const blob=new Blob([JSON.stringify(Store.db,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='balkan_tms_backup.json';a.click();toast('Baza izvezena');};
function replaceRemoteDb(newDb){
  delete newDb.users;delete newDb.user_company_access;
  const keepU=Store.db.users,keepA=Store.db.user_company_access;
  Store.db=Object.assign({},newDb,{users:keepU,user_company_access:keepA});
  sbWipeAll();Store.migrate();Store.pushAll();
}
window.importJSON=()=>{if(state.user.role!=='SUPER_ADMIN'){toast('Samo Super Admin može import na server.');return;}
  const inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
    r.onload=()=>{try{const d=JSON.parse(r.result);
      openModal('Import baze (JSON)','<p>Import će <b>zameniti kompletnu online bazu</b> sadržajem fajla, za sve korisnike. Nastaviti?</p>','<button class="btn" data-close>Otkaži</button><button class="btn danger" id="ijYes">Zameni bazu</button>');
      $$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
      $('#ijYes').onclick=()=>{replaceRemoteDb(d);closeModal();toast('Baza uvezena i poslata na server');state.route='dashboard';render();};
    }catch(err){toast('Greška pri uvozu JSON-a');}};r.readAsText(f);};inp.click();};
window.migrateLocal=()=>{if(state.user.role!=='SUPER_ADMIN'){toast('Samo Super Admin može prebacivanje na server.');return;}
  const raw=localStorage.getItem(KEY);
  if(!raw){toast('U ovom pregledaču nema podataka starog prototipa (v2.x).');return;}
  openModal('Prebacivanje lokalnih podataka','<p>Pronađena je lokalna baza prototipa (v2.x) u ovom pregledaču. Prebacivanje će <b>zameniti podatke na serveru</b> sadržajem lokalne baze, za sve korisnike. Nastaviti?</p>','<button class="btn" data-close>Otkaži</button><button class="btn danger" id="mlYes">Prebaci na server</button>');
  $$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
  $('#mlYes').onclick=()=>{try{replaceRemoteDb(JSON.parse(raw));closeModal();toast('Lokalni podaci poslati na server');state.route='dashboard';render();}catch(e){toast('Greška: '+e.message);}};};
window.resetData=()=>{if(state.user.role!=='SUPER_ADMIN'){toast('Samo Super Admin može reset.');return;}
  openModal('Reset podataka','<p>Vraćanje <b>cele online baze</b> na demo podatke. Svi podaci na serveru biće obrisani, za sve korisnike. Nastaviti?</p>','<button class="btn" data-close>Otkaži</button><button class="btn danger" id="rdYes">Resetuj</button>');
  $$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
  $('#rdYes').onclick=()=>{sbWipeAll();Store.reset();closeModal();toast('Podaci resetovani');state.route='dashboard';render();};};
window.openUserAdminForm=id=>{
  const u=Store.appUsers.find(x=>x.id===id);if(!u){toast('Korisnik nije pronađen');return;}
  const comps=Store.all('companies');
  const body='<div class="field"><label>Ime i prezime</label><input id="uaName" value="'+esc(u.full_name||'')+'"></div>'+
    '<div class="field"><label>Rola</label><select id="uaRole">'+Object.keys(ROLES).map(r=>'<option value="'+r+'"'+(u.role===r?' selected':'')+'>'+esc(ROLES[r].name)+'</option>').join('')+'</select></div>'+
    '<div class="field"><label>Kompanije</label>'+comps.map(c=>'<label style="display:inline-flex;align-items:center;gap:6px;margin-right:14px;font-weight:400"><input type="checkbox" class="uaComp" value="'+c.id+'"'+((Array.isArray(u.companies)?u.companies:[]).includes(c.id)?' checked':'')+' style="width:auto">'+esc(c.short_name)+'</label>').join('')+'</div>'+
    '<div class="field"><label>Status</label><select id="uaActive"><option value="1"'+(u.active?' selected':'')+'>Aktivan</option><option value="0"'+(!u.active?' selected':'')+'>Deaktiviran</option></select></div>'+
    '<div class="hint-inline">E-mail: '+esc(u.email)+' — menja se samo u Supabase konzoli (Authentication → Users).</div>';
  openModal('Korisnik: '+esc(u.full_name||u.email),body,'<button class="btn" data-close>Otkaži</button><button class="btn pri" id="uaSave">Sačuvaj</button>');
  $$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
  $('#uaSave').onclick=async()=>{
    const patch={full_name:$('#uaName').value.trim(),role:$('#uaRole').value,active:$('#uaActive').value==='1',companies:$$('.uaComp').filter(c=>c.checked).map(c=>c.value)};
    const {error}=await sbClient().from('tms_app_users').update(patch).eq('id',u.id);
    if(error){toast('⚠ '+error.message);return;}
    Object.assign(u,patch);mapAppUsers(Store.db,Store.appUsers);
    audit('update','app_user',u.id,'Izmena korisnika: '+(patch.full_name||u.email));
    closeModal();toast('Korisnik sačuvan');render();};
};
window.openNewUserForm=()=>{
  const comps=Store.all('companies');
  const body='<div class="field"><label>E-mail</label><input id="nuEmail" type="email" placeholder="ime@firma.rs"></div>'+
    '<div class="field"><label>Početna lozinka (min 6 znakova)</label><input id="nuPass" type="text"></div>'+
    '<div class="field"><label>Ime i prezime</label><input id="nuName"></div>'+
    '<div class="field"><label>Rola</label><select id="nuRole">'+Object.keys(ROLES).map(r=>'<option value="'+r+'"'+(r==='DISPECER'?' selected':'')+'>'+esc(ROLES[r].name)+'</option>').join('')+'</select></div>'+
    '<div class="field"><label>Kompanije</label>'+comps.map(c=>'<label style="display:inline-flex;align-items:center;gap:6px;margin-right:14px;font-weight:400"><input type="checkbox" class="nuComp" value="'+c.id+'" checked style="width:auto">'+esc(c.short_name)+'</label>').join('')+'</div>'+
    '<div class="hint-inline">Nalog se otvara odmah (Supabase Auth). Zaposleni se prijavljuje ovim e-mailom i lozinkom, koju posle može sam da promeni.</div>';
  openModal('Novi korisnik',body,'<button class="btn" data-close>Otkaži</button><button class="btn pri" id="nuSave">Kreiraj nalog</button>');
  $$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
  $('#nuSave').onclick=async()=>{
    const email=$('#nuEmail').value.trim(),pass=$('#nuPass').value,name=$('#nuName').value.trim();
    if(!email||pass.length<6){toast('Unesi e-mail i lozinku od bar 6 znakova.');return;}
    $('#nuSave').disabled=true;
    try{
      const aux=window.supabase.createClient(SB_URL,SB_ANON,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data,error}=await aux.auth.signUp({email,password:pass,options:{data:{full_name:name||email}}});
      if(error)throw error;
      const nid=data.user&&data.user.id;
      const patch={full_name:name||email,role:$('#nuRole').value,companies:$$('.nuComp').filter(c=>c.checked).map(c=>c.value),active:true};
      if(nid){const {error:e2}=await sbClient().from('tms_app_users').update(patch).eq('id',nid);if(e2)throw e2;}
      const users=await sbFetchUsers();Store.appUsers=users;mapAppUsers(Store.db,users);
      audit('create','app_user',nid||email,'Novi korisnik: '+email);
      closeModal();toast('Korisnik kreiran: '+email);render();
    }catch(e){toast('⚠ '+((e&&e.message)||e));}
    $('#nuSave').disabled=false;};
};

export {
  collapsed,
  LOOKUP_DEFS,
  lookupCard,
  visibleModulesFor,
  replaceRemoteDb
};
