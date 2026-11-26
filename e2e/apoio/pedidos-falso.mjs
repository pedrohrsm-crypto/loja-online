// Pedidos no Supabase FALSO (#32): `pedidos` com `itens_pedido` embutidos, as RPCs do Pix
// (confirmar_pagamento_mp, travas, reserva de evento) e `eventos_pagamento`, em memória, no formato do
// PostgREST. Imita o CONTRATO das funções da migration 20261104000001 (a regra de verdade é provada na
// bancada SQL) e a RLS de linha: com o JWT do comprador, só os pedidos dele; com a service_role, todos.
//
// Cada teste semeia o PRÓPRIO pedido (POST /teste/pedido), com id novo: os três projetos do Playwright
// rodam em paralelo sem um mexer no pedido do outro. Ligado em e2e/apoio/supabase-falso.mjs.
import { randomUUID } from 'node:crypto';

const pedidos = new Map();
const eventos = new Map();
const travas = new Map();

function lerCorpo(req) {
  return new Promise((resolve) => {
    let t = '';
    req.on('data', (p) => (t += p));
    req.on('end', () => {
      try { resolve(t ? JSON.parse(t) : {}); } catch { resolve(null); }
    });
  });
}

// Filtros do PostgREST que o código usa: eq, is.null, not.is.null, in.(…), gt, gte.
function passa(linha, q) {
  for (const [coluna, filtro] of q.entries()) {
    if (['select', 'order', 'limit', 'offset'].includes(coluna)) continue;
    const v = linha[coluna] ?? null;
    if (filtro === 'is.null') { if (v !== null) return false; continue; }
    if (filtro === 'not.is.null') { if (v === null) return false; continue; }
    const m = filtro.match(/^(eq|gt|gte|in)\.(.*)$/);
    if (!m) return false;
    if (m[1] === 'eq' && String(v) !== m[2]) return false;
    if (m[1] === 'in' && !m[2].replace(/^\(|\)$/g, '').split(',').includes(String(v))) return false;
    if (m[1] === 'gt' && !(v !== null && String(v) > m[2])) return false;
    if (m[1] === 'gte' && !(v !== null && String(v) >= m[2])) return false;
  }
  return true;
}

function semear(c) {
  const agora = Date.now();
  const id = randomUUID();
  const p = {
    id, usuario_id: c.usuario_id, produto: null, status: c.status ?? 'aberto', total_centavos: c.total_centavos ?? 13400,
    expira_em: new Date(agora + (c.minutos_restantes ?? 25) * 60_000).toISOString(),
    cancelado_em: c.cancelado_em_minutos === undefined ? null : new Date(agora + c.cancelado_em_minutos * 60_000).toISOString(),
    criado_em: new Date(agora - 60_000).toISOString(), modo: 'teste',
    mp_order_id: c.mp_order_id ?? null, mp_qr_code: c.mp_qr_code ?? null, mp_qr_code_base64: c.mp_qr_code_base64 ?? null,
    mp_ticket_url: null, mp_criado_em: c.mp_order_id ? new Date(agora).toISOString() : null, mp_cancelado_em: null,
    alerta_pagamento: null, alerta_em: null, reativado_em: null,
    itens_pedido: c.itens ?? [{ variacao_id: 'a0000000-0000-4000-8000-000000000001', quantidade: 2 }],
  };
  pedidos.set(id, p);
  return p;
}

function confirmar(a) {
  const p = [...pedidos.values()].find((x) => x.mp_order_id === a.p_mp_order_id && x.produto === null);
  if (!p) return 'nao-encontrado';
  if (p.status === 'pago' || p.status === 'estornado') return 'ja-pago';
  if (p.modo !== a.p_modo) return 'modo-divergente';
  if (a.p_external_reference !== p.id) return 'pedido-divergente';
  if (a.p_valor_centavos !== p.total_centavos) return 'valor-divergente';
  p.status = 'pago';
  p.pago_em = new Date().toISOString();
  if (p.cancelado_em) p.reativado_em = p.pago_em;
  return p.cancelado_em ? 'reativado' : 'pago';
}

