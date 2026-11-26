-- Lingua Legends — initial schema
-- Security model:
--   * RLS is enabled on EVERY table.
--   * Browsers (anon/authenticated) may only read their own data, public catalogues and
--     leaderboards, and may write only their own learning data and profile preferences.
--   * Competitive ratings, matches, rewards, currency, achievements, friendships and reports
--     are written exclusively by the authoritative multiplayer server (service_role).
--   * Guests exist only on the multiplayer server (player_accounts.id = 'g_…');
--     registered players use their auth.users id (as text).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_player_id() returns text
language sql stable
set search_path = ''
as $$ select (select auth.uid())::text $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------------------
-- Profiles (registered users only; private by default)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 3 and 16),
  locale text not null default 'he' check (locale in ('he', 'en')),
  explanation_language text not null default 'both' check (explanation_language in ('he', 'en', 'both')),
  self_reported_level text check (self_reported_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- Player accounts used by multiplayer (guests and registered). Server-managed.
create table public.player_accounts (
  id text primary key check (char_length(id) between 3 and 64),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 3 and 16),
  account_kind text not null check (account_kind in ('guest', 'registered')),
  friend_code char(8) not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Guests never have an auth user; registered accounts use their auth.users id as text.
  check (account_kind = 'registered' or auth_user_id is null)
);

-- ---------------------------------------------------------------------------
-- Curriculum and content
-- ---------------------------------------------------------------------------
create table public.skill_nodes (
  id text primary key,
  kind text not null check (kind in ('skill', 'vocabulary', 'grammar', 'bagrut')),
  label text not null,
  parent_id text references public.skill_nodes (id) on delete set null
);

create table public.content_items (
  id text primary key,
  current_version int not null default 1 check (current_version >= 1),
  level text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  primary_skill text not null,
  category text not null,
  item_type text not null,
  modes text[] not null default '{}',
  tags jsonb not null default '{}'::jsonb,
  review_status text not null check (review_status in ('draft', 'ai-drafted', 'reviewed', 'approved')),
  -- Ranked items' answer keys must never be readable by clients.
  is_ranked_only boolean not null default false,
  created_at timestamptz not null default now()
);
create index content_items_level_idx on public.content_items (level, primary_skill);

create table public.content_versions (
  item_id text not null references public.content_items (id) on delete cascade,
  version int not null check (version >= 1),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (item_id, version)
);

-- ---------------------------------------------------------------------------
-- Learning data (owned by registered users)
-- ---------------------------------------------------------------------------
create table public.learning_events (
  id bigint generated always as identity primary key,
  player_id uuid not null references auth.users (id) on delete cascade,
  content_item_id text not null,
  content_version int not null default 1,
  game_mode text not null,
  correct boolean not null,
  response_ms int check (response_ms is null or response_ms between 0 and 600000),
  attempt smallint not null default 1 check (attempt between 1 and 10),
  hint_used boolean not null default false,
  error_category text,
  client_event_id text,
  match_id text,
  source text not null default 'client' check (source in ('client', 'server')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (player_id, client_event_id)
);
create index learning_events_player_time_idx on public.learning_events (player_id, occurred_at desc);
create index learning_events_item_idx on public.learning_events (content_item_id);

create table public.skill_profiles (
  player_id uuid not null references auth.users (id) on delete cascade,
  skill text not null,
  theta real not null,
  n int not null default 0 check (n >= 0),
  correct int not null default 0 check (correct >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id, skill)
);

create table public.mastery (
  player_id uuid not null references auth.users (id) on delete cascade,
  tag text not null,
  mastery real not null check (mastery between 0 and 1),
  attempts int not null default 0 check (attempts >= 0),
  correct int not null default 0 check (correct >= 0),
  last_seen_at timestamptz not null default now(),
  primary key (player_id, tag)
);

create table public.review_queue (
  player_id uuid not null references auth.users (id) on delete cascade,
  tag text not null,
  interval_ms bigint not null check (interval_ms >= 0),
  ease real not null check (ease between 1 and 5),
  due_at timestamptz not null,
  reps int not null default 0,
  lapses int not null default 0,
  last_item_id text,
  last_mode text,
  primary key (player_id, tag)
);
create index review_queue_due_idx on public.review_queue (player_id, due_at);

-- ---------------------------------------------------------------------------
-- Competitive play (server-managed)
-- ---------------------------------------------------------------------------
create table public.seasons (
  id text primary key,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);

create table public.rank_profiles (
  player_id text not null references public.player_accounts (id) on delete cascade,
  mode text not null check (mode in ('word-battle', 'grammar-race', 'sentence-master')),
  bracket text not null check (bracket in ('foundation', 'core', 'advanced')),
  season_id text not null references public.seasons (id),
  rating int not null default 1000 check (rating >= 0),
  games int not null default 0 check (games >= 0),
  wins int not null default 0 check (wins >= 0),
  losses int not null default 0 check (losses >= 0),
  draws int not null default 0 check (draws >= 0),
  peak int not null default 1000,
  updated_at timestamptz not null default now(),
  primary key (player_id, mode, bracket, season_id)
);
create index rank_profiles_leaderboard_idx on public.rank_profiles (season_id, mode, bracket, rating desc) where games > 0;

create table public.matches (
  id text primary key,
  mode text not null,
  queue text not null check (queue in ('ranked', 'casual', 'private')),
  bracket text not null,
  season_id text references public.seasons (id),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  end_reason text not null,
  winner_id text references public.player_accounts (id) on delete set null
);
create index matches_ended_idx on public.matches (ended_at desc);

create table public.match_players (
  match_id text not null references public.matches (id) on delete cascade,
  player_id text not null references public.player_accounts (id) on delete cascade,
  result text not null check (result in ('win', 'loss', 'draw')),
  correct int not null default 0,
  incorrect int not null default 0,
  avg_response_ms int,
  best_combo int not null default 0,
  rating_before int,
  rating_after int,
  stats jsonb not null default '{}'::jsonb,
  primary key (match_id, player_id)
);
create index match_players_player_idx on public.match_players (player_id);

-- ---------------------------------------------------------------------------
-- Social & safety (server-managed; no free-text messaging tables exist)
-- ---------------------------------------------------------------------------
create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_player text not null references public.player_accounts (id) on delete cascade,
  to_player text not null references public.player_accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_player, to_player),
  check (from_player <> to_player)
);
create index friend_requests_to_idx on public.friend_requests (to_player);

