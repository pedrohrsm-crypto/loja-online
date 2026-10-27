import { describe, expect, it } from 'vitest';
import { reconciliar, type SessaoRemota } from './reconciliar';

const agora = new Date('2026-10-01T12:00:00Z');
const horasAtras = (h: number) => new Date(agora.getTime() - h * 3_600_000);

describe('reconciliação', () => {
  it('recupera o pagamento que o webhook perdeu e cancela o expirado', async () => {
    const sessoes: Record<string, SessaoRemota> = {
      cs_pago: { status: 'complete', payment_status: 'paid', payment_intent: 'pi_1' },
      cs_exp: { status: 'expired', payment_status: 'unpaid' },
      cs_aberta: { status: 'open', payment_status: 'unpaid' },
    };
    const r = await reconciliar(
      [
        { id: 'a', sessaoId: 'cs_pago', criadoEm: horasAtras(1) },
        { id: 'b', sessaoId: 'cs_exp', criadoEm: horasAtras(30) },
        { id: 'c', sessaoId: 'cs_aberta', criadoEm: horasAtras(1) },
      ],
      async (id) => sessoes[id] ?? null,
      agora,
    );
    expect(r.correcoes).toEqual([
      { pedidoId: 'a', acao: 'marcar-pago', sessaoId: 'cs_pago', pagamentoId: 'pi_1' },
      { pedidoId: 'b', acao: 'cancelar', motivo: 'sessao-expirada' },
    ]);
  });

  it('sem resposta do processador, não decide nada', async () => {
    const r = await reconciliar([{ id: 'a', sessaoId: 'cs_x', criadoEm: horasAtras(1) }], async () => { throw new Error('rede'); }, agora);
    expect(r).toEqual({ correcoes: [], falhas: ['a'] });
  });

  it('pedido sem sessão só é cancelado depois da janela de abandono', async () => {
    const r1 = await reconciliar([{ id: 'a', sessaoId: null, criadoEm: horasAtras(2) }], async () => null, agora);
    const r2 = await reconciliar([{ id: 'a', sessaoId: null, criadoEm: horasAtras(72) }], async () => null, agora);
    expect(r1.correcoes).toEqual([]);
    expect(r2.correcoes).toEqual([{ pedidoId: 'a', acao: 'cancelar', motivo: 'abandonado' }]);
  });
});
