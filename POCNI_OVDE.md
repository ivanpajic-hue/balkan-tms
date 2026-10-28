# BALKAN TMS Lite – POČNI OVDE

Verzija 1.0 (faza 1) · 28.10.2026

## Šta je u paketu

| Fajl | Čemu služi |
|---|---|
| `01_BAZA_TMS_LITE.sql` | Kompletna baza za SVE faze (vozni park, vozači, partneri, ture, nalozi, fakture, naplata, obračun vozača, prava pristupa, skladište dokumenata). Pokreće se jednom; sme i više puta. |
| `index.html` | Program – faza 1: rokovi i alarmi, vozila, vozači, partneri sa kontaktima, dokumenti, naše firme, šifarnici, korisnici. |
| `POCNI_OVDE.md` | Ovo uputstvo. |

Ukupno vreme: oko 30–40 minuta. Potrebni su samo pregledač i Notepad.

---

## Korak 1 – Novi Supabase projekat (5 min)

1. Otvorite **supabase.com** → **Sign in**.
2. **Odluka o planu (pročitajte pre klika):**
   - **Free**: projekat se **pauzira posle 7 dana bez korišćenja** i **nema automatskih rezervnih kopija**. Dozvoljena su samo 2 aktivna besplatna projekta.
   - **Pro ($25 mesečno po organizaciji)**: ne pauzira se, dnevne rezervne kopije se čuvaju 7 dana.
   - **Preporuka:** dok probate – Free. **Pre unosa prve prave fakture – Pro.** Fakture su poslovna dokumentacija; gubitak baze bez kopije nije prihvatljiv rizik.
   - Ako već imate 2 aktivna besplatna projekta, stari TMS projekat pauzirajte (njegov projekat → **Project Settings → General → Pause project**). Ne brišite ga.
3. **New project** → izaberite organizaciju.
4. Popunite:
   - **Project name:** `balkan-tms-lite`
   - **Database password:** kliknite **Generate a password** i sačuvajte lozinku (npr. u menadžer lozinki).
   - **Region:** **Central EU (Frankfurt)**.
   - Ako forma nudi **Security options**, ostavite podrazumevano (Data API + Connection string, `public` schema).
5. **Create new project** i sačekajte 1–2 minuta da se projekat napravi.

## Korak 2 – Pokretanje baze (3 min)

1. Levo: **SQL Editor** → **New query**.
2. Na računaru: desni klik na `01_BAZA_TMS_LITE.sql` → **Open with → Notepad** → **Ctrl+A**, **Ctrl+C**.
3. U Supabase polje: **Ctrl+V** → dugme **Run** (dole desno).
4. Ako Supabase upozori na „destructive operations“ → **Run this query** (skripta samo zamenjuje sopstvena pravila, podaci se ne brišu).
5. Dole se pojavljuje rezultat. Ispravno je:

| rezultat | tabela | pravila_rls | pravila_dokumenti | stavki_sifarnika |
|---|---|---|---|---|
| BAZA SPREMNA | 18 | 66 | 3 | 73 |

Ako je **pravila_dokumenti = 0**, uradite i korak 3b.

## Korak 3 – Prvi korisnik i zaključavanje registracije (3 min)

1. Levo: **Authentication → Users → Add user → Create new user**.
2. Upišite svoj e-mail i lozinku, uključite **Auto Confirm User** → **Create user**.
   Prvi korisnik u sistemu automatski postaje **Administrator**.
3. Zaključajte samostalnu registraciju (korisnike pravi samo administrator):
   **Authentication → Sign In / Providers** → isključite **Allow new users to sign up** → **Save**.
   (Dodavanje korisnika iz koraka 1 i dalje radi.)

**3b – samo ako je pravila_dokumenti = 0:** pokrenite skriptu ponovo (korak 2). Ako je i dalje 0:
**Storage → New bucket** → ime `dokumenti`, **Public bucket isključen** → **Create**. Zatim **Storage → Policies → dokumenti → New policy → For full customization** i napravite tri pravila za ulogu `authenticated`:
- SELECT i INSERT, izraz: `bucket_id = 'dokumenti' and public.moja_uloga() is not null`
- DELETE, izraz: `bucket_id = 'dokumenti' and public.moja_uloga() in ('ADMIN','FINANSIJE')`

## Korak 4 – Adresa baze i javni ključ (3 min)

1. **Project Settings → API Keys** → kopirajte **Publishable key** (počinje sa `sb_publishable_`).
   Ako ga nema, otvorite karticu **Legacy API keys** i kopirajte **anon public**.
2. **Project Settings → Data API** (ili dugme **Connect** na početnoj strani projekta) → kopirajte **Project URL** (`https://xxxx.supabase.co`).
3. **Nikada** ne koristite **secret** ni **service_role** ključ u programu – on zaobilazi sva prava pristupa.

Ova dva podatka upisujete u `index.html` u koraku 5.4. Publishable ključ je javni po prirodi; podatke štite prijava i prava pristupa u bazi.

## Korak 5 – GitHub i Vercel (10 min)

1. **github.com** → **New repository** → ime `balkan-tms-lite` → **Private** → **Create repository**.
2. Kliknite **uploading an existing file** → prevucite `index.html`, `01_BAZA_TMS_LITE.sql` i `POCNI_OVDE.md` → **Commit changes**.
3. U repozitorijumu kliknite `index.html` → ikonica olovke (**Edit**).
4. Pri vrhu skripte (oko 185. reda; pretraga Ctrl+F → KONFIG) nađite blok `KONFIG` i zamenite samo tekst između navodnika:
   ```
   SUPABASE_URL:   'https://xxxx.supabase.co',
   SUPABASE_KLJUC: 'sb_publishable_...'
   ```
   Navodnici i zarez na kraju prvog reda ostaju. → **Commit changes**.
