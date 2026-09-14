# BALKAN TMS — A0.2: razdvajanje monolita na ES module

Verzija: `4.0.0-a0.2` · Datum: 14.09.2026. · Faza: A0 (arhitektonski rez)

Ovaj dokument opisuje šta je urađeno u zadatku Z002, kako se projekat pokreće
lokalno, kako se objavljuje na Vercel i šta je otvoreno za sledeći korak.

---

## 1. Šta je promenjeno

Monolitni `index.html` (194.531 B, 1.401 red — jedan `<style>` i jedan `<script>`
od 1.148 redova) razložen je na:

| putanja | sadržaj |
|---|---|
| `index.html` | samo markup ljuske (2,4 KB) |
| `styles/app.css` | izdvojen `<style>` blok (17 KB) |
| `src/main.js` | ulazna tačka: uvoz svih modula, most ka `window`, boot |
| `src/core/` | 8 modula: konfiguracija, DOM helperi, Supabase sloj, stanje, seed, Store, RBAC, sesija |
| `src/ui/` | 5 modula: statusi/alarmi, tabela, modali, šifarnici, grafikoni |
| `src/modules/` | `registry.js` + 14 poslovnih pogleda |
| `src/app/` | ljuska, prijava, ruter |
| `tools/` | alati za proveru i podelu |

Ukupno **32 JS fajla, 192 KB** — isti kod, drugačije raspoređen.

### Slojevi i pravilo zavisnosti

```
core/     ← ništa ne uvozi iz gornjih slojeva
  ↑
ui/       ← uvozi samo iz core/
  ↑
modules/  ← uvozi iz core/, ui/, registry
  ↑
app/      ← uvozi iz core/, ui/, registry
  ↑
main.js   ← uvozi sve, pokreće aplikaciju
```

`Store` ostaje jedini sloj pristupa podacima (`src/core/store.js`). Prelazak sa
Supabase na bilo šta drugo i dalje je izmena u tom jednom fajlu.

---

## 2. Dve stvari koje su morale da se isprave

### 2.1 Implicitni globalni upis (postojeći bag)

U monolitu, red 271:

```js
renderTableState={};        // nema const/let/var
```

U klasičnoj skripti ovo tiho kreira svojstvo na globalnom objektu. ES modul je
uvek u `strict` režimu, pa je to `ReferenceError` i **cela generička tabela bi
pala**. Ispravljeno u `const renderTableState={}`.

Analiza opsega (acorn + eslint-scope) potvrđuje da je ovo bio jedini takav
slučaj u 1.148 redova.

### 2.2 Most ka globalnom opsegu (privremen)

Postojeći kod generiše HTML sa inline atributima:

```html
<button onclick="openOrderForm()">+ Nalog</button>
```

Inline atributi se izvršavaju u **globalnom** opsegu. Monolit je to dobijao
besplatno. ES modul ima sopstveni opseg, pa `openOrderForm` ne bi postojao.

Zato `src/main.js` sadrži most:

```js
for (const ns of NAMESPACES)
  for (const key of Object.keys(ns)) window[key] = ns[key];
```

**Ovo je privremeno rešenje i označeno je kao takvo u kodu.** Uklanja se u A0.3,
kada se inline atributi zamene delegiranjem događaja. Do tada je most obavezan —
bez njega nijedno dugme u aplikaciji ne radi.

Kontrolna lista izloženih imena dostupna je u konzoli: `window.__TMS_BRIDGE__`.

---

## 3. Lokalno pokretanje

ES moduli **ne rade preko `file://`** — dupli klik na `index.html` daje CORS
grešku. Potreban je HTTP server.

```bash
npm install          # samo prvi put (jsdom, acorn, eslint-scope)
npm run dev          # → http://localhost:5173
```

Server je bez zavisnosti (`tools/dev-server.mjs`, ~40 redova), postavlja tačne
MIME tipove i isključuje keš.

---

## 4. Provera pre svake isporuke

```bash
npm run check        # sintaksa + analiza opsega nad svih 32 modula
npm run smoke        # funkcionalni test u jsdom
npm run parity -- ../putanja/do/starog_monolita.html   # opciono
```

### `npm run check`
- `node --check` nad svakim modulom
- upis u nedeklarisanu promenljivu → **greška** (puca u strict režimu)
- čitanje nerazrešenog imena → **upozorenje** (verovatno nedostaje `import`)

Bela lista `WINDOW_OK` u `tools/check.mjs` sadrži imena koja se i u monolitu
razrešavaju preko `window` (`viewOrder`, `viewTrip`, `go`, …). Svako **novo** ime
u upozorenjima znači da nedostaje uvoz.

### `npm run smoke`
59 provera u jsdom okruženju:
- svih 14 pogleda × 3 režima firme (avto / transport / ALL)
- 11 formi + 5 detaljnih pregleda
- `Store`: insert / update / soft-delete / `scoped()` po `company_id`
- RBAC: SUPER_ADMIN, READONLY, FLEET
- brojači naloga, tura i faktura; grafikoni; izvoz; pretraga; ruter

