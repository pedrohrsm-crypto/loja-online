-- Pix do Mercado Pago pela Orders API (F4a, #32).
--
-- O que nasce aqui:
--   1. em `pedidos`, a ligação com a order do Mercado Pago (`mp_order_id`, única: a notificação
--      chega ao pedido por ela, nunca pelo `external_reference` da notificação; FIDELIDADE §1, regra 4),
--      o Pix para a tela (copia e cola, imagem do QR, link) e as marcas da reconciliação;
--   2. `confirmar_pagamento_mp`: o ÚNICO caminho que marca um pedido com itens como pago a partir do
--      Mercado Pago. Confere modo (T16), pedido (T10b), valor (T10b) e faz a transição monotônica
--      aberto → pago com a linha travada (T9). Pago depois de expirar (T5): com estoque, reserva de
--      novo e marca pago; sem estoque, marca o alerta de estorno pendente (o estorno é da F4b);
--   3. `travas_rotina` com `adquirir_trava_rotina` e `liberar_trava_rotina`: a reconciliação de 15 min
--      e a diária não rodam por cima uma da outra.
--
-- Quem escreve cada coluna (procurado com grep em 4-Nov, `eda9eec`):
--   - status, pago_em: criar_pedido, cancelar_pedido_aberto, expirar_pedidos_vencidos (migration
--     20261103000001) e, no legado do starter, lib/pagamentos/repositorios.ts (Stripe, só linhas com
--     `produto`). A partir daqui, para pedidos com itens, só confirmar_pagamento_mp marca pago.
--   - mp_*: só lib/pagamentos/cobranca.ts (criação e cancelamento da order), pela service_role.
--   - alerta_pagamento, alerta_em, reativado_em: só confirmar_pagamento_mp.
-- authenticated não escreve nenhuma coluna de pedidos (GRANT só de SELECT, por coluna), e o ASSERT
-- no fim prova isso de novo para as colunas novas.
--
-- Schema antigo: o código tolera esta migration ainda não aplicada (42703/PGRST204 nas colunas e
-- PGRST202 na função): a tela diz "pagamento indisponível", nunca 500, e nada é cobrado.
-- Ordem: tabelas → funções → privilégios → ASSERT (04, 1.3).

-- ------------------------------------------------------------------ tabelas
alter table public.pedidos
  -- ORD… do Mercado Pago. Única: uma order nunca serve a dois pedidos.
  add column mp_order_id text unique check (char_length(mp_order_id) between 1 and 64),
  -- O Pix para a tela 7. O copia e cola e a imagem são do próprio comprador (a RLS dá só a linha dele).
  add column mp_qr_code text check (char_length(mp_qr_code) between 1 and 2000),
  add column mp_qr_code_base64 text check (char_length(mp_qr_code_base64) between 1 and 200000),
  add column mp_ticket_url text check (char_length(mp_ticket_url) between 1 and 2000),
  add column mp_criado_em timestamptz,
  -- A order do pedido cancelado foi cancelada também no Mercado Pago (substituído ou expirado).
  add column mp_cancelado_em timestamptz,
  -- Pago depois de expirar, com estoque: o pedido voltou de 'cancelado' para 'pago' (T5).
  add column reativado_em timestamptz,
  -- O que a dona precisa olhar: pago sem estoque (estorno pendente, F4b), valor ou pedido divergente.
  add column alerta_pagamento text check (alerta_pagamento in ('estorno-pendente', 'valor-divergente', 'pedido-divergente')),
  add column alerta_em timestamptz;

-- A cobrança Pix só existe em pedido com itens, e o Pix chega inteiro (código e imagem juntos).
alter table public.pedidos add constraint pedidos_mp_so_com_itens check (mp_order_id is null or produto is null);
alter table public.pedidos add constraint pedidos_mp_pix_inteiro check ((mp_order_id is null) = (mp_criado_em is null));
alter table public.pedidos add constraint pedidos_alerta_com_data check ((alerta_pagamento is null) = (alerta_em is null));

-- A reconciliação de 15 min lê os Pix abertos e os cancelados que ainda têm order viva no Mercado Pago.
create index pedidos_pix_para_reconciliar on public.pedidos (criado_em)
  where mp_order_id is not null and mp_cancelado_em is null and status in ('aberto', 'cancelado');

create table public.travas_rotina (
  nome text primary key check (char_length(nome) between 1 and 60),
  dono uuid,
  travado_ate timestamptz not null default '-infinity'
);
alter table public.travas_rotina enable row level security;

-- ------------------------------------------------------------------ funções
-- Todas SECURITY INVOKER (rodam com a service_role de quem chama), como as do #27.

-- Confirma o pagamento de uma order do Mercado Pago. Os valores vêm do GET /v1/orders/{id} feito
-- pelo servidor (nunca do corpo da notificação, que não é assinado). Devolve:
--   'pago'              aberto → pago agora (a reserva já era a baixa do estoque);
--   'reativado'         estava cancelado (expirou/substituído), havia estoque: reservou de novo e pagou (T5);
--   'ja-pago'           já estava pago ou estornado: nada muda (T8, T9);
--   'estorno-pendente'  estava cancelado e não há estoque: alerta para a dona, nada de pago (T5);
--   'valor-divergente'  valor da order ≠ total congelado: alerta, nada de pago (T10b);
--   'pedido-divergente' external_reference ≠ id do pedido ligado à order: alerta, nada de pago (T10b);
--   'modo-divergente'   order de teste num pedido de produção, ou o contrário: nada muda (T16);
--   'nao-encontrado'    nenhum pedido com itens tem esta order.
create function public.confirmar_pagamento_mp(
  p_mp_order_id text,
  p_external_reference text,
  p_valor_centavos integer,
  p_modo text
) returns text
  language plpgsql security invoker set search_path = '' as $$
declare
  v public.pedidos%rowtype;
  v_item record;
  v_falta integer;
  n integer;
begin
  if p_mp_order_id is null or p_valor_centavos is null or p_modo is null or p_modo not in ('teste', 'producao') then
    raise exception 'argumentos inválidos' using errcode = '22023';
  end if;

  -- A linha do pedido travada: duas notificações do mesmo pagamento passam aqui uma de cada vez (T9).
  select * into v from public.pedidos where mp_order_id = p_mp_order_id and produto is null for update;
  if not found then return 'nao-encontrado'; end if;
  if v.status in ('pago', 'estornado') then return 'ja-pago'; end if;
  if v.modo <> p_modo then return 'modo-divergente'; end if;

  if p_external_reference is distinct from v.id::text then
    update public.pedidos set alerta_pagamento = 'pedido-divergente', alerta_em = now() where id = v.id and alerta_pagamento is null;
    return 'pedido-divergente';
  end if;
  if p_valor_centavos <> v.total_centavos then
    update public.pedidos set alerta_pagamento = 'valor-divergente', alerta_em = now() where id = v.id and alerta_pagamento is null;
    return 'valor-divergente';
  end if;

  if v.status = 'aberto' then
    update public.pedidos set status = 'pago', pago_em = now() where id = v.id and status = 'aberto';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'marcar pago tocou % linhas', n; end if;
    return 'pago';
  end if;

  -- Daqui para baixo, o pedido está 'cancelado' e a reserva já voltou ao estoque (T5).
  if v.alerta_pagamento = 'estorno-pendente' then return 'estorno-pendente'; end if;
  perform 1 from public.variacoes
    where id in (select variacao_id from public.itens_pedido where pedido_id = v.id)
    order by id for update;
  select count(*) into v_falta
    from public.itens_pedido i join public.variacoes va on va.id = i.variacao_id
   where i.pedido_id = v.id and va.estoque < i.quantidade;
  if v_falta > 0 then
    update public.pedidos set alerta_pagamento = 'estorno-pendente', alerta_em = now() where id = v.id and alerta_pagamento is null;
    return 'estorno-pendente';
  end if;
  for v_item in select variacao_id, quantidade from public.itens_pedido where pedido_id = v.id order by variacao_id loop
    update public.variacoes set estoque = estoque - v_item.quantidade
     where id = v_item.variacao_id and estoque >= v_item.quantidade;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'nova reserva tocou % linhas da variação %', n, v_item.variacao_id; end if;
  end loop;
  update public.pedidos
     set status = 'pago', pago_em = now(), reativado_em = now(), reserva_devolvida_em = null
   where id = v.id and status = 'cancelado';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'reativar tocou % linhas', n; end if;
  return 'reativado';
end $$;

-- Trava de rotina por prazo (a conexão do PostgREST não guarda advisory lock entre chamadas).
-- Devolve o dono (uuid) quando pegou a trava; null quando outra execução ainda a tem.
create function public.adquirir_trava_rotina(p_nome text, p_duracao interval) returns uuid
  language plpgsql security invoker set search_path = '' as $$
declare
  v_dono uuid := gen_random_uuid();
  n integer;
begin
  if p_duracao is null or p_duracao <= interval '0' or p_duracao > interval '1 hour' then
    raise exception 'duração inválida' using errcode = '22023';
  end if;
  insert into public.travas_rotina (nome) values (p_nome) on conflict (nome) do nothing;
  update public.travas_rotina set dono = v_dono, travado_ate = now() + p_duracao
   where nome = p_nome and travado_ate < now();
  get diagnostics n = row_count;
  return case when n = 1 then v_dono else null end;
end $$;

-- Só o dono solta. true = soltou; false = a trava já era de outro (venceu e foi tomada).
create function public.liberar_trava_rotina(p_nome text, p_dono uuid) returns boolean
  language plpgsql security invoker set search_path = '' as $$
declare
  n integer;
begin
  update public.travas_rotina set dono = null, travado_ate = '-infinity' where nome = p_nome and dono = p_dono;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- ------------------------------------------------------------------ privilégios
-- REVOKE de PUBLIC não basta no Supabase: os privilégios padrão dão EXECUTE e ALL a anon (04, 1.6).
revoke all on public.travas_rotina from public, anon, authenticated;
revoke execute on function public.confirmar_pagamento_mp(text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.adquirir_trava_rotina(text, interval) from public, anon, authenticated;
revoke execute on function public.liberar_trava_rotina(text, uuid) from public, anon, authenticated;
grant execute on function public.confirmar_pagamento_mp(text, text, integer, text) to service_role;
grant execute on function public.adquirir_trava_rotina(text, interval) to service_role;
grant execute on function public.liberar_trava_rotina(text, uuid) to service_role;
-- O comprador lê o Pix do próprio pedido (a policy pedidos_ler_os_proprios dá só a linha dele).
-- Fora do GRANT: mp_order_id, mp_ticket_url, mp_criado_em, mp_cancelado_em, reativado_em, alerta_* (internas).
grant select (mp_qr_code, mp_qr_code_base64) on public.pedidos to authenticated;

-- ------------------------------------------------------------------ ASSERT
do $$
declare
  papel text;
  coluna text;
  funcao text;
begin
  foreach papel in array array['anon', 'authenticated'] loop
    -- Nenhuma escrita em pedidos, em nenhuma coluna (as novas incluídas).
    assert not has_any_column_privilege(papel, 'public.pedidos', 'insert'), format('%s cria em pedidos', papel);
    assert not has_any_column_privilege(papel, 'public.pedidos', 'update'), format('%s altera pedidos', papel);
    assert not has_table_privilege(papel, 'public.pedidos', 'select'), format('%s lê pedidos inteira', papel);
    foreach coluna in array array['mp_order_id', 'mp_ticket_url', 'mp_criado_em', 'mp_cancelado_em', 'reativado_em', 'alerta_pagamento', 'alerta_em', 'status', 'pago_em'] loop
      assert not has_column_privilege(papel, 'public.pedidos', coluna, 'update'), format('%s altera pedidos.%s', papel, coluna);
    end loop;
    foreach coluna in array array['mp_order_id', 'mp_ticket_url', 'mp_criado_em', 'mp_cancelado_em', 'reativado_em', 'alerta_pagamento', 'alerta_em'] loop
      assert not has_column_privilege(papel, 'public.pedidos', coluna, 'select'), format('%s lê pedidos.%s', papel, coluna);
    end loop;
    assert not has_table_privilege(papel, 'public.travas_rotina', 'select'), format('%s lê travas_rotina', papel);
    assert not has_table_privilege(papel, 'public.travas_rotina', 'update'), format('%s altera travas_rotina', papel);
    assert not has_table_privilege(papel, 'public.travas_rotina', 'insert'), format('%s cria em travas_rotina', papel);
  end loop;
  assert not has_any_column_privilege('anon', 'public.pedidos', 'select'), 'anon lê pedidos';
  foreach coluna in array array['mp_qr_code', 'mp_qr_code_base64', 'status', 'total_centavos', 'expira_em'] loop
    assert has_column_privilege('authenticated', 'public.pedidos', coluna, 'select'), format('authenticated não lê pedidos.%s', coluna);
  end loop;
  assert (select relrowsecurity from pg_class where oid = 'public.travas_rotina'::regclass), 'RLS desligada em travas_rotina';
  assert (select relrowsecurity from pg_class where oid = 'public.pedidos'::regclass), 'RLS desligada em pedidos';

  foreach funcao in array array[
    'public.confirmar_pagamento_mp(text, text, integer, text)',
    'public.adquirir_trava_rotina(text, interval)',
    'public.liberar_trava_rotina(text, uuid)'
  ] loop
    assert not has_function_privilege('anon', funcao, 'execute'), format('anon executa %s', funcao);
    assert not has_function_privilege('authenticated', funcao, 'execute'), format('authenticated executa %s', funcao);
    assert has_function_privilege('service_role', funcao, 'execute'), format('service_role sem %s', funcao);
    assert not (select prosecdef from pg_proc where oid = funcao::regprocedure), format('%s é SECURITY DEFINER', funcao);
  end loop;
  assert has_table_privilege('service_role', 'public.travas_rotina', 'update'), 'service_role não trava rotina';
  assert has_table_privilege('service_role', 'public.pedidos', 'update'), 'service_role não grava a order';
end $$;
