-- ============================================================================
-- Color Hide — leaderboard table
-- ============================================================================
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Project: hqnfpjdkdiauzqolrwzn  (matches src/app/services/supabase.service.ts)
--
-- The Angular app talks to Supabase directly with the public "anon" key, so
-- Row Level Security (RLS) is enabled with policies that allow anyone to read
-- the board and submit a score (same model as the other game tables).
--
-- One append-only row per finished 60-second run. `mode` ('mix' | 'seek') and
-- `difficulty` ('easy' | 'medium' | 'hard' | 'ohmyeyes') let the app show a
-- per-mode / per-difficulty board so each tier competes fairly.
-- ============================================================================

-- 1) Table -------------------------------------------------------------------
create table if not exists public.color_hide_scores (
  id              uuid        primary key default gen_random_uuid(),
  player_name     text        not null,
  score           integer     not null default 0,
  mode            text        not null default 'mix',
  difficulty      text        not null default 'easy',
  perfect_matches integer     not null default 0,
  attempts        integer     not null default 0,
  best_combo      integer     not null default 0,
  avg_accuracy    integer     not null default 0,
  created_at      timestamptz not null default now(),

  -- light sanity guards (not anti-cheat — just keeps the board clean)
  constraint color_hide_name_len    check (char_length(player_name) between 1 and 40),
  constraint color_hide_score_rng   check (score >= 0 and score <= 5000000),
  constraint color_hide_mode_ok     check (mode in ('mix', 'seek')),
  constraint color_hide_diff_ok     check (difficulty in ('easy', 'medium', 'hard', 'ohmyeyes')),
  constraint color_hide_perfect_ok  check (perfect_matches >= 0),
  constraint color_hide_attempts_ok check (attempts >= 0),
  constraint color_hide_combo_ok    check (best_combo >= 0),
  constraint color_hide_acc_ok      check (avg_accuracy between 0 and 100)
);

comment on table public.color_hide_scores is 'High scores for the Color Hide browser game.';

-- 2) Indexes -----------------------------------------------------------------
-- Global / filtered Top-N leaderboard: order by score desc, scoped by mode+difficulty.
create index if not exists color_hide_board_idx
  on public.color_hide_scores (mode, difficulty, score desc);

-- Personal-best lookups: where player_name = ? order by score desc.
create index if not exists color_hide_player_idx
  on public.color_hide_scores (player_name, score desc);

-- 3) Row Level Security ------------------------------------------------------
alter table public.color_hide_scores enable row level security;

-- Anyone (anon + authenticated) can read the leaderboard.
drop policy if exists "Color Hide scores are public" on public.color_hide_scores;
create policy "Color Hide scores are public"
  on public.color_hide_scores
  for select
  using (true);

-- Anyone can submit a score (one insert per completed run, enforced client-side).
drop policy if exists "Anyone can submit a Color Hide score" on public.color_hide_scores;
create policy "Anyone can submit a Color Hide score"
  on public.color_hide_scores
  for insert
  with check (true);

-- No update / delete policies → those operations are denied for anon by default.

-- ============================================================================
-- Rollback (run only if you need to remove the table):
--   drop table if exists public.color_hide_scores cascade;
-- ============================================================================
