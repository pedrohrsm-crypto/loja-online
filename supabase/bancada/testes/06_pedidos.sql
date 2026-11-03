-- Pedido com itens e reserva de estoque (#27): chama toda função nova (04, 1.12) e prova,
-- em sequência, T12 (mesmo carrinho → mesmo pedido), T17c (variação fora do ar), T18 (o
-- pedido congelado não muda; carrinho novo é pedido novo), o 1 item da D-LO-8, a expiração
-- monotônica e quem pode o quê. A concorrência de verdade (T13 e T12 em duas sessões) está
-- em 07_pedidos_concorrencia.sh.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@teste'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@teste');

-- Atalho: id da variação pelo SKU da carga fictícia.
create function pg_temp.v(p_sku text) returns uuid language sql as
  $$ select id from public.variacoes where sku = p_sku $$;
create function pg_temp.estoque(p_sku text) returns integer language sql as
  $$ select estoque from public.variacoes where sku = p_sku $$;
-- Pedido por Correios para o CEP 01310-100 (faixa "Sudeste e Sul" não cobre; aqui só se
-- prova o banco: o frete chega pronto do servidor).
create function pg_temp.pedir(p_usuario uuid, p_itens jsonb, p_subtotal integer, p_frete integer default 3000)
  returns jsonb language sql as $$
  select public.criar_pedido(p_usuario, p_itens, '20040002', 'correios', p_frete, 'Sudeste e Sul', '4 a 9 dias úteis',
    p_subtotal, p_subtotal + p_frete, '21900000000', 'Ana Exemplo', 'Rua de Exemplo, 10')
$$;
grant execute on function pg_temp.v(text), pg_temp.estoque(text), pg_temp.pedir(uuid, jsonb, integer, integer) to service_role;

set local role service_role;

-- ---------------------------------------------------------------- criação, congelamento e T12
do $$
declare
  r jsonb;
  r2 jsonb;
  ale integer := pg_temp.estoque('SAB-ART-ALE-090');
  lav integer := pg_temp.estoque('VEL-ARO-LAV-150');
  p public.pedidos%rowtype;
  n integer;
