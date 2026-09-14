/* BALKAN TMS — modules/orders.js
   Nalozi za transport
   Modul generisan iz monolita v3.0 (A0.2). */
import { render } from '../app/router.js';
import { $, $$, addDays, esc, fmtDate, fmtMoney, toast, todayISO } from '../core/dom.js';
import { audit, can } from '../core/rbac.js';
import { state } from '../core/state.js';
import { Store } from '../core/store.js';
import { Views } from './registry.js';
import { countryOpts, lk, lkName, lkOpts, setting } from '../ui/lookups.js';
import { actionBtns, appendOptionAll, bindSave, closeModal, companyField, confirmDelete, field, openModal, pageHeader, quickAddClient, quickAddLookup, saveBtn } from '../ui/modal.js';
import { STATUS_BADGE, badge, compDot } from '../ui/status.js';
import { renderTable } from '../ui/table.js';

function vehCount(orderId){return Store.all('order_vehicles').filter(v=>v.order_id===orderId).length;}
Views.orders=()=>{const rows=Store.scoped('transport_orders');return pageHeader('Nalozi za transport','orders','Novi nalog',true)+renderTable({id:'orders',exportName:'nalozi',columns:[
  {key:'order_no',label:'Broj',render:r=>compDot(r.company_id)+'<b>'+esc(r.order_no)+'</b>'},
  {key:'client',label:'Klijent',sortVal:r=>(Store.get('clients',r.client_id)||{}).name,render:r=>esc((Store.get('clients',r.client_id)||{}).name||'—')},
  {key:'route',label:'Relacija',sortVal:r=>r.pickup_location,render:r=>esc(r.pickup_location)+(r.pickup_country?' <span class="tag">'+esc(r.pickup_country)+'</span>':'')+' → '+esc(r.delivery_location)+(r.delivery_country?' <span class="tag">'+esc(r.delivery_country)+'</span>':'')},
  {key:'veh',label:'Vozila',num:true,sortVal:r=>vehCount(r.id),render:r=>vehCount(r.id)},
  {key:'planned_pickup',label:'Utovar',render:r=>fmtDate(r.planned_pickup)},
  {key:'agreed_price',label:'Iznos',num:true,sortVal:r=>r.agreed_price,render:r=>fmtMoney(r.agreed_price,r.currency)},
  {key:'zarada',label:'Int. zarada',num:true,sortVal:r=>r.interna_zarada||0,render:r=>r.interna_zarada==null?'—':fmtMoney(r.interna_zarada)},
  {key:'status',label:'Status',render:r=>'<span class="badge '+(STATUS_BADGE[r.status]||'b-grey')+'">'+esc(lkName('order_statuses',r.status))+'</span>'}],
  filters:[{key:'status',label:'Status',options:lk('order_statuses').map(s=>({v:s.code,l:s.name}))}],
  dateFilters:[{key:'planned_pickup',label:'Utovar'}],
  rows,getRows:()=>Store.scoped('transport_orders'),actions:r=>'<button class="btn sm" onclick="viewOrder(\''+r.id+'\')">Detalji</button>'+(can('orders','C')?'<button class="btn sm" onclick="copyOrder(\''+r.id+'\')">Kopiraj</button>':'')+actionBtns('orders',r,'editOrder','delOrder')});};
