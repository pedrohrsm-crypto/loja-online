-- Módulo Pagamentos: pedidos e eventos do processador.
-- O cliente só LÊ os próprios pedidos; toda escrita é do servidor (service_role), a partir
-- do checkout e do webhook. Um pedido aberto por usuário e produto: é a trava de fundo
-- contra a compra dupla em duas abas.
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  -- Exclusão de conta mantém o registro de venda sem o titular (módulo Privacidade).
  usuario_id uuid references auth.users (id) on delete set null,
  produto text not null,
  valor_centavos integer not null check (valor_centavos > 0),
  status text not null default 'aberto' check (status in ('aberto', 'pago', 'estornado', 'cancelado')),
  stripe_sessao_id text unique,
  -- payment_intent: é por ele que o estorno (charge.refunded) chega.
  stripe_pagamento_id text unique,
  modo text not null default 'teste' check (modo in ('teste', 'producao')),
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  estornado_em timestamptz
);
create unique index pedidos_um_aberto_por_produto on public.pedidos (usuario_id, produto) where status = 'aberto';
create index pedidos_usuario on public.pedidos (usuario_id);

alter table public.pedidos enable row level security;
revoke all on public.pedidos from anon, authenticated;
grant select on public.pedidos to authenticated;
create policy pedidos_ler_os_proprios on public.pedidos
  for select to authenticated using (usuario_id = (select auth.uid()));

-- Cada evento do processador é processado uma vez: reservado antes de tocar em estado.
create table public.eventos_pagamento (
  id text primary key,
  tipo text not null,
  reservado_em timestamptz not null default now(),
  processado_em timestamptz
);
alter table public.eventos_pagamento enable row level security;
revoke all on public.eventos_pagamento from anon, authenticated;

-- 'reservado' (novo) · 'duplicado' (já processado) · 'em-andamento' (reserva recente sem
-- conclusão: outra instância está nele) · 'recuperado' (reserva parada além da janela: a
-- execução anterior morreu, e esta retoma).
create function public.reservar_evento_pagamento(p_id text, p_tipo text, p_janela interval default interval '5 minutes')
  returns text language plpgsql security definer set search_path = '' as $$
declare
  v public.eventos_pagamento%rowtype;
begin
  insert into public.eventos_pagamento (id, tipo) values (p_id, p_tipo) on conflict (id) do nothing;
  if found then return 'reservado'; end if;
  select * into v from public.eventos_pagamento where id = p_id for update;
  if v.processado_em is not null then return 'duplicado'; end if;
  if v.reservado_em < now() - p_janela then
    update public.eventos_pagamento set reservado_em = now() where id = p_id;
    return 'recuperado';
  end if;
  return 'em-andamento';
end $$;
revoke execute on function public.reservar_evento_pagamento(text, text, interval) from public, anon, authenticated;
grant execute on function public.reservar_evento_pagamento(text, text, interval) to service_role;

do $$ begin
  assert not has_table_privilege('anon', 'public.pedidos', 'select'), 'anon lê pedidos';
  assert not has_table_privilege('authenticated', 'public.pedidos', 'insert'), 'authenticated cria pedido';
  assert not has_table_privilege('authenticated', 'public.pedidos', 'update'), 'authenticated altera pedido';
  assert not has_table_privilege('authenticated', 'public.eventos_pagamento', 'select'), 'authenticated lê eventos';
  assert not has_table_privilege('anon', 'public.eventos_pagamento', 'select'), 'anon lê eventos';
  assert not has_function_privilege('anon', 'public.reservar_evento_pagamento(text, text, interval)', 'execute'), 'anon reserva evento';
  assert not has_function_privilege('authenticated', 'public.reservar_evento_pagamento(text, text, interval)', 'execute'), 'authenticated reserva evento';
  assert has_function_privilege('service_role', 'public.reservar_evento_pagamento(text, text, interval)', 'execute'), 'service_role sem reserva';
end $$;