begin
  -- 2 sabonetes de alecrim 90 g (R$ 22,00) + 1 vela de lavanda 150 g (R$ 45,00) + frete R$ 30,00.
  r := pg_temp.pedir('00000000-0000-0000-0000-0000000000f1', jsonb_build_array(
    jsonb_build_object('variacao_id', pg_temp.v('SAB-ART-ALE-090'), 'quantidade', 2, 'preco_centavos', 2200),
    jsonb_build_object('variacao_id', pg_temp.v('VEL-ARO-LAV-150'), 'quantidade', 1, 'preco_centavos', 4500)), 8900);
  assert (r->>'ok')::boolean, format('pedido não nasceu: %s', r);
  assert not (r->>'reaproveitado')::boolean and r->'substituido' = 'null'::jsonb, format('pedido novo marcado como reaproveitado: %s', r);
  select * into p from public.pedidos where id = (r->>'pedido_id')::uuid;
  assert p.status = 'aberto' and p.total_centavos = 11900 and p.subtotal_centavos = 8900 and p.frete_centavos = 3000,
    format('pedido gravado errado: %s %s %s', p.status, p.total_centavos, p.subtotal_centavos);
  assert p.expira_em between now() + interval '29 minutes' and now() + interval '31 minutes', format('prazo de %s', p.expira_em - now());
  assert p.cep = '20040002' and p.modo_entrega = 'correios' and p.produto is null, 'entrega gravada errada';
  assert pg_temp.estoque('SAB-ART-ALE-090') = ale - 2, 'reserva do sabonete não baixou 2';
  assert pg_temp.estoque('VEL-ARO-LAV-150') = lav - 1, 'reserva da vela não baixou 1';
  select count(*) into n from public.itens_pedido i where i.pedido_id = p.id
    and ((i.sku = 'SAB-ART-ALE-090' and i.quantidade = 2 and i.preco_unitario_centavos = 2200 and i.produto_nome = 'Sabonete artesanal')
      or (i.sku = 'VEL-ARO-LAV-150' and i.quantidade = 1 and i.preco_unitario_centavos = 4500 and i.aroma = 'lavanda'));
  assert n = 2, format('%s itens congelados certos (esperado 2)', n);

  -- T12 em sequência: a segunda aba com o mesmo carrinho cai no mesmo pedido, sem reservar de novo.
  r2 := pg_temp.pedir('00000000-0000-0000-0000-0000000000f1', jsonb_build_array(
    jsonb_build_object('variacao_id', pg_temp.v('VEL-ARO-LAV-150'), 'quantidade', 1, 'preco_centavos', 4500),
    jsonb_build_object('variacao_id', pg_temp.v('SAB-ART-ALE-090'), 'quantidade', 2, 'preco_centavos', 2200)), 8900);
  assert r2->>'pedido_id' = r->>'pedido_id' and (r2->>'reaproveitado')::boolean, format('segunda aba abriu outro pedido: %s', r2);
  assert pg_temp.estoque('SAB-ART-ALE-090') = ale - 2, 'segunda aba reservou de novo';

  -- T18: o carrinho mudou (3 sabonetes, sem a vela) → pedido novo; o anterior é cancelado, a
  -- reserva dele volta, e ele continua congelado como foi criado.
  r2 := pg_temp.pedir('00000000-0000-0000-0000-0000000000f1', jsonb_build_array(
    jsonb_build_object('variacao_id', pg_temp.v('SAB-ART-ALE-090'), 'quantidade', 3, 'preco_centavos', 2200)), 6600);
  assert (r2->>'ok')::boolean and r2->>'pedido_id' <> r->>'pedido_id', format('carrinho novo não virou pedido novo: %s', r2);
  assert r2->>'substituido' = r->>'pedido_id', format('substituido = %s', r2->>'substituido');
  select * into p from public.pedidos where id = (r->>'pedido_id')::uuid;
  assert p.status = 'cancelado' and p.reserva_devolvida_em is not null and p.total_centavos = 11900, 'pedido anterior não ficou cancelado e congelado';
  select count(*) into n from public.itens_pedido where pedido_id = p.id;
  assert n = 2, 'itens do pedido anterior mudaram';
  assert pg_temp.estoque('SAB-ART-ALE-090') = ale - 3, format('sabonete: %s (esperado %s)', pg_temp.estoque('SAB-ART-ALE-090'), ale - 3);
  assert pg_temp.estoque('VEL-ARO-LAV-150') = lav, 'a reserva da vela não voltou';
  select count(*) into n from public.pedidos where usuario_id = '00000000-0000-0000-0000-0000000000f1' and status = 'aberto';
  assert n = 1, format('%s pedidos abertos (esperado 1)', n);

  -- D-LO-8: pedido de 1 item, na retirada (sem endereço, sem frete).
  r := public.criar_pedido('00000000-0000-0000-0000-0000000000f2',
    jsonb_build_array(jsonb_build_object('variacao_id', pg_temp.v('OLE-BAN-LAR-100'), 'quantidade', 1, 'preco_centavos', 4600)),
    '01310100', 'retirada', 0, 'Retirada no ateliê', 'a combinar por WhatsApp', 4600, 4600, '11900000000');
  assert (r->>'ok')::boolean, format('pedido de 1 item não nasceu: %s', r);
  select * into p from public.pedidos where id = (r->>'pedido_id')::uuid;
  assert p.endereco is null and p.nome_recebedor is null and p.total_centavos = 4600, 'retirada gravada errada';
end $$;

-- ---------------------------------------------------------------- A-03 e T17c: nada é gravado
do $$
declare
  r jsonb;
  antes integer;
  ale integer := pg_temp.estoque('SAB-ART-ALE-090');
  n integer;
