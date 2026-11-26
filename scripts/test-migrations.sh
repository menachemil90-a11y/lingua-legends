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
