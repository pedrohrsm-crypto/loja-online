#!/usr/bin/env bash
# Concorrência de verdade, com duas sessões abertas ao mesmo tempo (#27):
#   T13 — último item disputado: estoque 1, dois compradores → uma reserva só; o outro recebe
#         "esgotou" antes de pagar.
#   T12 — duas abas, mesmo carrinho → um pedido só, uma reserva só.
#   Devolução — dois cancelamentos do mesmo pedido → a reserva volta uma vez só.
# Cada caso prova que a sessão B ESPEROU a trava da sessão A (senão o teste passaria por ter
# rodado em sequência). Chamado por scripts/bancada-sql.sh com URL_BANCO.
set -euo pipefail
: "${URL_BANCO:?URL_BANCO não definida}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -At "$URL_BANCO")
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

falhar() { echo "07_pedidos_concorrencia: $*" >&2; exit 1; }
sql() { "${PSQL[@]}" -c "$1"; }

# Carga própria (comitada): categoria, produto e duas variações publicadas, três compradores.
"${PSQL[@]}" <<'SQL'
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2'), ('00000000-0000-0000-0000-0000000000c3');
insert into public.categorias (slug, nome, publicado) values ('concorrencia', 'Concorrência', true);
insert into public.produtos (categoria_id, slug, nome, publicado)
  select id, 'produto-concorrencia', 'Produto da concorrência', true from public.categorias where slug = 'concorrencia';
insert into public.variacoes (produto_id, aroma, tamanho, preco_centavos, estoque, publicado, sku)
  select id, 'único', 'único', 1000, 1, true, 'CONC-T13' from public.produtos where slug = 'produto-concorrencia'
  union all
  select id, 'outro', 'outro', 1000, 5, true, 'CONC-T12' from public.produtos where slug = 'produto-concorrencia';
SQL

pedido() { # $1 = comprador, $2 = sku, $3 = quantidade
  local subtotal=$(( $3 * 1000 ))
  echo "select public.criar_pedido('$1', jsonb_build_array(jsonb_build_object('variacao_id', (select id from public.variacoes where sku = '$2'), 'quantidade', $3, 'preco_centavos', 1000)), '01310100', 'retirada', 0, 'Retirada', 'a combinar', $subtotal, $subtotal, '11900000000')::text;"
}

# A abre a transação, roda $1 e segura a trava até ver B esperando por ela; B roda $2.
concorrer() {
  "${PSQL[@]}" > "$TMP/a" <<SQL &
set application_name = 'conc-a';
set role service_role;
begin;
$1
-- De volta ao superusuário: com o papel service_role, o pg_stat_activity esconde a espera de B.
reset role;
do \$\$ begin
  for i in 1..200 loop
    perform pg_stat_clear_snapshot();
    exit when exists (select 1 from pg_stat_activity where datname = current_database() and application_name = 'conc-b' and wait_event_type = 'Lock');
    perform pg_sleep(0.05);
  end loop;
end \$\$;
select pg_stat_clear_snapshot();
select 'b-esperou=' || exists (select 1 from pg_stat_activity where datname = current_database() and application_name = 'conc-b' and wait_event_type = 'Lock');
commit;
SQL
  local pid_a=$!
  # Só solta B quando A já fez o trabalho e está segurando a trava (no laço de espera).
  local pronto=""
  for _ in $(seq 1 200); do
    pronto="$(sql "select 1 from pg_stat_activity where datname = current_database() and application_name = 'conc-a' and wait_event = 'PgSleep'")"
    [[ -n "$pronto" ]] && break
    sleep 0.05
  done
  [[ -n "$pronto" ]] || { wait "$pid_a" || true; falhar "a sessão A não chegou ao ponto de espera: $(cat "$TMP/a")"; }
  "${PSQL[@]}" > "$TMP/b" 2>&1 <<SQL &
set application_name = 'conc-b';
set role service_role;
$2
SQL
  local pid_b=$!
  wait "$pid_a" || falhar "a sessão A falhou: $(cat "$TMP/a")"
  wait "$pid_b" || falhar "a sessão B falhou: $(cat "$TMP/b")"
  grep -qx 'b-esperou=true' "$TMP/a" || falhar "B não esperou a trava de A (o teste rodou em sequência): $(cat "$TMP/a")"
}

