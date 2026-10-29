-- Carga fictícia do catálogo do Ateliê Alecrim (cliente fictício; #19).
-- Idempotente: rodar duas vezes não duplica nem sobrescreve (ON CONFLICT DO NOTHING por
-- slug, sku e faixa de frete). Só para bancada, demonstração e preview; nunca é dado real.
-- Cosmético artesanal: os textos descrevem textura, aroma e uso, sem prometer efeito
-- terapêutico. Fretes da tabela §6b de docs/freelance/DESCOBERTA.md.
-- Premissa da demonstração: ateliê na região metropolitana de São Paulo (CEP 01–09); o
-- endereço não entra aqui (FIDELIDADE.md §1, regra 7).

insert into public.categorias (slug, nome, ordem, publicado) values
  ('sabonetes', 'Sabonetes', 1, true),
  ('velas', 'Velas', 2, true),
  ('hidratantes', 'Hidratantes', 3, true),
  ('oleos', 'Óleos', 4, true),
  ('kits', 'Kits', 5, true)
on conflict (slug) do nothing;

insert into public.produtos (categoria_id, slug, nome, descricao, modo_de_uso, ingredientes, publicado)
select c.id, p.slug, p.nome, p.descricao, p.modo_de_uso, p.ingredientes, p.publicado
from (values
  ('sabonetes', 'sabonete-artesanal', 'Sabonete artesanal',
   'Sabonete em barra feito à mão em pequenos lotes, com espuma cremosa e 40 dias de descanso antes de ir à venda. Escolha o aroma e o tamanho.',
   'Molhe a barra, faça espuma nas mãos e aplique na pele úmida. Enxágue. Guarde em saboneteira que escorra a água.',
   'Óleo de coco, azeite de oliva, manteiga de karité, água, hidróxido de sódio (saponificado), óleo essencial conforme o aroma escolhido.', true),
  ('sabonetes', 'sabonete-de-argila', 'Sabonete de argila',
   'Barra com argila verde, de cor suave e espuma mais densa.',
   'Use no banho, como um sabonete comum. Enxágue bem.',
   'Azeite de oliva, óleo de coco, argila verde, água, hidróxido de sódio (saponificado), óleo essencial de lavanda (só no aroma lavanda).', true),
  ('sabonetes', 'sabonete-esfoliante-de-cafe', 'Sabonete esfoliante de café',
   'Barra com borra de café moída, para quem gosta de textura no banho.',
   'Passe a barra na pele úmida com movimentos leves. Evite o rosto. Enxágue.',
   'Óleo de coco, azeite de oliva, borra de café, água, hidróxido de sódio (saponificado).', true),
  ('sabonetes', 'sabonete-liquido-de-alecrim', 'Sabonete líquido de alecrim',
   'Sabonete líquido de base vegetal, com aroma herbal de alecrim, em frasco com válvula.',
   'Aplique uma pequena quantidade nas mãos ou na esponja, faça espuma e enxágue.',
   'Água, óleo de coco saponificado, glicerina vegetal, óleo essencial de alecrim.', true),
  ('velas', 'vela-aromatica', 'Vela aromática',
   'Vela de cera de soja em pote de vidro, com pavio de algodão.',
   'Na primeira vez, deixe acesa até a superfície derreter por inteiro. Apare o pavio antes de acender de novo. Nunca deixe acesa sem ninguém por perto.',
   'Cera de soja, pavio de algodão, essência conforme o aroma escolhido.', true),
  ('velas', 'vela-de-soja-sem-fragrancia', 'Vela de soja sem fragrância',
   'Vela de cera de soja pura, sem essência, para quem prefere só a luz.',
   'Deixe a superfície derreter por inteiro no primeiro uso e apare o pavio a cada vez. Nunca deixe acesa sem ninguém por perto.',
   'Cera de soja, pavio de algodão.', true),
  ('hidratantes', 'hidratante-corporal', 'Hidratante corporal',
   'Creme corporal de textura leve, que espalha fácil e não deixa a pele pegajosa.',
   'Aplique na pele limpa e seca, massageando até absorver.',
   'Água, óleo de semente de uva, manteiga de karité, cera emulsificante vegetal, glicerina vegetal, conservante, óleo essencial conforme o aroma escolhido.', true),
  ('hidratantes', 'manteiga-corporal-de-karite', 'Manteiga corporal de karité',
   'Manteiga batida, de textura densa, para áreas mais secas como cotovelos e pés.',
   'Aqueça uma pequena porção entre as mãos e aplique na pele seca.',
   'Manteiga de karité, óleo de coco, óleo de amêndoas doces.', true),
  ('oleos', 'oleo-corporal', 'Óleo corporal',
   'Óleo vegetal leve para depois do banho, com aroma suave.',
   'Aplique algumas gotas na pele ainda úmida e espalhe.',
   'Óleo de semente de uva, óleo de amêndoas doces, óleo essencial conforme o aroma escolhido.', true),
  ('oleos', 'oleo-de-banho', 'Óleo de banho',
   'Óleo para a água da banheira ou para o escalda-pés, com aroma cítrico.',
   'Coloque uma colher de chá na água morna e misture.',
   'Óleo de girassol, polissorbato vegetal, óleo essencial de laranja-doce.', true),
  ('kits', 'kit-presente', 'Kit presente',
   'Um sabonete artesanal de 140 g e uma vela aromática de 300 g do mesmo aroma, em caixa de papel reciclado.',
   'Veja o modo de uso de cada item na página do sabonete e da vela.',
   'Sabonete: óleo de coco, azeite de oliva, manteiga de karité, água, hidróxido de sódio (saponificado), óleo essencial. Vela: cera de soja, pavio de algodão, essência.', true),
  ('kits', 'kit-banho', 'Kit banho',
   'Um sabonete artesanal de 90 g sem fragrância e um óleo corporal de 100 ml sem fragrância.',
   'Veja o modo de uso de cada item na página do sabonete e do óleo.',
   'Sabonete: óleo de coco, azeite de oliva, manteiga de karité, água, hidróxido de sódio (saponificado). Óleo: óleo de semente de uva, óleo de amêndoas doces.', true),
  -- Rascunho: a dona ainda está testando o lote. Não aparece na vitrine.
  ('velas', 'vela-de-alecrim-e-hortela', 'Vela de alecrim e hortelã',
   'Vela de cera de soja com aroma herbal. Lote em teste.',
   'Deixe a superfície derreter por inteiro no primeiro uso. Nunca deixe acesa sem ninguém por perto.',
   'Cera de soja, pavio de algodão, essência de alecrim e hortelã.', false)
) as p (categoria, slug, nome, descricao, modo_de_uso, ingredientes, publicado)
join public.categorias c on c.slug = p.categoria
on conflict (slug) do nothing;

insert into public.variacoes (produto_id, aroma, tamanho, preco_centavos, estoque, publicado, sku)
select pr.id, v.aroma, v.tamanho, v.preco_centavos, v.estoque, v.publicado, v.sku
from (values
  -- Aprovado pelo cliente na média fidelidade: alecrim 90 g → R$ 22,00; 140 g → R$ 30,00.
  ('sabonete-artesanal', 'alecrim', '90 g', 2200, 18, true, 'SAB-ART-ALE-090'),
  ('sabonete-artesanal', 'alecrim', '140 g', 3000, 12, true, 'SAB-ART-ALE-140'),
  ('sabonete-artesanal', 'lavanda', '90 g', 2200, 20, true, 'SAB-ART-LAV-090'),
  ('sabonete-artesanal', 'lavanda', '140 g', 3000, 9, true, 'SAB-ART-LAV-140'),
  ('sabonete-artesanal', 'laranja-doce', '90 g', 2200, 7, true, 'SAB-ART-LAR-090'),
  -- Esgotada: estado "esgotado" na página do produto.
  ('sabonete-artesanal', 'laranja-doce', '140 g', 3000, 0, true, 'SAB-ART-LAR-140'),
  ('sabonete-artesanal', 'sem fragrância', '90 g', 2000, 15, true, 'SAB-ART-SEM-090'),
  ('sabonete-artesanal', 'sem fragrância', '140 g', 2800, 10, true, 'SAB-ART-SEM-140'),
  ('sabonete-de-argila', 'lavanda', '90 g', 2600, 8, true, 'SAB-ARG-LAV-090'),
  ('sabonete-de-argila', 'lavanda', '140 g', 3400, 5, true, 'SAB-ARG-LAV-140'),
  ('sabonete-de-argila', 'sem fragrância', '90 g', 2600, 6, true, 'SAB-ARG-SEM-090'),
  -- Variação em rascunho de um produto publicado: não aparece na vitrine.
  ('sabonete-de-argila', 'sem fragrância', '140 g', 3400, 4, false, 'SAB-ARG-SEM-140'),
  ('sabonete-esfoliante-de-cafe', 'sem fragrância', '90 g', 2600, 11, true, 'SAB-CAF-SEM-090'),
  ('sabonete-esfoliante-de-cafe', 'sem fragrância', '140 g', 3400, 6, true, 'SAB-CAF-SEM-140'),
  ('sabonete-liquido-de-alecrim', 'alecrim', '250 ml', 3800, 9, true, 'SAB-LIQ-ALE-250'),
  ('vela-aromatica', 'lavanda', '150 g', 4500, 6, true, 'VEL-ARO-LAV-150'),
  ('vela-aromatica', 'lavanda', '300 g', 7800, 4, true, 'VEL-ARO-LAV-300'),
  ('vela-aromatica', 'alecrim', '150 g', 4500, 0, true, 'VEL-ARO-ALE-150'),
  ('vela-aromatica', 'alecrim', '300 g', 7800, 3, true, 'VEL-ARO-ALE-300'),
  ('vela-aromatica', 'laranja-doce', '150 g', 4500, 5, true, 'VEL-ARO-LAR-150'),
  ('vela-aromatica', 'laranja-doce', '300 g', 7800, 2, true, 'VEL-ARO-LAR-300'),
  ('vela-de-soja-sem-fragrancia', 'sem fragrância', '150 g', 4000, 7, true, 'VEL-SOJ-SEM-150'),
  ('vela-de-soja-sem-fragrancia', 'sem fragrância', '300 g', 7000, 3, true, 'VEL-SOJ-SEM-300'),
  ('hidratante-corporal', 'lavanda', '200 g', 4800, 8, true, 'HID-COR-LAV-200'),
  ('hidratante-corporal', 'laranja-doce', '200 g', 4800, 6, true, 'HID-COR-LAR-200'),
  ('hidratante-corporal', 'sem fragrância', '200 g', 4600, 9, true, 'HID-COR-SEM-200'),
  ('manteiga-corporal-de-karite', 'sem fragrância', '100 g', 4200, 10, true, 'HID-KAR-SEM-100'),
  ('oleo-corporal', 'lavanda', '100 ml', 5200, 5, true, 'OLE-COR-LAV-100'),
  ('oleo-corporal', 'alecrim', '100 ml', 5200, 4, true, 'OLE-COR-ALE-100'),
  ('oleo-corporal', 'sem fragrância', '100 ml', 5000, 6, true, 'OLE-COR-SEM-100'),
  ('oleo-de-banho', 'laranja-doce', '100 ml', 4600, 7, true, 'OLE-BAN-LAR-100'),
  ('kit-presente', 'lavanda', 'sabonete 140 g + vela 300 g', 12000, 3, true, 'KIT-PRE-LAV'),
  ('kit-presente', 'alecrim', 'sabonete 140 g + vela 300 g', 12000, 2, true, 'KIT-PRE-ALE'),
  ('kit-banho', 'sem fragrância', 'sabonete 90 g + óleo 100 ml', 7000, 4, true, 'KIT-BAN-SEM'),
  -- Publicada, mas o produto está em rascunho: a RLS esconde mesmo assim.
  ('vela-de-alecrim-e-hortela', 'alecrim', '150 g', 4800, 5, true, 'VEL-AEH-ALE-150')
) as v (produto, aroma, tamanho, preco_centavos, estoque, publicado, sku)
join public.produtos pr on pr.slug = v.produto
on conflict (sku) do nothing;

-- Tabela §6b. Faixas de correios sem sobreposição; motoboy e retirada só na região do ateliê.
insert into public.fretes_regiao (nome, cep_inicio, cep_fim, modo, valor_centavos, prazo_texto) values
  ('Mesma cidade e região metropolitana', '01000000', '09999999', 'motoboy', 1500, '1 a 2 dias úteis, combinado por WhatsApp'),
  ('Retirada no ateliê', '01000000', '09999999', 'retirada', 0, 'a combinar por WhatsApp'),
  ('Restante do estado', '11000000', '19999999', 'correios', 2500, '3 a 7 dias úteis'),
  ('Sudeste e Sul', '20000000', '39999999', 'correios', 3000, '4 a 9 dias úteis'),
  ('Sudeste e Sul', '80000000', '99999999', 'correios', 3000, '4 a 9 dias úteis'),
  ('Demais regiões', '40000000', '79999999', 'correios', 4000, '6 a 12 dias úteis')
on conflict (modo, cep_inicio, cep_fim) do nothing;