begin
  select count(*) into antes from public.pedidos;
  -- Variação em rascunho, variação de produto em rascunho, preço que mudou e o que esgotou, junto
  -- com um item bom: volta a lista dos que mudaram e nenhum estoque se mexe.
  r := pg_temp.pedir('00000000-0000-0000-0000-0000000000f2', jsonb_build_array(
    jsonb_build_object('variacao_id', pg_temp.v('SAB-ART-ALE-090'), 'quantidade', 1, 'preco_centavos', 2200),
    jsonb_build_object('variacao_id', pg_temp.v('SAB-ARG-SEM-140'), 'quantidade', 1, 'preco_centavos', 3400),
    jsonb_build_object('variacao_id', pg_temp.v('VEL-AEH-ALE-150'), 'quantidade', 1, 'preco_centavos', 4800),
    jsonb_build_object('variacao_id', pg_temp.v('SAB-ART-LAV-090'), 'quantidade', 1, 'preco_centavos', 2000),
    jsonb_build_object('variacao_id', pg_temp.v('SAB-ART-LAR-140'), 'quantidade', 1, 'preco_centavos', 3000),
    jsonb_build_object('variacao_id', gen_random_uuid(), 'quantidade', 1, 'preco_centavos', 1000)), 15400);
  assert not (r->>'ok')::boolean and r->>'motivo' = 'mudou', format('esperado "mudou": %s', r);
  assert jsonb_array_length(r->'itens') = 5, format('%s itens marcados (esperado 5): %s', jsonb_array_length(r->'itens'), r);
  select count(*) into n from jsonb_array_elements(r->'itens') e where
    (e->>'variacao_id' = pg_temp.v('SAB-ARG-SEM-140')::text and e->>'tipo' = 'indisponivel')
    or (e->>'variacao_id' = pg_temp.v('VEL-AEH-ALE-150')::text and e->>'tipo' = 'indisponivel')
    or (e->>'variacao_id' = pg_temp.v('SAB-ART-LAV-090')::text and e->>'tipo' = 'preco-mudou' and (e->>'preco_centavos')::int = 2200)
    or (e->>'variacao_id' = pg_temp.v('SAB-ART-LAR-140')::text and e->>'tipo' = 'esgotou' and (e->>'disponivel')::int = 0);
  assert n = 4, format('itens marcados errados: %s', r->'itens');
  select count(*) into n from public.pedidos;
  assert n = antes, 'pedido gravado com item que mudou';
  assert pg_temp.estoque('SAB-ART-ALE-090') = ale, 'estoque mexeu num pedido recusado';

  -- Mais que o disponível (o comprador f2 tem 1 óleo reservado; a vela de alecrim 300 g tem 3).
  r := pg_temp.pedir('00000000-0000-0000-0000-0000000000f2', jsonb_build_array(
    jsonb_build_object('variacao_id', pg_temp.v('VEL-ARO-ALE-300'), 'quantidade', 4, 'preco_centavos', 7800)), 31200);
  assert r->'itens'->0->>'tipo' = 'esgotou' and (r->'itens'->0->>'disponivel')::int = 3, format('acima do estoque: %s', r);
  -- O pedido aberto de f2 continua de pé quando o novo é recusado.
  select count(*) into n from public.pedidos where usuario_id = '00000000-0000-0000-0000-0000000000f2' and status = 'aberto';
  assert n = 1, 'a recusa cancelou o pedido aberto do comprador';
end $$;

-- ---------------------------------------------------------------- entrada que o servidor nunca manda
do $$
declare
  sabonete jsonb := jsonb_build_array(jsonb_build_object('variacao_id', pg_temp.v('SAB-ART-ALE-090'), 'quantidade', 1, 'preco_centavos', 2200));
  caso text;
