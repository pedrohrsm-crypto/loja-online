import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bancoFalso, tem } from '@/lib/pedidos/banco-falso.apoio';

// A rota real, com o Supabase e o Stripe trocados por falsos.
const estado = vi.hoisted(() => ({ admin: null as unknown }));
vi.mock('@/lib/supabase/admin', () => ({ clienteAdmin: () => estado.admin }));
vi.mock('@/lib/pagamentos/stripe', () => ({ stripe: async () => ({ ok: true, dados: { status: 'open', payment_status: 'unpaid' } }) }));
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

const { GET } = await import('./route');

function pedido(): Request {
  return new Request('http://x/api/cron/reconciliar', { headers: { authorization: 'Bearer segredo' } });
}

describe('reconciliação diária (B1)', () => {
  let b: ReturnType<typeof bancoFalso>;
  beforeEach(() => {
    process.env.CRON_SECRET = 'segredo';
    b = bancoFalso(() => ({ data: [], error: null }));
    estado.admin = b.db;
  });

  it('expira os pedidos com itens vencidos (devolve a reserva) e lê só o legado do Stripe', async () => {
    b.aoChamar(() => ({ data: 2, error: null }));
    const r = await GET(pedido());
    expect(r.status).toBe(200);
    expect((await r.json()).expirados).toBe(2);
    expect(b.chamadas.map((c) => c.fn)).toEqual(['expirar_pedidos_vencidos']);
    const leitura = b.consultas[0];
    expect(tem(leitura, 'eq', 'status', 'aberto') && tem(leitura, 'not', 'produto', 'is', null)).toBe(true);
  });

  it('expiração falhou: a rodada do legado segue, mas a resposta é 500 para o agendador avisar', async () => {
    b.aoChamar(() => ({ data: null, error: { code: 'PGRST202', message: 'x' } }));
    const r = await GET(pedido());
    expect(r.status).toBe(500);
    expect(b.consultas.length).toBe(1);
  });
});
