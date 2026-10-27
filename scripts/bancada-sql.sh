#!/usr/bin/env bash
# Bancada SQL: aplica o stub do Supabase, todas as migrations em ordem e os testes de
# acesso num banco novo. Os ASSERT das migrations e dos testes reprovam a execução.
#
# Uso: DATABASE_URL=postgres://... bash scripts/bancada-sql.sh   (CI, com serviço postgres)
#      bash scripts/bancada-sql.sh                               (local: cluster temporário)
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

temporario=""
if [[ -z "${DATABASE_URL:-}" ]]; then
  BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
  [[ -x "$BIN/initdb" ]] || { echo "sem DATABASE_URL e sem Postgres local" >&2; exit 1; }
  temporario="$(mktemp -d)"
  chmod 777 "$temporario"
  como() { if [[ $(id -u) -eq 0 ]]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
  como "'$BIN/initdb' -D '$temporario/dados' -A trust -U postgres >/dev/null"
  como "'$BIN/pg_ctl' -D '$temporario/dados' -o '-p 54329 -k $temporario -c listen_addresses=127.0.0.1' -l '$temporario/log' -w start >/dev/null"
  trap 'como "\"$BIN/pg_ctl\" -D \"$temporario/dados\" -m immediate stop >/dev/null"; rm -rf "$temporario"' EXIT
  DATABASE_URL="postgresql://postgres@127.0.0.1:54329/postgres"
fi

BANCO="bancada_$$"
"${PSQL[@]}" "$DATABASE_URL" -c "create database $BANCO"
# Mesma conexão, outro banco: troca só o último segmento do caminho da URL.
URL_BANCO="$(printf '%s' "$DATABASE_URL" | sed -E "s#/[^/?]*(\?|$)#/$BANCO\1#")"

"${PSQL[@]}" "$URL_BANCO" -f "$RAIZ/supabase/bancada/stub.sql"
n=0
for m in "$RAIZ"/supabase/migrations/*.sql; do
  "${PSQL[@]}" "$URL_BANCO" -f "$m" || { echo "REPROVOU na migration $(basename "$m")" >&2; exit 1; }
  n=$((n + 1))
done
t=0
for f in "$RAIZ"/supabase/bancada/testes/*.sql; do
  "${PSQL[@]}" "$URL_BANCO" -f "$f" || { echo "REPROVOU no teste $(basename "$f")" >&2; exit 1; }
  t=$((t + 1))
done
echo "bancada SQL: $n migration(s) e $t teste(s) verdes"