5. **vercel.com** → **Add New → Project** → **Import** pored `balkan-tms-lite`.
   **Framework Preset: Other**, ostalo ne dirajte → **Deploy**.
6. Posle oko 30 sekundi dobijate adresu, npr. `https://balkan-tms-lite.vercel.app`. Svaka buduća izmena fajla na GitHub-u sama se objavljuje za oko minut.
7. Opciono: **Supabase → Authentication → URL Configuration → Site URL** = ta Vercel adresa.

## Korak 6 – Prva podešavanja u programu (10 min)

Otvorite Vercel adresu i prijavite se.

1. **Naše firme** – dopunite obe firme: adresa, PIB, matični broj, PDV broj, IBAN, banka, tekst u podnožju fakture. Ovi podaci idu na svaku fakturu (faza 3).
2. **Šifarnici**:
   - **Valute i kursevi** – proverite kurs RSD (upisan je okviran 117,2 – unesite važeći srednji kurs NBS).
   - **PDV stope** – za stopu 0 % neka knjigovođa upiše tačan osnov oslobođenja (taj tekst se štampa na fakturi).
   - **Rokovi – vozila / vozači** – podesite koliko dana ranije stiže upozorenje.
3. **Korisnici** – nove korisnike dodajte kao u koraku 3.1–3.2, pa im ovde dodelite ulogu:

| Uloga | Može |
|---|---|
| Administrator | sve, uključujući vozni park, šifarnike i korisnike |
| Dispečer | pregled voznog parka i alarma; unos partnera, tura i naloga |
| Finansije | sve kao dispečer + troškovi ture, obračun vozača, fakture i naplata |

4. Unesite vozila i vozače, za svakog **Rokovi** (registracija, tehnički, osiguranje, vozačka, lekarski…) i po potrebi **Dokumenti** (skenirana saobraćajna, polisa…).
5. Unesite partnere (nalogodavce i klijente) i za svakog bar jedan **kontakt za naplatu**.

## Korak 7 – Kontrola rada (2 min)

- [ ] Prijava radi, u meniju vidite svoje ime i ulogu „Administrator“.
- [ ] Dodajte probno vozilo i rok sa datumom od juče → na „Rokovi i alarmi“ se pojavljuje crveno, a u meniju crveni brojač.
- [ ] Učitajte jedan PDF u „Dokumenti“ → dugme **Otvori** ga prikazuje.
- [ ] Prijavite se kao dispečer → ne vidi Šifarnike i Korisnike, vozila može samo da pregleda.

## Rešavanje problema

| Šta vidite | Uzrok | Rešenje |
|---|---|---|
| Ekran „Povezivanje sa bazom“ | U `index.html` nisu upisani URL i ključ | Korak 5.3–5.4 |
| „Pogrešan e-mail ili lozinka“ | Pogrešna lozinka ili korisnik nije potvrđen | U Supabase-u obrišite korisnika i dodajte ponovo sa **Auto Confirm User** |
| „Nalog … nema dodeljenu ulogu“ | Admin još nije dodelio ulogu | Admin: **Korisnici** → uloga → **Sačuvaj** |
| „Profil nije pronađen“ | SQL nije pokrenut ili je korisnik napravljen u drugom projektu | Ponovite korak 2 u ISTOM projektu |
| „Nemate pravo za ovu radnju“ | Uloga nema tu dozvolu | Proverite tabelu uloga u koraku 6.3 |
| Dokument se ne učitava | Nema pravila za skladište | Korak 3b |
| Program se ne učitava, baza „Paused“ | Free projekat pauziran posle 7 dana | Supabase → projekat → **Restore project**; trajno: Pro plan |
| Korisnik zaboravio lozinku | Ugrađeni e-mail Supabase-a šalje poruke samo članovima tima | Admin obriše korisnika i doda ga ponovo, pa mu ponovo dodeli ulogu |

## Plan sledećih faza (svaka u novom razgovoru)

| Faza | Sadržaj | Baza |
|---|---|---|
| 1 – gotovo | Vozni park, vozači, rokovi i alarmi, dokumenti, partneri i kontakti, šifarnici, firme, korisnici | gotova |
| 2 | Ture i nalozi (nalogodavac + klijent), stavke prihoda, troškovi ture, obračun vozača (zarada, dnevnice, bonusi, odbici, akontacije) | gotova |
| 3 | Fakturisanje jednim klikom za označene naloge, više faktura po nalogu, grupno, interne fakture, valute, štampa/PDF, storno, naplata pojedinačno i grupno, dugovanja po nalogodavcu i klijentu | gotova |
| 4 | Izveštaji (ture, vozači, fakture, starost dugovanja) i izvoz u Excel, uključujući izvoz svih podataka kao rezervnu kopiju | gotova |

Baza za faze 2–4 je već postavljena i proverena, pa sledeće faze dodaju samo ekrane u `index.html`.

## Tekst za projektni dnevnik

```
28.10.2026 – BALKAN TMS Lite, faza 1. Novi pristup: jedan Supabase projekat, 18 tabela (umesto 68),
3 uloge (ADMIN, DISPECER, FINANSIJE), 66 RLS pravila, jedan šifarnik za sve liste.
Baza za sve faze završena i testirana na PostgreSQL 16 (idempotentnost, numeracija bez rupa,
izdavanje faktura grupisano po firmi/tipu/klijentu/nalogodavcu/valuti, storno, naplata, zaštita
fakturisanih stavki, obračun vozača sa znakom). Program faza 1: alarmi, vozila, vozači, partneri,
dokumenti, šifarnici, firme, korisnici – 44 provere ekrana i uloga + 15 provera zabrana u bazi prošle. Sledeće: faza 2 (ture i nalozi).
```
