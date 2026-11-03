-- Pedido com vários itens, frete pelo CEP e reserva de estoque (#27).
--
-- Por que EVOLUIR `pedidos` em vez de criar outra tabela: a FIDELIDADE.md §1 (regra 5) e a
-- DESCOBERTA.md §8 já nomeiam `pedidos` e `itens_pedido`; a RLS de leitura do dono, o
-- `on delete set null` da exclusão de conta e o status monotônico continuam valendo; e não
-- há dado real em produção (medido em 3-Nov, `343db3e`). As colunas do starter (`produto`,
-- `valor_centavos`, `stripe_*`) ficam até a F4 trocar o Stripe pelo Mercado Pago: o código
-- de hoje continua lendo e gravando nelas enquanto esta migration já está aplicada.
--
-- Quem escreve: só o servidor (service_role), pelas funções abaixo. O cliente só LÊ os
-- próprios pedidos e itens, coluna por coluna (RLS protege linhas, não colunas: 04, 1.4).
-- A reserva é a própria baixa em `variacoes.estoque`: o que a vitrine mostra já desconta o
-- que está reservado. A devolução acontece uma vez só (`reserva_devolvida_em`).
--
-- Onde mora cada regra (uma regra, um lugar):
--   - teto por item, subtotal, total e a escolha do frete pelo CEP: lib/pedidos/regras.ts e
--     lib/catalogo/frete.ts (TypeScript, no servidor). O banco NÃO recalcula: confere.
--   - estoque disponível, preço de hoje, variação publicada e o prazo de 30 min: aqui.
-- Ordem: tabelas → funções → policies → ASSERT (04, 1.3).

-- ------------------------------------------------------------------ tabelas
alter table public.pedidos
  alter column produto drop not null,
  alter column valor_centavos drop not null,
  add column subtotal_centavos integer check (subtotal_centavos > 0),
  add column frete_centavos integer check (frete_centavos >= 0),
  add column total_centavos integer check (total_centavos > 0),
  add column modo_entrega text check (modo_entrega in ('correios', 'motoboy', 'retirada')),
  -- CEP gravado (8 dígitos): é dele que o frete saiu, nunca de um id do formulário (regra 3).
  add column cep text check (cep ~ '^[0-9]{8}$'),
  -- Nome e prazo da faixa no momento da compra: o pedido não muda se a dona editar a tabela.
  add column frete_regiao text check (char_length(frete_regiao) between 1 and 80),
  add column frete_prazo text check (char_length(frete_prazo) between 1 and 80),
  -- Dado pessoal para a entrega (base: contrato). Nunca vai para o log.
  add column nome_recebedor text check (char_length(nome_recebedor) between 1 and 120),
  add column telefone text check (telefone ~ '^[0-9]{10,11}$'),
  add column endereco text check (char_length(endereco) between 1 and 200),
  add column expira_em timestamptz,
  add column cancelado_em timestamptz,
  add column reserva_devolvida_em timestamptz;

-- Uma linha é do starter (produto único) OU um pedido com itens, nunca uma mistura.
alter table public.pedidos add constraint pedidos_legado_ou_com_itens check (
  (produto is not null and valor_centavos is not null and total_centavos is null)
  or (
    produto is null and valor_centavos is null
    and subtotal_centavos is not null and frete_centavos is not null and total_centavos is not null
    and modo_entrega is not null and cep is not null and frete_regiao is not null and frete_prazo is not null
    and telefone is not null and expira_em is not null
    -- Invariante do pedido congelado (quem calcula é lib/pedidos/regras.ts; aqui só se confere).
    and total_centavos = subtotal_centavos + frete_centavos
    -- Retirada não leva endereço (o do ateliê nunca entra: regra 7); as outras levam endereço e quem recebe.
    and (modo_entrega = 'retirada') = (endereco is null)
    and (modo_entrega = 'retirada' or nome_recebedor is not null)
  )
);
-- Devolveu a reserva ⇒ saiu de 'aberto'. Nunca o contrário de volta.
alter table public.pedidos add constraint pedidos_reserva_so_fora_de_aberto check (
  reserva_devolvida_em is null or status <> 'aberto'
);

-- Um pedido com itens ABERTO por comprador: duas abas caem no mesmo pedido (T12). O índice
-- do starter (um aberto por usuário e produto) continua valendo só para as linhas antigas.
create unique index pedidos_um_aberto_por_usuario on public.pedidos (usuario_id)
  where status = 'aberto' and produto is null;
-- A rotina de expiração lê os abertos pelo prazo.
create index pedidos_abertos_por_prazo on public.pedidos (expira_em)
  where status = 'aberto' and produto is null;

create table public.itens_pedido (
  id uuid primary key default gen_random_uuid(),
  -- restrict: registro de venda não some (a conta excluída deixa o pedido sem titular).
  pedido_id uuid not null references public.pedidos (id) on delete restrict,
  variacao_id uuid not null references public.variacoes (id) on delete restrict,
  quantidade integer not null check (quantidade > 0),
  -- Congelados na criação: preço e descrição como o comprador viu.
  preco_unitario_centavos integer not null check (preco_unitario_centavos > 0),
  produto_nome text not null check (char_length(produto_nome) between 1 and 120),
  aroma text not null check (char_length(aroma) between 1 and 60),
  tamanho text not null check (char_length(tamanho) between 1 and 60),
  sku text not null check (char_length(sku) between 1 and 40),
  unique (pedido_id, variacao_id)
);
create index itens_pedido_variacao on public.itens_pedido (variacao_id);

-- Privilégios: revoga o padrão do Supabase (04, 1.6) e concede só a leitura, por coluna.
alter table public.itens_pedido enable row level security;
revoke all on public.pedidos, public.itens_pedido from public, anon, authenticated;
-- Fora do GRANT: stripe_sessao_id, stripe_pagamento_id, modo e reserva_devolvida_em (internas).
grant select (
  id, usuario_id, produto, valor_centavos, status, criado_em, pago_em, estornado_em,
  subtotal_centavos, frete_centavos, total_centavos, modo_entrega, cep, frete_regiao, frete_prazo,
  nome_recebedor, telefone, endereco, expira_em, cancelado_em
) on public.pedidos to authenticated;
grant select (
  id, pedido_id, variacao_id, quantidade, preco_unitario_centavos, produto_nome, aroma, tamanho, sku
) on public.itens_pedido to authenticated;

-- ------------------------------------------------------------------ funções
-- Todas SECURITY INVOKER: rodam com os privilégios de quem chama (service_role). Um GRANT
-- dado por engano a authenticated não abriria a escrita, porque authenticated não escreve
-- em pedidos nem em variacoes. Ordem das travas, a mesma em todas (sem deadlock):
-- trava do comprador → linha do pedido → variações em ordem de id, numa instrução só.

-- Cancela o pedido aberto e devolve a reserva UMA vez: a transição aberto → cancelado é a
-- trava (duas chamadas, ou a expiração e o cancelamento juntos, devolvem uma vez só).
-- true = cancelou agora; false = já não estava aberto (pago, cancelado ou do starter).
create function public.cancelar_pedido_aberto(p_pedido_id uuid) returns boolean
  language plpgsql security invoker set search_path = '' as $$
declare
  n integer;
  v_item record;
begin
  update public.pedidos
     set status = 'cancelado', cancelado_em = now(), reserva_devolvida_em = now()
   where id = p_pedido_id and status = 'aberto' and produto is null and reserva_devolvida_em is null;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;

  perform 1 from public.variacoes
    where id in (select variacao_id from public.itens_pedido where pedido_id = p_pedido_id)
    order by id for update;
  for v_item in
    select variacao_id, quantidade from public.itens_pedido where pedido_id = p_pedido_id order by variacao_id
  loop
    update public.variacoes set estoque = estoque + v_item.quantidade where id = v_item.variacao_id;
    get diagnostics n = row_count;
    if n <> 1 then
      raise exception 'devolução da reserva tocou % linhas da variação %', n, v_item.variacao_id;
    end if;
  end loop;
  return true;
end $$;

-- Cancela os pedidos abertos cujo prazo passou há mais que a folga (a reserva dura o prazo do
-- Pix mais uma folga: RISCOS_MERCADO_PAGO.md §1). Pronta para a reconciliação chamar.
-- SKIP LOCKED: duas execuções sobrepostas não disputam o mesmo pedido. Devolve quantos cancelou.
create function public.expirar_pedidos_vencidos(
  p_folga interval default interval '5 minutes',
  p_limite integer default 100
) returns integer
  language plpgsql security invoker set search_path = '' as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_total integer := 0;
begin
  if p_folga is null or p_folga < interval '0' then raise exception 'folga inválida' using errcode = '22023'; end if;
  if p_limite is null or p_limite not between 1 and 500 then raise exception 'limite inválido' using errcode = '22023'; end if;

  select coalesce(array_agg(s.id order by s.expira_em, s.id), '{}') into v_ids from (
    select id, expira_em from public.pedidos
     where status = 'aberto' and produto is null and expira_em + p_folga <= now()
     order by expira_em, id
     limit p_limite
     for update skip locked
  ) s;
  if cardinality(v_ids) = 0 then return 0; end if;

  perform 1 from public.variacoes
    where id in (select variacao_id from public.itens_pedido where pedido_id = any (v_ids))
    order by id for update;
  foreach v_id in array v_ids loop
    if public.cancelar_pedido_aberto(v_id) then v_total := v_total + 1; end if;
  end loop;
  return v_total;
end $$;

-- Cria o pedido congelado e reserva o estoque de forma atômica (T12, T13, T17c, T18).
--
-- Entrada: o pedido já montado pelo servidor (lib/pedidos/), com `p_itens` =
-- [{variacao_id, quantidade, preco_centavos}], onde preco_centavos é o preço que o comprador
-- viu. O banco confere, sob trava, cada item contra o catálogo de HOJE: variação, produto e
-- categoria publicados; preço igual; estoque suficiente. Algum item mudou → nada é gravado e
-- volta {ok:false, motivo:'mudou', itens:[...]} para a tela marcar o item (A-03).
--
-- Comprador com pedido aberto: o mesmo conteúdo, ainda no prazo, devolve o MESMO pedido
-- (duas abas: T12). Conteúdo diferente cancela o anterior, devolve a reserva dele e nasce um
-- pedido novo (`substituido`): o anterior continua congelado como foi criado (T18, S-05).
create function public.criar_pedido(
  p_usuario_id uuid,
  p_itens jsonb,
  p_cep text,
  p_modo_entrega text,
  p_frete_centavos integer,
  p_frete_regiao text,
  p_frete_prazo text,
  p_subtotal_centavos integer,
  p_total_centavos integer,
  p_telefone text,
  p_nome_recebedor text default null,
  p_endereco text default null
) returns jsonb
  language plpgsql security invoker set search_path = '' as $$
declare
  v_aberto public.pedidos%rowtype;
  v_mesmo boolean := false;
  v_problemas jsonb;
  v_soma bigint;
  v_id uuid;
  v_expira timestamptz;
  v_substituido uuid;
  v_item record;
  n integer;
begin
  if p_usuario_id is null then raise exception 'pedido sem comprador' using errcode = '22023'; end if;
  -- 100 é teto técnico contra abuso; o limite da loja (MAXIMO_ITENS_NO_PEDIDO) mora em lib/pedidos/regras.ts.
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) not between 1 and 100 then
    raise exception 'pedido precisa de pelo menos 1 item (e no máximo 100)' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_itens) as i (variacao_id uuid, quantidade integer, preco_centavos integer)
     where i.variacao_id is null or i.quantidade is null or i.quantidade < 1 or i.preco_centavos is null or i.preco_centavos < 1
  ) then
    raise exception 'item de pedido inválido' using errcode = '22023';
  end if;
  if (select count(distinct i.variacao_id) from jsonb_to_recordset(p_itens) as i (variacao_id uuid)) <> jsonb_array_length(p_itens) then
    raise exception 'variação repetida no pedido' using errcode = '22023';
  end if;

  -- Trava do comprador: duas abas do mesmo comprador passam aqui uma de cada vez (T12).
  perform pg_advisory_xact_lock(hashtextextended('criar_pedido:' || p_usuario_id::text, 0));

  select * into v_aberto from public.pedidos
   where usuario_id = p_usuario_id and status = 'aberto' and produto is null
   for update;

  if found and v_aberto.expira_em > now() then
    select v_aberto.cep = p_cep and v_aberto.modo_entrega = p_modo_entrega
       and v_aberto.frete_centavos = p_frete_centavos and v_aberto.subtotal_centavos = p_subtotal_centavos
       and v_aberto.total_centavos = p_total_centavos and v_aberto.telefone = p_telefone
       and v_aberto.nome_recebedor is not distinct from p_nome_recebedor
       and v_aberto.endereco is not distinct from p_endereco
       and not exists (
         select variacao_id, quantidade, preco_unitario_centavos from public.itens_pedido where pedido_id = v_aberto.id
         except
         select i.variacao_id, i.quantidade, i.preco_centavos from jsonb_to_recordset(p_itens) as i (variacao_id uuid, quantidade integer, preco_centavos integer)
       )
       and not exists (
         select i.variacao_id, i.quantidade, i.preco_centavos from jsonb_to_recordset(p_itens) as i (variacao_id uuid, quantidade integer, preco_centavos integer)
         except
         select variacao_id, quantidade, preco_unitario_centavos from public.itens_pedido where pedido_id = v_aberto.id
       )
      into v_mesmo;
    if v_mesmo then
      return jsonb_build_object('ok', true, 'pedido_id', v_aberto.id, 'expira_em', v_aberto.expira_em,
        'total_centavos', v_aberto.total_centavos, 'reaproveitado', true, 'substituido', null);
    end if;
  end if;

  -- Trava das variações do pedido novo e do anterior, em ordem de id, numa instrução só.
  perform 1 from public.variacoes
   where id in (
     select i.variacao_id from jsonb_to_recordset(p_itens) as i (variacao_id uuid)
     union
     select variacao_id from public.itens_pedido where pedido_id = v_aberto.id
   )
   order by id for update;

  -- Conferência item a item contra o catálogo de hoje. A reserva do pedido anterior volta
  -- antes da nova, então conta como disponível para o mesmo comprador.
  select coalesce(jsonb_agg(p.problema order by p.variacao_id), '[]'::jsonb) into v_problemas from (
    select i.variacao_id,
      case
        when v.id is null or not (v.publicado and pr.publicado and c.publicado) then
          jsonb_build_object('variacao_id', i.variacao_id, 'tipo', 'indisponivel')
        when v.preco_centavos <> i.preco_centavos then
          jsonb_build_object('variacao_id', i.variacao_id, 'tipo', 'preco-mudou', 'preco_centavos', v.preco_centavos)
        when i.quantidade > v.estoque + coalesce(ant.quantidade, 0) then
          jsonb_build_object('variacao_id', i.variacao_id, 'tipo', 'esgotou', 'disponivel', v.estoque + coalesce(ant.quantidade, 0))
      end as problema
    from jsonb_to_recordset(p_itens) as i (variacao_id uuid, quantidade integer, preco_centavos integer)
    left join public.variacoes v on v.id = i.variacao_id
    left join public.produtos pr on pr.id = v.produto_id
    left join public.categorias c on c.id = pr.categoria_id
    left join public.itens_pedido ant on ant.pedido_id = v_aberto.id and ant.variacao_id = i.variacao_id
  ) p where p.problema is not null;
  if jsonb_array_length(v_problemas) > 0 then
    return jsonb_build_object('ok', false, 'motivo', 'mudou', 'itens', v_problemas);
  end if;

  -- O subtotal que o servidor calculou tem de bater com os itens congelados.
  select sum(i.quantidade::bigint * i.preco_centavos) into v_soma
    from jsonb_to_recordset(p_itens) as i (quantidade integer, preco_centavos integer);
  if v_soma <> p_subtotal_centavos then
    raise exception 'subtotal divergente dos itens' using errcode = '22023';
  end if;

  if v_aberto.id is not null then
    if not public.cancelar_pedido_aberto(v_aberto.id) then
      raise exception 'pedido anterior não pôde ser cancelado';
    end if;
    v_substituido := v_aberto.id;
  end if;

  -- A reserva: baixa condicional, uma linha por item, conferida.
  for v_item in
    select i.variacao_id, i.quantidade from jsonb_to_recordset(p_itens) as i (variacao_id uuid, quantidade integer)
     order by i.variacao_id
  loop
    update public.variacoes set estoque = estoque - v_item.quantidade
     where id = v_item.variacao_id and estoque >= v_item.quantidade;
    get diagnostics n = row_count;
    if n <> 1 then
      raise exception 'reserva tocou % linhas da variação %', n, v_item.variacao_id;
    end if;
  end loop;

  -- O prazo do pedido aberto (30 min, o mínimo do Pix na Orders API) mora só aqui.
  insert into public.pedidos (
    usuario_id, status, subtotal_centavos, frete_centavos, total_centavos, modo_entrega, cep,
    frete_regiao, frete_prazo, nome_recebedor, telefone, endereco, expira_em
  ) values (
    p_usuario_id, 'aberto', p_subtotal_centavos, p_frete_centavos, p_total_centavos, p_modo_entrega, p_cep,
    p_frete_regiao, p_frete_prazo, p_nome_recebedor, p_telefone, p_endereco, now() + interval '30 minutes'
  ) returning id, expira_em into v_id, v_expira;

  insert into public.itens_pedido (pedido_id, variacao_id, quantidade, preco_unitario_centavos, produto_nome, aroma, tamanho, sku)
  select v_id, i.variacao_id, i.quantidade, v.preco_centavos, pr.nome, v.aroma, v.tamanho, v.sku
    from jsonb_to_recordset(p_itens) as i (variacao_id uuid, quantidade integer)
    join public.variacoes v on v.id = i.variacao_id
    join public.produtos pr on pr.id = v.produto_id;
  get diagnostics n = row_count;
  if n <> jsonb_array_length(p_itens) then
    raise exception 'itens gravados: % de %', n, jsonb_array_length(p_itens);
  end if;

  return jsonb_build_object('ok', true, 'pedido_id', v_id, 'expira_em', v_expira,
    'total_centavos', p_total_centavos, 'reaproveitado', false, 'substituido', v_substituido);
