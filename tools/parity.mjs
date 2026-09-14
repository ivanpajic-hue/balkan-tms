/* BALKAN TMS — tools/parity.mjs
   Dokazuje da modularna verzija daje isti rezultat kao monolit.
   Math.random je deterministički, pa su i ID-jevi iz seed-a identični.
   Pokretanje: node tools/parity.mjs <putanja-do-monolita.html>
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const MONO = process.argv[2];
if (!MONO || !fs.existsSync(MONO)) {
  console.error('Upotreba: node tools/parity.mjs <monolit.html>');
  process.exit(2);
}

function prng() { let s = 123456789; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }

function stubs(win) {
  win.Math.random = prng();
  win.supabase = {
    createClient: () => ({
      from: () => {
        const q = {
          select: () => q, eq: () => q, neq: () => q,
          range: async () => ({ data: [], error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
          upsert: async () => ({ error: null }),
          delete: () => q,
        };
        return q;
      },
      auth: {
        getSession: async () => ({ data: { session: null } }),
        signOut: async () => ({}), updateUser: async () => ({ error: null }),
      },
    }),
  };
  win.XLSX = { utils: { book_new: () => ({}), json_to_sheet: () => ({}), book_append_sheet: () => {} }, writeFile: () => {} };
  win.print = () => {}; win.scrollTo = () => {}; win.alert = () => {};
}

function drive(W) {
  const { Store, state, seed, MODULES } = W;
  Store.db = seed();
  Store.db.users = [{ id: 'u1', full_name: 'Test Korisnik', email: 't@t.rs', role: 'SUPER_ADMIN', active: true }];
  Store.db.user_company_access = [{ id: 'a1', user_id: 'u1', company_id: 'avto' }, { id: 'a2', user_id: 'u1', company_id: 'transport' }];
  state.user = { id: 'u1', full_name: 'Test Korisnik', email: 't@t.rs', role: 'SUPER_ADMIN' };
  state.companyId = 'avto';
  const doc = W.document;
  doc.getElementById('login').style.display = 'none';
  doc.getElementById('shell').style.display = 'block';
  W.mountShell();

  const out = {};
  out['__nav'] = doc.getElementById('nav').innerHTML;
  out['__quick'] = doc.getElementById('quickActions').innerHTML;
  out['__userChip'] = doc.getElementById('userChip').innerHTML;
  for (const comp of ['avto', 'transport', 'ALL']) {
    state.companyId = comp;
    for (const m of MODULES) { state.route = m.key; W.render(); out[comp + ':' + m.key] = doc.getElementById('view').innerHTML; }
  }
  state.companyId = 'avto';
  const forms = [['nalog', 'openOrderForm'], ['tura', 'openTripForm'], ['trosak', 'openExpenseForm'],
                 ['faktura', 'openInvoiceForm'], ['klijent', 'openClientForm'], ['vozilo', 'openFleetForm'],
                 ['vozac', 'openDriverForm'], ['ulazni', 'openPurchaseForm'], ['obracun', 'openSettlementForm'],
                 ['parametri', 'openParams']];
  for (const [k, fn] of forms) { W.closeModal(); W[fn](); out['form:' + k] = doc.getElementById('modalRoot').innerHTML; W.closeModal(); }
  const o = Store.scoped('transport_orders')[0]; W.viewOrder(o.id); out['detalj:nalog'] = doc.getElementById('modalRoot').innerHTML; W.closeModal();
  const t = Store.scoped('trips')[0]; W.viewTrip(t.id); out['detalj:tura'] = doc.getElementById('modalRoot').innerHTML; W.closeModal();
  return out;
}

/* ---- A: monolit ---- */
const domA = new JSDOM(fs.readFileSync(MONO, 'utf8'), {
  runScripts: 'dangerously', url: 'http://localhost/', beforeParse: stubs,
});
await new Promise(r => setTimeout(r, 60));
/* U monolitu su Store/state/seed/MODULES deklarisani sa const i ne postoje na window-u. */
domA.window.eval("window.Store=Store;window.state=state;window.seed=seed;window.MODULES=MODULES;");
const A = drive(domA.window);

/* ---- B: moduli ---- */
const domB = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  runScripts: 'outside-only', url: 'http://localhost/', beforeParse: stubs,
});
for (const k of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'FileReader', 'Blob', 'URL']) {
  const v = k === 'window' ? domB.window : domB.window[k];
  if (v === undefined) continue;
  try { Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); } catch (e) {}
}
Math.random = domB.window.Math.random;
globalThis.XLSX = domB.window.XLSX;
await import(pathToFileURL(path.join(ROOT, 'src/main.js')).href);
await new Promise(r => setTimeout(r, 60));
const B = drive(domB.window);

/* ---- poređenje ---- */
const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
let diff = 0;
for (const k of keys) {
  if (A[k] !== B[k]) {
    diff++;
    console.log('RAZLIKA u "' + k + '"  (monolit ' + (A[k] || '').length + ' zn. / moduli ' + (B[k] || '').length + ' zn.)');
    const a = (A[k] || ''), b = (B[k] || '');
    let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
    console.log('   monolit: …' + a.slice(Math.max(0, i - 60), i + 90).replace(/\n/g, '⏎'));
    console.log('   moduli : …' + b.slice(Math.max(0, i - 60), i + 90).replace(/\n/g, '⏎'));
  }
}
console.log('\n' + '='.repeat(58));
console.log('PARITY: upoređeno ' + keys.length + ' izlaza — razlika: ' + diff);
console.log('='.repeat(58));
process.exit(diff ? 1 : 0);
