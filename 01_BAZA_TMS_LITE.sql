-- =====================================================================
--  BALKAN TMS LITE · 01_BAZA_TMS_LITE.sql · verzija 1.0 · 28.10.2026
--  Kompletna baza za sve module (faze 1–4) na NOVOM Supabase projektu.
--  IDEMPOTENTNA: bezbedno je pokrenuti više puta; postojeći podaci ostaju.
--  Kako: Supabase → SQL Editor → New query → nalepite CEO fajl → Run.
--  Na kraju se prikaže red "BAZA SPREMNA" sa kontrolnim brojevima.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. KORISNICI I ULOGE
-- ---------------------------------------------------------------------
create table if not exists public.profili (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  ime         text,
  uloga       text check (uloga in ('ADMIN','DISPECER','FINANSIJE')),
  aktivan     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Uloga prijavljenog korisnika (NULL = nema pristup). Koristi se u svim pravilima.
create or replace function public.moja_uloga() returns text
language sql stable security definer set search_path = public as $$
  select uloga from public.profili where id = auth.uid() and aktivan
$$;

-- Novi korisnik iz Supabase Auth automatski dobija profil.
-- Prvi korisnik u sistemu postaje ADMIN; ostali čekaju da im admin dodeli ulogu.
create or replace function public.tms_novi_korisnik() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profili (id, email, ime, uloga)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'ime', split_part(new.email, '@', 1)),
          case when not exists (select 1 from public.profili where uloga = 'ADMIN') then 'ADMIN' end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists tms_novi_korisnik on auth.users;
create trigger tms_novi_korisnik after insert on auth.users
  for each row execute function public.tms_novi_korisnik();

-- Korisnici napravljeni PRE pokretanja ove skripte takođe dobijaju profil.
insert into public.profili (id, email, ime)
select u.id, u.email, split_part(u.email, '@', 1) from auth.users u
on conflict (id) do nothing;
update public.profili set uloga = 'ADMIN'
where id = (select p.id from public.profili p join auth.users u on u.id = p.id order by u.created_at limit 1)
  and not exists (select 1 from public.profili where uloga = 'ADMIN');

-- Uvek mora ostati bar jedan aktivan administrator.
create or replace function public.tms_zastita_admina() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profili where uloga = 'ADMIN' and aktivan) then
    raise exception 'Mora ostati bar jedan aktivan administrator.';
  end if;
  return null;
end $$;
drop trigger if exists tms_zastita_admina on public.profili;
create trigger tms_zastita_admina after update on public.profili
  for each statement execute function public.tms_zastita_admina();