end $$;

-- REVOKE de PUBLIC não basta no Supabase: os privilégios padrão dão EXECUTE a anon (04, 1.6).
revoke execute on function public.cancelar_pedido_aberto(uuid) from public, anon, authenticated;
revoke execute on function public.expirar_pedidos_vencidos(interval, integer) from public, anon, authenticated;
revoke execute on function public.criar_pedido(uuid, jsonb, text, text, integer, text, text, integer, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cancelar_pedido_aberto(uuid) to service_role;
grant execute on function public.expirar_pedidos_vencidos(interval, integer) to service_role;
grant execute on function public.criar_pedido(uuid, jsonb, text, text, integer, text, text, integer, integer, text, text, text)
  to service_role;

-- ------------------------------------------------------------------ policies
-- A policy de pedidos (pedidos_ler_os_proprios) já existe. O item segue o dono do pedido.
create policy itens_pedido_ler_os_proprios on public.itens_pedido
  for select to authenticated using (
    exists (select 1 from public.pedidos p where p.id = pedido_id and p.usuario_id = (select auth.uid()))
  );

-- ------------------------------------------------------------------ ASSERT
do $$
declare
  papel text;
  tabela text;
  coluna text;
  funcao text;
begin
  foreach tabela in array array['public.pedidos', 'public.itens_pedido'] loop
    assert (select relrowsecurity from pg_class where oid = tabela::regclass), format('RLS desligada em %s', tabela);
    foreach papel in array array['anon', 'authenticated'] loop
      assert not has_table_privilege(papel, tabela, 'select'), format('%s lê %s inteira (o GRANT é por coluna)', papel, tabela);
      assert not has_any_column_privilege(papel, tabela, 'insert'), format('%s cria em %s', papel, tabela);
      assert not has_any_column_privilege(papel, tabela, 'update'), format('%s altera %s', papel, tabela);
      assert not has_table_privilege(papel, tabela, 'delete'), format('%s apaga %s', papel, tabela);
      assert not has_table_privilege(papel, tabela, 'truncate'), format('%s esvazia %s', papel, tabela);
      assert not has_table_privilege(papel, tabela, 'trigger'), format('%s cria trigger em %s', papel, tabela);
      assert not has_any_column_privilege(papel, tabela, 'references'), format('%s referencia %s', papel, tabela);
    end loop;
    assert not has_any_column_privilege('anon', tabela, 'select'), format('anon lê %s', tabela);
  end loop;

  foreach coluna in array array['id', 'status', 'total_centavos', 'frete_centavos', 'modo_entrega', 'cep', 'endereco', 'expira_em', 'produto', 'valor_centavos'] loop
    assert has_column_privilege('authenticated', 'public.pedidos', coluna, 'select'), format('authenticated não lê pedidos.%s', coluna);
  end loop;
  foreach coluna in array array['stripe_sessao_id', 'stripe_pagamento_id', 'modo', 'reserva_devolvida_em'] loop
    assert not has_column_privilege('authenticated', 'public.pedidos', coluna, 'select'), format('authenticated lê pedidos.%s', coluna);
  end loop;
  foreach coluna in array array['pedido_id', 'variacao_id', 'quantidade', 'preco_unitario_centavos', 'produto_nome'] loop
    assert has_column_privilege('authenticated', 'public.itens_pedido', coluna, 'select'), format('authenticated não lê itens_pedido.%s', coluna);
  end loop;

  foreach funcao in array array[
    'public.criar_pedido(uuid, jsonb, text, text, integer, text, text, integer, integer, text, text, text)',
    'public.cancelar_pedido_aberto(uuid)',
    'public.expirar_pedidos_vencidos(interval, integer)'
  ] loop
    assert not has_function_privilege('anon', funcao, 'execute'), format('anon executa %s', funcao);
    assert not has_function_privilege('authenticated', funcao, 'execute'), format('authenticated executa %s', funcao);
    assert has_function_privilege('service_role', funcao, 'execute'), format('service_role sem %s', funcao);
    assert not (select prosecdef from pg_proc where oid = funcao::regprocedure), format('%s é SECURITY DEFINER', funcao);
  end loop;

  foreach tabela in array array['public.pedidos', 'public.itens_pedido', 'public.variacoes'] loop
    assert has_table_privilege('service_role', tabela, 'select'), format('service_role não lê %s', tabela);
  end loop;
  assert has_table_privilege('service_role', 'public.pedidos', 'insert'), 'service_role não cria pedido';
  assert has_table_privilege('service_role', 'public.itens_pedido', 'insert'), 'service_role não cria item';
  assert has_table_privilege('service_role', 'public.variacoes', 'update'), 'service_role não reserva estoque';
end $$;
