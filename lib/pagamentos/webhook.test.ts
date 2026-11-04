import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assinar, manifest } from './assinatura';
import type { LeituraConfigMP } from './config';
import { LojaFalsa } from './mp-falso.apoio';
import { processarWebhook } from './webhook';

vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

const SEGREDO = 'segredo-ficticio-de-teste';
const AGORA = 1_790_000_000_000;
const PEDIDO = 'b0000000-0000-4000-8000-000000000001';
const ORDER = 'ORD01PEDIDO1';
const CONFIG: LeituraConfigMP = { ok: true, config: { modo: 'teste', accessToken: 'x', segredoWebhook: SEGREDO } };

type Notificacao = { corpo?: object | string; dataId?: string | null; req?: string; ts?: number; segredo?: string; tipo?: string | null };

describe('webhook do Mercado Pago (L4)', () => {
  let loja: LojaFalsa;
  beforeEach(() => {
    loja = new LojaFalsa();
    loja.pedido({ id: PEDIDO, mpOrderId: ORDER, totalCentavos: 7500 });
    loja.orderPaga(ORDER, PEDIDO, '75.00');
  });

  const enviar = (n: Notificacao = {}, config: LeituraConfigMP = CONFIG) => {
    const dataId = n.dataId === undefined ? ORDER : n.dataId;
    const req = n.req ?? 'req-1';
    const ts = String(n.ts ?? AGORA);
    const corpo = typeof n.corpo === 'string' ? n.corpo : JSON.stringify(n.corpo ?? { type: 'order', action: 'order.processed', live_mode: false, data: { id: ORDER } });
    return processarWebhook({
      corpo, xSignature: `ts=${ts},v1=${assinar(manifest(dataId?.toLowerCase() ?? null, req, ts), n.segredo ?? SEGREDO)}`,
      xRequestId: req, dataId, tipo: n.tipo === undefined ? 'order' : n.tipo, config, eventos: loja, portas: loja, agoraMs: AGORA,
    });
  };

  it('T3: notificação válida → GET da order → pedido pago', async () => {
    const r = await enviar();
    expect(r).toEqual({ status: 200, corpo: { recebido: true, resultado: 'pago' } });
    expect(loja.pedidos.get(PEDIDO)?.status).toBe('pago');
    expect(loja.gets).toBe(1);
  });

  it('T8: a mesma notificação 2 vezes → a 2ª é duplicada e nada muda', async () => {
    await enviar();
    const segunda = await enviar();
    expect(segunda).toEqual({ status: 200, corpo: { recebido: true, resultado: 'duplicado' } });
    expect(loja.gets).toBe(1);
    expect(loja.baixas.get(PEDIDO)).toBe(1);
  });

  it('T9: duas notificações DIFERENTES do mesmo pagamento (created e processed) → baixa 1 vez', async () => {
    await enviar({ req: 'req-created', corpo: { type: 'order', action: 'order.created', live_mode: false } });
    const r = await enviar({ req: 'req-processed', corpo: { type: 'order', action: 'order.processed', live_mode: false } });
    expect(r.corpo.resultado).toBe('ja-pago');
    expect(loja.baixas.get(PEDIDO)).toBe(1);
  });

  it('T10: assinatura errada, velha ou de outro data.id → 400, sem GET', async () => {
    expect((await enviar({ segredo: 'outro' })).status).toBe(400);
    expect((await enviar({ ts: AGORA - 3_600_000 })).status).toBe(400);
    const r = await processarWebhook({
      corpo: '{}', xSignature: `ts=${AGORA},v1=${assinar(manifest('ord-outra', 'req-1', String(AGORA)), SEGREDO)}`,
      xRequestId: 'req-1', dataId: ORDER, tipo: 'order', config: CONFIG, eventos: loja, portas: loja, agoraMs: AGORA,
    });
    expect(r.status).toBe(400);
    expect(loja.gets).toBe(0);
    expect(loja.pedidos.get(PEDIDO)?.status).toBe('aberto');
  });

  it('T10: corpo forjado com status=approved e a order ainda esperando → nada muda (decide o GET)', async () => {
    loja.orders.set(ORDER, { ...loja.orders.get(ORDER)!, status: 'action_required', status_detail: 'waiting_transfer' });
    const r = await enviar({ corpo: { type: 'order', live_mode: false, data: { id: ORDER, status: 'processed', status_detail: 'accredited', total_amount: '75.00' }, status: 'approved' } });
    expect(r).toEqual({ status: 200, corpo: { recebido: true, resultado: 'aguardando' } });
    expect(loja.pedidos.get(PEDIDO)?.status).toBe('aberto');
    expect(loja.confirmacoes).toBe(0);
  });

  it('T10b: order paga com valor diferente do pedido → nada vira pago, alerta', async () => {
    loja.orderPaga(ORDER, PEDIDO, '74.99');
    const r = await enviar();
    expect(r.corpo.resultado).toBe('valor-divergente');
    expect(loja.pedidos.get(PEDIDO)).toMatchObject({ status: 'aberto', alerta: 'valor-divergente' });
  });

  it('T10b: order paga ligada a outro pedido (external_reference) → nada vira pago', async () => {
    loja.orderPaga(ORDER, 'b0000000-0000-4000-8000-0000000000ff', '75.00');
    expect((await enviar()).corpo.resultado).toBe('pedido-divergente');
    expect(loja.pedidos.get(PEDIDO)?.status).toBe('aberto');
  });

  it('T11: banco fora → 500 e reserva devolvida; a reentrega processa uma vez', async () => {
    const reservar = loja.reservar.bind(loja);
    loja.confirmar = vi.fn().mockRejectedValueOnce(new Error('banco fora')).mockImplementation(LojaFalsa.prototype.confirmar.bind(loja));
    const r = await enviar();
    expect(r.status).toBe(500);
    expect(loja.eventos.size).toBe(0);
    loja.reservar = reservar;
    expect((await enviar()).corpo.resultado).toBe('pago');
    expect(loja.baixas.get(PEDIDO)).toBe(1);
  });

  it('T11: Mercado Pago fora no GET → 500 (o Mercado Pago tenta de novo); recusa do GET → 200 inválido', async () => {
    loja.falharGet = 'transitorio';
    expect((await enviar()).status).toBe(500);
    expect(loja.eventos.size).toBe(0);
    loja.falharGet = 'recusa';
    expect(await enviar({ req: 'req-2' })).toEqual({ status: 200, corpo: { recebido: true, resultado: 'invalido' } });
  });

  it('T16: live_mode=true num pedido de teste → 200 com aviso, sem GET e sem efeito', async () => {
    const r = await enviar({ corpo: { type: 'order', live_mode: true, data: { id: ORDER } } });
    expect(r).toEqual({ status: 200, corpo: { recebido: true, resultado: 'modo-divergente' } });
    expect(loja.gets).toBe(0);
    expect(loja.pedidos.get(PEDIDO)?.status).toBe('aberto');
  });

  it('T16: order de teste num pedido de produção → a função de banco recusa (modo-divergente)', async () => {
    loja.pedidos.get(PEDIDO)!.modo = 'producao';
    expect((await enviar()).corpo.resultado).toBe('modo-divergente');
    expect(loja.pedidos.get(PEDIDO)?.status).toBe('aberto');
  });

  it('outro tópico → 200 ignorado; sem data.id → 400; corpo que não é JSON → 400', async () => {
    expect((await enviar({ tipo: 'payment' })).corpo.resultado).toBe('ignorado');
    expect((await enviar({ dataId: null })).status).toBe(400);
    expect((await enviar({ corpo: 'não é json' })).status).toBe(400);
    expect(loja.gets).toBe(0);
  });

  it('sem configuração → 500, sem tocar em nada', async () => {
    const r = await enviar({}, { ok: false, faltando: ['MERCADOPAGO_WEBHOOK_SECRET'] });
    expect(r.status).toBe(500);
    expect(loja.eventos.size).toBe(0);
  });

  it('em andamento em outra instância → 409', async () => {
    loja.eventos.set(`mp:${ORDER}:req-1`, 'reservado');
    expect((await enviar()).status).toBe(409);
    expect(loja.gets).toBe(0);
  });
});
