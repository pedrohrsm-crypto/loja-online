-- Pix do Mercado Pago (#32): chama toda função nova (04, 1.12) e prova T9 (duas confirmações do mesmo
-- pagamento pagam uma vez), T10b (valor e pedido divergentes não pagam), T16 (modo trocado não muda nada),
-- T5 (pago depois de expirar: com estoque reativa; sem estoque, estorno pendente), a trava de rotina e
-- quem pode o quê.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@teste'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@teste');

create function pg_temp.v(p_sku text) returns uuid language sql as
  $$ select id from public.variacoes where sku = p_sku $$;
create function pg_temp.estoque(p_sku text) returns integer language sql as
  $$ select estoque from public.variacoes where sku = p_sku $$;
-- 1 vela de lavanda 150 g (R$ 45,00) + frete R$ 30,00 = R$ 75,00, ligada à order p_order.
create function pg_temp.pedido_com_pix(p_usuario uuid, p_order text, p_qtd integer default 1) returns uuid language plpgsql as $$
declare r jsonb; v_id uuid;
begin
  r := public.criar_pedido(p_usuario,
    jsonb_build_array(jsonb_build_object('variacao_id', pg_temp.v('VEL-ARO-LAV-150'), 'quantidade', p_qtd, 'preco_centavos', 4500)),
    '20040002', 'correios', 3000, 'Sudeste e Sul', '4 a 9 dias úteis', 4500 * p_qtd, 4500 * p_qtd + 3000, '21900000000', 'Ana Exemplo', 'Rua de Exemplo, 10');
  if not (r->>'ok')::boolean then raise exception 'pedido não nasceu: %', r; end if;
  v_id := (r->>'pedido_id')::uuid;
  update public.pedidos set mp_order_id = p_order, mp_qr_code = '000201-exemplo', mp_qr_code_base64 = 'aW1n', mp_criado_em = now(), modo = 'teste'
   where id = v_id and status = 'aberto' and mp_order_id is null;
  return v_id;
end $$;
grant execute on function pg_temp.v(text), pg_temp.estoque(text), pg_temp.pedido_com_pix(uuid, text, integer) to service_role;

set local role service_role;

do $$
declare
  p uuid;
  p2 uuid;
  lav integer;
  r public.pedidos%rowtype;
  dono uuid;
