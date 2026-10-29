-- Chama toda função nova (04, 1.12: o plpgsql só compila na chamada) e torna explícita a
-- policy de variações, que a RLS aninhada de produtos encobre.
begin;
-- Trigger tocar_atualizado_em em produtos (a única tabela com o trigger): quem escreve
-- não escolhe atualizado_em; o banco grava a hora da escrita.
do $$ declare n int; v timestamptz; begin
  update public.produtos set atualizado_em = '2000-01-01' where slug = 'sabonete-artesanal';
  get diagnostics n = row_count;
  assert n = 1, format('update tocou %s linhas (esperado 1)', n);
  select atualizado_em into v from public.produtos where slug = 'sabonete-artesanal';
  assert v > '2000-01-01', format('produtos.atualizado_em ficou em %s: o trigger não rodou', v);
  -- Só os triggers conhecidos chamam a função; trigger novo com ela precisa de caso aqui.
  select count(*) into n from pg_trigger
    where tgfoid = 'public.tocar_atualizado_em()'::regprocedure and not tgisinternal;
  assert n = 1, format('%s triggers usam tocar_atualizado_em (esperado 1: produtos); acrescente o caso', n);
end $$;

-- Produto publicado numa categoria despublicada: nenhuma variação dele aparece, nem na
-- leitura direta de variacoes.
update public.categorias set publicado = false where slug = 'velas';
set local role anon;
do $$ declare n int; begin
  select count(*) into n from public.variacoes where sku like 'VEL-ARO-%';
  assert n = 0, format('anon vê %s variações da vela aromática com a categoria despublicada', n);
  select count(*) into n from public.variacoes where sku like 'VEL-%';
  assert n = 0, format('anon vê %s variações de velas com a categoria despublicada', n);
end $$;
reset role;

-- O teste acima não reprova se a policy de variacoes perder `p.publicado` ou `c.publicado`:
-- a subconsulta passa pela RLS de produtos, que já exige os dois. Por isso a prova da
-- policy é pelo texto dela.
do $$ declare q text; begin
  select qual into q from pg_policies where schemaname = 'public' and tablename = 'variacoes' and policyname = 'variacoes_ler_publicadas';
  assert q is not null, 'policy variacoes_ler_publicadas não existe';
  assert q ~ '\mp\.publicado\M', format('policy de variações sem p.publicado: %s', q);
  assert q ~ '\mc\.publicado\M', format('policy de variações sem c.publicado: %s', q);
end $$;
rollback;