### `npm run parity`
Pokreće stari monolit i nove module u dva jsdom konteksta sa determinističkim
`Math.random`, pa upoređuje generisani HTML **bajt po bajt** — 57 izlaza.
Rezultat pri isporuci: **0 razlika**.

Ovo je alat koji vredi zadržati: pre svakog većeg refaktora snimi „pre“ stanje i
dokaži da se ponašanje nije promenilo.

---

## 5. Objava — GitHub i Vercel

### 5.1 Prvi push

```bash
cd balkan-tms
git init
git add .
git commit -m "A0.2: razdvajanje monolita na ES module"
git branch -M main
git remote add origin https://github.com/ivanpajic-hue/balkan-tms.git
git push -u origin main
```

`.gitignore` već isključuje `node_modules/`, `.vercel/` i logove.

### 5.2 Grana za pregled

```bash
git checkout -b preview
git push -u origin preview
```

Vercel automatski pravi preview URL za svaku granu i svaki PR. Radno pravilo:
`main` = produkcija (`balkan-tms.vercel.app`), `preview` = provera pre spajanja.

### 5.3 Vercel podešavanje

Projekat je statički — **bez build komande**:

- Framework Preset: **Other**
- Build Command: prazno
- Output Directory: prazno (koren repozitorijuma)
- Install Command: prazno

`vercel.json` postavlja `Cache-Control: max-age=0, must-revalidate` za
`.html/.js/.css`. Bez toga se ES moduli agresivno keširaju i posle deploya se
servira mešavina starog i novog koda — teško uočljiv kvar.

---

## 6. Posledice podele koje treba imati na umu

**Broj zahteva: 1 → 33.** Preko HTTP/2 to je prihvatljivo pri ovoj veličini.
Kada se u Sprintu B doda 7 portovanih modula (1.616 KB izvornog koda), prvo
učitavanje treba izmeriti. Lek je jeftin i može da sačeka: `esbuild` kao Vercel
build korak, bez ijedne izmene u kodu aplikacije.

**Podela je ponovljiva.** `tools/split.py` je skripta koja je napravila ovu
podelu iz monolita — nije ručno prepisivanje. Opsezi redova su u listi `MODULES`
na vrhu fajla. Zadržana je kao dokumentacija postupka; posle A0.3 više neće biti
upotrebljiva jer kod odlazi dalje od monolita.

---

## 7. Otvoreno — pre unosa stvarnih podataka

### 7.1 RLS pre javnog deploya (Z005)

Anon ključ je u `src/core/config.js`, vidljiv i u repozitorijumu i u browseru.
To je po dizajnu ispravno — ali **samo ako RLS politike stoje**. Do tada je baza
otvorena za svakoga ko otvori Developer Tools. Preporuka: Z005 ide **pre** prvog
javnog deploya, ne posle Z003 i Z004.

### 7.2 Kontradikcija u obračunu interne zarade

U kodu (`src/modules/orders.js`):

```js
f.interna_zarada = +(f.agreed_price - (f.fakt_eur + f.interna_iznos + f.gotovina)).toFixed(2);
```

**`fakt_din` nije oduzet.** Važeće pravilo projekta glasi:

```
agreed_price = EUR + DIN + INTERNA + GOTOVINA + interna_zarada
```

Po tom pravilu DIN mora ući u oduzimanje. Razlika se pojavljuje na svakom nalogu
sa dinarskim delom.

Nije dirano u A0.2 — ovaj zadatak je refaktor bez promene ponašanja i parity test
bi pao. Ali je izmena u jednoj liniji i **mora se rešiti pre unosa stvarnih
naloga**, jer posle ispravke svi ranije uneti nalozi imaju pogrešnu internu
zaradu i traže ručnu reviziju.

### 7.3 Supabase projekat

Fajl koristi projekat `ygkxuuumbzsanyatylet`. U ranijim beleškama figurira drugi
projekat. Pre nastavka potvrditi koji je aktuelan, da se šema v4.0 (Z004) ne
kreira u pogrešnom.

---

## 8. Sledeći korak

| zadatak | opis | procena |
|---|---|---|
| Z005 | RLS — razdvajanje firmi po `company_id` | 1 h |
| Z003 | Registar modula i odloženo učitavanje (`import()`) | 3 h |
| Z004 | Ciljna šema baze v4.0 (~64 tabele) | 2 h |
| A0.3 | Uklanjanje inline atributa i mosta ka `window` | — |

Z003 je sada izvodljiv jer `src/modules/registry.js` postoji kao jedina tačka
kroz koju pogledi ulaze u sistem — dovoljno je zameniti statičke uvoze u
`main.js` dinamičkim `import()` po ruti.
