/* BALKAN TMS — tools/check.mjs
   1) node --check nad svakim modulom (sintaksa)
   2) analiza opsega: upis u nedeklarisanu promenljivu puca u ES modulu (strict)
   Pokretanje: npm run check
*/
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as escope from 'eslint-scope';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

const BROWSER = new Set(['window', 'document', 'console', 'Math', 'JSON', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'Date', 'Promise', 'Set', 'Map', 'WeakMap', 'RegExp', 'Error', 'URL', 'Blob',
  'File', 'FileReader', 'localStorage', 'sessionStorage', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'XLSX', 'navigator', 'location', 'fetch', 'Intl', 'Symbol', 'undefined',
  'NaN', 'Infinity', 'alert', 'confirm', 'prompt', 'requestAnimationFrame', 'globalThis',
  'Event', 'Node', 'Element', 'HTMLElement', 'crypto', 'performance', 'history', 'atob', 'btoa',
  'FormData', 'DOMParser', 'Image', 'ArrayBuffer', 'Uint8Array', 'Proxy', 'Reflect']);

/* Funkcije koje se i u monolitu razrešavaju preko window (window.X = ...).
   Očekivane su; svaka NOVA stavka ovde je znak da nedostaje import. */
const WINDOW_OK = new Set(['go', 'viewOrder', 'viewTrip', 'viewInvoice', 'viewFleet', 'viewDriver',
  'viewSettlement', 'planUnassign', 'planAssignCore']);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : (e.name.endsWith('.js') ? [p] : []);
  });
}

const files = walk(SRC).sort();
let errors = 0, warnings = 0;

for (const f of files) {
  const rel = path.relative(ROOT, f);
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    console.log('✗ SINTAKSA  ' + rel + '\n' + String(e.stderr).split('\n').slice(0, 4).join('\n'));
    errors++;
    continue;
  }
  const src = fs.readFileSync(f, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module', locations: true, ranges: true });
  const sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
  for (const ref of sm.globalScope.through) {
    const n = ref.identifier.name;
    if (BROWSER.has(n)) continue;
    const line = ref.identifier.loc.start.line;
    if (ref.isWrite()) {
      console.log('✗ UPIS u nedeklarisano: ' + n + '  (' + rel + ':' + line + ') — puca u strict režimu');
      errors++;
    } else if (!WINDOW_OK.has(n)) {
      console.log('⚠ nerazrešeno čitanje: ' + n + '  (' + rel + ':' + line + ') — nedostaje import?');
      warnings++;
    }
  }
}

console.log('\n' + '='.repeat(58));
console.log('CHECK — fajlova: ' + files.length + ' | grešaka: ' + errors + ' | upozorenja: ' + warnings);
console.log('='.repeat(58));
process.exit(errors ? 1 : 0);
