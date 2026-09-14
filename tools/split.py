#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BALKAN TMS — A0.2
Deli monolitni index.html (jedan <script>) na ES module.
Uvozi/izvozi se generišu automatski iz analize simbola.
"""
import os, re, json, shutil

SRC_HTML = 'index.html'
OUT = 'build'

# ---------- 1. Učitavanje ----------
html = open(SRC_HTML, encoding='utf-8').read()
lines = html.split('\n')

CSS_FROM, CSS_TO = 8, 213          # 1-based, unutar <style>...</style>
JS_FROM, JS_TO = 251, 1398         # 1-based, unutar <script>...</script>

css = '\n'.join(lines[CSS_FROM-1:CSS_TO])
js = '\n'.join(lines[JS_FROM-1:JS_TO])
jl = js.split('\n')                 # jl[0] == prva linija JS-a (app.js red 1)

def seg(a, b):
    """1-based, uključivo, u koordinatama app.js"""
    return '\n'.join(jl[a-1:b])

# ---------- 2. Definicija modula ----------
# (putanja, [(od,do), ...], opis)
MODULES = [
    ('core/dom.js',        [(3,14)],                    'DOM i format helperi'),
    ('core/config.js',     [(16,16),(19,25),(50,52)],   'Konfiguracija: Supabase, tabele'),
    ('core/supabase.js',   [(26,49)],                   'Supabase klijent i write-through sloj'),
    ('core/state.js',      [(119,119)],                 'Globalno stanje aplikacije'),
    ('core/seed.js',       [(124,253)],                 'Početni i demo podaci'),
    ('core/store.js',      [(54,89)],                   'Store — jedini sloj pristupa podacima'),
    ('core/rbac.js',       [(91,117)],                  'Moduli, uloge, dozvole, audit'),
    ('core/session.js',    [(120,122)],                 'Kompanije i opseg korisnika'),
    ('ui/status.js',       [(255,268)],                 'Alarmi (computed), statusne oznake'),
    ('ui/table.js',        [(271,303)],                 'Generička tabela + izvoz'),
    ('ui/modal.js',        [(305,353)],                 'Modali i helperi za forme'),
    ('ui/lookups.js',      [(355,360)],                 'Šifarnici — helperi'),
    ('ui/charts.js',       [(362,383)],                 'Inline SVG grafikoni'),
    ('modules/dashboard.js',   [(386,408)],  'Komandna tabla'),
    ('modules/clients.js',     [(410,431)],  'Klijenti i partneri'),
    ('modules/orders.js',      [(433,556)],  'Nalozi za transport'),
    ('modules/planning.js',    [(558,601)],  'Planiranje utovara'),
    ('modules/trips.js',       [(603,665)],  'Ture'),
    ('modules/expenses.js',    [(667,697)],  'Troškovi'),
    ('modules/invoices.js',    [(699,741)],  'Fakture'),
    ('modules/purchases.js',   [(743,785)],  'Ulazni računi'),
    ('modules/settlements.js', [(787,832)],  'Obračun vozača'),
    ('modules/fleet.js',       [(834,858)],  'Vozni park'),
    ('modules/drivers.js',     [(860,878)],  'Vozači'),
    ('modules/reports.js',     [(880,935)],  'Izveštaji'),
    ('modules/alerts.js',      [(937,945)],  'Alarmi'),
    ('modules/admin.js',       [(947,1051)], 'Administracija'),
    ('app/shell.js',       [(1053,1054),(1106,1132)],  'Ljuska: navigacija, pretraga'),
    ('app/auth.js',        [(1055,1104)],               'Prijava, sesija, prva postavka'),
    ('app/router.js',      [(1105,1105),(1133,1140)],   'Ruter i iscrtavanje'),
]

BOOT = seg(1141, 1148)

# registry.js pišemo ručno (jedna linija: const Views={})
REGISTRY = "export const Views = {};\n"

# ---------- 3. Sirovi sadržaj ----------
raw = {}
for path, ranges, desc in MODULES:
    raw[path] = '\n'.join(seg(a, b) for a, b in ranges)

# hotfix: implicitni globalni upis (puca u strict/ESM režimu)
assert 'renderTableState={};' in raw['ui/table.js']
raw['ui/table.js'] = raw['ui/table.js'].replace('renderTableState={};', 'const renderTableState={};', 1)

# ---------- 4. Uklanjanje stringova/komentara za analizu ----------
def strip_literals(src):
    """Zamenjuje sadrzaj stringova, sablona, komentara i regex literala razmacima,
    uz ocuvanje prelaza u nov red. Regex literal se prepoznaje po prethodnom
    znacajnom znaku (posle operatora / zagrade / kljucne reci sledi regex,
    posle identifikatora ili zatvorene zagrade sledi deljenje)."""
    out = []; i = 0; n = len(src)
    prev = ''          # poslednji znacajan znak
    prev_word = ''     # poslednja rec pre '/'
    KW = {'return','typeof','instanceof','in','of','new','delete','void','case',
          'do','else','yield','await','throw'}
    def blank(t):
        return ''.join('\n' if ch == '\n' else ' ' for ch in t)
    while i < n:
        c = src[i]
        if c == '/' and i+1 < n and src[i+1] == '/':
            j = src.find('\n', i); j = n if j < 0 else j
            out.append(blank(src[i:j])); i = j; continue
        if c == '/' and i+1 < n and src[i+1] == '*':
            j = src.find('*/', i+2); j = n if j < 0 else j+2
            out.append(blank(src[i:j])); i = j; continue
        if c in '"\'`':
            q = c; j = i+1
            while j < n:
                if src[j] == '\\': j += 2; continue
                if src[j] == q: j += 1; break
                j += 1
            out.append(blank(src[i:j])); i = j; prev = q; prev_word=''; continue
        if c == '/':
            is_re = (prev == '' or prev in '(,=:[!&|?{};+-*%~^<>' or prev_word in KW)
            if is_re:
                j = i+1; cls = False; closed = False
                while j < n:
                    ch = src[j]
                    if ch == '\\': j += 2; continue
                    if ch == '\n': break
                    if ch == '[': cls = True
                    elif ch == ']': cls = False
                    elif ch == '/' and not cls:
                        j += 1; closed = True
                        while j < n and src[j].isalpha(): j += 1
                        break
                    j += 1
                if closed:
                    out.append(blank(src[i:j])); i = j; prev = '/'; prev_word=''; continue
            out.append(c); i += 1; prev = '/'; prev_word=''; continue
        out.append(c)
        if not c.isspace():
            prev = c
            if c.isalnum() or c in '_$':
                k = i
                while k > 0 and (src[k-1].isalnum() or src[k-1] in '_$'): k -= 1
                prev_word = src[k:i+1]
            else:
                prev_word = ''
        i += 1
    return ''.join(out)

clean = {p: strip_literals(s) for p, s in raw.items()}

# ---------- 5. Top-level deklaracije po modulu ----------
DECL = re.compile(r'(?m)^(?:const|let|var)\s+([A-Za-z_$][\w$]*)|^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^class\s+([A-Za-z_$][\w$]*)')

owner = {}          # ime -> putanja modula
exports = {}        # putanja -> [imena]
for path, _, _ in MODULES:
    names = []
    for m in DECL.finditer(clean[path]):
        nm = m.group(1) or m.group(2) or m.group(3)
        if nm and nm not in names:
            names.append(nm)
    exports[path] = names
    for nm in names:
        if nm in owner:
            raise SystemExit('DUPLIKAT simbola %s: %s i %s' % (nm, owner[nm], path))
        owner[nm] = path

# Views je poseban modul
owner['Views'] = 'modules/registry.js'
exports['modules/registry.js'] = ['Views']

# ---------- 6. Generisanje import blokova ----------
def rel(frm, to):
    d = os.path.relpath(os.path.dirname(to) or '.', os.path.dirname(frm) or '.')
    r = os.path.join(d, os.path.basename(to)).replace('\\', '/')
    return r if r.startswith('.') else './' + r

imports_map = {}
for path, _, _ in MODULES:
    body = clean[path]
    own = set(exports[path])
    used = set(re.findall(r'(?<![.\w$])([A-Za-z_$][\w$]*)', body))
    need = {}
    for nm in sorted(used):
        if nm in own or nm not in owner:
            continue
        src = owner[nm]
        if src == path:
            continue
        need.setdefault(src, []).append(nm)
    imports_map[path] = need

# ---------- 7. Ispis ----------
if os.path.isdir(OUT):
    shutil.rmtree(OUT)
for d in ['src/core', 'src/ui', 'src/modules', 'src/app', 'styles', 'tools']:
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

HDR = "/* BALKAN TMS — %s\n   %s\n   Modul generisan iz monolita v3.0 (A0.2). */\n"

written = []
for path, ranges, desc in MODULES:
    need = imports_map[path]
    imp = ''.join(
        "import { %s } from '%s';\n" % (', '.join(sorted(names)), rel('src/'+path, 'src/'+src))
        for src, names in sorted(need.items())
    )
    exp = ''
    if exports[path]:
        exp = '\nexport {\n  ' + ',\n  '.join(exports[path]) + '\n};\n'
    content = (HDR % (path, desc)) + (imp and imp + '\n') + raw[path].rstrip('\n') + '\n' + exp
    full = os.path.join(OUT, 'src', path)
    open(full, 'w', encoding='utf-8').write(content)
    written.append((path, len(content), len(exports[path]), sum(len(v) for v in need.values())))

open(os.path.join(OUT, 'src/modules/registry.js'), 'w', encoding='utf-8').write(
    (HDR % ('modules/registry.js', 'Registar pogleda — popunjavaju ga moduli')) + REGISTRY)

open(os.path.join(OUT, 'styles/app.css'), 'w', encoding='utf-8').write(css.strip() + '\n')

json.dump({'owner': owner, 'exports': exports,
           'imports': {k: v for k, v in imports_map.items()}},
          open(os.path.join(OUT, 'tools/_symbols.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

print('BOOT blok:\n' + BOOT)
print('\n%-26s %8s %7s %7s' % ('modul', 'bajtova', 'izvoza', 'uvoza'))
for p, sz, ex, im in written:
    print('%-26s %8d %7d %7d' % (p, sz, ex, im))
print('\nUkupno modula: %d' % (len(written)+1))

# ---------- 8. main.js i index.html ----------
open(os.path.join(OUT, 'src/main.js'), 'w', encoding='utf-8').write(
    open('tpl/main.js', encoding='utf-8').read())

L = html.split('\n')
head = '\n'.join(L[0:6])
markup = '\n'.join(L[215:247])
new_html = head + """
<link rel="stylesheet" href="./styles/app.css">
</head>
""" + markup + """
<!-- Zavisnosti sa CDN-a: klasicne skripte, izvrsavaju se pre modula (moduli su odlozeni). -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/dist/umd/supabase.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<!-- Aplikacija: ES moduli. Zahteva http(s) posluzivanje (ne radi preko file://). -->
<script type="module" src="./src/main.js"></script>
</body>
</html>
"""
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(new_html)
print('\nindex.html + main.js upisani.')