window.__new_orders=()=>openOrderForm();
function nextOrderNo(c){const pre=c==='avto'?'AV-':'TR-';const nums=Store.all('transport_orders').filter(o=>o.company_id===c).map(o=>parseInt(String(o.order_no).replace(/\D/g,'')||'0')).filter(n=>!isNaN(n));return pre+((nums.length?Math.max(...nums):(c==='avto'?1000:5000))+1);}
function openOrderForm(id,copyFrom){const r=id?Store.get('transport_orders',id):(copyFrom?Object.assign({},copyFrom):{});if(copyFrom){delete r.id;delete r.order_no;r.status='novi';r.created_date=null;}
  const clients=Store.scoped('clients');
  const cliOpt=[{v:'',l:'— klijent —'}].concat(clients.map(c=>({v:c.id,l:c.name})));
  const compOpt=Store.all('companies').map(c=>({v:c.id,l:c.name}));
  const ownComp=r.company_id||(state.companyId==='ALL'?'avto':state.companyId);
  const minZar=Number(setting('interna_zarada_default',0))||0;
  const dv=(v,d)=>(v==null||v==='')?d:v;
  const finBody='<div class="hint-inline" style="margin-bottom:8px">Svaka vrsta fakture u jednom redu: <b>iznos · izdaje · fakturiše na</b>. Provera: <b>EUR + INTERNA + GOTOVINA + interna zarada = iznos naloga</b> (dinarska se ne uračunava). Provera/blokada interne zarade (min. '+fmtMoney(minZar)+') važi samo ako je iznos INTERNE fakture popunjen.</div>'+
    '<div class="fin-row">'+
      field({name:'fakt_eur',label:'EUR faktura — iznos',type:'number',value:r.fakt_eur==null?0:r.fakt_eur,attr:'step="0.01" data-fin'})+
      field({name:'eur_izdaje_id',label:'EUR — izdaje',type:'select',value:dv(r.eur_izdaje_id,ownComp),options:compOpt})+
      field({name:'eur_klijent_id',label:'EUR — fakturiše na',type:'select',value:r.eur_klijent_id||'',options:cliOpt,attr:'class="cli-sel"'})+
    '</div>'+
    '<div class="fin-row">'+
      field({name:'interna_iznos',label:'INTERNA faktura — iznos',type:'number',value:r.interna_iznos==null?'':r.interna_iznos,attr:'step="0.01" data-fin placeholder="0,00"'})+
      field({name:'interna_izdaje_id',label:'INTERNA — izdaje',type:'select',value:dv(r.interna_izdaje_id,'avto'),options:compOpt})+
      field({name:'interna_firma_id',label:'INTERNA — fakturiše na',type:'select',value:dv(r.interna_firma_id,'transport'),options:compOpt})+
    '</div>'+
    '<div class="fin-row">'+
      field({name:'gotovina',label:'GOTOVINSKA faktura — iznos',type:'number',value:r.gotovina==null?0:r.gotovina,attr:'step="0.01" data-fin'})+
      field({name:'gotovina_izdaje_id',label:'GOTOVINSKA — izdaje',type:'select',value:dv(r.gotovina_izdaje_id,ownComp),options:compOpt})+
      field({name:'gotovina_klijent_id',label:'GOTOVINSKA — fakturiše na',type:'select',value:r.gotovina_klijent_id||'',options:cliOpt,attr:'class="cli-sel"'})+
    '</div>'+
    '<div class="fin-row din">'+
      field({name:'fakt_din',label:'DINARSKA faktura — iznos (RSD)',type:'number',value:r.fakt_din==null?0:r.fakt_din,attr:'step="0.01"'})+
      field({name:'din_izdaje_id',label:'DINARSKA — izdaje',type:'select',value:dv(r.din_izdaje_id,'transport'),options:compOpt})+
      field({name:'din_klijent_id',label:'DINARSKA — fakturiše na',type:'select',value:r.din_klijent_id||'',options:cliOpt,attr:'class="cli-sel"'})+
    '</div>'+
    '<div class="fin-recon"><label>Provera podele</label><div id="ordRecon"></div></div>';
  const fin='<div class="ord-sec" id="ordSecFin"><div class="subhead clp2" onclick="__ordSecToggle(\'ordSecFin\')">FINANSIJSKA PODELA NALOGA<span class="chev2">▾</span></div><div class="ord-sec-b">'+finBody+'</div></div>';
  const docTypes=lk('order_doc_types');
  window.__ordDocs=Object.keys(r.docs||{}).map(code=>({code,has:!!(r.docs[code]||{}).has}));
  const docsBody='<div id="ordDocsList"></div>'+
    '<div class="qa-bar"><span class="lbl">Dodaj dokument:</span><select id="ordDocPick" style="flex:1;min-width:160px;padding:8px;border:1px solid var(--border);border-radius:8px">'+docTypes.map(dt=>'<option value="'+esc(dt.code)+'">'+esc(dt.name)+'</option>').join('')+'</select><button type="button" class="btn sm" onclick="__ordDocAdd()">+ Dodaj</button>'+(can('admin','C')?'<button type="button" class="btn sm" onclick="__ordDocNewType()">+ Nov tip</button>':'')+'</div>';
  const docsSec='<div class="ord-sec" id="ordSecDocs"><div class="subhead clp2" onclick="__ordSecToggle(\'ordSecDocs\')">POTREBNA DOKUMENTA<span class="small muted" style="margin-left:8px;font-weight:500;text-transform:none">(po defaultu prazno)</span><span class="chev2">▾</span></div><div class="ord-sec-b">'+docsBody+'</div></div>';
  const body='<div class="form-grid">'+companyField(r)+
    '<div class="field"><label>Klijent (naručilac)</label><div style="display:flex;gap:6px"><select name="client_id" class="cli-sel" style="flex:1;padding:9px 11px;border:1px solid var(--border);border-radius:8px">'+clients.map(c=>'<option value="'+esc(c.id)+'" '+(String(r.client_id)===String(c.id)?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select><button type="button" class="btn sm" onclick="__ordNewClient()" title="Brzo dodaj klijenta">+</button></div></div>'+
    field({name:'status',label:'Status',type:'select',value:r.status||'novi',options:lkOpts('order_statuses')})+
    field({name:'planned_pickup',label:'Datum utovara',type:'date',value:r.planned_pickup||todayISO()})+field({name:'planned_delivery',label:'Datum istovara',type:'date',value:r.planned_delivery||addDays(todayISO(),3)})+
    field({name:'pickup_location',label:'Mesto utovara',value:r.pickup_location})+field({name:'delivery_location',label:'Mesto istovara',value:r.delivery_location})+
    field({name:'pickup_country',label:'Država utovara',type:'select',value:r.pickup_country||'',options:countryOpts('—'),attr:'class="cnt-sel"'})+field({name:'delivery_country',label:'Država istovara',type:'select',value:r.delivery_country||'',options:countryOpts('—'),attr:'class="cnt-sel"'})+
    field({name:'agreed_price',label:'Iznos naloga (ukupno)',type:'number',value:r.agreed_price==null?0:r.agreed_price,attr:'step="0.01" data-fin'})+field({name:'currency',label:'Valuta',type:'select',value:r.currency||'EUR',options:[{v:'EUR',l:'EUR'},{v:'RSD',l:'RSD'},{v:'USD',l:'USD'}]})+
    field({name:'invoice_mode',label:'Fakturisanje',type:'select',value:r.invoice_mode||'pojedinacno',options:[{v:'pojedinacno',l:'pojedinačno'},{v:'zbirno',l:'zbirno'}]})+
    field({name:'vat_mode',label:'PDV režim / napomena',value:r.vat_mode||'oslobođeno (međunarodni transport)'})+
    field({name:'internal_note',label:'Interna napomena',type:'textarea',value:r.internal_note,full:true})+'</div>'+
    '<div class="qa-bar"><span class="lbl">Brzo dodaj:</span><button type="button" class="btn sm" onclick="__ordNewClient()">+ Klijent</button><button type="button" class="btn sm" onclick="__ordNewCountry()">+ Država</button></div>'+
    fin+docsSec+'<div class="hint-inline">Vozila (nova/polovna) dodajete iz „Detalji" nakon snimanja.</div>';
  openModal(id?'Izmena naloga':(copyFrom?'Kopija naloga':'Nov nalog za transport'),body,saveBtn(),true);
  const root=$('#modalRoot');
  window.__ordDocAdd=()=>{const pick=$('#ordDocPick');if(!pick||!pick.value){toast('Nema definisanih tipova');return;}if(window.__ordDocs.some(d=>d.code===pick.value)){toast('Dokument je već dodat');return;}window.__ordDocs.push({code:pick.value,has:false});renderOrdDocs();};
  window.__ordDocToggle=(i,v)=>{if(window.__ordDocs[i])window.__ordDocs[i].has=v;};
  window.__ordDocRemove=i=>{window.__ordDocs.splice(i,1);renderOrdDocs();};
  window.__ordDocNewType=()=>quickAddLookup('order_doc_types','Tip dokumentacije',(code,name)=>{const p=$('#ordDocPick');if(p){const o=document.createElement('option');o.value=code;o.textContent=name;p.appendChild(o);p.value=code;}});
  window.__ordNewClient=()=>{const comp=($('[name=company_id]',root)||{}).value||state.companyId;quickAddClient(comp,(id2,name)=>appendOptionAll('.cli-sel',id2,name));};
  window.__ordSecToggle=secId=>{const el=document.getElementById(secId);if(el)el.classList.toggle('collapsed');};
  window.__ordNewCountry=()=>quickAddLookup('countries','Država',(code,name)=>appendOptionAll('.cnt-sel',code,code+' — '+name));
  function renderOrdDocs(){const box=$('#ordDocsList');if(!box)return;box.innerHTML=window.__ordDocs.length?window.__ordDocs.map((d,i)=>'<div class="doc-row"><span style="flex:1">'+esc(lkName('order_doc_types',d.code))+'</span><label style="display:flex;gap:5px;align-items:center;font-weight:500;font-size:12px"><input type="checkbox" '+(d.has?'checked':'')+' onchange="__ordDocToggle('+i+',this.checked)" style="width:auto"> imam</label><button type="button" class="btn sm danger" onclick="__ordDocRemove('+i+')">×</button></div>').join(''):'<div class="muted small" style="padding:6px 0">Nema dodatih dokumenata.</div>';}
  renderOrdDocs();
  function recon(){const g=n=>Number(($('[name='+n+']',root)||{}).value)||0;const tot=g('agreed_price');const sum=g('fakt_eur')+g('interna_iznos')+g('gotovina');const zar=+(tot-sum).toFixed(2);
    const iEl=$('[name=interna_iznos]',root);const internaFilled=!!(iEl&&String(iEl.value).trim()!=='');const below=internaFilled&&zar<minZar-0.005;
    $('#ordRecon').innerHTML='<span class="recon '+((zar>=-0.005&&!below)?'ok':'bad')+'">Interna zarada: '+fmtMoney(zar)+'</span> <span class="small muted">EUR + INTERNA + GOTOVINA = '+fmtMoney(sum)+' · Iznos naloga = '+fmtMoney(tot)+'</span>'+(zar<-0.005?'<div class="small" style="color:var(--bad);margin-top:4px">Podela premašuje iznos naloga!</div>':'')+(below?'<div class="small" style="color:var(--bad);margin-top:4px">Interna zarada je ispod preporučene ('+fmtMoney(minZar)+') — snimanje nije dozvoljeno.</div>':'')+(!internaFilled?'<div class="small muted" style="margin-top:4px">INTERNA faktura prazna → 0,00 (bez provere/blokade interne zarade).</div>':'');}
  root.querySelectorAll('[data-fin]').forEach(el=>el.oninput=recon);recon();
  bindSave(f=>{const internaFilled=String(f.interna_iznos==null?'':f.interna_iznos).trim()!=='';
    ['agreed_price','fakt_eur','fakt_din','interna_iznos','gotovina'].forEach(k=>f[k]=Number(f[k])||0);f.interna_zarada=+(f.agreed_price-(f.fakt_eur+f.interna_iznos+f.gotovina)).toFixed(2);
    if(internaFilled&&f.interna_zarada<minZar-0.005){toast('Interna zarada ('+fmtMoney(f.interna_zarada)+') je ispod preporučene ('+fmtMoney(minZar)+') — snimanje nije dozvoljeno');return;}
    const docs={};(window.__ordDocs||[]).forEach(d=>{docs[d.code]={req:true,has:!!d.has};});f.docs=docs;
    if(id){Store.update('transport_orders',id,f);audit('update','order',id,'Izmena naloga');toast('Nalog sačuvan');closeModal();render();}else{f.created_date=todayISO();f.order_no=nextOrderNo(f.company_id);const n=Store.insert('transport_orders',f);audit('create','order',n.id,'Nov nalog '+f.order_no);toast('Nalog kreiran — dodajte vozila');closeModal();viewOrder(n.id);}});}
window.copyOrder=id=>{const o=Store.get('transport_orders',id);if(o)openOrderForm(null,o);};
window.editOrder=id=>openOrderForm(id);
window.delOrder=id=>confirmDelete('transport_orders',id,'nalog');
function invoicedSum(oid){return Store.all('invoice_items').filter(i=>i.order_id===oid).reduce((s,i)=>s+(i.line_gross||0),0);}
window.invoicedSum=invoicedSum;
window.viewOrder=id=>{const o=Store.get('transport_orders',id);const c=Store.get('clients',o.client_id);const veh=Store.all('order_vehicles').filter(v=>v.order_id===id);
  const intF=o.interna_firma_id?(Store.get('companies',o.interna_firma_id)||Store.get('clients',o.interna_firma_id)):null;const inv=invoicedSum(id);
  const cN=cid=>{const c=cid?Store.get('clients',cid):null;return c?esc(c.name):'—';};
  const fN=fid=>{const c=fid?Store.get('companies',fid):null;return c?esc(c.short_name||c.name):'—';};
  const fin='<div class="section-title">Finansijska podela</div><div class="fin-split">'+
    '<div class="fc"><div class="l">Iznos naloga</div><div class="v">'+fmtMoney(o.agreed_price,o.currency)+'</div></div>'+
    '<div class="fc"><div class="l">EUR · '+fN(o.eur_izdaje_id)+' → '+cN(o.eur_klijent_id)+'</div><div class="v">'+fmtMoney(o.fakt_eur||0)+'</div></div>'+
    '<div class="fc"><div class="l">INTERNA · '+fN(o.interna_izdaje_id)+' → '+fN(o.interna_firma_id)+'</div><div class="v">'+fmtMoney(o.interna_iznos||0)+'</div></div>'+
    '<div class="fc"><div class="l">GOTOVINSKA · '+fN(o.gotovina_izdaje_id)+' → '+cN(o.gotovina_klijent_id)+'</div><div class="v">'+fmtMoney(o.gotovina||0)+'</div></div>'+
    '<div class="fc"><div class="l">DINARSKA · '+fN(o.din_izdaje_id)+' → '+cN(o.din_klijent_id)+'</div><div class="v">'+fmtMoney(o.fakt_din||0,'RSD')+'</div></div>'+
    '<div class="fc"><div class="l">Interna zarada</div><div class="v" style="color:'+((o.interna_zarada||0)>=0?'var(--ok)':'var(--bad)')+'">'+fmtMoney(o.interna_zarada||0)+'</div></div>'+
    '<div class="fc"><div class="l">Već fakturisano</div><div class="v">'+fmtMoney(inv)+'</div></div></div>'+
    '<div class="hint-inline">Provera: EUR + INTERNA + GOTOVINA + interna zarada = iznos naloga (dinarska se ne uračunava).</div>';
  const body='<div class="detail-grid"><div class="di"><div class="k">Broj naloga</div><div class="v">'+compDot(o.company_id)+'<b>'+esc(o.order_no)+'</b></div></div>'+
    '<div class="di"><div class="k">Klijent</div><div class="v">'+esc(c?c.name:'—')+'</div></div><div class="di"><div class="k">Status</div><div class="v"><span class="badge '+(STATUS_BADGE[o.status]||'b-grey')+'">'+esc(lkName('order_statuses',o.status))+'</span></div></div>'+
    '<div class="di"><div class="k">Relacija</div><div class="v">'+esc(o.pickup_location)+(o.pickup_country?' ('+esc(o.pickup_country)+')':'')+' → '+esc(o.delivery_location)+(o.delivery_country?' ('+esc(o.delivery_country)+')':'')+'</div></div>'+
    '<div class="di"><div class="k">Utovar / istovar</div><div class="v">'+fmtDate(o.planned_pickup)+' → '+fmtDate(o.planned_delivery)+'</div></div>'+
    '<div class="di"><div class="k">Fakturisanje</div><div class="v">'+esc(o.invoice_mode)+'</div></div><div class="di"><div class="k">PDV režim</div><div class="v">'+esc(o.vat_mode)+'</div></div></div>'+fin+
    '<div class="section-title">Vozila u nalogu ('+veh.length+') '+(can('orders','E')?'<button class="btn sm" style="float:right" onclick="addOrderVehicle(\''+id+'\')">+ Vozilo</button>':'')+'</div>'+
    '<table class="mini-table"><thead><tr><th>Vozilo</th><th>Tip</th><th>Stanje</th><th>VIN</th><th>Lot</th><th>Status</th>'+(can('orders','E')?'<th></th>':'')+'</tr></thead><tbody>'+(veh.length?veh.map(v=>'<tr><td>'+esc(v.make)+' '+esc(v.model)+' ('+esc(v.year)+')</td><td>'+esc(v.vehicle_type)+'</td><td><span class="tag">'+esc(v.condition||'—')+'</span></td><td class="small">'+esc(v.vin)+'</td><td>'+esc(v.lot_no||'—')+'</td><td>'+badge(v.status)+'</td>'+(can('orders','E')?'<td class="num"><button class="btn sm danger" onclick="delOrderVehicle(\''+v.id+'\',\''+id+'\')">×</button></td>':'')+'</tr>').join(''):'<tr><td colspan="7" class="muted" style="padding:14px">Nema dodatih vozila.</td></tr>')+'</tbody></table>'+(o.internal_note?'<div class="section-title">Napomena</div><div class="pill-note">'+esc(o.internal_note)+'</div>':'');
  const odocs=o.docs||{};const docKeys=Object.keys(odocs);
  const docsView=docKeys.length?('<div class="section-title">Dokumentacija</div><table class="mini-table"><thead><tr><th>Dokument</th><th>Potrebno</th><th>Imam</th></tr></thead><tbody>'+docKeys.map(k=>'<tr><td>'+esc(lkName('order_doc_types',k))+'</td><td>'+(odocs[k].req?'<span class="badge b-blue">potrebno</span>':'—')+'</td><td>'+(odocs[k].has?'<span class="badge b-green">imam</span>':(odocs[k].req?'<span class="badge b-amber">nedostaje</span>':'—'))+'</td></tr>').join('')+'</tbody></table>'):'';
  let footer='';if(can('orders','C'))footer+='<button class="btn" onclick="closeModal();copyOrder(\''+id+'\')">Kopiraj nalog</button>';
  footer+=(o.status==='isporucen'&&can('invoices','C')?'<button class="btn pri" onclick="closeModal();go(\'invoices\');toast(\'Kreirajte fakturu iz isporučenog naloga\')">Fakturiši</button>':'')+'<button class="btn" data-close>Zatvori</button>';
  openModal('Nalog '+o.order_no,body+docsView,footer,true);$$('#modalRoot [data-close]').forEach(b=>b.onclick=closeModal);};
window.addOrderVehicle=orderId=>{const o=Store.get('transport_orders',orderId);
  const body='<div class="form-grid">'+field({name:'make',label:'Marka',value:''})+field({name:'model',label:'Model',value:''})+
    field({name:'vehicle_type',label:'Tip vozila',type:'select',value:'putnicko',options:[{v:'putnicko',l:'putničko'},{v:'kombi',l:'kombi'},{v:'teretno',l:'teretno'},{v:'drugo',l:'drugo'}]})+
    field({name:'condition',label:'Stanje',type:'select',value:'polovna',options:[{v:'nova',l:'novo vozilo'},{v:'polovna',l:'polovno vozilo'}]})+
    field({name:'year',label:'Godina',type:'number',value:2020})+field({name:'vin',label:'VIN / šasija',value:''})+field({name:'plate',label:'Registracija',value:''})+
    field({name:'color',label:'Boja',value:''})+field({name:'lot_no',label:'Aukcijski lot',value:''})+
    field({name:'runnable',label:'',type:'checkbox',value:true,cblabel:'Vozno'})+field({name:'has_keys',label:'',type:'checkbox',value:true,cblabel:'Ima ključeve'})+
    field({name:'damage_note',label:'Napomena o oštećenjima',type:'textarea',value:'',full:true})+'</div>';
  openModal('Dodaj vozilo u nalog',body,saveBtn());
  bindSave(f=>{f.order_id=orderId;f.company_id=o.company_id;f.year=Number(f.year)||null;f.status='ceka';const n=Store.insert('order_vehicles',f);audit('create','order_vehicle',n.id,'Vozilo u nalog '+o.order_no);toast('Vozilo dodato');closeModal();viewOrder(orderId);});};
window.delOrderVehicle=(vid,orderId)=>{Store.remove('order_vehicles',vid);audit('delete','order_vehicle',vid,'Brisanje vozila iz naloga');viewOrder(orderId);};

export {
  vehCount,
  nextOrderNo,
  openOrderForm,
  invoicedSum
};
