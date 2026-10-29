-- Catálogo: anon e authenticated veem só o publicado, não escrevem em nada e não leem as
-- colunas de fretes_regiao fora do GRANT (FIDELIDADE.md §1, regras 3 e 5).
begin;
-- Um frete inativo e uma categoria despublicada, para provar que a RLS os esconde.
insert into public.fretes_regiao (nome, cep_inicio, cep_fim, modo, valor_centavos, prazo_texto, ativo)
  values ('Faixa desligada', '00000000', '00999999', 'correios', 100, 'teste', false);
update public.categorias set publicado = false where slug = 'kits';

set local role anon;
do $$ declare n int; begin
  -- 12 publicados na carga, menos os 2 kits da categoria despublicada.
  select count(*) into n from public.produtos;
  assert n = 10, format('anon vê %s produtos (esperado 10)', n);
  select count(*) into n from public.produtos where slug = 'vela-de-alecrim-e-hortela';
  assert n = 0, 'anon vê produto em rascunho';
  select count(*) into n from public.categorias where slug = 'kits';
  assert n = 0, 'anon vê categoria despublicada';
  -- 35 na carga: menos 1 variação em rascunho, 1 de produto em rascunho e 3 dos kits.
  select count(*) into n from public.variacoes;
  assert n = 30, format('anon vê %s variações (esperado 30)', n);
  select count(*) into n from public.variacoes where sku in ('SAB-ARG-SEM-140', 'VEL-AEH-ALE-150', 'KIT-PRE-LAV');
  assert n = 0, 'anon vê variação de rascunho, de produto em rascunho ou de categoria despublicada';
  -- Colunas do GRANT: legíveis, e só as faixas ativas.
  select count(*) into n from (select nome, cep_inicio, cep_fim, modo, valor_centavos, prazo_texto from public.fretes_regiao) f;
  assert n = 6, format('anon vê %s faixas de frete (esperado 6 ativas)', n);
end $$;

-- Mesma bateria de recusas para os dois papéis.
reset role;
create function pg_temp.recusa(papel text) returns void language plpgsql as $$
declare
  sql text;
begin
  foreach sql in array array[
    'select id from public.fretes_regiao',
    'select ativo from public.fretes_regiao',
    'select * from public.fretes_regiao',
    'insert into public.categorias (slug, nome, publicado) values (''x'', ''x'', true)',
    'insert into public.produtos (categoria_id, slug, nome, publicado) select id, ''x'', ''x'', true from public.categorias limit 1',
    'insert into public.variacoes (produto_id, aroma, tamanho, preco_centavos, sku) select id, ''x'', ''x'', 1, ''x'' from public.produtos limit 1',
    'insert into public.fretes_regiao (nome, cep_inicio, cep_fim, modo, valor_centavos, prazo_texto) values (''x'', ''00000000'', ''00000001'', ''motoboy'', 0, ''x'')',
    'update public.categorias set nome = ''x''',
    'update public.produtos set publicado = true',
    'update public.variacoes set preco_centavos = 1',
    'update public.variacoes set estoque = 999',
    'update public.fretes_regiao set valor_centavos = 0',
    'delete from public.categorias',
    'delete from public.produtos',
    'delete from public.variacoes',
    'delete from public.fretes_regiao'
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
do $$ begin perform pg_temp.recusa('anon'); end $$;

reset role;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e1');
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true); end $$;
do $$ begin perform pg_temp.recusa('authenticated'); end $$;
do $$ declare n int; begin
  select count(*) into n from public.produtos where not publicado;
  assert n = 0, 'authenticated vê rascunho';
end $$;
rollback;
