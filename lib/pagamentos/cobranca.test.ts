import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaOrder, consultarPix, corpoDaOrder, gerarPix, type DadosCobranca, type PedidoParaPix, type PortasCobranca } from './cobranca';
import type { ConfigMP } from './config';
import { LojaFalsa } from './mp-falso.apoio';

vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

const AGORA = Date.parse('2026-11-05T12:00:00Z');
const DONO = '00000000-0000-4000-8000-0000000000c1';
const ID = 'b0000000-0000-4000-8000-000000000001';
const TESTE: ConfigMP = { modo: 'teste', accessToken: 'x', segredoWebhook: 'y' };
const PIX = { id: 'pix', type: 'bank_transfer', qr_code: '000201-copia-e-cola', qr_code_base64: 'aW1hZ2Vt', ticket_url: 'https://exemplo.invalid/t' };

class Portas extends LojaFalsa implements PortasCobranca {
  linha: PedidoParaPix | null = { id: ID, usuarioId: DONO, status: 'aberto', totalCentavos: 28000, expiraEm: new Date(AGORA + 25 * 60_000).toISOString(), mpOrderId: null, qrCode: null, qrCodeBase64: null };
  criadas: { corpo: unknown; chave: string }[] = [];
  canceladas: string[] = [];
  marcadas: string[] = [];
  vivas: { id: string; mpOrderId: string }[] = [];
  respostaCriar: Awaited<ReturnType<PortasCobranca['criarOrder']>> | null = null;
  gravarDevolve = true;
  async lerPedido() { return this.linha ? { ...this.linha } : null; }
  async gravarCobranca(_id: string, d: DadosCobranca) {
    if (!this.gravarDevolve || !this.linha || this.linha.mpOrderId) return false;
    this.linha.mpOrderId = d.mpOrderId;
    this.linha.qrCode = d.qrCode;
    return true;
  }
  async completarPix(_id: string, d: DadosCobranca) { if (this.linha) this.linha.qrCode = d.qrCode; return true; }
  async criarOrder(corpo: unknown, chave: string) {
    this.criadas.push({ corpo, chave });
    return this.respostaCriar ?? { ok: true as const, json: { id: 'ORD-NOVA', status: 'action_required', status_detail: 'waiting_transfer', total_amount: '280.00', external_reference: ID, transactions: { payments: [{ payment_method: PIX }] } } };
  }
  async cancelarOrder(orderId: string) { this.canceladas.push(orderId); return { ok: true, transitorio: false }; }
  async cobrancasVivasCanceladas() { return this.vivas; }
  async marcarCanceladaNoMP(id: string) { this.marcadas.push(id); }
}

const gerar = (portas: Portas, extra: Partial<Parameters<typeof gerarPix>[0]> = {}) =>
  gerarPix({ pedidoId: ID, usuarioId: DONO, email: 'cliente@exemplo.test', config: TESTE, agoraMs: AGORA, ...extra }, portas);