/** true = tratou a requisição. `quem` = usuário do JWT (ou null); `servico` = veio com a service_role. */
export async function tratarPedidos(req, res, url, { json, quem, servico }) {
  const q = url.searchParams;
  const unico = String(req.headers.accept ?? '').includes('vnd.pgrst.object');

  if (url.pathname === '/teste/pedido' && req.method === 'POST') {
    const c = await lerCorpo(req);
    return json(res, 201, semear(c)), true;
  }
  const ver = url.pathname.match(/^\/teste\/pedido\/([^/]+)$/);
  if (ver && req.method === 'PATCH') {
    const p = pedidos.get(ver[1]);
    if (p) Object.assign(p, await lerCorpo(req));
    return (p ? json(res, 200, p) : json(res, 404, {})), true;
  }
  if (ver) {
    const p = pedidos.get(ver[1]);
    return (p ? json(res, 200, p) : json(res, 404, {})), true;
  }

  if (url.pathname === '/rest/v1/pedidos') {
    if (!servico && !quem) return json(res, 401, { code: '42501', message: 'permission denied' }), true;
    // RLS: o comprador só vê as linhas dele.
    const visiveis = [...pedidos.values()].filter((p) => servico || p.usuario_id === quem.id).filter((p) => passa(p, q));
    if (req.method === 'GET') {
      if (unico) return (visiveis.length === 1 ? json(res, 200, visiveis[0]) : visiveis.length === 0 ? json(res, 200, null) : json(res, 406, { code: 'PGRST116' })), true;
      return json(res, 200, visiveis), true;
    }
    if (req.method === 'PATCH') {
      // authenticated não escreve em pedidos (migration: nenhum GRANT de UPDATE).
      if (!servico) return json(res, 403, { code: '42501', message: 'permission denied for table pedidos' }), true;
      const corpo = await lerCorpo(req);
      for (const p of visiveis) Object.assign(p, corpo);
      return json(res, 200, visiveis.map((p) => ({ id: p.id }))), true;
    }
  }

  if (url.pathname.startsWith('/rest/v1/rpc/') || url.pathname === '/rest/v1/eventos_pagamento') {
    const fn = url.pathname.replace('/rest/v1/rpc/', '');
    const PIX = ['confirmar_pagamento_mp', 'reservar_evento_pagamento', 'adquirir_trava_rotina', 'liberar_trava_rotina', 'expirar_pedidos_vencidos'];
    if (url.pathname.startsWith('/rest/v1/rpc/') && !PIX.includes(fn)) return false;
    if (!servico) return json(res, 401, { code: '42501', message: `permission denied for function ${fn}` }), true;
    const corpo = req.method === 'GET' || req.method === 'DELETE' ? {} : await lerCorpo(req);
    if (url.pathname === '/rest/v1/eventos_pagamento') {
      const id = (q.get('id') ?? '').replace(/^eq\./, '');
      if (req.method === 'PATCH') {
        if (!eventos.has(id)) return json(res, 200, []), true;
        eventos.set(id, 'concluido');
        return json(res, 200, [{ id }]), true;
      }
      if (req.method === 'DELETE') {
        if (eventos.get(id) !== 'concluido') eventos.delete(id);
        return json(res, 204, null), true;
      }
    }
    if (fn === 'confirmar_pagamento_mp') return json(res, 200, confirmar(corpo)), true;
    if (fn === 'reservar_evento_pagamento') {
      const e = eventos.get(corpo.p_id);
      if (!e) eventos.set(corpo.p_id, 'reservado');
      return json(res, 200, !e ? 'reservado' : e === 'concluido' ? 'duplicado' : 'em-andamento'), true;
    }
    if (fn === 'adquirir_trava_rotina') {
      if ((travas.get(corpo.p_nome) ?? 0) > Date.now()) return json(res, 200, null), true;
      travas.set(corpo.p_nome, Date.now() + 60_000);
      return json(res, 200, randomUUID()), true;
    }
    if (fn === 'liberar_trava_rotina') return travas.delete(corpo.p_nome), json(res, 200, true), true;
    if (fn === 'expirar_pedidos_vencidos') return json(res, 200, 0), true;
  }
  return false;
}