create or replace function public.tms_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------------
-- 2. ŠIFARNICI I NAŠE FIRME
-- ---------------------------------------------------------------------
create table if not exists public.firme (
  id               uuid primary key default gen_random_uuid(),
  kod              text not null unique,
  naziv            text not null,
  adresa           text, postanski_broj text, mesto text, drzava text,
  pib              text, maticni_broj text, pdv_broj text,
  iban             text, banka text, swift text,
  email            text, telefon text, web text,
  odgovorno_lice   text,
  napomena_faktura text,            -- tekst u podnožju svake fakture
  aktivna          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Jedna tabela za sve padajuće liste. "kod" se ne menja posle unosa.
create table if not exists public.sifarnici (
  id        uuid primary key default gen_random_uuid(),
  grupa     text not null,
  kod       text not null,
  naziv     text not null,
  vrednost  numeric,                -- npr. dana upozorenja, kurs, PDV stopa, znak +1/-1
  oznaka    text,                   -- npr. prefiks broja fakture, tekst na fakturi
  redosled  int not null default 100,
  aktivan   boolean not null default true,
  unique (grupa, kod)
);

-- ---------------------------------------------------------------------
-- 3. PARTNERI (nalogodavci i klijenti – fizička i pravna lica)
-- ---------------------------------------------------------------------
create table if not exists public.partneri (
  id               uuid primary key default gen_random_uuid(),
  tip              text not null default 'PRAVNO' check (tip in ('PRAVNO','FIZICKO')),
  naziv            text not null,   -- naziv firme ili ime i prezime
  pib              text, maticni_broj text,
  pdv_obveznik     boolean not null default false,
  adresa           text, postanski_broj text, mesto text, drzava text,
  email            text, email_fakture text, telefon text, iban text,
  rok_placanja     int not null default 15 check (rok_placanja between 0 and 365),
  valuta           text not null default 'EUR',
  interna_firma_id uuid references public.firme(id),   -- popunjeno = partner je naša firma
  napomena         text,
  aktivan          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid default auth.uid()
);
create unique index if not exists partneri_pib_uk
  on public.partneri (lower(regexp_replace(pib, '\s', '', 'g')))
  where pib is not null and btrim(pib) <> '';
create index if not exists partneri_naziv_ix on public.partneri (lower(naziv));

create table if not exists public.partner_kontakti (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partneri(id) on delete cascade,
  ime         text not null,
  funkcija    text, telefon text, email text,
  za_naplatu  boolean not null default false,
  napomena    text,
  created_at  timestamptz not null default now()
);
create index if not exists partner_kontakti_partner_ix on public.partner_kontakti (partner_id);

-- ---------------------------------------------------------------------
-- 4. VOZNI PARK, VOZAČI, ROKOVI (alarmi) I DOKUMENTI
-- ---------------------------------------------------------------------
create table if not exists public.vozila (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid references public.firme(id),
  registracija  text not null,
  tip           text,
  marka         text, model text, godiste int, vin text,
  kapacitet     int,                -- broj vozila koja može da preveze
  aktivno       boolean not null default true,
  napomena      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists vozila_reg_uk
  on public.vozila (upper(regexp_replace(registracija, '[\s-]', '', 'g')));

create table if not exists public.vozaci (
  id               uuid primary key default gen_random_uuid(),
  firma_id         uuid references public.firme(id),
  ime              text not null,
  prezime          text not null,
  telefon          text, email text,
  datum_zaposlenja date,
  aktivan          boolean not null default true,
  napomena         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.rokovi (
  id              uuid primary key default gen_random_uuid(),
  entitet         text not null check (entitet in ('VOZILO','VOZAC')),
  entitet_id      uuid not null,
  vrsta           text not null,     -- šifarnik ROK_VOZILO / ROK_VOZAC
  datum_isteka    date not null,
  broj_dokumenta  text,
  napomena        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (entitet, entitet_id, vrsta)
);

create table if not exists public.dokumenti (
  id          uuid primary key default gen_random_uuid(),
  entitet     text not null check (entitet in ('VOZILO','VOZAC','PARTNER','TURA','NALOG','FAKTURA')),
  entitet_id  uuid not null,
  vrsta       text,
  naziv       text not null,
  putanja     text not null unique,  -- putanja u Storage bucket-u "dokumenti"
  velicina    bigint, mime text, napomena text,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
create index if not exists dokumenti_ent_ix on public.dokumenti (entitet, entitet_id);

-- ---------------------------------------------------------------------
-- 5. BROJAČI (redni brojevi bez rupa, po firmi i godini)
-- ---------------------------------------------------------------------
create table if not exists public.brojaci (
  firma_id   uuid not null references public.firme(id),
  vrsta      text not null,          -- TURE, NALOZI, FAKTURA:<tip>
  godina     int  not null,
  poslednji  int  not null default 0,
  primary key (firma_id, vrsta, godina)
);

create or replace function public.sledeci_broj(p_firma uuid, p_vrsta text, p_godina int) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into public.brojaci (firma_id, vrsta, godina, poslednji) values (p_firma, p_vrsta, p_godina, 1)
  on conflict (firma_id, vrsta, godina) do update set poslednji = public.brojaci.poslednji + 1
  returning poslednji into v;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- 6. TURE, NALOZI, STAVKE (prihodi), TROŠKOVI, OBRAČUN VOZAČA
-- ---------------------------------------------------------------------
create table if not exists public.ture (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null references public.firme(id),
  godina        int, broj_seq int, broj text,
  vozilo_id     uuid references public.vozila(id),
  prikolica_id  uuid references public.vozila(id),
  vozac_id      uuid references public.vozaci(id),
  vozac2_id     uuid references public.vozaci(id),
  datum_od      date, datum_do date,
  km_pocetak    int, km_kraj int,
  relacija      text,
  status        text not null default 'PLAN',
  napomena      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  unique (firma_id, godina, broj_seq)
);
create index if not exists ture_datum_ix on public.ture (datum_od);

create table if not exists public.nalozi (
  id              uuid primary key default gen_random_uuid(),
  firma_id        uuid not null references public.firme(id),   -- naša firma koja fakturiše
  tura_id         uuid references public.ture(id) on delete set null,
  godina          int, broj_seq int, broj text,
  nalogodavac_id  uuid not null references public.partneri(id), -- plaća prevoz (zaduženje)
  klijent_id      uuid not null references public.partneri(id), -- na njega glasi faktura
  ref_klijenta    text,                                         -- broj naloga/porudžbine nalogodavca
  datum_utovara   date, mesto_utovara text,
  datum_istovara  date, mesto_istovara text,
  opis_tereta     text,                                         -- npr. VIN brojevi
  status          text not null default 'NOV',
  napomena        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  unique (firma_id, godina, broj_seq)
);
create index if not exists nalozi_tura_ix on public.nalozi (tura_id);
create index if not exists nalozi_nalogodavac_ix on public.nalozi (nalogodavac_id);
create index if not exists nalozi_klijent_ix on public.nalozi (klijent_id);

create table if not exists public.fakture (
  id               uuid primary key default gen_random_uuid(),
  firma_id         uuid not null references public.firme(id),
  tip              text not null,                    -- šifarnik TIP_FAKTURE
  godina           int  not null,
  broj_seq         int  not null,
  broj             text not null,
  klijent_id       uuid not null references public.partneri(id),
  nalogodavac_id   uuid references public.partneri(id),
  izdavalac        jsonb,                            -- snimak podataka naše firme
  kupac            jsonb,                            -- snimak podataka kupca
  datum_izdavanja  date not null,
  datum_prometa    date,
  datum_dospeca    date not null,
  valuta           text not null,
  kurs             numeric(14,6) not null default 1 check (kurs > 0),  -- 1 EUR = kurs × valuta
  osnovica         numeric(14,2) not null default 0,
  pdv              numeric(14,2) not null default 0,
  ukupno           numeric(14,2) not null default 0,
  napomena         text,
  sef_broj         text,                             -- ID iz SEF-a / e-računa
  status           text not null default 'IZDATA' check (status in ('IZDATA','STORNO')),
  storno_datum     date, storno_razlog text,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  unique (firma_id, tip, godina, broj_seq)
);
create index if not exists fakture_klijent_ix on public.fakture (klijent_id);
create index if not exists fakture_nalogodavac_ix on public.fakture (nalogodavac_id);
create index if not exists fakture_datum_ix on public.fakture (datum_izdavanja);

create table if not exists public.nalog_stavke (
  id           uuid primary key default gen_random_uuid(),
  nalog_id     uuid not null references public.nalozi(id) on delete cascade,
  rb           int not null default 1,
  opis         text not null,
  kolicina     numeric(14,3) not null default 1,
  jedinica     text,
  cena         numeric(14,2) not null default 0,       -- bez PDV
  valuta       text not null default 'EUR',
  kurs         numeric(14,6) not null default 1 check (kurs > 0),
  pdv_stopa    numeric(5,2) not null default 0,
  tip_fakture  text not null default 'DOMACA',
  klijent_id   uuid references public.partneri(id),   -- prazno = klijent sa naloga
  faktura_id   uuid references public.fakture(id),
  iznos        numeric(14,2) generated always as (round(kolicina * cena, 2)) stored,
  iznos_eur    numeric(14,2) generated always as (round(kolicina * cena / kurs, 2)) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists nalog_stavke_nalog_ix on public.nalog_stavke (nalog_id);
create index if not exists nalog_stavke_faktura_ix on public.nalog_stavke (faktura_id);

create table if not exists public.faktura_stavke (
  id               uuid primary key default gen_random_uuid(),
  faktura_id       uuid not null references public.fakture(id) on delete cascade,
  rb               int not null,
  nalog_id         uuid references public.nalozi(id) on delete set null,
  nalog_stavka_id  uuid,
  opis             text not null,
  detalji          text,             -- broj naloga, relacija, teret (snimak)
  kolicina         numeric(14,3), jedinica text,
  cena             numeric(14,2), pdv_stopa numeric(5,2),
  osnovica         numeric(14,2), pdv numeric(14,2), ukupno numeric(14,2)
);
create index if not exists faktura_stavke_f_ix on public.faktura_stavke (faktura_id);

create table if not exists public.naplate (
  id          uuid primary key default gen_random_uuid(),
  faktura_id  uuid not null references public.fakture(id),
  datum       date not null default current_date,
  iznos       numeric(14,2) not null check (iznos <> 0),  -- u valuti fakture
  napomena    text,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
create index if not exists naplate_f_ix on public.naplate (faktura_id);

create table if not exists public.tura_troskovi (
  id              uuid primary key default gen_random_uuid(),
  tura_id         uuid not null references public.ture(id) on delete cascade,
  nalog_id        uuid references public.nalozi(id) on delete set null,
  datum           date not null default current_date,
  vrsta           text not null,                 -- šifarnik VRSTA_TROSKA
  opis            text,
  iznos           numeric(14,2) not null,
  valuta          text not null default 'EUR',
  kurs            numeric(14,6) not null default 1 check (kurs > 0),
  iznos_eur       numeric(14,2) generated always as (round(iznos / kurs, 2)) stored,
  nacin_placanja  text,                          -- šifarnik NACIN_PLACANJA
  vozac_id        uuid references public.vozaci(id),
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid()
);
create index if not exists tura_troskovi_tura_ix on public.tura_troskovi (tura_id);

create table if not exists public.obracun_vozaca (
  id          uuid primary key default gen_random_uuid(),
  vozac_id    uuid not null references public.vozaci(id),
  tura_id     uuid references public.ture(id) on delete set null,
  datum       date not null default current_date,
  vrsta       text not null,                     -- šifarnik VRSTA_OBRACUNA
  opis        text,
  kolicina    numeric(10,2) not null default 1,
  iznos_jed   numeric(14,2) not null,
  valuta      text not null default 'EUR',
  kurs        numeric(14,6) not null default 1 check (kurs > 0),
  znak        smallint not null default 1,       -- +1 isplata, -1 odbitak (iz šifarnika)
  u_trosak    boolean not null default true,     -- ulazi u trošak ture (iz šifarnika)
  iznos       numeric(14,2) generated always as (round(kolicina * iznos_jed, 2)) stored,
  iznos_eur   numeric(14,2) generated always as (round(kolicina * iznos_jed / kurs, 2)) stored,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
create index if not exists obracun_vozac_ix on public.obracun_vozaca (vozac_id, datum);

-- ---------------------------------------------------------------------
-- 7. OKIDAČI (automatika i zaštite)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['firme','partneri','vozila','vozaci','rokovi','ture','nalozi','nalog_stavke'] loop
    execute format('drop trigger if exists tms_upd on public.%I', t);
    execute format('create trigger tms_upd before update on public.%I for each row execute function public.tms_updated_at()', t);
  end loop;
end $$;

-- Broj ture / naloga: npr. BT-T0001/2026, BT-N0001/2026. Broj i firma se kasnije ne menjaju.
create or replace function public.tms_dodeli_broj() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_kod text; v_pref text;
begin
  if tg_op = 'UPDATE' then
    if new.firma_id is distinct from old.firma_id then
      raise exception 'Firma se ne može promeniti posle kreiranja (broj je već dodeljen).';
    end if;
    new.godina := old.godina; new.broj_seq := old.broj_seq; new.broj := old.broj;
    return new;
  end if;
  select kod into v_kod from public.firme where id = new.firma_id;
  if v_kod is null then raise exception 'Izaberite firmu.'; end if;
  v_pref := case tg_table_name when 'ture' then 'T' else 'N' end;
  new.godina   := extract(year from current_date)::int;
  new.broj_seq := public.sledeci_broj(new.firma_id, upper(tg_table_name), new.godina);
  new.broj     := v_kod || '-' || v_pref || lpad(new.broj_seq::text, 4, '0') || '/' || new.godina;
  return new;
end $$;
drop trigger if exists tms_broj on public.ture;
create trigger tms_broj before insert or update on public.ture for each row execute function public.tms_dodeli_broj();
drop trigger if exists tms_broj on public.nalozi;
create trigger tms_broj before insert or update on public.nalozi for each row execute function public.tms_dodeli_broj();

-- Fakturisana stavka naloga se ne može menjati ni brisati (samo kroz storno fakture).
create or replace function public.tms_zastita_stavke() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.faktura_id is not null then
      raise exception 'Stavka je već fakturisana i ne može se obrisati. Prvo stornirajte fakturu.';
    end if;
    return old;
  end if;
  if old.faktura_id is not null and new.faktura_id is not null and
     (new.nalog_id, new.opis, new.kolicina, new.jedinica, new.cena, new.valuta, new.kurs,
      new.pdv_stopa, new.tip_fakture, new.klijent_id, new.faktura_id)
     is distinct from
     (old.nalog_id, old.opis, old.kolicina, old.jedinica, old.cena, old.valuta, old.kurs,
      old.pdv_stopa, old.tip_fakture, old.klijent_id, old.faktura_id) then
    raise exception 'Stavka je već fakturisana i ne može se menjati. Prvo stornirajte fakturu.';
  end if;
  return new;
end $$;
drop trigger if exists tms_zastita on public.nalog_stavke;
create trigger tms_zastita before update or delete on public.nalog_stavke
  for each row execute function public.tms_zastita_stavke();

-- Brisanjem vozila/vozača/partnera/ture/naloga brišu se i njihovi rokovi i zapisi o dokumentima.
create or replace function public.tms_ocisti_vezane() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ent text := case tg_table_name
  when 'vozila' then 'VOZILO' when 'vozaci' then 'VOZAC' when 'partneri' then 'PARTNER'
  when 'ture' then 'TURA' when 'nalozi' then 'NALOG' end;
begin
  delete from public.rokovi    where entitet = v_ent and entitet_id = old.id;
  delete from public.dokumenti where entitet = v_ent and entitet_id = old.id;
  return old;
end $$;
do $$
declare t text;
begin
  foreach t in array array['vozila','vozaci','partneri','ture','nalozi'] loop
    execute format('drop trigger if exists tms_ocisti on public.%I', t);
    execute format('create trigger tms_ocisti after delete on public.%I for each row execute function public.tms_ocisti_vezane()', t);
  end loop;
end $$;

-- Obračun vozača: znak (+/-) i "ulazi u trošak ture" preuzimaju se iz šifarnika pri unosu.
create or replace function public.tms_obracun_znak() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if tg_op = 'INSERT' or new.vrsta is distinct from old.vrsta then
    select vrednost, oznaka into s from public.sifarnici where grupa = 'VRSTA_OBRACUNA' and kod = new.vrsta;
    if not found then raise exception 'Nepoznata vrsta obračuna: %', new.vrsta; end if;
    new.znak     := case when coalesce(s.vrednost, 1) < 0 then -1 else 1 end;
    new.u_trosak := coalesce(upper(s.oznaka) like '%TROSAK%', false);
  end if;
  return new;
end $$;
drop trigger if exists tms_znak on public.obracun_vozaca;
create trigger tms_znak before insert or update on public.obracun_vozaca
  for each row execute function public.tms_obracun_znak();

-- Uplate: ne na storniranu fakturu i ne preko iznosa fakture.
create or replace function public.tms_provera_naplate() returns trigger
language plpgsql security definer set search_path = public as $$
declare f record; v_sum numeric;
begin
  select ukupno, status, broj into f from public.fakture where id = new.faktura_id;
  if f.status = 'STORNO' then
    raise exception 'Faktura % je stornirana – uplata nije moguća.', f.broj;
  end if;
  select coalesce(sum(iznos), 0) into v_sum from public.naplate where faktura_id = new.faktura_id;
  if v_sum > f.ukupno + 0.01 then
    raise exception 'Uplate ukupno (%) prelaze iznos fakture % (%).', v_sum, f.broj, f.ukupno;
  end if;
  return null;
end $$;
drop trigger if exists tms_provera on public.naplate;
create trigger tms_provera after insert or update on public.naplate
  for each row execute function public.tms_provera_naplate();

-- ---------------------------------------------------------------------
-- 8. PREGLEDI (views) – poštuju prava korisnika (security_invoker)
-- ---------------------------------------------------------------------
drop view if exists public.v_alarmi;
create view public.v_alarmi with (security_invoker = true) as
select r.id, r.entitet, r.entitet_id, r.vrsta,
       coalesce(s.naziv, r.vrsta)               as vrsta_naziv,
       r.datum_isteka, r.broj_dokumenta, r.napomena,
       coalesce(s.vrednost, 30)::int            as dana_upozorenja,
       (r.datum_isteka - current_date)          as dana_do_isteka,
       case when r.datum_isteka < current_date then 'ISTEKAO'
            when r.datum_isteka - current_date <= coalesce(s.vrednost, 30) then 'USKORO'
            else 'OK' end                       as status,
       case r.entitet when 'VOZILO' then v.registracija
                      else d.ime || ' ' || d.prezime end as naziv,
       coalesce(v.aktivno, d.aktivan, true)     as aktivan
from public.rokovi r
left join public.sifarnici s on s.grupa = case r.entitet when 'VOZILO' then 'ROK_VOZILO' else 'ROK_VOZAC' end
                            and s.kod = r.vrsta
left join public.vozila v on r.entitet = 'VOZILO' and v.id = r.entitet_id
left join public.vozaci d on r.entitet = 'VOZAC'  and d.id = r.entitet_id;

drop view if exists public.v_fakture;
create view public.v_fakture with (security_invoker = true) as
select f.*, fi.kod as firma_kod, k.naziv as klijent_naziv, n.naziv as nalogodavac_naziv,
       coalesce(p.placeno, 0) as placeno,
       p.poslednja_uplata,
       case when f.status = 'STORNO' then 0 else f.ukupno - coalesce(p.placeno, 0) end as saldo,
       case when f.status = 'STORNO' then 'STORNO'
            when f.ukupno - coalesce(p.placeno, 0) <= 0.005 then 'PLACENA'
            when coalesce(p.placeno, 0) > 0 then 'DELIMICNO'
            else 'NEPLACENA' end as status_placanja,
       case when f.status = 'IZDATA' and f.ukupno - coalesce(p.placeno, 0) > 0.005
            then greatest(current_date - f.datum_dospeca, 0) else 0 end as dana_kasnjenja,
       round(f.ukupno / f.kurs, 2) as ukupno_eur,
       round((case when f.status = 'STORNO' then 0 else f.ukupno - coalesce(p.placeno, 0) end) / f.kurs, 2) as saldo_eur,
       coalesce(sif.kod = 'INTERNA', false) as interna
from public.fakture f
join public.firme fi on fi.id = f.firma_id
left join public.partneri k on k.id = f.klijent_id
left join public.partneri n on n.id = f.nalogodavac_id
left join public.sifarnici sif on sif.grupa = 'TIP_FAKTURE' and sif.kod = f.tip
left join (select faktura_id, sum(iznos) as placeno, max(datum) as poslednja_uplata
           from public.naplate group by faktura_id) p on p.faktura_id = f.id;

drop view if exists public.v_nalozi;
create view public.v_nalozi with (security_invoker = true) as
select n.*, fi.kod as firma_kod, ng.naziv as nalogodavac_naziv, kl.naziv as klijent_naziv, t.broj as tura_broj,
       coalesce(s.stavki, 0) as stavki,
       coalesce(s.fakt, 0) as fakturisano_stavki,
       coalesce(s.iznos_eur, 0) as iznos_eur,
       coalesce(s.nefakt_eur, 0) as nefakturisano_eur,
       case when coalesce(s.stavki, 0) = 0 then 'BEZ_STAVKI'
            when s.fakt = 0 then 'NE'
            when s.fakt < s.stavki then 'DELIMICNO'
            else 'DA' end as fakturisano
from public.nalozi n
join public.firme fi on fi.id = n.firma_id
left join public.partneri ng on ng.id = n.nalogodavac_id
left join public.partneri kl on kl.id = n.klijent_id
left join public.ture t on t.id = n.tura_id
left join (select nalog_id, count(*) as stavki, count(faktura_id) as fakt,
                  sum(iznos_eur) as iznos_eur,
                  sum(iznos_eur) filter (where faktura_id is null) as nefakt_eur
           from public.nalog_stavke group by nalog_id) s on s.nalog_id = n.id;

drop view if exists public.v_ture;
create view public.v_ture with (security_invoker = true) as
select t.*, fi.kod as firma_kod,
       v.registracija, p.registracija as prikolica_registracija,
       d.ime || ' ' || d.prezime as vozac,
       d2.ime || ' ' || d2.prezime as vozac2,
       case when t.km_kraj >= t.km_pocetak then t.km_kraj - t.km_pocetak end as km,
       coalesce(pr.naloga, 0) as naloga,
       coalesce(pr.prihod_eur, 0) as prihod_eur,
       coalesce(tr.troskovi_eur, 0) as troskovi_eur,
       coalesce(ob.vozac_eur, 0) as vozac_eur,
       coalesce(pr.prihod_eur, 0) - coalesce(tr.troskovi_eur, 0) - coalesce(ob.vozac_eur, 0) as rezultat_eur
from public.ture t
join public.firme fi on fi.id = t.firma_id
left join public.vozila v  on v.id = t.vozilo_id
left join public.vozila p  on p.id = t.prikolica_id
left join public.vozaci d  on d.id = t.vozac_id
left join public.vozaci d2 on d2.id = t.vozac2_id
left join (select n.tura_id, count(distinct n.id) as naloga, coalesce(sum(s.iznos_eur), 0) as prihod_eur
           from public.nalozi n left join public.nalog_stavke s on s.nalog_id = n.id
           where n.tura_id is not null group by n.tura_id) pr on pr.tura_id = t.id
left join (select tura_id, sum(iznos_eur) as troskovi_eur
           from public.tura_troskovi group by tura_id) tr on tr.tura_id = t.id
left join (select tura_id, sum(znak * iznos_eur) filter (where u_trosak) as vozac_eur
           from public.obracun_vozaca where tura_id is not null group by tura_id) ob on ob.tura_id = t.id;

-- ---------------------------------------------------------------------
-- 9. POSLOVNE FUNKCIJE (pozivaju se iz aplikacije jednim klikom)
-- ---------------------------------------------------------------------
-- Izdaje fakture za sve NEFAKTURISANE stavke izabranih naloga.
-- Jedna faktura = ista firma + tip fakture + klijent + nalogodavac + valuta
-- (+ isti nalog, osim ako je p_grupno = true). Zaduženje ide na nalogodavca.
create or replace function public.izdaj_fakture(
  p_nalozi        uuid[],
  p_grupno        boolean default false,
  p_datum         date    default current_date,
  p_datum_prometa date    default null,
  p_napomena      text    default null)
returns table (r_id uuid, r_broj text, r_klijent text, r_valuta text, r_ukupno numeric)
language plpgsql security definer set search_path = public as $$
declare
  g record; red record;
  v_f uuid; v_seq int; v_god int; v_ozn text; v_kurs numeric; v_broj text;
  v_k public.partneri%rowtype; v_fi public.firme%rowtype;
  v_rb int; v_os numeric; v_pdv numeric;
begin
  if coalesce(public.moja_uloga(), '') not in ('ADMIN','FINANSIJE') then
    raise exception 'Nemate pravo da izdajete fakture.';
  end if;
  if p_nalozi is null or coalesce(array_length(p_nalozi, 1), 0) = 0 then
    raise exception 'Niste izabrali nijedan nalog.';
  end if;
  p_datum := coalesce(p_datum, current_date);
  v_god := extract(year from p_datum)::int;

  perform 1 from public.nalog_stavke
   where nalog_id = any(p_nalozi) and faktura_id is null for update;
  if not found then
    raise exception 'Izabrani nalozi nemaju nefakturisanih stavki.';
  end if;

  for g in
    select n.firma_id, s.tip_fakture as tip, coalesce(s.klijent_id, n.klijent_id) as klijent_id,
           n.nalogodavac_id, s.valuta,
           case when p_grupno then null else n.id end as nalog_grp,
           max(s.kurs) as kurs_st, max(n.datum_istovara) as max_istovar,
           sum(round(s.kolicina * s.cena, 2)) as osnovica,
           sum(round(round(s.kolicina * s.cena, 2) * s.pdv_stopa / 100, 2)) as pdv
    from public.nalog_stavke s
    join public.nalozi n on n.id = s.nalog_id
    where n.id = any(p_nalozi) and s.faktura_id is null
    group by 1, 2, 3, 4, 5, 6
    order by min(n.broj), 2, 3, 5
  loop
    select * into v_k  from public.partneri where id = g.klijent_id;
    select * into v_fi from public.firme    where id = g.firma_id;
    select coalesce(nullif(btrim(oznaka), ''), kod) into v_ozn
      from public.sifarnici where grupa = 'TIP_FAKTURE' and kod = g.tip;
    if v_ozn is null then
      raise exception 'Tip fakture "%" ne postoji u šifarniku TIP_FAKTURE.', g.tip;
    end if;
    v_kurs := null;
    select vrednost into v_kurs from public.sifarnici
     where grupa = 'VALUTA' and kod = g.valuta and vrednost > 0;
    v_kurs := case when g.valuta = 'EUR' then 1 else coalesce(v_kurs, g.kurs_st, 1) end;

    v_seq  := public.sledeci_broj(g.firma_id, 'FAKTURA:' || g.tip, v_god);
    v_broj := v_ozn || '-' || lpad(v_seq::text, 4, '0') || '/' || v_god;

    insert into public.fakture (firma_id, tip, godina, broj_seq, broj, klijent_id, nalogodavac_id,
                                izdavalac, kupac, datum_izdavanja, datum_prometa, datum_dospeca,
                                valuta, kurs, osnovica, pdv, ukupno, napomena)
    values (g.firma_id, g.tip, v_god, v_seq, v_broj, g.klijent_id, g.nalogodavac_id,
            to_jsonb(v_fi) - 'id' - 'created_at' - 'updated_at' - 'aktivna',
            to_jsonb(v_k)  - 'id' - 'created_at' - 'updated_at' - 'created_by' - 'aktivan' - 'napomena',
            p_datum, coalesce(p_datum_prometa, g.max_istovar, p_datum),
            p_datum + coalesce(v_k.rok_placanja, 15),
            g.valuta, v_kurs, g.osnovica, g.pdv, g.osnovica + g.pdv, p_napomena)
    returning id into v_f;

    v_rb := 0;
    for red in
      select st.*, n.broj as n_broj, n.ref_klijenta, n.mesto_utovara, n.mesto_istovara, n.opis_tereta
      from public.nalog_stavke st
      join public.nalozi n on n.id = st.nalog_id
      where n.id = any(p_nalozi) and st.faktura_id is null
        and n.firma_id = g.firma_id and st.tip_fakture = g.tip
        and coalesce(st.klijent_id, n.klijent_id) = g.klijent_id
        and n.nalogodavac_id = g.nalogodavac_id and st.valuta = g.valuta
        and (g.nalog_grp is null or n.id = g.nalog_grp)
      order by n.broj, st.rb, st.created_at
    loop
      v_rb  := v_rb + 1;
      v_os  := round(red.kolicina * red.cena, 2);
      v_pdv := round(v_os * red.pdv_stopa / 100, 2);
      insert into public.faktura_stavke (faktura_id, rb, nalog_id, nalog_stavka_id, opis, detalji,
                                         kolicina, jedinica, cena, pdv_stopa, osnovica, pdv, ukupno)
      values (v_f, v_rb, red.nalog_id, red.id, red.opis,
              concat_ws(' · ', 'Nalog ' || red.n_broj,
                               'ref. ' || nullif(btrim(red.ref_klijenta), ''),
                               nullif(concat_ws(' – ', red.mesto_utovara, red.mesto_istovara), ''),
                               nullif(btrim(red.opis_tereta), '')),
              red.kolicina, red.jedinica, red.cena, red.pdv_stopa, v_os, v_pdv, v_os + v_pdv);
      update public.nalog_stavke set faktura_id = v_f where id = red.id;
    end loop;

    r_id := v_f; r_broj := v_broj; r_klijent := v_k.naziv; r_valuta := g.valuta; r_ukupno := g.osnovica + g.pdv;
    return next;
  end loop;
end $$;

-- Storno: broj ostaje zauzet (bez rupa u numeraciji), stavke naloga se oslobađaju za novu fakturu.
create or replace function public.storniraj_fakturu(p_faktura uuid, p_razlog text)
returns text language plpgsql security definer set search_path = public as $$
declare f record;
begin
  if coalesce(public.moja_uloga(), '') not in ('ADMIN','FINANSIJE') then
    raise exception 'Nemate pravo da stornirate fakture.';
  end if;
  if coalesce(btrim(p_razlog), '') = '' then raise exception 'Upišite razlog storniranja.'; end if;
  select * into f from public.fakture where id = p_faktura for update;
  if not found then raise exception 'Faktura ne postoji.'; end if;
  if f.status = 'STORNO' then raise exception 'Faktura % je već stornirana.', f.broj; end if;
  if exists (select 1 from public.naplate where faktura_id = p_faktura) then
    raise exception 'Faktura % ima evidentirane uplate. Prvo obrišite uplate.', f.broj;
  end if;
  update public.fakture
     set status = 'STORNO', storno_datum = current_date, storno_razlog = p_razlog
   where id = p_faktura;
  update public.nalog_stavke set faktura_id = null where faktura_id = p_faktura;
  return f.broj;
end $$;

-- Grupno "plaćeno": za svaku izabranu fakturu upisuje uplatu u visini preostalog duga.
create or replace function public.oznaci_placeno(p_fakture uuid[], p_datum date default current_date, p_napomena text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if coalesce(public.moja_uloga(), '') not in ('ADMIN','FINANSIJE') then
    raise exception 'Nemate pravo da evidentirate naplatu.';
  end if;
  insert into public.naplate (faktura_id, datum, iznos, napomena)
  select f.id, coalesce(p_datum, current_date),
         f.ukupno - coalesce((select sum(n.iznos) from public.naplate n where n.faktura_id = f.id), 0),
         p_napomena
  from public.fakture f
  where f.id = any(p_fakture) and f.status = 'IZDATA'
    and f.ukupno - coalesce((select sum(n.iznos) from public.naplate n where n.faktura_id = f.id), 0) > 0.005;
  get diagnostics v = row_count;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- 10. PRAVA PRISTUPA (RLS) – ADMIN sve; DISPEČER nalozi/ture; FINANSIJE + troškovi, fakture, naplata
-- ---------------------------------------------------------------------
do $$
declare r record;
  sve constant text := '{ADMIN,DISPECER,FINANSIJE}';
begin
  for r in select * from (values
    -- tabela            čitanje                  unos/izmena               brisanje
    ('firme',            sve,                     '{ADMIN}',                '{ADMIN}'),
    ('sifarnici',        sve,                     '{ADMIN}',                '{ADMIN}'),
    ('partneri',         sve,                     sve,                      '{ADMIN}'),
    ('partner_kontakti', sve,                     sve,                      sve),
    ('vozila',           sve,                     '{ADMIN}',                '{ADMIN}'),
    ('vozaci',           sve,                     '{ADMIN}',                '{ADMIN}'),
    ('rokovi',           sve,                     '{ADMIN}',                '{ADMIN}'),
    ('dokumenti',        sve,                     sve,                      '{ADMIN,FINANSIJE}'),
    ('ture',             sve,                     sve,                      sve),
    ('nalozi',           sve,                     sve,                      sve),
    ('nalog_stavke',     sve,                     sve,                      sve),
    ('tura_troskovi',    sve,                     '{ADMIN,FINANSIJE}',      '{ADMIN,FINANSIJE}'),
    ('obracun_vozaca',   '{ADMIN,FINANSIJE}',     '{ADMIN,FINANSIJE}',      '{ADMIN,FINANSIJE}'),
    ('fakture',          sve,                     '{ADMIN,FINANSIJE}',      '{}'),
    ('faktura_stavke',   sve,                     '{ADMIN,FINANSIJE}',      '{}'),
    ('naplate',          '{ADMIN,FINANSIJE}',     '{ADMIN,FINANSIJE}',      '{ADMIN,FINANSIJE}')
  ) as x(tabela, citanje, pisanje, brisanje)
  loop
    execute format('alter table public.%I enable row level security', r.tabela);
    execute format('drop policy if exists tms_citanje on public.%I', r.tabela);
    execute format('create policy tms_citanje on public.%I for select to authenticated using ((select public.moja_uloga()) = any (%L::text[]))', r.tabela, r.citanje);
    execute format('drop policy if exists tms_unos on public.%I', r.tabela);
    execute format('create policy tms_unos on public.%I for insert to authenticated with check ((select public.moja_uloga()) = any (%L::text[]))', r.tabela, r.pisanje);
    execute format('drop policy if exists tms_izmena on public.%I', r.tabela);
    execute format('create policy tms_izmena on public.%I for update to authenticated using ((select public.moja_uloga()) = any (%L::text[])) with check ((select public.moja_uloga()) = any (%L::text[]))', r.tabela, r.pisanje, r.pisanje);
    execute format('drop policy if exists tms_brisanje on public.%I', r.tabela);
    execute format('create policy tms_brisanje on public.%I for delete to authenticated using ((select public.moja_uloga()) = any (%L::text[]))', r.tabela, r.brisanje);
  end loop;
end $$;

alter table public.profili enable row level security;
drop policy if exists tms_profil_citanje on public.profili;
create policy tms_profil_citanje on public.profili for select to authenticated
  using (id = auth.uid() or (select public.moja_uloga()) = 'ADMIN');
drop policy if exists tms_profil_izmena on public.profili;
create policy tms_profil_izmena on public.profili for update to authenticated
  using ((select public.moja_uloga()) = 'ADMIN') with check ((select public.moja_uloga()) = 'ADMIN');

alter table public.brojaci enable row level security;   -- bez pravila = nedostupno spolja

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on public.brojaci from authenticated;
-- Fakture i stavke faktura nastaju i menjaju se samo kroz funkcije (izdavanje, storno).
revoke insert, update, delete on public.fakture, public.faktura_stavke from authenticated;
grant update (napomena, sef_broj, datum_dospeca) on public.fakture to authenticated;
-- Veza stavke sa fakturom (faktura_id) menja se samo kroz funkcije.
revoke insert, update on public.nalog_stavke from authenticated;
grant insert (id, nalog_id, rb, opis, kolicina, jedinica, cena, valuta, kurs, pdv_stopa, tip_fakture, klijent_id)
  on public.nalog_stavke to authenticated;
grant update (rb, opis, kolicina, jedinica, cena, valuta, kurs, pdv_stopa, tip_fakture, klijent_id)
  on public.nalog_stavke to authenticated;
-- Profile pravi sistem; admin menja samo ime, ulogu i status.
revoke insert, update, delete on public.profili from authenticated;
grant update (ime, uloga, aktivan) on public.profili to authenticated;

revoke execute on function public.sledeci_broj(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.izdaj_fakture(uuid[], boolean, date, date, text) from public, anon;
revoke execute on function public.storniraj_fakturu(uuid, text) from public, anon;
revoke execute on function public.oznaci_placeno(uuid[], date, text) from public, anon;
grant execute on function public.moja_uloga() to authenticated;
grant execute on function public.izdaj_fakture(uuid[], boolean, date, date, text) to authenticated;
grant execute on function public.storniraj_fakturu(uuid, text) to authenticated;
grant execute on function public.oznaci_placeno(uuid[], date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 11. SKLADIŠTE DOKUMENATA (Supabase Storage, privatni bucket, do 20 MB po fajlu)
-- ---------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit)
  values ('dokumenti', 'dokumenti', false, 20971520)
  on conflict (id) do nothing;
  drop policy if exists tms_dok_citanje on storage.objects;
  create policy tms_dok_citanje on storage.objects for select to authenticated
    using (bucket_id = 'dokumenti' and (select public.moja_uloga()) is not null);
  drop policy if exists tms_dok_unos on storage.objects;
  create policy tms_dok_unos on storage.objects for insert to authenticated
    with check (bucket_id = 'dokumenti' and (select public.moja_uloga()) is not null);
  drop policy if exists tms_dok_brisanje on storage.objects;
  create policy tms_dok_brisanje on storage.objects for delete to authenticated
    using (bucket_id = 'dokumenti' and (select public.moja_uloga()) in ('ADMIN','FINANSIJE'));
exception when others then
  raise notice 'Skladište nije podešeno automatski (%). Pogledajte POCNI_OVDE.md, korak 3, napomena.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 12. POČETNI PODACI (dodaju se samo ako ne postoje; menjaju se u aplikaciji)
-- ---------------------------------------------------------------------
insert into public.firme (kod, naziv, drzava) values
  ('BA', 'BALKAN AVTO d.o.o.', 'Slovenija'),
  ('BT', 'BALKAN TRANSPORT d.o.o.', 'Srbija')
on conflict (kod) do nothing;

insert into public.sifarnici (grupa, kod, naziv, vrednost, oznaka, redosled) values
  ('TIP_VOZILA','TEGLJAC','Tegljač / kamion',null,null,10),
  ('TIP_VOZILA','AUTOTRANSPORTER','Autotransporter',null,null,20),
  ('TIP_VOZILA','PRIKOLICA','Prikolica / poluprikolica',null,null,30),
  ('TIP_VOZILA','KOMBI','Kombi / laka dostava',null,null,40),
  ('TIP_VOZILA','PUTNICKO','Putničko vozilo',null,null,50),
  ('ROK_VOZILO','REGISTRACIJA','Registracija',30,null,10),
  ('ROK_VOZILO','TEHNICKI','Tehnički pregled',30,null,20),
  ('ROK_VOZILO','OSIGURANJE_AO','Obavezno osiguranje (AO)',30,null,30),
  ('ROK_VOZILO','KASKO','Kasko osiguranje',30,null,40),
  ('ROK_VOZILO','CMR_POLISA','CMR polisa',30,null,50),
  ('ROK_VOZILO','TAHOGRAF','Baždarenje tahografa',30,null,60),
  ('ROK_VOZILO','PP_APARAT','PP aparat',30,null,70),
  ('ROK_VOZILO','LICENCA','Licenca / izvod licence',30,null,80),
  ('ROK_VOZILO','SERVIS','Redovan servis',15,null,90),
  ('ROK_VOZAC','VOZACKA','Vozačka dozvola',60,null,10),
  ('ROK_VOZAC','LEKARSKI','Lekarski pregled',30,null,20),
  ('ROK_VOZAC','TAHO_KARTICA','Kartica vozača (tahograf)',60,null,30),
  ('ROK_VOZAC','KOD95','Sertifikat CPC (kod 95)',60,null,40),
  ('ROK_VOZAC','PASOS','Pasoš',90,null,50),
  ('ROK_VOZAC','VIZA','Viza / radna dozvola',30,null,60),
  ('ROK_VOZAC','UGOVOR','Ugovor o radu',30,null,70),
  ('VRSTA_DOKUMENTA','SAOBRACAJNA','Saobraćajna dozvola',null,null,10),
  ('VRSTA_DOKUMENTA','POLISA','Polisa osiguranja',null,null,20),
  ('VRSTA_DOKUMENTA','ZAPISNIK','Zapisnik / atest',null,null,30),
  ('VRSTA_DOKUMENTA','LICNI','Lični dokument',null,null,40),
  ('VRSTA_DOKUMENTA','UGOVOR','Ugovor',null,null,50),
  ('VRSTA_DOKUMENTA','CMR','CMR / tovarni list',null,null,60),
  ('VRSTA_DOKUMENTA','RACUN','Račun / priznanica',null,null,70),
  ('VRSTA_DOKUMENTA','FOTO','Fotografija',null,null,80),
  ('VRSTA_DOKUMENTA','OSTALO','Ostalo',null,null,99),
  ('STATUS_TURE','PLAN','Planirana',null,null,10),
  ('STATUS_TURE','U_TOKU','U toku',null,null,20),
  ('STATUS_TURE','ZAVRSENA','Završena',null,null,30),
  ('STATUS_TURE','OBRACUNATA','Obračunata',null,null,40),
  ('STATUS_NALOGA','NOV','Nov',null,null,10),
  ('STATUS_NALOGA','UTOVAREN','Utovaren',null,null,20),
  ('STATUS_NALOGA','ISPORUCEN','Isporučen',null,null,30),
  ('STATUS_NALOGA','OTKAZAN','Otkazan',null,null,90),
  ('VRSTA_TROSKA','GORIVO','Gorivo',null,null,10),
  ('VRSTA_TROSKA','PUTARINA','Putarina / vinjeta',null,null,20),
  ('VRSTA_TROSKA','TRAJEKT','Trajekt / tunel',null,null,30),
  ('VRSTA_TROSKA','PARKING','Parking',null,null,40),
  ('VRSTA_TROSKA','SPEDICIJA','Špedicija / carina',null,null,50),
  ('VRSTA_TROSKA','SERVIS','Servis na putu',null,null,60),
  ('VRSTA_TROSKA','KAZNA','Kazna',null,null,70),
  ('VRSTA_TROSKA','PODIZVOZAC','Podizvođač (tuđi prevoz)',null,null,80),
  ('VRSTA_TROSKA','OSTALO','Ostalo',null,null,99),
  ('NACIN_PLACANJA','GOTOVINA_VOZAC','Gotovina – vozač',null,null,10),
  ('NACIN_PLACANJA','KARTICA_FIRME','Kartica firme',null,null,20),
  ('NACIN_PLACANJA','GORIVNA_KARTICA','Kartica za gorivo',null,null,30),
  ('NACIN_PLACANJA','VIRMAN','Virman (faktura dobavljača)',null,null,40),
  ('VRSTA_OBRACUNA','PLATA','Osnovna zarada',1,'TROSAK',10),
  ('VRSTA_OBRACUNA','DNEVNICA','Dnevnica',1,'TROSAK',20),
  ('VRSTA_OBRACUNA','BONUS','Bonus',1,'TROSAK',30),
  ('VRSTA_OBRACUNA','POVRACAJ','Povraćaj troškova plaćenih gotovinom',1,null,40),
  ('VRSTA_OBRACUNA','ODBITAK','Odbitak (šteta, kazna)',-1,'TROSAK',50),
  ('VRSTA_OBRACUNA','AKONTACIJA','Akontacija (već isplaćeno)',-1,null,60),
  ('TIP_FAKTURE','DOMACA','Faktura',null,'F',10),
  ('TIP_FAKTURE','INO','Faktura – inostranstvo',null,'IF',20),
  ('TIP_FAKTURE','INTERNA','Interna faktura (između naših firmi)',null,'INT',30),
  ('PDV_STOPA','0','Bez PDV / oslobođeno',0,null,10),
  ('PDV_STOPA','10','PDV 10 %',10,null,20),
  ('PDV_STOPA','20','PDV 20 % (Srbija)',20,null,30),
  ('PDV_STOPA','22','DDV 22 % (Slovenija)',22,null,40),
  ('JEDINICA','KOM','kom',null,null,10),
  ('JEDINICA','VOZILO','vozilo',null,null,20),
  ('JEDINICA','TURA','tura',null,null,30),
  ('JEDINICA','KM','km',null,null,40),
  ('JEDINICA','DAN','dan',null,null,50),
  ('JEDINICA','SAT','sat',null,null,60),
  ('JEDINICA','PAUSAL','paušal',null,null,70),
  ('VALUTA','EUR','Evro',1,null,10),
  ('VALUTA','RSD','Dinar',117.2,null,20)
on conflict (grupa, kod) do nothing;

commit;

-- ---------------------------------------------------------------------
-- 13. KONTROLA – očekivano: tabela 18, pravila_rls 66, pravila_dokumenti 3
-- ---------------------------------------------------------------------
select 'BAZA SPREMNA' as rezultat,
  (select count(*) from pg_tables where schemaname = 'public' and tablename in
     ('profili','firme','sifarnici','partneri','partner_kontakti','vozila','vozaci','rokovi','dokumenti',
      'brojaci','ture','nalozi','fakture','nalog_stavke','faktura_stavke','naplate','tura_troskovi','obracun_vozaca')) as tabela,
  (select count(*) from pg_policies where schemaname = 'public' and policyname like 'tms_%') as pravila_rls,
  (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'tms_dok_%') as pravila_dokumenti,
  (select count(*) from public.sifarnici) as stavki_sifarnika,
  (select string_agg(email || ' = ' || coalesce(uloga, 'bez uloge'), ', ') from public.profili) as korisnici;
