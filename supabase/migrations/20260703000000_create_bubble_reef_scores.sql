-- ============================================================================
-- Bubble Reef — leaderboard table
-- ============================================================================
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Project: hqnfpjdkdiauzqolrwzn  (matches src/app/services/supabase.service.ts)
--
-- The Angular app talks to Supabase directly with the public "anon" key, so
-- Row Level Security (RLS) is enabled with policies that allow anyone to read
-- the board and submit a score (same model as the other game tables).
--
-- One append-only row per finished 60-second Bubble Rush run. The toddler
-- "Little Fins" mode and the reef/friend collection are local-only and never
-- touch the network.
-- ============================================================================

-- 1) Table -------------------------------------------------------------------
create table if not exists public.bubble_reef_scores (
  id              uuid        primary key default gen_random_uuid(),
  player_name     text        not null,
  score           integer     not null default 0,
  bubbles_popped  integer     not null default 0,
  friends_rescued integer     not null default 0,
  best_combo      integer     not null default 0,
  created_at      timestamptz not null default now(),

  -- light sanity guards (not anti-cheat — just keeps the board clean)
  constraint bubble_reef_name_len   check (char_length(player_name) between 1 and 40),
  constraint bubble_reef_score_rng  check (score >= 0 and score <= 1000000),
  constraint bubble_reef_pops_ok    check (bubbles_popped >= 0 and bubbles_popped <= 5000),
  constraint bubble_reef_rescue_ok  check (friends_rescued >= 0 and friends_rescued <= 500),
  constraint bubble_reef_combo_ok   check (best_combo >= 0 and best_combo <= 5000)
);

comment on table public.bubble_reef_scores is 'High scores for the Bubble Reef browser game (Bubble Rush mode).';

-- 2) Indexes -----------------------------------------------------------------
-- Global Top-N leaderboard: order by score desc.
create index if not exists bubble_reef_board_idx
  on public.bubble_reef_scores (score desc);

-- Personal-best lookups: where player_name = ? order by score desc.
create index if not exists bubble_reef_player_idx
  on public.bubble_reef_scores (player_name, score desc);

-- 3) Row Level Security ------------------------------------------------------
alter table public.bubble_reef_scores enable row level security;

-- Anyone (anon + authenticated) can read the leaderboard.
drop policy if exists "Bubble Reef scores are public" on public.bubble_reef_scores;
create policy "Bubble Reef scores are public"
  on public.bubble_reef_scores
  for select
  using (true);

-- Anyone can submit a score (one insert per completed run, enforced client-side).
drop policy if exists "Anyone can submit a Bubble Reef score" on public.bubble_reef_scores;
create policy "Anyone can submit a Bubble Reef score"
  on public.bubble_reef_scores
  for insert
  with check (true);

-- No update / delete policies → those operations are denied for anon by default.

-- ============================================================================
-- Rollback (run only if you need to remove the table):
--   drop table if exists public.bubble_reef_scores cascade;
-- ============================================================================
