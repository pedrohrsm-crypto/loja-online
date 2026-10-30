// Supabase FALSO para o e2e: responde só o que as telas da alta fidelidade leem, no formato do
// PostgREST e do GoTrue, para que o código REAL de lib/catalogo/ e a guarda de papel rodem sem
// banco. Não valida nada, não grava nada e só escuta em 127.0.0.1. Os dados espelham a carga
// fictícia de supabase/seed/catalogo.sql (cliente fictício).
//
// Casos de teste por slug: "sabonete-artesanal" (normal, com variação esgotada), "vela-aromatica"
// (alecrim 150 g esgotado), "quebrado" (o banco responde 500: estado de erro), qualquer outro
// (sem linha: produto indisponível). Papel pelo token: "token-admin" e "token-cliente".
import { createServer } from 'node:http';

const PORTA = Number(process.env.SUPABASE_FALSO_PORTA ?? 3101);

const CAT = { slug: 'sabonetes', nome: 'Sabonetes' };
const v = (id, produto_id, aroma, tamanho, preco_centavos, estoque, sku) => ({ id, produto_id, aroma, tamanho, preco_centavos, estoque, sku });
const base = (id, slug, nome, categorias, variacoes) => ({
  id, categoria_id: 'c-' + id, slug, nome,
  descricao: 'Sabonete em barra feito à mão em pequenos lotes. Escolha o aroma e o tamanho.',
  modo_de_uso: 'Molhe a barra, faça espuma nas mãos e aplique na pele úmida. Enxágue.',
  ingredientes: 'Óleo de coco, azeite de oliva, manteiga de karité, água, hidróxido de sódio (saponificado), óleo essencial conforme o aroma escolhido.',
  criado_em: '2026-10-29T12:00:00Z', atualizado_em: '2026-10-29T12:00:00Z', categorias, variacoes,
});

const PRODUTOS = {
  'sabonete-artesanal': base('p1', 'sabonete-artesanal', 'Sabonete artesanal', CAT, [
    v('v-sem-90', 'p1', 'sem fragrância', '90 g', 2000, 15, 'SAB-ART-SEM-090'),
    v('v-ale-90', 'p1', 'alecrim', '90 g', 2200, 18, 'SAB-ART-ALE-090'),
    v('v-lar-90', 'p1', 'laranja-doce', '90 g', 2200, 7, 'SAB-ART-LAR-090'),
    v('v-lav-90', 'p1', 'lavanda', '90 g', 2200, 20, 'SAB-ART-LAV-090'),
    v('v-sem-140', 'p1', 'sem fragrância', '140 g', 2800, 10, 'SAB-ART-SEM-140'),
    v('v-ale-140', 'p1', 'alecrim', '140 g', 3000, 12, 'SAB-ART-ALE-140'),
    v('v-lar-140', 'p1', 'laranja-doce', '140 g', 3000, 0, 'SAB-ART-LAR-140'),
    v('v-lav-140', 'p1', 'lavanda', '140 g', 3000, 9, 'SAB-ART-LAV-140'),
  ]),
  'vela-aromatica': base('p2', 'vela-aromatica', 'Vela aromática', { slug: 'velas', nome: 'Velas' }, [
    v('v-vela-lav-150', 'p2', 'lavanda', '150 g', 4500, 6, 'VEL-ARO-LAV-150'),
    v('v-vela-ale-150', 'p2', 'alecrim', '150 g', 4500, 0, 'VEL-ARO-ALE-150'),
    v('v-vela-lav-300', 'p2', 'lavanda', '300 g', 7800, 4, 'VEL-ARO-LAV-300'),
  ]),
};

const FRETES = [
  { nome: 'Mesma cidade e região metropolitana', cep_inicio: '01000000', cep_fim: '09999999', modo: 'motoboy', valor_centavos: 1500, prazo_texto: '1 a 2 dias úteis, combinado por WhatsApp' },
  { nome: 'Retirada no ateliê', cep_inicio: '01000000', cep_fim: '09999999', modo: 'retirada', valor_centavos: 0, prazo_texto: 'a combinar por WhatsApp' },
  { nome: 'Restante do estado', cep_inicio: '11000000', cep_fim: '19999999', modo: 'correios', valor_centavos: 2500, prazo_texto: '3 a 7 dias úteis' },
  { nome: 'Sudeste e Sul', cep_inicio: '20000000', cep_fim: '39999999', modo: 'correios', valor_centavos: 3000, prazo_texto: '4 a 9 dias úteis' },
];

const USUARIOS = {
  'token-admin': { id: '00000000-0000-4000-8000-0000000000a1', papel: 'admin' },
  'token-cliente': { id: '00000000-0000-4000-8000-0000000000c1', papel: 'cliente' },
};

function json(res, status, corpo) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(corpo));
}

const SEM_LINHA = { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'Cannot coerce the result to a single JSON object' };

const servidor = createServer((req, res) => {
  if (process.env.SUPABASE_FALSO_LOG) console.log(req.method, req.url);
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const unico = String(req.headers.accept ?? '').includes('vnd.pgrst.object');
  const q = url.searchParams;

  if (url.pathname === '/saude') return json(res, 200, { ok: true });

  if (url.pathname === '/rest/v1/produtos') {
    const slug = (q.get('slug') ?? '').replace(/^eq\./, '');
    if (slug === 'quebrado') return json(res, 500, { code: 'XX000', message: 'falha simulada do banco', details: null, hint: null });
    const p = PRODUTOS[slug];
    if (unico) return p ? json(res, 200, p) : json(res, 406, SEM_LINHA);
    return json(res, 200, p ? [p] : slug ? [] : Object.values(PRODUTOS));
  }

  if (url.pathname === '/rest/v1/fretes_regiao') {
    const ate = (q.get('cep_inicio') ?? '').replace(/^lte\./, '');
    const de = (q.get('cep_fim') ?? '').replace(/^gte\./, '');
    return json(res, 200, FRETES.filter((f) => f.cep_inicio <= ate && f.cep_fim >= de));
  }

  if (url.pathname === '/auth/v1/user') {
    const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
    const u = USUARIOS[token];
    if (!u) return json(res, 401, { code: 401, msg: 'token inválido' });
    return json(res, 200, { id: u.id, aud: 'authenticated', role: 'authenticated', email: `${u.papel}@exemplo.test`, app_metadata: {}, user_metadata: {}, created_at: '2026-10-29T12:00:00Z' });
  }

  if (url.pathname === '/rest/v1/perfis') {
    const id = (q.get('id') ?? '').replace(/^eq\./, '');
    const u = Object.values(USUARIOS).find((x) => x.id === id);
    if (!u) return unico ? json(res, 406, SEM_LINHA) : json(res, 200, []);
    return json(res, 200, unico ? { papel: u.papel } : [{ papel: u.papel }]);
  }

  return json(res, 404, { message: 'rota do Supabase falso não existe: ' + url.pathname });
});

servidor.listen(PORTA, '127.0.0.1', () => console.log(`Supabase falso em http://127.0.0.1:${PORTA}`));
