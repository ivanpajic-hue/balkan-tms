/* BALKAN TMS — core/seed.js
   Početni i demo podaci
   Modul generisan iz monolita v3.0 (A0.2). */
import { addDays, todayISO, uid } from './dom.js';

function seed(){
  const db={companies:[],users:[],user_company_access:[],clients:[],transport_orders:[],order_vehicles:[],
    trips:[],trip_stops:[],trip_orders:[],drivers:[],fleet_vehicles:[],fleet_documents:[],driver_documents:[],
    expenses:[],invoices:[],invoice_items:[],payments:[],driver_settlements:[],settlement_items:[],bonuses_maluses:[],
    service_orders:[],audit_logs:[],expense_categories:[],purchase_invoices:[],
    settlement_item_types:[],fleet_doc_types:[],driver_doc_types:[],countries:[],settings:[],order_statuses:[],order_doc_types:[]};
  const T=todayISO();
  db.companies.push({id:'avto',name:'BALKAN AVTO d.o.o.',short_name:'AVTO',vat_id:'SI12345678',reg_no:'1234567000',address:'Tržaška 100, Ljubljana',country:'Slovenija',currency:'EUR',accent_color:'#2563EB',active:true});
  db.companies.push({id:'transport',name:'BALKAN TRANSPORT d.o.o.',short_name:'TRANSPORT',vat_id:'RS101234567',reg_no:'20123456',address:'Bulevar oslobođenja 50, Novi Sad',country:'Srbija',currency:'EUR',accent_color:'#0E9488',active:true});
  const U=[
    {id:'u_vlasnik',full_name:'Ivan Pajić',role:'SUPER_ADMIN',comp:['avto','transport']},
    {id:'u_admin',full_name:'Ana Marković',role:'ADMIN',comp:['avto','transport']},
    {id:'u_disp',full_name:'Marko Nikolić',role:'DISPECER',comp:['avto']},
    {id:'u_fin',full_name:'Jelena Ilić',role:'FINANSIJE',comp:['avto','transport']},
    {id:'u_fleet',full_name:'Petar Jovanović',role:'FLEET',comp:['transport']},
    {id:'u_ro',full_name:'Menadžment',role:'READONLY',comp:['avto','transport']}];
  U.forEach(u=>{db.users.push({id:u.id,full_name:u.full_name,email:u.id+'@balkan.rs',role:u.role,active:true});
    u.comp.forEach(c=>db.user_company_access.push({id:uid('uca'),user_id:u.id,company_id:c}));});
  ['gorivo','putarine','parking','trajekt','tuneli','pranje','servis','gume','kazne','dnevnice','smestaj','carina','ostalo']
    .forEach(c=>db.expense_categories.push({id:uid('ec'),company_id:null,code:c,name:c[0].toUpperCase()+c.slice(1),active:true}));
  [['d1','avto','Goran Petrović','+386 40 111 222','C+E','2021-03-01'],
   ['d2','avto','Saša Đorđević','+386 40 333 444','C+E','2022-06-15'],
   ['d3','transport','Nenad Stanković','+381 64 555 666','C+E','2020-09-10'],
   ['d4','transport','Bojan Mitić','+381 64 777 888','C+E','2023-01-20']]
   .forEach(d=>db.drivers.push({id:d[0],company_id:d[1],full_name:d[2],phone:d[3],email:'',status:'aktivan',hire_date:d[5],license_categories:d[4],note:''}));
  db.driver_documents.push({id:uid('dd'),driver_id:'d1',company_id:'avto',doc_type:'lekarsko',expires_at:addDays(T,12),note:''});
  db.driver_documents.push({id:uid('dd'),driver_id:'d2',company_id:'avto',doc_type:'kod95',expires_at:addDays(T,40),note:''});
  db.driver_documents.push({id:uid('dd'),driver_id:'d3',company_id:'transport',doc_type:'vozacka',expires_at:addDays(T,-5),note:'Istekla!'});
  db.driver_documents.push({id:uid('dd'),driver_id:'d4',company_id:'transport',doc_type:'tahograf_kartica',expires_at:addDays(T,75),note:''});
  [['f1','avto','truck','AV-01','LJ-AV-101','MAN','TGX',2021,'tegljač','—','aktivno',420000,'d1'],
   ['f2','avto','trailer','AV-P1','LJ-PR-201','Rolfo','Auriga',2020,'autotransporter','8 vozila','aktivno',0,null],
   ['f3','transport','truck','TR-01','NS-TR-301','Scania','R450',2019,'tegljač','—','aktivno',610000,'d3'],
   ['f4','transport','trailer','TR-P1','NS-PR-401','Lohr','Eurolohr',2022,'autotransporter','9 vozila','servis',0,null]]
   .forEach(f=>db.fleet_vehicles.push({id:f[0],company_id:f[1],kind:f[2],internal_no:f[3],plate:f[4],vin:'WMA'+Math.random().toString().slice(2,16),make:f[5],model:f[6],year:f[7],vehicle_type:f[8],capacity:f[9],status:f[10],current_km:f[11],assigned_driver_id:f[12],note:''}));
  db.fleet_documents.push({id:uid('fd'),fleet_vehicle_id:'f1',company_id:'avto',doc_type:'registracija',expires_at:addDays(T,8),note:''});
  db.fleet_documents.push({id:uid('fd'),fleet_vehicle_id:'f1',company_id:'avto',doc_type:'tahograf',expires_at:addDays(T,55),note:''});
  db.fleet_documents.push({id:uid('fd'),fleet_vehicle_id:'f3',company_id:'transport',doc_type:'osiguranje',expires_at:addDays(T,3),note:''});
  db.fleet_documents.push({id:uid('fd'),fleet_vehicle_id:'f3',company_id:'transport',doc_type:'tehnicki',expires_at:addDays(T,-2),note:'Istekao!'});
  db.fleet_documents.push({id:uid('fd'),fleet_vehicle_id:'f4',company_id:'transport',doc_type:'registracija',expires_at:addDays(T,28),note:''});
  db.service_orders.push({id:uid('so'),company_id:'transport',fleet_vehicle_id:'f4',problem:'Zamena hidraulike rampe',planned_service:addDays(T,1),actual_service:'',supplier_id:null,cost:1200,doc_meta:null,out_of_service_from:addDays(T,-1),out_of_service_to:addDays(T,3),status:'u_toku'});
  [['c1','avto','AutoHaus München GmbH','klijent','Nemačka','DE811234567',30,'A'],
   ['c2','avto','Copart Deutschland','aukcija','Nemačka','DE998877665',15,'A'],
   ['c3','avto','Porsche Leasing SLO','klijent','Slovenija','SI55667788',45,'B'],
   ['c4','transport','Auto Čačak d.o.o.','dealer','Srbija','RS105566778',30,'A'],
   ['c5','transport','IAAI Logistics','aukcija','Holandija','NL8123456B01',21,'B'],
   ['c6','transport','Delta Motors Beograd','klijent','Srbija','RS100112233',60,'C']]
   .forEach(c=>db.clients.push({id:c[0],company_id:c[1],name:c[2],type:c[3],vat_id:c[5],reg_no:'',address:'',country:c[4],currency:'EUR',payment_terms_days:c[6],rating:c[7],status:'aktivan',note:''}));
  let on={avto:1001,transport:5001};
  function mkOrder(company,client,status,price,pickup,delivery,pp,pd,vehicles,invoice_mode){
    const id=uid('ord');const order_no=(company==='avto'?'AV-':'TR-')+(on[company]++);
    const pc=(pickup.split(',').pop()||'').trim();const dc=(delivery.split(',').pop()||'').trim();
    db.transport_orders.push({id,company_id:company,order_no,client_id:client,created_date:addDays(T,-20+Math.floor(Math.random()*15)),status,pickup_location:pickup,pickup_country:pc,delivery_location:delivery,delivery_country:dc,planned_pickup:pp,planned_delivery:pd,agreed_price:price,currency:'EUR',fakt_eur:price,fakt_din:0,eur_klijent_id:client,eur_izdaje_id:company,din_klijent_id:null,din_izdaje_id:'transport',gotovina_klijent_id:null,gotovina_izdaje_id:company,interna_iznos:0,interna_izdaje_id:'avto',interna_firma_id:'transport',gotovina:0,interna_zarada:0,vat_mode:'oslobođeno (međunarodni transport)',client_ref:'',invoice_mode:invoice_mode||'pojedinacno',internal_note:'',public_note:''});
    vehicles.forEach(v=>db.order_vehicles.push({id:uid('ov'),order_id:id,company_id:company,make:v[0],model:v[1],vehicle_type:v[2]||'putnicko',condition:'polovna',vin:'VF'+Math.random().toString().slice(2,15),plate:v[3]||'',year:v[4]||2020,color:v[5]||'crna',lot_no:v[6]||'',runnable:true,has_keys:true,condition_note:'',damage_note:'',status:(status==='isporucen'||status==='fakturisan'||status==='placen')?'isporuceno':(status==='u_toku'?'u_tranzitu':'ceka')}));
    return id;
  }
  const o1=mkOrder('avto','c1','isporucen',1850,'München, DE','Ljubljana, SLO',addDays(T,-10),addDays(T,-7),[['BMW','X5','putnicko','M-AB123',2022,'crna','LOT-771'],['Audi','Q7','putnicko','M-CD456',2021,'siva','LOT-772']]);
  const o2=mkOrder('avto','c2','isporucen',1200,'Hamburg, DE','Koper, SLO',addDays(T,-8),addDays(T,-5),[['VW','Golf','putnicko','',2019,'bela','C-99812'],['Škoda','Octavia','putnicko','',2020,'plava','C-99813'],['Seat','Leon','putnicko','',2018,'crvena','C-99814']]);
  const o3=mkOrder('avto','c1','u_toku',1650,'Stuttgart, DE','Maribor, SLO',addDays(T,-1),addDays(T,2),[['Mercedes','GLE','putnicko','S-EF789',2023,'crna','']]);
  const o4=mkOrder('avto','c3','planiran',900,'Frankfurt, DE','Ljubljana, SLO',addDays(T,3),addDays(T,5),[['Porsche','Macan','putnicko','',2022,'bela','']]);
  const o5=mkOrder('avto','c2','novi',1400,'Köln, DE','Celje, SLO',addDays(T,5),addDays(T,8),[['Ford','Focus','putnicko','',2017,'siva',''],['Opel','Astra','putnicko','',2018,'crna','']]);
  const o6=mkOrder('transport','c5','isporucen',2100,'Rotterdam, NL','Beograd, RS',addDays(T,-12),addDays(T,-6),[['Toyota','RAV4','putnicko','',2021,'bela','IAAI-551'],['Nissan','Qashqai','putnicko','',2020,'siva','IAAI-552']],'zbirno');
  const o7=mkOrder('transport','c5','isporucen',1700,'Amsterdam, NL','Novi Sad, RS',addDays(T,-11),addDays(T,-6),[['Renault','Clio','putnicko','',2019,'crvena','IAAI-560']],'zbirno');
  const o8=mkOrder('transport','c4','u_toku',1300,'Beč, AT','Čačak, RS',addDays(T,-1),addDays(T,1),[['Kia','Sportage','putnicko','',2022,'crna','']]);
  const o9=mkOrder('transport','c6','planiran',1100,'Budimpešta, HU','Beograd, RS',addDays(T,2),addDays(T,4),[['Hyundai','Tucson','putnicko','',2021,'plava','']]);
  function mkTrip(company,trip_no,truck,trailer,disp,drivers,start,end,from,to,status,orders,km,route){
    const id=uid('trip');
    const seq0=[];orders.forEach(oid=>{const o=db.transport_orders.find(x=>x.id===oid);if(!o)return;[o.pickup_country,o.delivery_country].forEach(c=>{if(c&&!seq0.includes(c))seq0.push(c);});});const drv=seq0.join(' → ');
    db.trips.push({id,company_id:company,trip_no,truck_id:truck,trailer_id:trailer,dispatcher_id:disp,driver_ids:drivers,start_date:start,end_date:end,start_location:from,end_location:to,planned_km:km.p,actual_km:km.a,km_start:km.a?100000:0,km_stop:km.a?100000+km.a:0,empty_km:km.e,loaded_km:km.l,route:drv,transit_countries:drv,status});
    orders.forEach(oid=>db.trip_orders.push({id:uid('to'),trip_id:id,order_id:oid,company_id:company}));
    let seq=1;
    orders.forEach(oid=>{const o=db.transport_orders.find(x=>x.id===oid);db.trip_stops.push({id:uid('ts'),trip_id:id,company_id:company,seq:seq++,stop_type:'pickup',location:o.pickup_location,contact:'',planned_time:o.planned_pickup,actual_time:(status==='zakljucana'||status==='zavrsena')?o.planned_pickup:'',status:'završeno',note:'',order_id:oid});});
    orders.forEach(oid=>{const o=db.transport_orders.find(x=>x.id===oid);db.trip_stops.push({id:uid('ts'),trip_id:id,company_id:company,seq:seq++,stop_type:'delivery',location:o.delivery_location,contact:'',planned_time:o.planned_delivery,actual_time:(status==='zakljucana'||status==='zavrsena')?o.planned_delivery:'',status:status==='aktivna'?'u toku':'završeno',note:'',order_id:oid});});
    return id;
  }
  const t1=mkTrip('avto','AV-T-220','f1','f2','u_disp',['d1'],addDays(T,-10),addDays(T,-5),'München, DE','Ljubljana, SLO','zakljucana',[o1,o2],{p:1850,a:1910,e:520,l:1390},'DE → AT → SLO');
  const t2=mkTrip('avto','AV-T-221','f1','f2','u_disp',['d2'],addDays(T,-1),addDays(T,2),'Stuttgart, DE','Maribor, SLO','aktivna',[o3],{p:760,a:0,e:180,l:580},'DE → AT → SLO');
  const t3=mkTrip('transport','TR-T-330','f3','f4','u_admin',['d3'],addDays(T,-12),addDays(T,-6),'Rotterdam, NL','Beograd, RS','zakljucana',[o6,o7],{p:1980,a:2040,e:300,l:1740},'NL → DE → AT → RS');
  const t4=mkTrip('transport','TR-T-331','f3','f4','u_admin',['d4'],addDays(T,-1),addDays(T,1),'Beč, AT','Čačak, RS','aktivna',[o8],{p:520,a:0,e:90,l:430},'AT → HU → RS');
  function exp(company,date,cat,amount,trip,vehicle,driver,refundable,approved){
    db.expenses.push({id:uid('exp'),company_id:company,date,category_code:cat,amount,currency:'EUR',fx_rate:1,amount_base:amount,trip_id:trip,order_id:null,fleet_vehicle_id:vehicle,driver_id:driver,supplier_id:null,payment_method:'kartica',doc_ref:'',file_meta:null,refundable:!!refundable,approved:approved!==false,approved_by:approved!==false?'u_fin':null,note:''});
  }
  exp('avto',addDays(T,-9),'gorivo',640,t1,'f1','d1');
  exp('avto',addDays(T,-8),'putarine',180,t1,'f1','d1');
  exp('avto',addDays(T,-8),'dnevnice',150,t1,null,'d1',true);
  exp('avto',addDays(T,-1),'gorivo',310,t2,'f1','d2');
  exp('transport',addDays(T,-11),'gorivo',720,t3,'f3','d3');
  exp('transport',addDays(T,-10),'putarine',260,t3,'f3','d3');
  exp('transport',addDays(T,-9),'trajekt',140,t3,'f3','d3');
  exp('transport',addDays(T,-8),'dnevnice',180,t3,null,'d3',true);
  exp('transport',addDays(T,-1),'gorivo',290,t4,'f3','d4');
  exp('transport',addDays(T,2),'servis',1200,null,'f4',null,false,false);
  function mkInvoice(company,client,no,supply,status,items){
    const id=uid('inv');let net=0;
    items.forEach(it=>{it.line_net=it.qty*it.unit_price;it.line_vat=it.line_net*(it.vat_rate/100);it.line_gross=it.line_net+it.line_vat;net+=it.line_net;});
    db.invoices.push({id,company_id:company,invoice_no:no,client_id:client,supply_date:supply,issue_date:supply,currency:'EUR',total_net:net,total_vat:0,total_gross:net,status,sef_status:'nije_poslato',note:''});
    items.forEach(it=>db.invoice_items.push({id:uid('ii'),invoice_id:id,company_id:company,order_id:it.order_id||null,trip_id:null,description:it.description,qty:it.qty,unit_price:it.unit_price,vat_rate:it.vat_rate,line_net:it.line_net,line_vat:it.line_vat,line_gross:it.line_gross}));
    return id;
  }
  const inv1=mkInvoice('avto','c1','AV-2026-0044',addDays(T,-7),'placeno',[{description:'Transport vozila (nalog AV-1001)',qty:1,unit_price:1850,vat_rate:0,order_id:o1}]);
  const inv2=mkInvoice('avto','c2','AV-2026-0045',addDays(T,-5),'poslato',[{description:'Transport vozila (nalog AV-1002)',qty:1,unit_price:1200,vat_rate:0,order_id:o2}]);
  db.transport_orders.find(o=>o.id===o1).status='placen';
  db.transport_orders.find(o=>o.id===o2).status='fakturisan';
  db.payments.push({id:uid('pay'),invoice_id:inv1,company_id:'avto',date:addDays(T,-2),amount:1850,currency:'EUR',method:'transfer',note:''});
  const inv3=mkInvoice('transport','c5','TR-2026-0120',addDays(T,-40),'kasni',[{description:'Transport vozila (nalog TR-5001)',qty:1,unit_price:2100,vat_rate:0,order_id:o6},{description:'Transport vozila (nalog TR-5002)',qty:1,unit_price:1700,vat_rate:0,order_id:o7}]);
  db.transport_orders.find(o=>o.id===o6).status='fakturisan';
  db.transport_orders.find(o=>o.id===o7).status='fakturisan';
  const s1=uid('set');const km=1910;const base=Math.round(km*0.12);
  db.driver_settlements.push({id:s1,company_id:'avto',driver_id:'d1',period_from:addDays(T,-15),period_to:T,total_km:km,base_amount:base,bonus_total:80,malus_total:0,advance_total:200,refund_total:150,total_amount:base+80-200+150,status:'odobreno',approved_by:'u_fin'});
  db.settlement_items.push({id:uid('si'),settlement_id:s1,company_id:'avto',trip_id:t1,rule_code:'po_km',qty:km,rate:0.12,amount:base});
  db.bonuses_maluses.push({id:uid('bm'),settlement_id:s1,company_id:'avto',kind:'bonus',code:'bez_stete',label:'Bonus — bez štete',amount:80,note:''});
  // ŠIFARNICI (global, company_id:null) — definišu se u Administraciji
  [['DE','Nemačka'],['AT','Austrija'],['SLO','Slovenija'],['RS','Srbija'],['HU','Mađarska'],['NL','Holandija'],['IT','Italija'],['HR','Hrvatska'],['FR','Francuska'],['BE','Belgija'],['CH','Švajcarska'],['PL','Poljska'],['CZ','Češka'],['SK','Slovačka'],['ES','Španija']]
    .forEach(c=>db.countries.push({id:uid('cn'),company_id:null,code:c[0],name:c[1],active:true}));
  [['po_km','Po pređenom km','km',0.12],['po_punom_km','Po punom km','km',0.14],['po_praznom_km','Po praznom km','km',0.05],['po_turi','Po turi','tura',0],['po_danu','Dnevnica','dan',45],['po_vozilu','Po vozilu','vozilo',0],['po_nalogu','Po nalogu','nalog',0],['procenat_prihoda','Procenat prihoda','%',0],['fiksni_bonus','Fiksni bonus','€',0]]
    .forEach(t=>db.settlement_item_types.push({id:uid('sit'),company_id:null,code:t[0],name:t[1],unit:t[2],default_rate:t[3],active:true}));
  [['registracija','Registracija',365],['tehnicki','Tehnički pregled',365],['osiguranje','Osiguranje',180],['tahograf','Tahograf',730],['kalibracija','Kalibracija tahografa',730],['licenca','Licenca',365],['servis_datum','Servis (datum)',180],['ulje','Zamena ulja',180],['gume','Gume',365],['atest','Atest',365],['cmr_osig','CMR osiguranje',365],['zeleni_karton','Zeleni karton',365],['ostalo','Ostalo',180]]
    .forEach(t=>db.fleet_doc_types.push({id:uid('fdt'),company_id:null,code:t[0],name:t[1],default_days:t[2],active:true}));
  [['pasos','Pasoš',365],['licna','Lična karta',365],['vozacka','Vozačka dozvola',365],['kod95','Kod 95',365],['lekarsko','Lekarsko uverenje',365],['tahograf_kartica','Tahograf kartica',1825],['ugovor','Ugovor o radu',365],['obuka','Obuka',365],['ostalo','Ostalo',365]]
    .forEach(t=>db.driver_doc_types.push({id:uid('ddt'),company_id:null,code:t[0],name:t[1],default_days:t[2],active:true}));
  db.settings.push({id:uid('set'),company_id:null,key:'interna_zarada_default',value:0});
  [['novi','Novi'],['planiran','Planiran'],['dodeljen','Dodeljen'],['u_toku','U toku'],['isporucen','Isporučen'],['fakturisan','Fakturisan'],['placen','Plaćen'],['storniran','Storniran']]
    .forEach(s=>db.order_statuses.push({id:uid('os'),company_id:null,code:s[0],name:s[1],active:true}));
  [['faktura','Faktura'],['saobracajna','Saobraćajna'],['ex','EX dokument'],['cmr','CMR'],['pod','POD / dostavnica'],['ugovor','Ugovor'],['ovlascenje','Ovlašćenje'],['ostalo','Ostalo']]
    .forEach(d=>db.order_doc_types.push({id:uid('odt'),company_id:null,code:d[0],name:d[1],active:true}));
  // DEMO ulazni računi
  db.purchase_invoices.push({id:uid('pur'),company_id:'avto',date:addDays(T,-6),supplier_id:null,supplier_name:'OMV Slovenija',category_code:'gorivo',neto:840,pdv_rate:22,bruto:1024.8,amount:1024.8,currency:'EUR',link_type:'trip',trip_id:t1,driver_id:null,doc_ref:'R-2026/512',due_date:addDays(T,9),status:'neplaceno',note:''});
  db.purchase_invoices.push({id:uid('pur'),company_id:'transport',date:addDays(T,-10),supplier_id:'c5',supplier_name:'Servis Lohr',category_code:'servis',neto:1000,pdv_rate:20,bruto:1200,amount:1200,currency:'EUR',link_type:'vozilo',fleet_vehicle_id:'f4',due_date:addDays(T,-2),status:'placeno',note:'Hidraulika rampe'});
  db.purchase_invoices.push({id:uid('pur'),company_id:'transport',date:addDays(T,-3),supplier_id:null,supplier_name:'DARS putarine',category_code:'putarine',neto:320,pdv_rate:0,bruto:320,amount:320,currency:'EUR',link_type:'trip',trip_id:t3,due_date:addDays(T,12),status:'neplaceno',note:''});
  return db;
}

export {
  seed
};
