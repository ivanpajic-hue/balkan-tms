/* BALKAN TMS — app/auth.js
   Prijava, sesija, prva postavka
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from './router.js';
import { mountShell } from './shell.js';
import { $, $$, toast } from '../core/dom.js';
import { ROLES, audit } from '../core/rbac.js';
import { userCompanies } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { sbClient } from '../core/supabase.js';
import { closeModal, openModal } from '../ui/modal.js';

function loginErr(msg){const el=$('#loginErr');if(!el)return;el.style.display=msg?'block':'none';el.textContent=msg||'';}
async function doLogin(){
  const email=($('#loginEmail').value||'').trim(),pass=$('#loginPass').value||'';
  if(!email||!pass){loginErr('Unesi e-mail i lozinku.');return;}
  const btn=$('#loginBtn');btn.disabled=true;btn.textContent='Prijava...';loginErr('');
  try{const {data,error}=await sbClient().auth.signInWithPassword({email,password:pass});
    if(error)throw new Error(/invalid login/i.test(error.message||'')?'Pogrešan e-mail ili lozinka.':error.message);
    await enterApp(data.session);
  }catch(e){loginErr((e&&e.message)||'Greška pri prijavi.');}
  btn.disabled=false;btn.textContent='Prijava';
}
async function enterApp(session){
  const {data:prof,error}=await sbClient().from('tms_app_users').select('*').eq('id',session.user.id).maybeSingle();
  if(error){loginErr('Greška pri čitanju profila: '+error.message);return;}
  if(!prof){loginErr('Nalog nije registrovan u TMS-u. Kontaktiraj administratora.');return;}
  if(!prof.active){await sbClient().auth.signOut();loginErr('Nalog je deaktiviran. Kontaktiraj administratora.');return;}
  const btn=$('#loginBtn');if(btn){btn.disabled=true;btn.textContent='Učitavanje podataka...';}
  try{await Store.loadRemote();}
  catch(e){loginErr('Greška pri učitavanju baze: '+((e&&e.message)||e)+'. Da li je SQL šema pokrenuta u Supabase projektu?');if(btn){btn.disabled=false;btn.textContent='Prijava';}return;}
  state.user={id:prof.id,full_name:prof.full_name||prof.email,email:prof.email,role:ROLES[prof.role]?prof.role:'READONLY'};
  if(btn){btn.disabled=false;btn.textContent='Prijava';}
  if(Store.isEmpty()&&state.user.role==='SUPER_ADMIN'){showFirstRun();return;}
  if(Store.isEmpty()){loginErr('Baza još nije inicijalizovana. Neka se Super Admin prvi prijavi.');return;}
  finishLogin();
}
function finishLogin(){
  const comps=userCompanies();state.companyId=comps.length?comps[0].id:((Store.all('companies')[0]||{}).id||'avto');state.route='dashboard';
  $('#login').style.display='none';$('#shell').style.display='block';
  audit('login','user',state.user.id,'Prijava: '+state.user.full_name);
  mountShell();render();
}
function showFirstRun(){
  openModal('Prva postavka baze','<p>Baza na serveru je prazna. Kako želiš da počneš?</p><ul class="small" style="margin:10px 0 0 18px;line-height:1.7"><li><b>Osnovni šifarnici</b> — firme, kategorije troškova, države, statusi. Preporučeno za produkciju: počinješ sa praznim nalozima i unosiš stvarne podatke.</li><li><b>Demo podaci</b> — kompletan probni set (klijenti, nalozi, ture, fakture) za isprobavanje.</li></ul>',
    '<button class="btn" id="frBasic">Osnovni šifarnici (produkcija)</button><button class="btn pri" id="frDemo">Demo podaci</button>');
  $('#frBasic').onclick=()=>{Store.seedBasic();closeModal();finishLogin();toast('Osnovni šifarnici učitani');};
  $('#frDemo').onclick=()=>{Store.seedDemo();closeModal();finishLogin();toast('Demo podaci učitani');};
}
window.logout=async()=>{try{await sbClient().auth.signOut();}catch(e){}state.user=null;$('#shell').style.display='none';$('#login').style.display='flex';closeModal();};
window.refreshData=async()=>{try{await Store.loadRemote();render();toast('Podaci osveženi sa servera');}catch(e){toast('⚠ Greška pri osvežavanju: '+((e&&e.message)||e));}};
window.openMyPassword=()=>{
  openModal('Promena lozinke','<div class="field"><label>Nova lozinka (min 6 znakova)</label><input id="mpPass" type="password"></div><div class="field"><label>Ponovi novu lozinku</label><input id="mpPass2" type="password"></div>',
    '<button class="btn" data-close>Otkaži</button><button class="btn pri" id="mpSave">Sačuvaj</button>');
  $$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
  $('#mpSave').onclick=async()=>{const p=$('#mpPass').value;
    if(p.length<6){toast('Lozinka mora imati bar 6 znakova.');return;}
    if(p!==$('#mpPass2').value){toast('Lozinke se ne poklapaju.');return;}
    const {error}=await sbClient().auth.updateUser({password:p});
    if(error){toast('⚠ '+error.message);return;}
    closeModal();toast('Lozinka promenjena');};
};

export {
  loginErr,
  doLogin,
  enterApp,
  finishLogin,
  showFirstRun
};