begin
  foreach caso in array array['subtotal', 'total', 'retirada-com-endereco', 'correios-sem-endereco', 'quantidade-zero', 'repetida', 'vazio', 'cep'] loop
    begin
      case caso
        when 'subtotal' then perform pg_temp.pedir('00000000-0000-0000-0000-0000000000f2', sabonete, 2000);
        when 'total' then perform public.criar_pedido('00000000-0000-0000-0000-0000000000f2', sabonete, '20040002', 'correios', 3000,
          'Sudeste e Sul', 'x', 2200, 1, '21900000000', 'Ana', 'Rua A, 1');
        when 'retirada-com-endereco' then perform public.criar_pedido('00000000-0000-0000-0000-0000000000f2', sabonete, '01310100', 'retirada', 0,
          'Retirada no ateliê', 'x', 2200, 2200, '11900000000', 'Ana', 'Rua A, 1');
        when 'correios-sem-endereco' then perform public.criar_pedido('00000000-0000-0000-0000-0000000000f2', sabonete, '20040002', 'correios', 3000,
          'Sudeste e Sul', 'x', 2200, 5200, '21900000000', 'Ana', null);
        when 'quantidade-zero' then perform pg_temp.pedir('00000000-0000-0000-0000-0000000000f2',
          jsonb_build_array(jsonb_build_object('variacao_id', pg_temp.v('SAB-ART-ALE-090'), 'quantidade', 0, 'preco_centavos', 2200)), 1);
        when 'repetida' then perform pg_temp.pedir('00000000-0000-0000-0000-0000000000f2', sabonete || sabonete, 4400);
        when 'vazio' then perform pg_temp.pedir('00000000-0000-0000-0000-0000000000f2', '[]'::jsonb, 1);
        when 'cep' then perform public.criar_pedido('00000000-0000-0000-0000-0000000000f2', sabonete, '2004-002', 'correios', 3000,
          'Sudeste e Sul', 'x', 2200, 5200, '21900000000', 'Ana', 'Rua A, 1');
      end case;
      raise exception 'aceitou o caso %', caso;
    exception
      when invalid_parameter_value or check_violation then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------- B1: o UPDATE direto não prende a reserva
-- Os dois UPDATE do starter, exatamente como estão em app/conta/acoes.ts (exclusão de conta) e em
-- app/api/cron/reconciliar/route.ts (abandono de 48 h), sobre um pedido com itens: a guarda
-- pedidos_cancelado_devolve_reserva recusa. O pagamento ('pago') continua passando.
do $$
declare
  p_id uuid;
  oleo integer := pg_temp.estoque('OLE-BAN-LAR-100');
begin
  select id into p_id from public.pedidos where usuario_id = '00000000-0000-0000-0000-0000000000f2' and status = 'aberto';
  assert p_id is not null, 'f2 sem pedido aberto para o teste da guarda';
  begin
    update public.pedidos set status = 'cancelado' where usuario_id = '00000000-0000-0000-0000-0000000000f2' and status = 'aberto';
    raise exception 'o UPDATE da exclusão de conta cancelou sem devolver a reserva';
  exception when check_violation then null;
  end;
  begin
    update public.pedidos set status = 'cancelado' where id = p_id and status = 'aberto';
    raise exception 'o UPDATE da reconciliação cancelou sem devolver a reserva';
  exception when check_violation then null;
  end;
  assert (select status from public.pedidos where id = p_id) = 'aberto', 'o pedido saiu de aberto';
  assert pg_temp.estoque('OLE-BAN-LAR-100') = oleo, 'o estoque mexeu';
  -- O caminho certo devolve; o pagamento não precisa da devolução (savepoint: volta a aberto depois).
  begin
    update public.pedidos set status = 'pago', pago_em = now() where id = p_id and status = 'aberto';
    assert found, 'a guarda recusou o pagamento';
    raise exception 'desfaz' using errcode = 'P0099';
  exception when sqlstate 'P0099' then null;
  end;
end $$;

-- ---------------------------------------------------------------- expiração monotônica
do $$
declare
  p_id uuid;
  oleo integer;
  n integer;
