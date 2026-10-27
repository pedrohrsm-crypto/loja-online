import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assinar } from './assinatura';
import { DadoInvalido, processarWebhook, type Reserva, type RepositorioEventos, type Tratador } from './webhook';
import { chaveDoCheckout } from './chave';

vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

const SEGREDO = 'whsec_teste';
const AGORA = 1_790_000_000_000;

function requisicao(evento: object, segredo = SEGREDO, t = AGORA / 1000) {
  const corpo = JSON.stringify(evento);
  return { corpo, cabecalho: `t=${t},v1=${assinar(corpo, segredo, t)}` };
}

class RepoMemoria implements RepositorioEventos {
  estado = new Map<string, 'reservado' | 'concluido'>();
  forcar?: Reserva;
  async reservar(id: string): Promise<Reserva> {
    if (this.forcar) return this.forcar;
    const e = this.estado.get(id);
    if (e === 'concluido') return 'duplicado';
    if (e === 'reservado') return 'em-andamento';
    this.estado.set(id, 'reservado');
    return 'reservado';
  }
  async concluir(id: string) { this.estado.set(id, 'concluido'); }
  async devolver(id: string) { this.estado.delete(id); }
}

const EVENTO = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } };

describe('webhook de pagamento', () => {
  let repo: RepoMemoria;
  let efeitos: number;
  let tratadores: Record<string, Tratador>;
  beforeEach(() => {
    repo = new RepoMemoria();
    efeitos = 0;
    tratadores = { 'checkout.session.completed': async () => { efeitos++; } };
  });
  const rodar = (r: { corpo: string; cabecalho: string }) =>
    processarWebhook({ ...r, segredo: SEGREDO, repo, tratadores, agoraMs: AGORA });

  it('processa uma vez e ignora a reentrega do mesmo evento', async () => {
    expect((await rodar(requisicao(EVENTO))).status).toBe(200);
    const segunda = await rodar(requisicao(EVENTO));
    expect(segunda).toEqual({ status: 200, corpo: { recebido: true, resultado: 'duplicado' } });
    expect(efeitos).toBe(1);
  });

  it('assinatura errada ou velha demais → 400, sem efeito', async () => {
    expect((await rodar(requisicao(EVENTO, 'whsec_outro'))).status).toBe(400);
    expect((await rodar(requisicao(EVENTO, SEGREDO, AGORA / 1000 - 3600))).status).toBe(400);
    expect(efeitos).toBe(0);
  });

  it('aceita qualquer v1 válida (rotação de segredo)', async () => {
    const { corpo } = requisicao(EVENTO);
    const t = AGORA / 1000;
    const cabecalho = `t=${t},v1=${assinar(corpo, 'whsec_antigo', t)},v1=${assinar(corpo, SEGREDO, t)}`;
    expect((await processarWebhook({ corpo, cabecalho, segredo: SEGREDO, repo, tratadores, agoraMs: AGORA })).status).toBe(200);
  });

  it('falha transitória → 500 e reserva devolvida; a reentrega processa', async () => {
    let falhar = true;
    tratadores['checkout.session.completed'] = async () => { if (falhar) throw new Error('banco fora'); efeitos++; };
    expect((await rodar(requisicao(EVENTO))).status).toBe(500);
    expect(repo.estado.has('evt_1')).toBe(false);
    falhar = false;
    expect((await rodar(requisicao(EVENTO))).status).toBe(200);
    expect(efeitos).toBe(1);
  });

  it('dado inválido → 200 e concluído (500 permanente desativaria o endpoint)', async () => {
    tratadores['checkout.session.completed'] = async () => { throw new DadoInvalido('pedido inexistente'); };
    expect((await rodar(requisicao(EVENTO))).corpo.resultado).toBe('invalido');
    expect(repo.estado.get('evt_1')).toBe('concluido');
  });

  it('em andamento em outra instância → 409', async () => {
    repo.forcar = 'em-andamento';
    expect((await rodar(requisicao(EVENTO))).status).toBe(409);
    expect(efeitos).toBe(0);
  });

  it('reserva parada recuperada → processa', async () => {
    repo.forcar = 'recuperado';
    expect((await rodar(requisicao(EVENTO))).status).toBe(200);
    expect(efeitos).toBe(1);
  });

  it('falha ao reservar → 500', async () => {
    repo.reservar = async () => { throw new Error('banco fora'); };
    expect((await rodar(requisicao(EVENTO))).status).toBe(500);
  });

  it('tipo sem tratador → 200 ignorado, sem reservar', async () => {
    const r = await rodar(requisicao({ ...EVENTO, type: 'customer.created' }));
    expect(r.corpo.resultado).toBe('ignorado');
    expect(repo.estado.size).toBe(0);
  });

  it('sem segredo configurado → 500', async () => {
    const r = await processarWebhook({ ...requisicao(EVENTO), segredo: undefined, repo, tratadores, agoraMs: AGORA });
    expect(r.status).toBe(500);
  });
});

describe('chave do checkout', () => {
  it('é estável para o mesmo pedido e corpo, e muda com qualquer um dos dois', () => {
    const a = chaveDoCheckout('p1', { preco: 'price_1', modo: 'payment' });
    expect(chaveDoCheckout('p1', { modo: 'payment', preco: 'price_1' })).toBe(a);
    expect(chaveDoCheckout('p2', { preco: 'price_1', modo: 'payment' })).not.toBe(a);
    expect(chaveDoCheckout('p1', { preco: 'price_2', modo: 'payment' })).not.toBe(a);
  });

  it('não depende do relógio', () => {
    const a = chaveDoCheckout('p1', { preco: 'x' });
    vi.setSystemTime(new Date('2030-01-01'));
    expect(chaveDoCheckout('p1', { preco: 'x' })).toBe(a);
    vi.useRealTimers();
  });
});
