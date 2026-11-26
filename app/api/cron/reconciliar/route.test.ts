import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bancoFalso, tem } from '@/lib/pedidos/banco-falso.apoio';

// A rota real, com o Supabase falso e o fetch do Mercado Pago trocado por um dublê.
const estado = vi.hoisted(() => ({ admin: null as unknown }));
vi.mock('@/lib/supabase/admin', () => ({ clienteAdmin: () => estado.admin }));
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

const { GET, POST } = await import('./route');

const pedido = (metodo: 'GET' | 'POST', segredo = 'segredo') =>
  new Request('http://x/api/cron/reconciliar', { method: metodo, headers: { authorization: `Bearer ${segredo}` } });

describe('rota da reconciliação (L5)', () => {
  let b: ReturnType<typeof bancoFalso>;
  let gets: string[];
  beforeEach(() => {
    process.env.CRON_SECRET = 'segredo';
    process.env.PAGAMENTO_MODO = 'teste';
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-ficticio';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo-ficticio';
    b = bancoFalso((cadeia) => (tem(cadeia, 'from', 'pedidos') ? { data: [{ id: 'p1', status: 'aberto', mp_order_id: 'ORD-1' }], error: null } : { data: [], error: null }));
    b.aoChamar((fn) => {
      if (fn === 'adquirir_trava_rotina') return { data: 'dono-1', error: null };
      if (fn === 'liberar_trava_rotina') return { data: true, error: null };
      if (fn === 'expirar_pedidos_vencidos') return { data: 2, error: null };
      if (fn === 'confirmar_pagamento_mp') return { data: 'pago', error: null };
      return { data: null, error: { code: 'X', message: 'x' } };
    });
    estado.admin = b.db;
    gets = [];
    vi.stubGlobal('fetch', async (url: string) => {
      gets.push(url);
      return new Response(JSON.stringify({ id: 'ORD-1', status: 'processed', status_detail: 'accredited', external_reference: 'p1', total_amount: '75.00' }), { status: 200 });
    });
  });

  it('sem o segredo certo → 401, sem tocar no banco', async () => {
    expect((await POST(pedido('POST', 'errado'))).status).toBe(401);
    expect((await GET(new Request('http://x/api/cron/reconciliar'))).status).toBe(401);
    expect(b.chamadas).toEqual([]);
  });

  it('POST (GitHub Actions) e GET (cron da Vercel) rodam a mesma rodada, com a trava', async () => {
    for (const f of [POST, GET]) {
      b.chamadas.length = 0;
      const r = await f(pedido(f === POST ? 'POST' : 'GET'));
      expect(r.status).toBe(200);
      expect(await r.json()).toMatchObject({ expirados: 2, conferidos: 1, confirmados: { pago: 1 }, falhas: 0 });
      expect(b.chamadas.map((c) => c.fn)).toEqual(['adquirir_trava_rotina', 'expirar_pedidos_vencidos', 'confirmar_pagamento_mp', 'liberar_trava_rotina']);
    }
    expect(gets[0]).toBe('https://api.mercadopago.com/v1/orders/ORD-1');
  });

  it('schema antigo (a função de trava ainda não existe) → 500 para o agendador avisar', async () => {
    b.aoChamar(() => ({ data: null, error: { code: 'PGRST202', message: 'x' } }));
    expect((await POST(pedido('POST'))).status).toBe(500);
  });

  it('expiração falhou → 500, mas a confirmação do pago aconteceu', async () => {
    b.aoChamar((fn) => (fn === 'expirar_pedidos_vencidos' ? { data: null, error: { code: 'XX000', message: 'x' } } : fn === 'adquirir_trava_rotina' ? { data: 'd', error: null } : fn === 'confirmar_pagamento_mp' ? { data: 'pago', error: null } : { data: true, error: null }));
    const r = await POST(pedido('POST'));
    expect(r.status).toBe(500);
    expect(b.chamadas.map((c) => c.fn)).toContain('confirmar_pagamento_mp');
  });

  it('sem PAGAMENTO_MODO → 500, nada roda', async () => {
    delete process.env.PAGAMENTO_MODO;
    expect((await POST(pedido('POST'))).status).toBe(500);
    expect(b.chamadas).toEqual([]);
  });
});
