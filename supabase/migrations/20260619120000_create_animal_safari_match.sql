-- ============================================================================
-- Animal Safari Match — game tables
-- ============================================================================
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Project: hqnfpjdkdiauzqolrwzn  (matches src/app/services/supabase.service.ts)
-- Safe to re-run: schema uses IF NOT EXISTS and the catalog is re-seeded in full.
--
-- Design note — "frontend only mechanic + database":
--   There is NO custom backend and NO auth. The Angular app talks to Supabase
--   directly with the public "anon" key, exactly like the other arcade games.
--   The *player-owned* progression from the PRD (permanent collection, coins,
--   stickers, parade, daily streak, per-device stats) lives entirely on the
--   client in localStorage — that is the offline-first "frontend only mechanic".
--
--   Supabase only stores the three things that benefit from being shared/global:
--     1) safari_animals    — the animal catalog (seeded below, read-only).
--     2) safari_sessions   — one row per finished level (anonymous play log).
--     3) safari_discoveries — one append-only event per animal matched, which
--                             powers the community "Players have discovered N
--                             lions" counter (see the safari_community_totals
--                             view). No per-user rows, no updates → fits the
--                             anon insert + public select RLS model cleanly.
--
--   The 24 animals map 1:1 to the GLB models in src/assets/models/ and to
--   ANIMALS in src/app/pages/animal-safari-match/safari-data.ts.
-- ============================================================================

-- 1) Animal catalog ----------------------------------------------------------
-- Read-only reference data. Seeded below; the client keeps its own copy too, so
-- gameplay never blocks on this table.
create table if not exists public.safari_animals (
  id          text        primary key,                 -- stable slug, e.g. 'lion'
  name        text        not null,
  rarity      text        not null,                     -- common | rare | epic | legendary
  theme       text        not null,                     -- savanna | farmyard | riverside
  emoji       text        not null,                     -- glyph used for the fallback card
  model       text,                                     -- GLB basename, e.g. 'animal-lion'
  created_at  timestamptz not null default now(),

  constraint safari_animals_rarity_ck check (rarity in ('common','rare','epic','legendary'))
);

comment on table public.safari_animals is 'Animal Safari Match — animal catalog (reference data).';

-- 2) Play sessions -----------------------------------------------------------
-- One row per completed level. Anonymous (player_name is a chosen display name,
-- not an account). Used for personal stats + a global "games played" count.
create table if not exists public.safari_sessions (
  id               uuid        primary key default gen_random_uuid(),
  player_name      text        not null,
  theme            text        not null,
  pairs            integer     not null default 0,      -- pairs on the board (4 / 6 / 8)
  moves            integer     not null default 0,
  duration_seconds integer     not null default 0,
  animals_found    integer     not null default 0,
  coins_earned     integer     not null default 0,
  created_at       timestamptz not null default now(),

  constraint safari_sessions_name_len  check (char_length(player_name) between 1 and 40),
  constraint safari_sessions_pairs_ck  check (pairs        between 1 and 24),
  constraint safari_sessions_moves_ck  check (moves        >= 0 and moves <= 100000),
  constraint safari_sessions_dur_ck    check (duration_seconds >= 0 and duration_seconds <= 86400),
  constraint safari_sessions_found_ck  check (animals_found >= 0),
  constraint safari_sessions_coins_ck  check (coins_earned  >= 0 and coins_earned <= 1000000)
);

comment on table public.safari_sessions is 'Animal Safari Match — one anonymous row per finished level.';

-- 3) Discovery events --------------------------------------------------------
-- Append-only log: one row per animal matched in a run. `is_first` marks the
-- player's very first lifetime discovery of that animal (decided client-side
-- from local collection). Aggregated by the community view below.
create table if not exists public.safari_discoveries (
  id          uuid        primary key default gen_random_uuid(),
  player_name text        not null,
  animal_id   text        not null,
  rarity      text        not null,
  is_first    boolean     not null default false,
  created_at  timestamptz not null default now(),

  constraint safari_disc_name_len  check (char_length(player_name) between 1 and 40),
  constraint safari_disc_rarity_ck check (rarity in ('common','rare','epic','legendary'))
);

comment on table public.safari_discoveries is 'Animal Safari Match — append-only animal discovery/match events (powers the community counter).';

-- 4) Indexes -----------------------------------------------------------------
create index if not exists safari_sessions_created_idx
  on public.safari_sessions (created_at desc);

create index if not exists safari_discoveries_animal_idx
  on public.safari_discoveries (animal_id);

-- 5) Community totals view ---------------------------------------------------
-- "Players have discovered 12,500 lions." One read returns every animal's tally.
-- security_invoker = on → the view respects the base table's (public) RLS.
create or replace view public.safari_community_totals
  with (security_invoker = on) as
  select animal_id,
         count(*)::bigint                              as total_found,
         count(*) filter (where is_first)::bigint      as total_discoverers
  from public.safari_discoveries
  group by animal_id;

comment on view public.safari_community_totals is 'Animal Safari Match — per-animal community discovery tallies.';

