/* BALKAN TMS — tools/smoke.mjs
   Test u jsdom okruženju nad ES modulima.
   Pokretanje:  node tools/smoke.mjs
   Zahteva:     npm i -D jsdom
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (extra ? ' — ' + extra : '')); }
}
function must(name, fn) {
  try { const r = fn(); ok(name, r !== false); }
  catch (e) { fail++; failures.push(name + ' — IZUZETAK: ' + (e && e.message)); }
}

/* ---------- 1. DOM ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
const { window } = dom;

for (const k of ['window','document','navigator','location','HTMLElement','Node','Event','FileReader','Blob','URL','getComputedStyle','requestAnimationFrame']) {
  const v = k === 'window' ? window : window[k];
  if (v === undefined) continue;
  try { Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); }
  catch (e) { /* npr. navigator je samo-za-čitanje u Node-u — moduli koriste window.navigator */ }
}

/* ---------- 2. Zamene za spoljne zavisnosti ---------- */
const sbCalls = [];
const fakeQuery = (table) => {
  const q = {
    select: () => q, eq: () => q, neq: () => q,
    range: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    upsert: async (p) => { sbCalls.push(['upsert', table, p]); return { error: null }; },
    delete: () => q,
    then: (res) => res({ data: [], error: null }),
  };
  return q;
};
window.supabase = {
  createClient: () => ({
    from: (t) => fakeQuery(t),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInWithPassword: async () => ({ data: { session: {} }, error: null }),
      signOut: async () => ({}),
      updateUser: async () => ({ error: null }),
    },
  }),
};
globalThis.XLSX = window.XLSX = {
  utils: { book_new: () => ({}), json_to_sheet: () => ({}), book_append_sheet: () => {} },
  writeFile: () => {},
};
window.print = () => {};
window.scrollTo = () => {};
window.alert = () => {};

/* ---------- 3. Učitavanje aplikacije ---------- */
await import(pathToFileURL(path.join(ROOT, 'src/main.js')).href);
await new Promise(r => setTimeout(r, 30));

const W = window;
const { Store, state, seed, Views, ROLES, MODULES } = W;

/* ---------- 4. Most ka window ---------- */
must('most: __TMS_BRIDGE__ postoji', () => Array.isArray(W.__TMS_BRIDGE__) && W.__TMS_BRIDGE__.length > 100);

const INLINE_GLOBALS = [
  'go', 'logout', 'refreshData', 'openMyPassword', 'closeModal', 'closeModal2',
  'openOrderForm', 'openTripForm', 'openInvoiceForm', 'openExpenseForm',
  'openLookupForm', 'openParams', 'openCompanyForm', 'openNewUserForm', 'openUserAdminForm',
  'viewOrder', 'viewTrip', 'viewInvoice', 'viewFleet', 'viewDriver', 'viewSettlement',
  'addOrderVehicle', 'delOrderVehicle', 'copyOrder', 'assignOrder',
  'addTripExpense', 'tripSettlement', 'lockTrip',
  'addPayment', 'approveExpense', 'approveSettlement', 'addSettlementItem', 'delSettlementItem',
  'addBonusMalus', 'delBonusMalus', 'addFleetDoc', 'delFleetDoc', 'addDriverDoc', 'delDriverDoc',
  'planDragStart', 'planDragOver', 'planDrop', 'planUnassign', 'planAssignCore',
  'planDragEnd', 'planDragLeave', 'setPlanFilter', 'setRepFilter', 'toggleCollapse',
  'togglePurPaid', 'delLookup', 'exportJSON', 'importJSON', 'migrateLocal', 'resetData',
  '__new_clients', '__new_orders', '__new_trips', '__new_expenses', '__new_invoices',
  '__new_purchases', '__new_settlements', '__new_fleet', '__new_drivers',
];
const missing = INLINE_GLOBALS.filter(n => typeof W[n] !== 'function');
ok('most: sve inline funkcije su na window', missing.length === 0, 'nedostaju: ' + missing.join(', '));

/* ---------- 5. Store i seed ---------- */
Store.db = seed();
Store.db.users = [{ id: 'u1', full_name: 'Test Korisnik', email: 't@t.rs', role: 'SUPER_ADMIN', active: true }];
Store.db.user_company_access = [{ id: 'a1', user_id: 'u1', company_id: 'avto' }, { id: 'a2', user_id: 'u1', company_id: 'transport' }];
state.user = { id: 'u1', full_name: 'Test Korisnik', email: 't@t.rs', role: 'SUPER_ADMIN' };
state.companyId = 'avto';