# ---------------------------------------------------------------- T13
concorrer "$(pedido 00000000-0000-0000-0000-0000000000c1 CONC-T13 1)" "$(pedido 00000000-0000-0000-0000-0000000000c2 CONC-T13 1)"
grep -q '"ok": true' "$TMP/a" || falhar "T13: A não reservou: $(cat "$TMP/a")"
grep -q '"ok": false' "$TMP/b" && grep -q '"tipo": "esgotou"' "$TMP/b" && grep -q '"disponivel": 0' "$TMP/b" \
  || falhar "T13: B deveria receber esgotou com 0 disponível: $(cat "$TMP/b")"
[[ "$(sql "select estoque from public.variacoes where sku = 'CONC-T13'")" == 0 ]] || falhar "T13: estoque final diferente de 0"
[[ "$(sql "select count(*) from public.itens_pedido i join public.variacoes v on v.id = i.variacao_id where v.sku = 'CONC-T13'")" == 1 ]] \
  || falhar "T13: mais de um pedido com o último item"

# ---------------------------------------------------------------- T12
concorrer "$(pedido 00000000-0000-0000-0000-0000000000c3 CONC-T12 2)" "$(pedido 00000000-0000-0000-0000-0000000000c3 CONC-T12 2)"
id_a="$(grep -o '"pedido_id": "[^"]*"' "$TMP/a" || true)"
id_b="$(grep -o '"pedido_id": "[^"]*"' "$TMP/b" || true)"
[[ -n "$id_a" && "$id_a" == "$id_b" ]] || falhar "T12: duas abas, dois pedidos: A=$(cat "$TMP/a") B=$(cat "$TMP/b")"
grep -q '"reaproveitado": true' "$TMP/b" || falhar "T12: B não reaproveitou o pedido de A: $(cat "$TMP/b")"
[[ "$(sql "select estoque from public.variacoes where sku = 'CONC-T12'")" == 3 ]] || falhar "T12: a reserva baixou mais de uma vez"
[[ "$(sql "select count(*) from public.pedidos where usuario_id = '00000000-0000-0000-0000-0000000000c3' and status = 'aberto'")" == 1 ]] \
  || falhar "T12: mais de um pedido aberto"

# ---------------------------------------------------------------- devolução uma vez só
p13="$(sql "select id from public.pedidos where usuario_id = '00000000-0000-0000-0000-0000000000c1' and status = 'aberto'")"
[[ -n "$p13" ]] || falhar "devolução: o pedido do T13 sumiu"
concorrer "select 'a=' || public.cancelar_pedido_aberto('$p13');" "select 'b=' || public.cancelar_pedido_aberto('$p13');"
grep -qx 'a=true' "$TMP/a" || falhar "devolução: A não cancelou: $(cat "$TMP/a")"
grep -qx 'b=false' "$TMP/b" || falhar "devolução: B cancelou de novo: $(cat "$TMP/b")"
[[ "$(sql "select estoque from public.variacoes where sku = 'CONC-T13'")" == 1 ]] || falhar "devolução: a reserva voltou mais de uma vez (ou nenhuma)"

# Limpa a carga própria (o banco da bancada é descartável, mas o próximo teste não herda nada).
"${PSQL[@]}" <<'SQL'
delete from public.itens_pedido where variacao_id in (select id from public.variacoes where sku like 'CONC-%');
delete from public.pedidos where usuario_id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
delete from public.variacoes where sku like 'CONC-%';
delete from public.produtos where slug = 'produto-concorrencia';
delete from public.categorias where slug = 'concorrencia';
delete from auth.users where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
SQL
echo "concorrência: T13, T12 e devolução com duas sessões verdes"
