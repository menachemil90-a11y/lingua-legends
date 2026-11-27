-- Achievement awarded by the multiplayer server to the champion of a friends' tournament.
insert into public.achievements (id, name, description) values
  ('tournament-champion', 'Tournament Champion', 'Win a friends'' tournament.')
on conflict (id) do nothing;
