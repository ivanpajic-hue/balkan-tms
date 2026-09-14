/* BALKAN TMS — src/main.js
   Ulazna tačka. Uvozi sve module, postavlja most ka window i pokreće aplikaciju.
   A0.2 — razdvajanje monolita na ES module. */

/* --- jezgro --- */
import * as config   from './core/config.js';
import * as dom      from './core/dom.js';
import * as supabase from './core/supabase.js';
import * as stateM   from './core/state.js';
import * as seedM    from './core/seed.js';
import * as store    from './core/store.js';
import * as rbac     from './core/rbac.js';
import * as session  from './core/session.js';

/* --- zajednički UI --- */
import * as status   from './ui/status.js';
import * as table    from './ui/table.js';
import * as modal    from './ui/modal.js';
import * as lookups  from './ui/lookups.js';
import * as charts   from './ui/charts.js';

/* --- registar pogleda (mora se izvršiti pre poslovnih modula) --- */
import * as registry from './modules/registry.js';

/* --- poslovni moduli: svaki upisuje svoj pogled u Views --- */
import * as mDashboard   from './modules/dashboard.js';
import * as mClients     from './modules/clients.js';
import * as mOrders      from './modules/orders.js';
import * as mPlanning    from './modules/planning.js';
import * as mTrips       from './modules/trips.js';
import * as mExpenses    from './modules/expenses.js';
import * as mInvoices    from './modules/invoices.js';
import * as mPurchases   from './modules/purchases.js';
import * as mSettlements from './modules/settlements.js';
import * as mFleet       from './modules/fleet.js';
import * as mDrivers     from './modules/drivers.js';
import * as mReports     from './modules/reports.js';
import * as mAlerts      from './modules/alerts.js';
import * as mAdmin       from './modules/admin.js';

/* --- ljuska, prijava, ruter --- */
import * as shell    from './app/shell.js';
import * as auth     from './app/auth.js';
import * as router   from './app/router.js';

/* =====================================================================
   MOST KA GLOBALNOM OPSEGU (privremen — planirano uklanjanje u A0.3)

   Postojeći kod generiše HTML sa inline atributima tipa
   onclick="openOrderForm()". Takvi atributi se izvršavaju u globalnom
   opsegu, pa svaka funkcija koju oni pozivaju mora biti na window.
   Monolit je to dobijao besplatno (klasična skripta). ES modul ima
   sopstveni opseg, pa most mora biti eksplicitan.

   Sledeći korak (A0.3): zamena inline atributa delegiranjem događaja,
   posle čega se ovaj blok briše.
   ===================================================================== */
const NAMESPACES = [
  config, dom, supabase, stateM, seedM, store, rbac, session,
  status, table, modal, lookups, charts, registry,
  mDashboard, mClients, mOrders, mPlanning, mTrips, mExpenses, mInvoices,
  mPurchases, mSettlements, mFleet, mDrivers, mReports, mAlerts, mAdmin,
  shell, auth, router,
];

const exposed = [];
for (const ns of NAMESPACES) {
  for (const key of Object.keys(ns)) {
    try { window[key] = ns[key]; exposed.push(key); }
    catch (e) { console.warn('[MOST] ne mogu da izložim: ' + key, e); }
  }
}
window.__TMS_BRIDGE__ = exposed.sort();

/* =====================================================================
   BOOT
   ===================================================================== */
const { $ } = dom;
const { doLogin, enterApp, loginErr } = auth;
const { sbClient } = supabase;

(async function boot() {
  $('#loginBtn').onclick = doLogin;
  $('#loginPass').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
  $('#loginEmail').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
  try {
    const { data: { session } } = await sbClient().auth.getSession();
    if (session) await enterApp(session);
  } catch (e) {
    console.error(e);
    loginErr('Greška pri proveri sesije: ' + ((e && e.message) || e));
  }
})();