-- 6) Row Level Security ------------------------------------------------------
alter table public.safari_animals     enable row level security;
alter table public.safari_sessions    enable row level security;
alter table public.safari_discoveries enable row level security;

drop policy if exists "Safari animals are public" on public.safari_animals;
create policy "Safari animals are public"
  on public.safari_animals for select using (true);

drop policy if exists "Safari sessions are public" on public.safari_sessions;
create policy "Safari sessions are public"
  on public.safari_sessions for select using (true);

drop policy if exists "Anyone can log a Safari session" on public.safari_sessions;
create policy "Anyone can log a Safari session"
  on public.safari_sessions for insert with check (true);

drop policy if exists "Safari discoveries are public" on public.safari_discoveries;
create policy "Safari discoveries are public"
  on public.safari_discoveries for select using (true);

drop policy if exists "Anyone can log a Safari discovery" on public.safari_discoveries;
create policy "Anyone can log a Safari discovery"
  on public.safari_discoveries for insert with check (true);

-- No update / delete policies → those operations are denied for anon by default.

-- 7) Seed the catalog --------------------------------------------------------
-- Keep in sync with ANIMALS in
--   src/app/pages/animal-safari-match/safari-data.ts
-- The block below is re-run safe: it makes the schema current, removes any stale
-- animals from a previous catalog, upserts the 24-animal set, then (re)applies
-- the theme guard once every row conforms.
alter table public.safari_animals add column if not exists model text;
alter table public.safari_animals drop constraint if exists safari_animals_theme_ck;

delete from public.safari_animals
  where id not in (
    'lion','tiger','elephant','giraffe','fox','monkey','deer','hog',
    'panda','koala','bunny','cow','pig','dog','cat','chick',
    'polar','penguin','beaver','parrot','fish','crab','bee','caterpillar'
  );

insert into public.safari_animals (id, name, rarity, theme, emoji, model) values
  -- Savanna
  ('lion',        'Lion',        'legendary', 'savanna',   '🦁',     'animal-lion'),
  ('tiger',       'Tiger',       'epic',      'savanna',   '🐯',     'animal-tiger'),
  ('elephant',    'Elephant',    'rare',      'savanna',   '🐘',     'animal-elephant'),
  ('giraffe',     'Giraffe',     'rare',      'savanna',   '🦒',     'animal-giraffe'),
  ('fox',         'Fox',         'rare',      'savanna',   '🦊',     'animal-fox'),
  ('monkey',      'Monkey',      'common',    'savanna',   '🐵',     'animal-monkey'),
  ('deer',        'Deer',        'common',    'savanna',   '🦌',     'animal-deer'),
  ('hog',         'Hog',         'common',    'savanna',   '🐗',     'animal-hog'),
  -- Farmyard
  ('panda',       'Panda',       'legendary', 'farmyard',  '🐼',     'animal-panda'),
  ('koala',       'Koala',       'epic',      'farmyard',  '🐨',     'animal-koala'),
  ('bunny',       'Bunny',       'rare',      'farmyard',  '🐰',     'animal-bunny'),
  ('cow',         'Cow',         'common',    'farmyard',  '🐮',     'animal-cow'),
  ('pig',         'Pig',         'common',    'farmyard',  '🐷',     'animal-pig'),
  ('dog',         'Dog',         'common',    'farmyard',  '🐶',     'animal-dog'),
  ('cat',         'Cat',         'common',    'farmyard',  '🐱',     'animal-cat'),
  ('chick',       'Chick',       'common',    'farmyard',  '🐥',     'animal-chick'),
  -- Riverside
  ('polar',       'Polar Bear',  'epic',      'riverside', '🐻‍❄️', 'animal-polar'),
  ('penguin',     'Penguin',     'rare',      'riverside', '🐧',     'animal-penguin'),
  ('beaver',      'Beaver',      'rare',      'riverside', '🦫',     'animal-beaver'),
  ('parrot',      'Parrot',      'rare',      'riverside', '🦜',     'animal-parrot'),
  ('fish',        'Fish',        'common',    'riverside', '🐟',     'animal-fish'),
  ('crab',        'Crab',        'common',    'riverside', '🦀',     'animal-crab'),
  ('bee',         'Bee',         'common',    'riverside', '🐝',     'animal-bee'),
  ('caterpillar', 'Caterpillar', 'common',    'riverside', '🐛',     'animal-caterpillar')
on conflict (id) do update
  set name   = excluded.name,
      rarity = excluded.rarity,
      theme  = excluded.theme,
      emoji  = excluded.emoji,
      model  = excluded.model;

alter table public.safari_animals
  add constraint safari_animals_theme_ck check (theme in ('savanna','farmyard','riverside'));

-- ============================================================================
-- Rollback (run only if you need to remove everything):
--   drop view  if exists public.safari_community_totals;
--   drop table if exists public.safari_discoveries cascade;
--   drop table if exists public.safari_sessions    cascade;
--   drop table if exists public.safari_animals      cascade;
-- ============================================================================