begin
  select id into p_id from public.pedidos where usuario_id = '00000000-0000-0000-0000-0000000000f2' and status = 'aberto';
  oleo := pg_temp.estoque('OLE-BAN-LAR-100');
  -- Venceu há 1 minuto: dentro da folga de 5, ainda não expira.
  update public.pedidos set expira_em = now() - interval '1 minute' where id = p_id;
  assert public.expirar_pedidos_vencidos() = 0, 'expirou dentro da folga';
  update public.pedidos set expira_em = now() - interval '6 minutes' where id = p_id;
  assert public.expirar_pedidos_vencidos() = 1, 'não expirou o vencido';
  assert pg_temp.estoque('OLE-BAN-LAR-100') = oleo + 1, 'a reserva não voltou';
  -- De novo, pelos dois caminhos: devolve uma vez só.
  assert public.expirar_pedidos_vencidos() = 0, 'expirou duas vezes';
  assert not public.cancelar_pedido_aberto(p_id), 'cancelou duas vezes';
  assert pg_temp.estoque('OLE-BAN-LAR-100') = oleo + 1, format('a reserva voltou mais de uma vez: %s', pg_temp.estoque('OLE-BAN-LAR-100') - oleo);
  select count(*) into n from public.pedidos where id = p_id and status = 'cancelado' and cancelado_em is not null and reserva_devolvida_em is not null;
  assert n = 1, 'pedido expirado sem status e datas';
  -- Pedido pago nunca é cancelado pela expiração.
  update public.pedidos set status = 'pago', pago_em = now(), expira_em = now() - interval '1 day'
    where usuario_id = '00000000-0000-0000-0000-0000000000f1' and status = 'aberto' returning id into p_id;
  assert public.expirar_pedidos_vencidos() = 0, 'expirou pedido pago';
  assert not public.cancelar_pedido_aberto(p_id), 'cancelou pedido pago';
  -- Nenhum trigger usa as funções novas (se um nascer, precisa de caso aqui).
  select count(*) into n from pg_trigger where not tgisinternal and tgfoid in (
    'public.criar_pedido(uuid, jsonb, text, text, integer, text, text, integer, integer, text, text, text)'::regprocedure,
    'public.cancelar_pedido_aberto(uuid)'::regprocedure, 'public.expirar_pedidos_vencidos(interval, integer)'::regprocedure);
  assert n = 0, format('%s triggers usam as funções de pedido (esperado 0)', n);
end $$;
reset role;

-- ---------------------------------------------------------------- quem pode o quê
create function pg_temp.recusa(papel text) returns void language plpgsql as $$
declare
  sql text;
begin
  foreach sql in array array[
    'select public.criar_pedido(''00000000-0000-0000-0000-0000000000f1'', ''[]'', ''01310100'', ''retirada'', 0, ''x'', ''x'', 1, 1, ''11900000000'')',
    'select public.cancelar_pedido_aberto(gen_random_uuid())',
    'select public.expirar_pedidos_vencidos()',
    'select stripe_sessao_id from public.pedidos',
    'select reserva_devolvida_em from public.pedidos',
    'select * from public.pedidos',
    'update public.pedidos set total_centavos = 1',
    'update public.pedidos set status = ''pago''',
    'insert into public.itens_pedido (pedido_id, variacao_id, quantidade, preco_unitario_centavos, produto_nome, aroma, tamanho, sku) select id, gen_random_uuid(), 1, 1, ''x'', ''x'', ''x'', ''x'' from public.pedidos limit 1',
    'update public.itens_pedido set preco_unitario_centavos = 1',
    'delete from public.itens_pedido'
  ] loop
    begin
      execute sql;
      raise exception '% conseguiu: %', papel, sql;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
grant execute on function pg_temp.recusa(text) to anon, authenticated;

set local role anon;
do $$ begin
  perform pg_temp.recusa('anon');
  begin
    perform id from public.itens_pedido;
    raise exception 'anon leu itens_pedido';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', true); end $$;
do $$ declare n int; begin
  perform pg_temp.recusa('authenticated');
  -- f2 vê só os próprios pedidos e itens, pelas colunas do GRANT.
  select count(*) into n from (select id, total_centavos, endereco, expira_em from public.pedidos) p;
  assert n = 1, format('f2 vê %s pedidos (esperado 1)', n);
  select count(*) into n from (select pedido_id, produto_nome, preco_unitario_centavos from public.itens_pedido) i;
  assert n = 1, format('f2 vê %s itens (esperado 1)', n);
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true); end $$;
do $$ declare n int; begin
  select count(*) into n from (select id from public.pedidos) p;
  assert n = 2, format('f1 vê %s pedidos (esperado 2)', n);
  select count(*) into n from (select id from public.itens_pedido) i;
  assert n = 3, format('f1 vê %s itens (esperado 3)', n);
end $$;
rollback;
