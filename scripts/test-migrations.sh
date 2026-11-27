#!/usr/bin/env bash
# Applies supabase/migrations to a throw-away local PostgreSQL with a minimal auth stub
# and runs the RLS test suite. Requires PostgreSQL server binaries (initdb, pg_ctl).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then RUN_AS=(runuser -u postgres --); chown postgres "$WORK"; fi
cleanup() { "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
"${RUN_AS[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null
PSQL=("${RUN_AS[@]}" psql -h "$WORK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "create database lingua_test" postgres
"${PSQL[@]}" -d lingua_test -f "$ROOT/supabase/tests/local_auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$f")"
  "${PSQL[@]}" -d lingua_test -f "$f"
done
"${PSQL[@]}" -d lingua_test -f "$ROOT/supabase/tests/rls_tests.sql"
echo "Applying seed.sql (public content bank)"
"${PSQL[@]}" -d lingua_test -f "$ROOT/supabase/seed.sql" >/dev/null
"${PSQL[@]}" -d lingua_test -t -c "select count(*) || ' public content items seeded' from public.content_items"
# Optional: verify a PRIVATE ranked pool export (never committed) loads and stays hidden by RLS.
#   RANKED_SQL=private/ranked.private.sql pnpm db:test
if [ -n "${RANKED_SQL:-}" ]; then
  echo "Applying private ranked pool from \$RANKED_SQL"
  "${PSQL[@]}" -d lingua_test -f "$RANKED_SQL" >/dev/null
  "${PSQL[@]}" -d lingua_test <<'SQL'
do $$
declare n int; v int;
begin
  select count(*) into n from public.content_items where is_ranked_only;
  if n = 0 then raise exception 'TEST FAILED: no ranked-only items were loaded'; end if;
  set local role anon;
  select count(*) into v from public.content_items where is_ranked_only;
  if v <> 0 then raise exception 'TEST FAILED: anon can see % ranked items', v; end if;
  select count(*) into v from public.content_versions cv join public.content_items ci on ci.id = cv.item_id where ci.is_ranked_only;
  if v <> 0 then raise exception 'TEST FAILED: anon can read ranked answer keys'; end if;
  reset role;
  set local role authenticated;
  select count(*) into v from public.content_versions where item_id like 'pr-%';
  if v <> 0 then raise exception 'TEST FAILED: authenticated users can read ranked answer keys'; end if;
  reset role;
  raise notice 'PRIVATE RANKED POOL: % items loaded and hidden from anon/authenticated', n;
end $$;
SQL
fi
