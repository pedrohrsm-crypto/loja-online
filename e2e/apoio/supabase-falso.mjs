// Supabase FALSO para o e2e: responde só o que as telas da alta fidelidade leem, no formato do
// PostgREST e do GoTrue, para que o código REAL de lib/catalogo/ e a guarda de papel rodem sem
// banco. Não valida nada, não grava nada e só escuta em 127.0.0.1. Os dados espelham a carga
// fictícia de supabase/seed/catalogo.sql (cliente fictício).
//
// Casos de teste por slug: "sabonete-artesanal" (normal, com variação esgotada), "vela-aromatica"
// (alecrim 150 g esgotado), "quebrado" (o banco responde 500: estado de erro), qualquer outro
// (sem linha: produto indisponível).
//
// Auth (frente entrar-codigo, #28): o token de acesso tem o FORMATO de um JWT (cabeçalho.carga.
// assinatura, em base64url), porque mfa.getAuthenticatorAssuranceLevel(jwt) lê o `aal` da carga. O
// falso não confere a assinatura: o usuário sai do `sub` e o nível, do `aal`. Usuários fictícios:
// - admin@exemplo.test (senha "senha-da-dona"): dona com o autenticador ativo;
// - dona-nova@exemplo.test (senha "senha-da-dona"): dona sem autenticador (ativação);
// - cliente@exemplo.test (senha "senha-do-cliente"): comprador; no cadastro, é o "e-mail que já tem conta";
// - pendente@exemplo.test (senha "senha-pendente"): conta sem e-mail confirmado;
// - qualquer outro e-mail no cadastro vira o comprador novo depois do código.
// O código certo, do e-mail e do autenticador, é sempre 123456.
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

// Checkout (#27): produto lido só pelo slug (não entra na vitrine), com ids no formato uuid, como o
// banco real. A função criar_pedido falsa responde pelo id da variação: uma esgota na hora da
// reserva (outro comprador levou: T13 visto pela tela), outra simula a função ainda inexistente.
const VARIACAO_OK = 'a0000000-0000-4000-8000-000000000001';
const VARIACAO_ESGOTA_NA_RESERVA = 'a0000000-0000-4000-8000-000000000002';
const VARIACAO_BANCO_FORA = 'a0000000-0000-4000-8000-000000000003';
const PEDIDO_CRIADO = 'b0000000-0000-4000-8000-0000000004f2';
// A chave de serviço fictícia que o playwright.config.ts entrega ao Next e a este falso.
const CHAVE_SERVICO = process.env.SUPABASE_FALSO_CHAVE_SERVICO ?? 'service-role-de-teste';
const SO_POR_SLUG = {
  'oleo-corporal': base('p3', 'oleo-corporal', 'Óleo corporal', { slug: 'oleos', nome: 'Óleos' }, [
    v(VARIACAO_OK, 'p3', 'lavanda', '100 ml', 5200, 5, 'OLE-COR-LAV-100'),
    v(VARIACAO_ESGOTA_NA_RESERVA, 'p3', 'alecrim', '100 ml', 5200, 4, 'OLE-COR-ALE-100'),
    v(VARIACAO_BANCO_FORA, 'p3', 'sem fragrância', '100 ml', 5000, 6, 'OLE-COR-SEM-100'),
  ]),
};

const FRETES = [
  { nome: 'Mesma cidade e região metropolitana', cep_inicio: '01000000', cep_fim: '09999999', modo: 'motoboy', valor_centavos: 1500, prazo_texto: '1 a 2 dias úteis, combinado por WhatsApp' },
  { nome: 'Retirada no ateliê', cep_inicio: '01000000', cep_fim: '09999999', modo: 'retirada', valor_centavos: 0, prazo_texto: 'a combinar por WhatsApp' },
  { nome: 'Restante do estado', cep_inicio: '11000000', cep_fim: '19999999', modo: 'correios', valor_centavos: 2500, prazo_texto: '3 a 7 dias úteis' },
  { nome: 'Sudeste e Sul', cep_inicio: '20000000', cep_fim: '39999999', modo: 'correios', valor_centavos: 3000, prazo_texto: '4 a 9 dias úteis' },
];

const FATOR_ATIVO = { id: 'fator-totp-a1', factor_type: 'totp', status: 'verified', friendly_name: 'Painel Alecrim', created_at: '2026-10-29T12:00:00Z', updated_at: '2026-10-29T12:00:00Z' };
const FATOR_NOVO = { id: 'fator-novo', factor_type: 'totp', status: 'unverified', friendly_name: 'Painel Alecrim', created_at: '2026-10-29T12:00:00Z', updated_at: '2026-10-29T12:00:00Z' };