must('seed: dve kompanije', () => Store.all('companies').length === 2);
must('seed: postoje nalozi', () => Store.all('transport_orders').length > 0);
must('seed: postoje ture', () => Store.all('trips').length > 0);
must('seed: šifarnici popunjeni', () =>
  Store.all('countries').length > 0 && Store.all('expense_categories').length > 0 &&
  Store.all('order_doc_types').length > 0 && Store.all('settlement_item_types').length > 0);

/* ---------- 6. CRUD kroz Store ---------- */
must('Store.insert + get', () => {
  const r = Store.insert('clients', { company_id: 'avto', name: 'SMOKE d.o.o.' });
  return !!r.id && Store.get('clients', r.id).name === 'SMOKE d.o.o.';
});
must('Store.update', () => {
  const r = Store.find('clients', c => c.name === 'SMOKE d.o.o.')[0];
  Store.update('clients', r.id, { name: 'SMOKE 2' });
  return Store.get('clients', r.id).name === 'SMOKE 2';
});
must('Store.remove je soft-delete', () => {
  const r = Store.find('clients', c => c.name === 'SMOKE 2')[0];
  Store.remove('clients', r.id);
  const raw = Store.db.clients.find(c => c.id === r.id);
  return !Store.get('clients', r.id) && !!raw.deleted_at;
});
must('Store.scoped filtrira po company_id', () => {
  state.companyId = 'transport';
  const a = Store.scoped('transport_orders').every(o => o.company_id === 'transport');
  state.companyId = 'ALL';
  const b = Store.scoped('transport_orders').length >= Store.all('transport_orders').length;
  state.companyId = 'avto';
  return a && b;
});

/* ---------- 7. RBAC ---------- */
must('RBAC: SUPER_ADMIN vidi sve module', () => W.visibleModules().length === MODULES.length);
must('RBAC: READONLY nema pravo kreiranja naloga', () => {
  state.user.role = 'READONLY';
  const r = !W.can('orders', 'C') && W.can('orders', 'V');
  state.user.role = 'SUPER_ADMIN';
  return r;
});
must('RBAC: FLEET ne vidi fakture', () => {
  state.user.role = 'FLEET';
  const r = !W.can('invoices', 'V');
  state.user.role = 'SUPER_ADMIN';
  return r;
});

/* ---------- 8. Iscrtavanje svih pogleda ---------- */
document.getElementById('login').style.display = 'none';
document.getElementById('shell').style.display = 'block';
W.mountShell();

for (const m of MODULES) {
  must('pogled: ' + m.key, () => {
    state.route = m.key;
    W.render();
    const h = document.getElementById('view').innerHTML;
    return typeof h === 'string' && h.length > 50;
  });
}
must('pogled: zbirni režim ALL radi', () => {
  state.companyId = 'ALL';
  let okAll = true;
  for (const m of MODULES) { state.route = m.key; W.render(); if (document.getElementById('view').innerHTML.length < 20) okAll = false; }
  state.companyId = 'avto';
  return okAll;
});

/* ---------- 9. Otvaranje formi ---------- */
const FORMS = [
  ['nalog', () => W.openOrderForm()],
  ['tura', () => W.openTripForm()],
  ['trošak', () => W.openExpenseForm()],
  ['faktura', () => W.openInvoiceForm()],
  ['klijent', () => W.openClientForm()],
  ['vozilo', () => W.openFleetForm()],
  ['vozač', () => W.openDriverForm()],
  ['ulazni račun', () => W.openPurchaseForm()],
  ['obračun vozača', () => W.openSettlementForm()],
  ['parametri', () => W.openParams()],
  ['promena lozinke', () => W.openMyPassword()],
];
for (const [name, fn] of FORMS) {
  must('forma: ' + name, () => {
    W.closeModal();
    fn();
    const h = document.getElementById('modalRoot').innerHTML;
    W.closeModal();
    return h.length > 100;
  });
}

/* globali koje forme postavljaju tek pri otvaranju */
must('most: __ord* i __exp* globali posle otvaranja formi', () => {
  W.closeModal(); W.openOrderForm();
  const a = ['__ordDocAdd', '__ordDocToggle', '__ordDocRemove', '__ordDocNewType',
             '__ordNewClient', '__ordNewCountry', '__ordSecToggle']
            .filter(n => typeof W[n] !== 'function');
  W.closeModal(); W.openExpenseForm();
  const b = typeof W.__expNewCat === 'function';
  W.closeModal();
  if (a.length || !b) throw new Error('nedostaju: ' + a.join(',') + (b ? '' : ' __expNewCat'));
  return true;
});