create table public.friends (
  player_a text not null references public.player_accounts (id) on delete cascade,
  player_b text not null references public.player_accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_a, player_b),
  check (player_a < player_b)
);
create index friends_b_idx on public.friends (player_b);

create table public.blocked_users (
  blocker_id text not null references public.player_accounts (id) on delete cascade,
  blocked_id text not null references public.player_accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocked_users_blocked_idx on public.blocked_users (blocked_id);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id text not null references public.player_accounts (id) on delete cascade,
  reported_id text not null references public.player_accounts (id) on delete cascade,
  reason text not null check (reason in ('cheating', 'offensive-name', 'harassment', 'other')),
  match_id text,
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);

-- ---------------------------------------------------------------------------
-- Progression & cosmetics (server-managed; never purchasable)
-- ---------------------------------------------------------------------------
create table public.achievements (
  id text primary key,
  name text not null,
  description text not null
);

create table public.user_achievements (
  player_id text not null references public.player_accounts (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (player_id, achievement_id)
);

create table public.cosmetics (
  id text primary key,
  kind text not null check (kind in ('character', 'vehicle', 'title', 'frame', 'emote', 'arena-theme', 'victory-effect')),
  name text not null,
  unlock jsonb not null
);

create table public.user_cosmetics (
  player_id text not null references public.player_accounts (id) on delete cascade,
  cosmetic_id text not null references public.cosmetics (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  equipped boolean not null default false,
  primary key (player_id, cosmetic_id)
);

create table public.wallets (
  player_id text primary key references public.player_accounts (id) on delete cascade,
  shards int not null default 0 check (shards >= 0),
  xp int not null default 0 check (xp >= 0),
  updated_at timestamptz not null default now()
);

create table public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.player_accounts enable row level security;
alter table public.skill_nodes enable row level security;
alter table public.content_items enable row level security;
alter table public.content_versions enable row level security;
alter table public.learning_events enable row level security;
alter table public.skill_profiles enable row level security;
alter table public.mastery enable row level security;
alter table public.review_queue enable row level security;
alter table public.seasons enable row level security;
alter table public.rank_profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friends enable row level security;
alter table public.blocked_users enable row level security;
alter table public.reports enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.cosmetics enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.wallets enable row level security;
alter table public.account_deletion_requests enable row level security;

-- Defence in depth: clients never write server-managed tables, even if a policy is added by mistake.
revoke insert, update, delete on
  public.player_accounts, public.skill_nodes, public.content_items, public.content_versions,
  public.seasons, public.rank_profiles, public.matches, public.match_players,
  public.friend_requests, public.friends, public.blocked_users, public.reports,
  public.achievements, public.user_achievements, public.cosmetics, public.user_cosmetics,
  public.wallets, public.account_deletion_requests
from anon, authenticated;

-- Profiles: own row only.
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy player_accounts_select_own on public.player_accounts for select to authenticated using (auth_user_id = (select auth.uid()));

-- Public catalogues.
create policy skill_nodes_read on public.skill_nodes for select to anon, authenticated using (true);
create policy content_items_read_public on public.content_items for select to anon, authenticated using (not is_ranked_only);
create policy content_versions_read_public on public.content_versions for select to anon, authenticated
  using (exists (select 1 from public.content_items ci where ci.id = item_id and not ci.is_ranked_only));
create policy seasons_read on public.seasons for select to anon, authenticated using (true);
create policy achievements_read on public.achievements for select to anon, authenticated using (true);
create policy cosmetics_read on public.cosmetics for select to anon, authenticated using (true);

-- Learning data: own rows only. Clients may only insert "client" events for themselves.
create policy learning_events_select_own on public.learning_events for select to authenticated using (player_id = (select auth.uid()));
create policy learning_events_insert_own on public.learning_events for insert to authenticated
  with check (player_id = (select auth.uid()) and source = 'client' and match_id is null);

create policy skill_profiles_all_own on public.skill_profiles for all to authenticated
  using (player_id = (select auth.uid())) with check (player_id = (select auth.uid()));
create policy mastery_all_own on public.mastery for all to authenticated
  using (player_id = (select auth.uid())) with check (player_id = (select auth.uid()));
create policy review_queue_all_own on public.review_queue for all to authenticated
  using (player_id = (select auth.uid())) with check (player_id = (select auth.uid()));

-- Leaderboards are public within the game (nickname + rating only via the server API);
-- authenticated users may read rank rows directly.
create policy rank_profiles_read on public.rank_profiles for select to authenticated using (true);

-- Matches: participants only. Helper avoids recursive policy evaluation.
create or replace function public.is_match_participant(p_match_id text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.match_players mp
    where mp.match_id = p_match_id and mp.player_id = (select auth.uid())::text
  )
$$;
revoke all on function public.is_match_participant(text) from public;
grant execute on function public.is_match_participant(text) to authenticated;

create policy matches_select_participant on public.matches for select to authenticated using (public.is_match_participant(id));
create policy match_players_select_participant on public.match_players for select to authenticated using (public.is_match_participant(match_id));

create policy friend_requests_select_involved on public.friend_requests for select to authenticated
  using (from_player = public.current_player_id() or to_player = public.current_player_id());
create policy friends_select_involved on public.friends for select to authenticated
  using (player_a = public.current_player_id() or player_b = public.current_player_id());
create policy blocked_users_select_own on public.blocked_users for select to authenticated using (blocker_id = public.current_player_id());
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = public.current_player_id());

create policy user_achievements_select_own on public.user_achievements for select to authenticated using (player_id = public.current_player_id());
create policy user_cosmetics_select_own on public.user_cosmetics for select to authenticated using (player_id = public.current_player_id());
create policy wallets_select_own on public.wallets for select to authenticated using (player_id = public.current_player_id());
create policy deletion_select_own on public.account_deletion_requests for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Secure server-side operations exposed to clients
-- ---------------------------------------------------------------------------

-- Equip an owned cosmetic (cannot grant new cosmetics).
create or replace function public.equip_cosmetic(p_cosmetic_id text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_player text := (select auth.uid())::text;
  v_kind text;
begin
  if v_player is null then raise exception 'not authenticated'; end if;
  select c.kind into v_kind from public.cosmetics c
    join public.user_cosmetics uc on uc.cosmetic_id = c.id
    where c.id = p_cosmetic_id and uc.player_id = v_player;
  if v_kind is null then raise exception 'cosmetic not owned'; end if;
  update public.user_cosmetics uc set equipped = false
    from public.cosmetics c
    where uc.cosmetic_id = c.id and uc.player_id = v_player and c.kind = v_kind;
  update public.user_cosmetics set equipped = true where player_id = v_player and cosmetic_id = p_cosmetic_id;
end $$;
revoke all on function public.equip_cosmetic(text) from public;
grant execute on function public.equip_cosmetic(text) to authenticated;

-- Request deletion of the caller's account and data (processed by an admin job).
create or replace function public.request_account_deletion() returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  insert into public.account_deletion_requests (user_id) values ((select auth.uid()))
    on conflict (user_id) do update set requested_at = now();
end $$;
revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;

-- Admin-only: permanently deletes a user's data. auth.users cascade removes owned rows.
create or replace function public.process_account_deletion(p_user_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.player_accounts where id = p_user_id::text or auth_user_id = p_user_id;
  delete from auth.users where id = p_user_id;
end $$;
revoke all on function public.process_account_deletion(uuid) from public, anon, authenticated;

-- Seed reference data.
insert into public.seasons (id, name, starts_at, ends_at)
values ('s1', 'Season 1 — Awakening', '2026-09-01T00:00:00Z', '2027-01-31T23:59:59Z')
on conflict (id) do nothing;

insert into public.achievements (id, name, description) values
  ('first-victory', 'First Victory', 'Win your first match.'),
  ('race-winner', 'Podium Finish', 'Win a Grammar Race.'),
  ('sentence-10', 'Architect', 'Build 10 correct sentences.'),
  ('words-25', 'Wordsmith', 'Master 25 words.'),
  ('combo-master', 'Combo Master', 'Reach a 6-answer combo.'),
  ('win-streak-3', 'On Fire', 'Win 3 matches in a row.'),
  ('bagrut-first', 'Scholar', 'Complete a Bagrut Academy task.'),
  ('placement', 'Know Thyself', 'Complete the placement test.'),
  ('reviewer', 'Memory Keeper', 'Complete a review session.')
on conflict (id) do nothing;