describe('cobrança Pix do pedido reservado (L3)', () => {
  let portas: Portas;
  beforeEach(() => { portas = new Portas(); });

  it('cria a order com o total do pedido congelado, PT30M, external_reference = id e grava a order', async () => {
    expect(await gerar(portas)).toEqual({ ok: true, criada: true });
    const corpo = portas.criadas[0].corpo as ReturnType<typeof corpoDaOrder>;
    expect(corpo.total_amount).toBe('280.00');
    expect(corpo.external_reference).toBe(ID);
    expect(corpo.transactions.payments).toEqual([{ amount: '280.00', payment_method: { id: 'pix', type: 'bank_transfer' }, expiration_time: 'PT30M' }]);
    expect(portas.linha?.mpOrderId).toBe('ORD-NOVA');
    expect(portas.linha?.qrCode).toBe('000201-copia-e-cola');
  });

  it('payer só com o e-mail; APRO só no modo de teste', () => {
    const pedido = { id: ID, totalCentavos: 100 };
    expect(corpoDaOrder(pedido, 'a@b.test', 'teste').payer).toEqual({ email: 'a@b.test', first_name: 'APRO' });
    expect(corpoDaOrder(pedido, 'a@b.test', 'producao').payer).toEqual({ email: 'a@b.test' });
  });

  it('T12: a chave nasce do pedido (sem e-mail nem relógio) e cabe no limite de 128', () => {
    const a = chaveDaOrder({ id: ID, totalCentavos: 28000 }, 'teste');
    expect(chaveDaOrder({ id: ID, totalCentavos: 28000 }, 'teste')).toBe(a);
    expect(chaveDaOrder({ id: ID, totalCentavos: 28100 }, 'teste')).not.toBe(a);
    expect(chaveDaOrder({ id: ID, totalCentavos: 28000 }, 'producao')).not.toBe(a);
    expect(a.length).toBeLessThanOrEqual(128);
    expect(a).not.toMatch(/@/);
  });

  it('T12: com a order já gravada (outra aba), não cria outra', async () => {
    portas.linha!.mpOrderId = 'ORD-DA-OUTRA-ABA';
    expect(await gerar(portas)).toEqual({ ok: true, criada: false });
    expect(portas.criadas).toEqual([]);
  });

  it('T12: chave já usada (409) → em andamento, sem gravar nada', async () => {
    portas.respostaCriar = { ok: false, transitorio: false, status: 409, codigo: 'idempotency_key_already_used' };
    expect(await gerar(portas)).toEqual({ ok: false, motivo: 'em-andamento' });
    expect(portas.linha?.mpOrderId).toBeNull();
  });

  it('guarda: pedido de outra pessoa é igual a inexistente; fechado e vencido não geram Pix', async () => {
    expect(await gerar(portas, { usuarioId: '00000000-0000-4000-8000-0000000000c9' })).toEqual({ ok: false, motivo: 'nao-encontrado' });
    portas.linha!.status = 'pago';
    expect(await gerar(portas)).toEqual({ ok: false, motivo: 'fechado' });
    portas.linha!.status = 'aberto';
    expect(await gerar(portas, { agoraMs: AGORA + 26 * 60_000 })).toEqual({ ok: false, motivo: 'expirado' });
    portas.linha = null;
    expect(await gerar(portas)).toEqual({ ok: false, motivo: 'nao-encontrado' });
    expect(portas.criadas).toEqual([]);
  });

  it('recusa do Mercado Pago (ex.: sem chave Pix) → indisponível, nada gravado', async () => {
    portas.respostaCriar = { ok: false, transitorio: false, status: 400, codigo: 'property_value' };
    expect(await gerar(portas)).toEqual({ ok: false, motivo: 'indisponivel' });
    expect(portas.linha?.mpOrderId).toBeNull();
  });

  it('o pedido saiu de aberto entre a leitura e a gravação → cancela a order recém-criada', async () => {
    portas.gravarDevolve = false;
    expect(await gerar(portas)).toEqual({ ok: false, motivo: 'fechado' });
    expect(portas.canceladas).toEqual(['ORD-NOVA']);
  });

  it('T18: pedido substituído → a order do anterior é cancelada no Mercado Pago', async () => {
    portas.vivas = [{ id: 'b0000000-0000-4000-8000-0000000000aa', mpOrderId: 'ORD-ANTIGA' }];
    await gerar(portas);
    expect(portas.canceladas).toEqual(['ORD-ANTIGA']);
    expect(portas.marcadas).toEqual(['b0000000-0000-4000-8000-0000000000aa']);
  });

  it('T18: cancelar a anterior falhou → o Pix novo sai assim mesmo, e a anterior fica para a reconciliação', async () => {
    portas.vivas = [{ id: 'b0000000-0000-4000-8000-0000000000aa', mpOrderId: 'ORD-ANTIGA' }];
    portas.cancelarOrder = async () => ({ ok: false, transitorio: true });
    expect(await gerar(portas)).toEqual({ ok: true, criada: true });
    expect(portas.marcadas).toEqual([]);
  });

  it('a tela consulta o estado real: order paga → pedido pago; esperando sem QR → completa o QR', async () => {
    portas.linha!.mpOrderId = 'ORD-1';
    portas.pedido({ id: ID, mpOrderId: 'ORD-1', totalCentavos: 28000 });
    portas.orders.set('ORD-1', { id: 'ORD-1', status: 'action_required', status_detail: 'waiting_transfer', external_reference: ID, total_amount: '280.00', transactions: { payments: [{ payment_method: PIX }] } });
    expect(await consultarPix(portas.linha!, TESTE, portas)).toBe('sem-mudanca');
    expect(portas.linha?.qrCode).toBe('000201-copia-e-cola');
    portas.orderPaga('ORD-1', ID, '280.00');
    expect(await consultarPix(portas.linha!, TESTE, portas)).toBe('pago');
    expect(portas.pedidos.get(ID)?.status).toBe('pago');
  });

  it('a consulta da tela nunca derruba a página: Mercado Pago fora → sem mudança', async () => {
    portas.linha!.mpOrderId = 'ORD-1';
    portas.falharGet = 'transitorio';
    expect(await consultarPix(portas.linha!, TESTE, portas)).toBe('sem-mudanca');
  });
});
