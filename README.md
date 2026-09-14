# BALKAN TMS

Sistem za auto-logistiku — BALKAN AVTO d.o.o. (SLO) i BALKAN TRANSPORT d.o.o. (SRB).

Verzija `4.0.0-a0.2` · ES moduli · Supabase · Vercel

## Pokretanje

```bash
npm install
npm run dev      # http://localhost:5173
```

ES moduli ne rade preko `file://` — obavezan je HTTP server.

## Provera

```bash
npm run check    # sintaksa + analiza opsega (32 modula)
npm run smoke    # funkcionalni test u jsdom (59 provera)
npm test         # check + smoke
```

## Struktura

```
index.html          markup ljuske
styles/app.css      stilovi
src/main.js         ulazna tačka + most ka window (privremen, A0.3)
src/core/           config, dom, supabase, state, seed, store, rbac, session
src/ui/             status, table, modal, lookups, charts
src/modules/        registry + 14 poslovnih pogleda
src/app/            shell, auth, router
tools/              check, smoke, parity, dev-server, split
```

Pravilo zavisnosti: `core → ui → modules/app → main`.
`Store` (`src/core/store.js`) je jedini sloj pristupa podacima.

Detalji, postupak objave i otvorena pitanja: **[UPUTSTVO_A0_2.md](./UPUTSTVO_A0_2.md)**
