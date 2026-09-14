/* BALKAN TMS — ui/modal.js
   Modali i helperi za forme
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { $, $$, esc, toast, uid } from '../core/dom.js';
import { MODULES, audit, can } from '../core/rbac.js';
import { companyName, userCompanies } from '../core/session.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';

function openModal(title,body,footer,wide){
  $('#modalRoot').innerHTML='<div class="modal-bg"><div class="modal '+(wide?'wide':'')+'"><div class="mh"><h3>'+esc(title)+'</h3><button class="x" data-close>×</button></div><div class="mb">'+body+'</div><div class="mf">'+(footer||'<button class="btn" data-close>Zatvori</button>')+'</div></div></div>';
  $('#modalRoot .modal-bg').onclick=e=>{if(e.target.classList.contains('modal-bg'))closeModal();};
  $$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);
}
function closeModal(){$('#modalRoot').innerHTML='';}
/* ===== Sekundarni modal (brzo modularno dodavanje iz formi) ===== */
function openModal2(title,body,footer){
  $('#modalRoot2').innerHTML='<div class="modal-bg" style="z-index:60"><div class="modal" style="max-width:460px"><div class="mh"><h3>'+esc(title)+'</h3><button class="x" data-close2>×</button></div><div class="mb">'+body+'</div><div class="mf">'+(footer||'<button class="btn" data-close2>Zatvori</button>')+'</div></div></div>';
  $('#modalRoot2 .modal-bg').onclick=e=>{if(e.target.classList.contains('modal-bg'))closeModal2();};
  $$('#modalRoot2 [data-close2]').forEach(b=>b.onclick=closeModal2);
}
function closeModal2(){$('#modalRoot2').innerHTML='';}
function appendOptionAll(selector,v,l){$$(selector,$('#modalRoot')).forEach(s=>{const o=document.createElement('option');o.value=v;o.textContent=l;s.appendChild(o);s.value=v;});}
function quickAddLookup(table,title,cb){
  const body='<div class="form-grid"><div class="field full"><label>Naziv</label><input id="qaName" placeholder="npr. CMR, Carinski dokument..."></div></div>';
  openModal2('Brzo dodavanje — '+title,body,'<button class="btn" data-close2>Otkaži</button><button class="btn pri" id="qaSave">Dodaj</button>');
  setTimeout(()=>{const e=$('#qaName');if(e)e.focus();},30);
  $('#qaSave').onclick=()=>{const name=($('#qaName').value||'').trim();if(!name){toast('Unesite naziv');return;}const code=(name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''))||uid('lk');const n=Store.insert(table,{company_id:null,code,name,active:true});audit('create',table,n.id,'Brzo dodato: '+name);toast('Dodato: '+name);cb&&cb(code,name);closeModal2();};
}
function quickAddClient(company,cb){
  const types=['klijent','primalac','posiljalac','aukcija','dealer','fizicko','dobavljac','servis','podizvodjac'];
  const body='<div class="form-grid"><div class="field full"><label>Naziv klijenta</label><input id="qcName"></div><div class="field"><label>Tip</label><select id="qcType">'+types.map(t=>'<option>'+t+'</option>').join('')+'</select></div><div class="field"><label>Država</label><input id="qcCountry"></div></div>';
  openModal2('Brzo dodavanje klijenta',body,'<button class="btn" data-close2>Otkaži</button><button class="btn pri" id="qcSave">Dodaj</button>');
  setTimeout(()=>{const e=$('#qcName');if(e)e.focus();},30);
  $('#qcSave').onclick=()=>{const name=($('#qcName').value||'').trim();if(!name){toast('Unesite naziv');return;}const n=Store.insert('clients',{company_id:company,name,type:$('#qcType').value,country:($('#qcCountry').value||''),vat_id:'',address:'',currency:'EUR',payment_terms_days:30,rating:'A',status:'aktivan',note:''});audit('create','client',n.id,'Brzo dodat klijent: '+name);toast('Klijent dodat');cb&&cb(n.id,name);closeModal2();};
}
function field(f){
  const cls=f.full?'field full':'field';let input;
  if(f.type==='select')input='<select name="'+f.name+'" '+(f.attr||'')+'>'+(f.options||[]).map(o=>'<option value="'+esc(o.v)+'" '+(String(f.value)===String(o.v)?'selected':'')+'>'+esc(o.l)+'</option>').join('')+'</select>';
  else if(f.type==='textarea')input='<textarea name="'+f.name+'" '+(f.attr||'')+'>'+esc(f.value||'')+'</textarea>';
  else if(f.type==='checkbox')input='<label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" name="'+f.name+'" '+(f.value?'checked':'')+' style="width:auto"> '+esc(f.cblabel||'')+'</label>';
  else input='<input type="'+(f.type||'text')+'" name="'+f.name+'" value="'+esc(f.value==null?'':f.value)+'" '+(f.attr||'')+'>';
  return '<div class="'+cls+'"><label>'+esc(f.label)+'</label>'+input+(f.hint?'<div class="hint-inline">'+esc(f.hint)+'</div>':'')+'</div>';
}
function readForm(root){const o={};$$('[name]',root).forEach(el=>{o[el.name]=el.type==='checkbox'?el.checked:el.value;});return o;}
function saveBtn(){return '<button class="btn" data-close>Otkaži</button><button class="btn pri" id="modalSave">Sačuvaj</button>';}
function bindSave(fn){const b=$('#modalSave');if(b)b.onclick=()=>fn(readForm($('#modalRoot')));}
function companyField(r){
  const comps=userCompanies();const val=r.company_id||(state.companyId==='ALL'?(comps[0]||{}).id:state.companyId);
  if(comps.length<=1)return field({name:'company_id',label:'Kompanija',value:val,attr:'readonly'}).replace('readonly','disabled')+'<input type="hidden" name="company_id" value="'+esc(val)+'">';
  return field({name:'company_id',label:'Kompanija',type:'select',value:val,options:comps.map(c=>({v:c.id,l:c.name}))});
}
function pageHeader(title,module,btnLabel,onNew){
  const crumb=(MODULES.find(m=>m.key===module)||{}).sec||'';
  return '<div class="crumb">'+esc(crumb)+' · '+esc(companyName(state.companyId))+'</div><div class="page-h"><h1>'+esc(title)+'</h1><div class="sp"></div>'+(onNew&&can(module,'C')?'<button class="btn pri no-print" onclick="__new_'+module+'()">+ '+esc(btnLabel)+'</button>':'')+'</div>';
}
function actionBtns(module,r,editFn,delFn){let b='';if(editFn&&can(module,'E'))b+='<button class="btn sm" onclick="'+editFn+'(\''+r.id+'\')">Izmeni</button>';if(delFn&&can(module,'D'))b+='<button class="btn sm danger" onclick="'+delFn+'(\''+r.id+'\')">×</button>';return b;}
function confirmDelete(table,id,label){openModal('Potvrda brisanja','<p>Da li sigurno želite da obrišete '+esc(label)+'? (soft delete)</p>','<button class="btn" data-close>Otkaži</button><button class="btn danger" id="delYes">Obriši</button>');$('#delYes').onclick=()=>{Store.remove(table,id);audit('delete',table,id,'Brisanje: '+label);toast('Obrisano');closeModal();render();};}

export {
  openModal,
  closeModal,
  openModal2,
  closeModal2,
  appendOptionAll,
  quickAddLookup,
  quickAddClient,
  field,
  readForm,
  saveBtn,
  bindSave,
  companyField,
  pageHeader,
  actionBtns,
  confirmDelete
};
