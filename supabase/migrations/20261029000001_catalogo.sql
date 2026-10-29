-- Catálogo (categorias, produtos, variações) e fretes por região de CEP (#19).
--
-- Quem lê: anon e authenticated, só o que está publicado (FIDELIDADE.md §1, regra 5).
-- Quem escreve: só o servidor (service_role), pelas Server Actions da dona com guarda de
-- papel (outra frente). Nenhum INSERT/UPDATE/DELETE para anon e authenticated.
-- RLS protege LINHAS, não colunas (04, 1.4 e 1.5): fretes_regiao tem GRANT por coluna.
-- No Supabase, toda tabela e função nova em `public` nasce com acesso para anon (04, 1.6):
-- por isso o REVOKE ALL antes de cada GRANT e os ASSERT no fim.
-- Ordem: tabelas → função → policies → ASSERT.
-- O endereço do ateliê não entra aqui (regra 7): a retirada é "combinada por WhatsApp".

-- Slug de URL: minúsculas, dígitos e hífen simples, sem acento (vira /produto/<slug>).
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  nome text not null check (char_length(nome) between 1 and 80),
  ordem integer not null default 0,
  publicado boolean not null default false
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  nome text not null check (char_length(nome) between 1 and 120),
  descricao text not null default '' check (char_length(descricao) <= 2000),
  modo_de_uso text not null default '' check (char_length(modo_de_uso) <= 2000),
  -- Lista de ingredientes (INCI ou nome comum). Nunca uma pergunta sobre alergia.
  ingredientes text not null default '' check (char_length(ingredientes) <= 2000),
  publicado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index produtos_categoria on public.produtos (categoria_id);

create table public.variacoes (
  id uuid primary key default gen_random_uuid(),
  -- restrict: a variação vai ser citada por itens de pedido; produto sai do ar despublicando.
  produto_id uuid not null references public.produtos (id) on delete restrict,
  aroma text not null check (char_length(aroma) between 1 and 60),
  -- Texto como a dona escreve: "90 g", "140 g", "150 g", "300 g", "100 ml".
  tamanho text not null check (char_length(tamanho) between 1 and 60),
  preco_centavos integer not null check (preco_centavos > 0),
  estoque integer not null default 0 check (estoque >= 0),
  publicado boolean not null default false,
  sku text not null unique check (char_length(sku) between 1 and 40),
  unique (produto_id, aroma, tamanho)
);

-- A região sai do CEP (8 dígitos, sem hífen), nunca de um id vindo do formulário (regra 3).
create table public.fretes_regiao (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 80),
  cep_inicio text not null check (cep_inicio ~ '^[0-9]{8}$'),
  cep_fim text not null check (cep_fim ~ '^[0-9]{8}$'),
  modo text not null check (modo in ('correios', 'motoboy', 'retirada')),
  valor_centavos integer not null check (valor_centavos >= 0),
  prazo_texto text not null check (char_length(prazo_texto) between 1 and 80),
  ativo boolean not null default true,
  check (cep_inicio <= cep_fim),
  unique (modo, cep_inicio, cep_fim)
);
create index fretes_regiao_faixa on public.fretes_regiao (cep_inicio, cep_fim);

-- Privilégios: revoga o padrão do Supabase e concede só a leitura.
alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.variacoes enable row level security;
alter table public.fretes_regiao enable row level security;
revoke all on public.categorias, public.produtos, public.variacoes, public.fretes_regiao from public, anon, authenticated;
grant select on public.categorias, public.produtos, public.variacoes to anon, authenticated;
-- Vitrine do frete: região, faixa, modo, valor e prazo. `id` e `ativo` ficam de fora.
grant select (nome, cep_inicio, cep_fim, modo, valor_centavos, prazo_texto) on public.fretes_regiao to anon, authenticated;

-- atualizado_em é do banco, não de quem escreve.
create function public.tocar_atualizado_em() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
revoke execute on function public.tocar_atualizado_em() from public, anon, authenticated;
create trigger produtos_atualizado_em before update on public.produtos
  for each row execute function public.tocar_atualizado_em();

-- Policies: produto só com a categoria publicada; variação só com produto e categoria publicados.
create policy categorias_ler_publicadas on public.categorias
  for select to anon, authenticated using (publicado);
create policy produtos_ler_publicados on public.produtos
  for select to anon, authenticated using (
    publicado and exists (select 1 from public.categorias c where c.id = categoria_id and c.publicado)
  );
create policy variacoes_ler_publicadas on public.variacoes
  for select to anon, authenticated using (
    publicado and exists (
      select 1 from public.produtos p join public.categorias c on c.id = p.categoria_id
      where p.id = produto_id and p.publicado and c.publicado
    )
  );
create policy fretes_regiao_ler_ativos on public.fretes_regiao
  for select to anon, authenticated using (ativo);

do $$
declare
  papel text;
  tabela text;
  coluna text;
begin
  foreach tabela in array array['public.categorias', 'public.produtos', 'public.variacoes', 'public.fretes_regiao'] loop
    assert (select relrowsecurity from pg_class where oid = tabela::regclass), format('RLS desligada em %s', tabela);
    foreach papel in array array['anon', 'authenticated'] loop
      -- has_any_column_privilege pega também um GRANT por coluna esquecido.
      assert not has_any_column_privilege(papel, tabela, 'insert'), format('%s cria em %s', papel, tabela);
      assert not has_any_column_privilege(papel, tabela, 'update'), format('%s altera %s', papel, tabela);
      assert not has_table_privilege(papel, tabela, 'delete'), format('%s apaga %s', papel, tabela);
      assert not has_table_privilege(papel, tabela, 'truncate'), format('%s esvazia %s', papel, tabela);
      assert not has_table_privilege(papel, tabela, 'trigger'), format('%s cria trigger em %s', papel, tabela);
      assert not has_table_privilege(papel, tabela, 'references'), format('%s referencia %s', papel, tabela);
    end loop;
  end loop;

  foreach papel in array array['anon', 'authenticated'] loop
    assert has_table_privilege(papel, 'public.categorias', 'select'), format('%s não lê categorias', papel);
    assert has_table_privilege(papel, 'public.produtos', 'select'), format('%s não lê produtos', papel);
    assert has_table_privilege(papel, 'public.variacoes', 'select'), format('%s não lê variações', papel);
    assert not has_table_privilege(papel, 'public.fretes_regiao', 'select'), format('%s lê fretes_regiao inteira', papel);
    foreach coluna in array array['nome', 'cep_inicio', 'cep_fim', 'modo', 'valor_centavos', 'prazo_texto'] loop
      assert has_column_privilege(papel, 'public.fretes_regiao', coluna, 'select'), format('%s não lê fretes_regiao.%s', papel, coluna);
    end loop;
    foreach coluna in array array['id', 'ativo'] loop
      assert not has_column_privilege(papel, 'public.fretes_regiao', coluna, 'select'), format('%s lê fretes_regiao.%s', papel, coluna);
    end loop;
    assert not has_function_privilege(papel, 'public.tocar_atualizado_em()', 'execute'), format('%s executa tocar_atualizado_em', papel);
  end loop;
end $$;
