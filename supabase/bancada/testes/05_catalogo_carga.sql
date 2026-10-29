-- A carga fictícia (supabase/seed/catalogo.sql) entrou inteira e uma vez só: a bancada a
-- aplica duas vezes, e as contagens provam que a segunda não duplicou nada.
begin;
do $$ declare n int; begin
  select count(*) into n from public.categorias;
  assert n = 5, format('%s categorias (esperado 5)', n);
  select count(*) into n from public.produtos;
  assert n = 13, format('%s produtos (esperado 13)', n);
  select count(*) into n from public.produtos where not publicado;
  assert n = 1, format('%s produtos em rascunho (esperado 1)', n);
  select count(*) into n from public.variacoes;
  assert n = 35, format('%s variações (esperado 35)', n);
  select count(*) into n from public.variacoes where estoque = 0 and publicado;
  assert n >= 1, 'nenhuma variação publicada esgotada';
  select count(*) into n from public.fretes_regiao;
  assert n = 6, format('%s faixas de frete (esperado 6)', n);
  -- Preço aprovado pelo cliente na média fidelidade.
  select count(*) into n from public.variacoes v join public.produtos p on p.id = v.produto_id
    where p.slug = 'sabonete-artesanal' and v.aroma = 'alecrim'
      and ((v.tamanho = '90 g' and v.preco_centavos = 2200) or (v.tamanho = '140 g' and v.preco_centavos = 3000));
  assert n = 2, 'sabonete de alecrim fora do preço aprovado (90 g R$ 22,00; 140 g R$ 30,00)';
  -- Cosmético artesanal: nenhuma promessa de efeito terapêutico no texto.
  select count(*) into n from public.produtos
    where concat_ws(' ', nome, descricao, modo_de_uso, ingredientes) ~* '(cura|trata|hipoalerg|terap|medicinal|anti-?inflam)';
  assert n = 0, format('%s produto(s) prometem efeito terapêutico', n);
end $$;
rollback;
