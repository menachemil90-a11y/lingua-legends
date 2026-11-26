-- RLS and privilege tests. Every failure raises an exception (psql runs with ON_ERROR_STOP).
\set ON_ERROR_STOP on

-- Seed as the migration owner.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');
insert into public.player_accounts (id, auth_user_id, nickname, account_kind, friend_code) values
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Alice', 'registered', 'AAAAAAAA'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Bobby', 'registered', 'BBBBBBBB'),
  ('g_guest_one', null, 'Guesty', 'guest', 'CCCCCCCC');
insert into public.content_items (id, level, primary_skill, category, item_type, review_status, is_ranked_only) values
  ('a1-coffee', 'A1', 'vocabulary', 'vocabulary', 'cloze', 'ai-drafted', false),
  ('rk-secret', 'B1', 'grammar', 'grammar', 'cloze', 'ai-drafted', true);
insert into public.content_versions (item_id, version, payload) values
  ('a1-coffee', 1, '{"acceptedAnswers":["a"]}'), ('rk-secret', 1, '{"acceptedAnswers":["b"]}');
insert into public.matches (id, mode, queue, bracket, season_id, started_at, ended_at, end_reason) values
  ('m1', 'word-battle', 'ranked', 'core', 's1', now(), now(), 'ko'),
  ('m2', 'word-battle', 'casual', 'core', 's1', now(), now(), 'ko');
insert into public.match_players (match_id, player_id, result) values
  ('m1', '11111111-1111-1111-1111-111111111111', 'win'),
  ('m1', '22222222-2222-2222-2222-222222222222', 'loss'),
  ('m2', '22222222-2222-2222-2222-222222222222', 'win'),
  ('m2', 'g_guest_one', 'loss');
insert into public.wallets (player_id, shards) values ('11111111-1111-1111-1111-111111111111', 10);
insert into public.cosmetics (id, kind, name, unlock) values ('frame-gilded', 'frame', 'Gilded', '{"kind":"level","level":5}');
insert into public.learning_events (player_id, content_item_id, game_mode, correct, source) values
  ('22222222-2222-2222-2222-222222222222', 'a1-coffee', 'practice', true, 'client');

-- Helper: assert that a statement is rejected with insufficient_privilege (42501).
create or replace function pg_temp.expect_denied(sql text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'TEST FAILED (statement was allowed): %', sql;
exception when insufficient_privilege then
  null;
end $$;

-- ===== As user A (authenticated) =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Learning events: own insert allowed, forged player/source rejected, others invisible.
insert into public.learning_events (player_id, content_item_id, game_mode, correct, client_event_id)
  values ('11111111-1111-1111-1111-111111111111', 'a1-coffee', 'practice', true, 'ev1');
select pg_temp.expect_denied($q$insert into public.learning_events (player_id, content_item_id, game_mode, correct) values ('22222222-2222-2222-2222-222222222222', 'a1-coffee', 'practice', true)$q$);
select pg_temp.expect_denied($q$insert into public.learning_events (player_id, content_item_id, game_mode, correct, source) values ('11111111-1111-1111-1111-111111111111', 'a1-coffee', 'practice', true, 'server')$q$);
do $$ begin
  if (select count(*) from public.learning_events) <> 1 then raise exception 'TEST FAILED: user A sees other users learning events'; end if;
end $$;

-- Competitive data, currency and rewards cannot be written by clients.
select pg_temp.expect_denied($q$insert into public.rank_profiles (player_id, mode, bracket, season_id, rating) values ('11111111-1111-1111-1111-111111111111', 'word-battle', 'core', 's1', 3000)$q$);
select pg_temp.expect_denied($q$update public.wallets set shards = 999999$q$);
select pg_temp.expect_denied($q$insert into public.user_achievements (player_id, achievement_id) values ('11111111-1111-1111-1111-111111111111', 'first-victory')$q$);
select pg_temp.expect_denied($q$update public.match_players set result = 'win' where match_id = 'm1'$q$);
select pg_temp.expect_denied($q$insert into public.user_cosmetics (player_id, cosmetic_id) values ('11111111-1111-1111-1111-111111111111', 'frame-gilded')$q$);
select pg_temp.expect_denied($q$insert into public.friends (player_a, player_b) values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')$q$);

-- Ranked answer keys are not readable.
do $$ begin
  if exists (select 1 from public.content_items where id = 'rk-secret') then raise exception 'TEST FAILED: ranked item visible'; end if;
  if exists (select 1 from public.content_versions where item_id = 'rk-secret') then raise exception 'TEST FAILED: ranked answer key visible'; end if;
  if not exists (select 1 from public.content_versions where item_id = 'a1-coffee') then raise exception 'TEST FAILED: public content hidden'; end if;
end $$;

-- Matches: only those the user played.
do $$ begin
  if (select count(*) from public.matches) <> 1 then raise exception 'TEST FAILED: non-participant match visible'; end if;
  if (select count(*) from public.match_players) <> 2 then raise exception 'TEST FAILED: match players visibility'; end if;
  if (select shards from public.wallets) <> 10 then raise exception 'TEST FAILED: own wallet not readable'; end if;
end $$;

-- Cannot equip a cosmetic that is not owned.
do $$ begin
  perform public.equip_cosmetic('frame-gilded');
  raise exception 'TEST FAILED: equipped an unowned cosmetic';
exception when raise_exception then
  if sqlerrm not like '%not owned%' then raise; end if;
end $$;

-- Own mastery is writable (learning data only), someone else's is not.
insert into public.mastery (player_id, tag, mastery) values ('11111111-1111-1111-1111-111111111111', 'v:although', 0.4);
select pg_temp.expect_denied($q$insert into public.mastery (player_id, tag, mastery) values ('22222222-2222-2222-2222-222222222222', 'v:although', 1)$q$);

-- Account deletion request.
select public.request_account_deletion();
commit;

-- ===== As anon =====
begin;
set local role anon;
do $$ begin
  if (select count(*) from public.learning_events) <> 0 then raise exception 'TEST FAILED: anon reads learning events'; end if;
  if (select count(*) from public.seasons) <> 1 then raise exception 'TEST FAILED: anon cannot read seasons'; end if;
  if (select count(*) from public.rank_profiles) <> 0 then raise exception 'TEST FAILED: anon reads rank profiles'; end if;
end $$;
select pg_temp.expect_denied($q$insert into public.profiles (id, display_name) values ('11111111-1111-1111-1111-111111111111', 'Hacker')$q$);
commit;

-- ===== As the multiplayer server (service_role) =====
begin;
set local role service_role;
insert into public.rank_profiles (player_id, mode, bracket, season_id, rating, games)
  values ('g_guest_one', 'word-battle', 'core', 's1', 1032, 1);
update public.wallets set shards = shards + 5 where player_id = '11111111-1111-1111-1111-111111111111';
commit;

-- Admin deletion removes the user and owned rows.
select public.process_account_deletion('22222222-2222-2222-2222-222222222222');
do $$ begin
  if exists (select 1 from public.learning_events where player_id = '22222222-2222-2222-2222-222222222222') then raise exception 'TEST FAILED: deletion left learning events'; end if;
  if exists (select 1 from public.player_accounts where id = '22222222-2222-2222-2222-222222222222') then raise exception 'TEST FAILED: deletion left player account'; end if;
end $$;

\echo 'ALL RLS TESTS PASSED'