begin
  -- ------------------------------------------------ aberto → pago, uma vez só (T3, T9, T8)
  p := pg_temp.pedido_com_pix('00000000-0000-0000-0000-0000000000e1', 'ORD-T9');
  lav := pg_temp.estoque('VEL-ARO-LAV-150');
  assert public.confirmar_pagamento_mp('ORD-T9', p::text, 7500, 'teste') = 'pago', 'primeira confirmação não pagou';
  assert public.confirmar_pagamento_mp('ORD-T9', p::text, 7500, 'teste') = 'ja-pago', 'segunda confirmação não foi ja-pago';
  select * into r from public.pedidos where id = p;
  assert r.status = 'pago' and r.pago_em is not null and r.reativado_em is null and r.alerta_pagamento is null, format('pago gravado errado: %s', r.status);
  assert pg_temp.estoque('VEL-ARO-LAV-150') = lav, 'pagar mexeu no estoque (a reserva já era a baixa)';

  -- ------------------------------------------------ T10b e T16: nada vira pago
  p := pg_temp.pedido_com_pix('00000000-0000-0000-0000-0000000000e2', 'ORD-T10B');
  assert public.confirmar_pagamento_mp('ORD-T10B', p::text, 7500, 'producao') = 'modo-divergente', 'modo trocado passou';
  assert public.confirmar_pagamento_mp('ORD-T10B', p::text, 7400, 'teste') = 'valor-divergente', 'valor divergente passou';
  select * into r from public.pedidos where id = p;
  assert r.status = 'aberto' and r.alerta_pagamento = 'valor-divergente' and r.alerta_em is not null, format('valor divergente: %s %s', r.status, r.alerta_pagamento);
  assert public.confirmar_pagamento_mp('ORD-T10B', gen_random_uuid()::text, 7500, 'teste') = 'pedido-divergente', 'outro pedido passou';
  assert (select status from public.pedidos where id = p) = 'aberto', 'pedido divergente virou pago';
  assert public.confirmar_pagamento_mp('ORD-QUE-NAO-EXISTE', p::text, 7500, 'teste') = 'nao-encontrado', 'order inexistente achou pedido';
  -- limpa o aberto do e2 para o T5 abaixo
  assert public.cancelar_pedido_aberto(p), 'não cancelou o pedido do T10b';

  -- ------------------------------------------------ T5 com estoque: reativa e baixa de novo
  p := pg_temp.pedido_com_pix('00000000-0000-0000-0000-0000000000e2', 'ORD-T5');
  lav := pg_temp.estoque('VEL-ARO-LAV-150');
  assert public.cancelar_pedido_aberto(p), 'não expirou o pedido do T5';
  assert pg_temp.estoque('VEL-ARO-LAV-150') = lav + 1, 'a expiração não devolveu a reserva';
  assert public.confirmar_pagamento_mp('ORD-T5', p::text, 7500, 'teste') = 'reativado', 'pago depois de expirar não reativou';
  select * into r from public.pedidos where id = p;
  assert r.status = 'pago' and r.reativado_em is not null and r.reserva_devolvida_em is null, format('reativado gravado errado: %s', r.status);
  assert pg_temp.estoque('VEL-ARO-LAV-150') = lav, 'a reativação não reservou de novo';
  assert public.confirmar_pagamento_mp('ORD-T5', p::text, 7500, 'teste') = 'ja-pago', 'segunda confirmação do reativado mudou algo';
  assert pg_temp.estoque('VEL-ARO-LAV-150') = lav, 'segunda confirmação baixou o estoque de novo';

  -- ------------------------------------------------ T5 sem estoque: estorno pendente, nada de pago
  p := pg_temp.pedido_com_pix('00000000-0000-0000-0000-0000000000e1', 'ORD-T5-SEM', 2);
  assert public.cancelar_pedido_aberto(p), 'não expirou o pedido do T5 sem estoque';
  lav := pg_temp.estoque('VEL-ARO-LAV-150');
  update public.variacoes set estoque = 1 where sku = 'VEL-ARO-LAV-150';
  assert public.confirmar_pagamento_mp('ORD-T5-SEM', p::text, 12000, 'teste') = 'estorno-pendente', 'sem estoque não marcou estorno pendente';
  select * into r from public.pedidos where id = p;
  assert r.status = 'cancelado' and r.alerta_pagamento = 'estorno-pendente', format('sem estoque: %s %s', r.status, r.alerta_pagamento);
  assert pg_temp.estoque('VEL-ARO-LAV-150') = 1, 'sem estoque mexeu no estoque';
  assert public.confirmar_pagamento_mp('ORD-T5-SEM', p::text, 12000, 'teste') = 'estorno-pendente', 'a repetição mudou o estorno pendente';
  update public.variacoes set estoque = lav where sku = 'VEL-ARO-LAV-150';

  -- ------------------------------------------------ a order é única: não serve a dois pedidos
  p2 := pg_temp.pedido_com_pix('00000000-0000-0000-0000-0000000000e1', 'ORD-UNICA');
  begin
    update public.pedidos set mp_order_id = 'ORD-UNICA' where id = p;
    raise exception 'a mesma order ligou dois pedidos';
  exception when unique_violation then null;
  end;

  -- ------------------------------------------------ trava de rotina: uma execução por vez
  dono := public.adquirir_trava_rotina('reconciliar', interval '5 minutes');
  assert dono is not null, 'a primeira execução não pegou a trava';
  assert public.adquirir_trava_rotina('reconciliar', interval '5 minutes') is null, 'a execução sobreposta pegou a trava';
  assert not public.liberar_trava_rotina('reconciliar', gen_random_uuid()), 'outro dono soltou a trava';
  assert public.liberar_trava_rotina('reconciliar', dono), 'o dono não soltou a trava';
  assert public.adquirir_trava_rotina('reconciliar', interval '5 minutes') is not null, 'a trava solta não foi pega de novo';
  update public.travas_rotina set travado_ate = now() - interval '1 second' where nome = 'reconciliar';
  assert public.adquirir_trava_rotina('reconciliar', interval '5 minutes') is not null, 'a trava vencida não foi retomada';
end $$;
reset role;

-- ------------------------------------------------ quem pode o quê
set local role authenticated;
do $$ begin
  perform public.confirmar_pagamento_mp('ORD-T9', 'x', 1, 'teste');
  raise exception 'authenticated confirmou pagamento';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.adquirir_trava_rotina('x', interval '1 minute');
  raise exception 'authenticated pegou trava';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.pedidos set mp_order_id = 'ORD-X';
  raise exception 'authenticated gravou mp_order_id';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform mp_order_id from public.pedidos limit 1;
  raise exception 'authenticated leu mp_order_id';
exception when insufficient_privilege then null;
end $$;
reset role;
set local role anon;
do $$ begin
  perform mp_qr_code from public.pedidos limit 1;
  raise exception 'anon leu o Pix';
exception when insufficient_privilege then null;
end $$;
reset role;
rollback;