const USUARIOS = [
  { id: '00000000-0000-4000-8000-0000000000a1', email: 'admin@exemplo.test', senha: 'senha-da-dona', papel: 'admin', fatores: [FATOR_ATIVO] },
  { id: '00000000-0000-4000-8000-0000000000a2', email: 'dona-nova@exemplo.test', senha: 'senha-da-dona', papel: 'admin', fatores: [FATOR_NOVO] },
  { id: '00000000-0000-4000-8000-0000000000c1', email: 'cliente@exemplo.test', senha: 'senha-do-cliente', papel: 'cliente', fatores: [] },
  { id: '00000000-0000-4000-8000-0000000000c2', email: 'pendente@exemplo.test', senha: 'senha-pendente', papel: 'cliente', fatores: [], pendente: true },
  { id: '00000000-0000-4000-8000-0000000000c3', email: 'novo@exemplo.test', senha: null, papel: 'cliente', fatores: [] },
  { id: '00000000-0000-4000-8000-0000000000c4', email: 'limitado@exemplo.test', senha: 'senha-pendente', papel: 'cliente', fatores: [], pendente: true },
];
const NOVO = USUARIOS[4];
const CODIGO_CERTO = '123456';

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
function jwt(usuario, aal) {
  const agora = Math.floor(Date.now() / 1000);
  const carga = { sub: usuario.id, aud: 'authenticated', role: 'authenticated', email: usuario.email, aal, amr: [{ method: aal === 'aal2' ? 'totp' : 'password', timestamp: agora }], iat: agora, exp: 4102444800, session_id: 'sessao-falsa' };
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(carga)}.${Buffer.from('assinatura-falsa').toString('base64url')}`;
}

function lerToken(req) {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
  try {
    const carga = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    const usuario = USUARIOS.find((u) => u.id === carga.sub);
    return usuario ? { usuario, aal: carga.aal } : null;
  } catch {
    return null;
  }
}

function usuarioGoTrue(u, email = u.email) {
  return { id: u.id, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: u.pendente ? null : '2026-10-29T12:00:00Z', app_metadata: {}, user_metadata: {}, identities: [{ id: u.id, provider: 'email' }], factors: u.fatores, created_at: '2026-10-29T12:00:00Z' };
}

function sessao(u, aal, email) {
  return { access_token: jwt(u, aal), refresh_token: `renovacao-${aal}`, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: usuarioGoTrue(u, email) };
}

function lerCorpo(req) {
  return new Promise((resolve) => {
    let texto = '';
    req.on('data', (parte) => (texto += parte));
    req.on('end', () => {
      try {
        resolve(texto ? JSON.parse(texto) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function json(res, status, corpo) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(corpo));
}

const erroAuth = (res, status, codigo) => json(res, status, { code: status, error_code: codigo, msg: `erro simulado: ${codigo}` });

async function auth(req, res, url) {
  const caminho = url.pathname.replace(/^\/auth\/v1/, '');
  const corpo = req.method === 'GET' || req.method === 'DELETE' ? {} : await lerCorpo(req);

  if (caminho === '/token' && url.searchParams.get('grant_type') === 'password') {
    const u = USUARIOS.find((x) => x.email === corpo.email && x.senha && x.senha === corpo.password);
    if (!u) return erroAuth(res, 400, 'invalid_credentials');
    if (u.pendente) return erroAuth(res, 400, 'email_not_confirmed');
    return json(res, 200, sessao(u, 'aal1'));
  }
  if (caminho === '/signup') {
    // Anti-enumeração do GoTrue com "Confirm email" ligado: e-mail que já tem conta volta 200 com
    // um usuário ofuscado de identities vazio (auth-js, doc de signUp).
    const existe = USUARIOS.some((x) => x !== NOVO && x.email === corpo.email);
    return json(res, 200, { ...usuarioGoTrue(NOVO, corpo.email), email_confirmed_at: null, identities: existe ? [] : [{ id: NOVO.id, provider: 'email' }] });
  }
  if (caminho === '/verify') {
    if (corpo.token !== CODIGO_CERTO) return erroAuth(res, 403, 'otp_expired');
    return json(res, 200, sessao(NOVO, 'aal1', corpo.email));
  }
  // O reenvio para "limitado@" simula o limite de 1 e-mail por minuto do Auth.
  if (caminho === '/resend') return corpo.email === 'limitado@exemplo.test' ? erroAuth(res, 429, 'over_email_send_rate_limit') : json(res, 200, {});

  const quem = lerToken(req);
  if (!quem) return json(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'token inválido' });
  if (caminho === '/user') return json(res, 200, usuarioGoTrue(quem.usuario));
  if (caminho === '/factors' && req.method === 'POST') {
    const qr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="white"/><rect x="2" y="2" width="6" height="6"/></svg>';
    return json(res, 200, { id: FATOR_NOVO.id, type: 'totp', friendly_name: corpo.friendly_name, totp: { qr_code: qr, secret: 'SEGREDOFALSODOE2E', uri: 'otpauth://totp/exemplo' } });
  }
  const fator = caminho.match(/^\/factors\/([^/]+)(\/challenge|\/verify)?$/);
  if (fator && req.method === 'DELETE') return json(res, 200, { id: fator[1] });
  if (fator && fator[2] === '/challenge') return json(res, 200, { id: 'desafio-falso', type: 'totp', expires_at: 4102444800 });
  if (fator && fator[2] === '/verify') {
    if (corpo.code !== CODIGO_CERTO) return erroAuth(res, 422, 'mfa_verification_failed');
    const { user, ...resto } = sessao(quem.usuario, 'aal2');
    return json(res, 200, { ...resto, user });
  }
  return json(res, 404, { message: 'rota de auth do Supabase falso não existe: ' + caminho });
}

const SEM_LINHA = { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'Cannot coerce the result to a single JSON object' };

const servidor = createServer((req, res) => {
  if (process.env.SUPABASE_FALSO_LOG) console.log(req.method, req.url);
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const unico = String(req.headers.accept ?? '').includes('vnd.pgrst.object');
  const q = url.searchParams;

  if (url.pathname === '/saude') return json(res, 200, { ok: true });

  if (url.pathname === '/rest/v1/rpc/criar_pedido' && req.method === 'POST') {
    let corpo = '';
    req.on('data', (parte) => { corpo += parte; });
    req.on('end', () => {
      let args;
      try { args = JSON.parse(corpo); } catch { return json(res, 400, { code: '22P02', message: 'json inválido' }); }
      // Como o banco real: a função só executa com a service_role (REVOKE de anon e authenticated na
      // migration), e o comprador tem de existir. O JWT do comprador nunca chega aqui: o servidor lê o
      // `sub` dele pelo /user e manda o id em p_usuario_id.
      if (String(req.headers.authorization ?? '') !== `Bearer ${CHAVE_SERVICO}`) {
        return json(res, 401, { code: '42501', message: 'permission denied for function criar_pedido', details: null, hint: null });
      }
      if (!USUARIOS.some((u) => u.id === args.p_usuario_id)) {
        return json(res, 409, { code: '23503', message: 'insert or update on table "pedidos" violates foreign key constraint', details: null, hint: null });
      }
      const ids = (args.p_itens ?? []).map((i) => i.variacao_id);
      if (ids.includes(VARIACAO_BANCO_FORA)) return json(res, 404, { code: 'PGRST202', message: 'Could not find the function public.criar_pedido', details: null, hint: null });
      if (ids.includes(VARIACAO_ESGOTA_NA_RESERVA)) {
        return json(res, 200, { ok: false, motivo: 'mudou', itens: [{ variacao_id: VARIACAO_ESGOTA_NA_RESERVA, tipo: 'esgotou', disponivel: 0 }] });
      }
      const expira = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      return json(res, 200, { ok: true, pedido_id: PEDIDO_CRIADO, expira_em: expira, total_centavos: args.p_total_centavos, reaproveitado: false, substituido: null });
    });
    return;
  }

  if (url.pathname === '/rest/v1/produtos') {
    const slug = (q.get('slug') ?? '').replace(/^eq\./, '');
    if (slug === 'quebrado') return json(res, 500, { code: 'XX000', message: 'falha simulada do banco', details: null, hint: null });
    const p = PRODUTOS[slug] ?? SO_POR_SLUG[slug];
    if (unico) return p ? json(res, 200, p) : json(res, 406, SEM_LINHA);
    return json(res, 200, p ? [p] : slug ? [] : Object.values(PRODUTOS));
  }

  if (url.pathname === '/rest/v1/fretes_regiao') {
    const ate = (q.get('cep_inicio') ?? '').replace(/^lte\./, '');
    const de = (q.get('cep_fim') ?? '').replace(/^gte\./, '');
    return json(res, 200, FRETES.filter((f) => f.cep_inicio <= ate && f.cep_fim >= de));
  }

  if (url.pathname.startsWith('/auth/v1/')) return void auth(req, res, url);

  if (url.pathname === '/rest/v1/perfis') {
    const id = (q.get('id') ?? '').replace(/^eq\./, '');
    const u = USUARIOS.find((x) => x.id === id);
    if (!u) return unico ? json(res, 406, SEM_LINHA) : json(res, 200, []);
    return json(res, 200, unico ? { papel: u.papel } : [{ papel: u.papel }]);
  }

  return json(res, 404, { message: 'rota do Supabase falso não existe: ' + url.pathname });
});

servidor.listen(PORTA, '127.0.0.1', () => console.log(`Supabase falso em http://127.0.0.1:${PORTA}`));