/* ---------- 10. Detaljni pregledi ---------- */
must('detalj: nalog', () => {
  const o = Store.scoped('transport_orders')[0];
  W.closeModal(); W.viewOrder(o.id);
  const h = document.getElementById('modalRoot').innerHTML; W.closeModal();
  return h.includes(o.order_no);
});
must('detalj: tura', () => {
  const t = Store.scoped('trips')[0];
  W.closeModal(); W.viewTrip(t.id);
  const h = document.getElementById('modalRoot').innerHTML; W.closeModal();
  return h.length > 200;
});
must('detalj: faktura', () => {
  const i = Store.scoped('invoices')[0];
  if (!i) return true;
  W.closeModal(); W.viewInvoice(i.id);
  const h = document.getElementById('modalRoot').innerHTML; W.closeModal();
  return h.length > 200;
});
must('detalj: vozilo', () => {
  const v = Store.scoped('fleet_vehicles')[0];
  W.closeModal(); W.viewFleet(v.id);
  const h = document.getElementById('modalRoot').innerHTML; W.closeModal();
  return h.length > 200;
});
must('detalj: vozač', () => {
  const d = Store.scoped('drivers')[0];
  W.closeModal(); W.viewDriver(d.id);
  const h = document.getElementById('modalRoot').innerHTML; W.closeModal();
  return h.length > 200;
});

/* ---------- 11. Poslovna logika ---------- */
must('brojači: sledeći broj naloga po firmi', () => {
  const a = W.nextOrderNo('avto'), t = W.nextOrderNo('transport');
  return a.startsWith('AV-') && t.startsWith('TR-') && a !== t;
});
must('brojači: sledeći broj ture', () => W.nextTripNo('avto').startsWith('AV-T-'));
must('brojači: sledeći broj fakture sadrži godinu', () =>
  W.nextInvoiceNo('avto').includes(String(new Date().getFullYear())));
must('finansije: interna zarada = cena − (EUR + INTERNA + GOTOVINA)', () => {
  const agreed = 1000, eur = 600, interna = 250, gotovina = 50;
  const z = +(agreed - (eur + interna + gotovina)).toFixed(2);
  return z === 100;
});
must('alarmi: computeAlerts vraća niz', () => Array.isArray(W.computeAlerts()));
must('šifarnici: lkOpts vraća opcije za države', () => W.lkOpts('countries', '—').length > 1);
must('formatiranje: fmtMoney', () => W.fmtMoney(1234.5, 'EUR').includes('€'));
must('formatiranje: esc štiti od HTML injekcije', () => W.esc('<b>&"') === '&lt;b&gt;&amp;&quot;');
must('grafikoni: svgBars vraća SVG', () => W.svgBars([{ label: 'a', value: 1 }]).startsWith('<svg'));
must('grafikoni: svgDonut vraća SVG', () => W.svgDonut([{ label: 'a', value: 1 }]).includes('<svg'));
must('tabela: renderTable vraća HTML', () =>
  W.renderTable({ id: 'smoke', columns: [{ key: 'name', label: 'Naziv', render: r => r.name }], rows: Store.all('clients') }).includes('<table'));

/* ---------- 12. Pretraga i ruter ---------- */
must('globalna pretraga otvara modal', () => {
  W.closeModal();
  W.globalSearch('AV');
  const h = document.getElementById('modalRoot').innerHTML;
  W.closeModal();
  return h.length > 50;
});
must('ruter: go() menja rutu', () => { W.go('invoices'); return state.route === 'invoices'; });
must('ruter: nedozvoljena ruta pada na dashboard', () => {
  state.user.role = 'FLEET'; state.route = 'invoices'; W.render();
  const r = state.route === 'dashboard';
  state.user.role = 'SUPER_ADMIN';
  return r;
});

/* ---------- 13. Rezultat ---------- */
console.log('\n' + '='.repeat(58));
console.log('BALKAN TMS — smoke test (ES moduli)');
console.log('='.repeat(58));
console.log('  prošlo:  ' + pass);
console.log('  palo:    ' + fail);
if (failures.length) {
  console.log('\nNEUSPELO:');
  failures.forEach(f => console.log('  ✗ ' + f));
}
console.log('='.repeat(58));
process.exit(fail ? 1 : 0);
