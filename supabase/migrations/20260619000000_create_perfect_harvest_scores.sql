-- ============================================================================
-- Perfect Harvest — leaderboard table
-- ============================================================================
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Project: hqnfpjdkdiauzqolrwzn  (matches src/app/services/supabase.service.ts)
--
-- The Angular app talks to Supabase directly with the public "anon" key, so
-- Row Level Security (RLS) is enabled with policies that allow anyone to read
-- the board and submit a score (same model as the other game tables).
-- ============================================================================

-- 1) Table -------------------------------------------------------------------
create table if not exists public.perfect_harvest_scores (
  id            uuid        primary key default gen_random_uuid(),
  player_name   text        not null,
  score         integer     not null default 0,
  perfect_count integer     not null default 0,
  highest_combo integer     not null default 0,
  created_at    timestamptz not null default now(),

  -- light sanity guards (not anti-cheat — just keeps the board clean)
  constraint perfect_harvest_name_len   check (char_length(player_name) between 1 and 40),
  constraint perfect_harvest_score_rng  check (score >= 0 and score <= 5000000),
  constraint perfect_harvest_perfect_ok check (perfect_count >= 0),
  constraint perfect_harvest_combo_ok   check (highest_combo >= 0)
);

comment on table public.perfect_harvest_scores is 'High scores for the Perfect Harvest browser game.';

-- 2) Indexes -----------------------------------------------------------------
-- Global Top-N leaderboard query: order by score desc.
create index if not exists perfect_harvest_score_idx
  on public.perfect_harvest_scores (score desc);

-- Personal-best lookups: where player_name = ? order by score desc.
create index if not exists perfect_harvest_player_idx
  on public.perfect_harvest_scores (player_name, score desc);

-- 3) Row Level Security ------------------------------------------------------
alter table public.perfect_harvest_scores enable row level security;

-- Anyone (anon + authenticated) can read the leaderboard.
drop policy if exists "Perfect Harvest scores are public" on public.perfect_harvest_scores;
create policy "Perfect Harvest scores are public"
  on public.perfect_harvest_scores
  for select
  using (true);

-- Anyone can submit a score (one insert per completed run, enforced client-side).
drop policy if exists "Anyone can submit a Perfect Harvest score" on public.perfect_harvest_scores;
create policy "Anyone can submit a Perfect Harvest score"
  on public.perfect_harvest_scores
  for insert
  with check (true);

-- No update / delete policies → those operations are denied for anon by default.

-- ============================================================================
-- Rollback (run only if you need to remove the table):
--   drop table if exists public.perfect_harvest_scores cascade;
-- ============================================================================
