import { describe, expect, it } from 'vitest';
import { PEDIDOS_PAINEL_EXEMPLO } from './exemplos';
import {
  contarPorStatus, exigeRastreio, filtrarPedidos, ordenarPedidos, proximoStatus, textoHa, validarRastreio,
} from './pedidos';

describe('transições logísticas da dona', () => {
  it('só pago → separado → enviado → entregue; entregue e estornado não avançam', () => {
    expect(proximoStatus('pago')).toBe('separado');
    expect(proximoStatus('separado')).toBe('enviado');
    expect(proximoStatus('enviado')).toBe('entregue');
    expect(proximoStatus('entregue')).toBeNull();
    expect(proximoStatus('estornado')).toBeNull();
  });

  it('o código de rastreio só é exigido nos Correios, ao marcar como enviado', () => {
    expect(exigeRastreio({ modo: 'correios', status: 'separado' })).toBe(true);
    expect(exigeRastreio({ modo: 'correios', status: 'pago' })).toBe(false);
    expect(exigeRastreio({ modo: 'motoboy', status: 'separado' })).toBe(false);
    expect(exigeRastreio({ modo: 'retirada', status: 'separado' })).toBe(false);
  });
});

describe('lista de pedidos', () => {
  it('pagos primeiro; no mesmo status, o que espera há mais tempo vem antes', () => {
    const r = ordenarPedidos(PEDIDOS_PAINEL_EXEMPLO);
    expect(r.slice(0, 3).map((p) => p.numero)).toEqual(['1042', '1043', '1045']);
    expect(r.map((p) => p.status)).toEqual(['pago', 'pago', 'pago', 'separado', 'enviado', 'entregue']);
  });

  it('filtra por status e conta por status', () => {
    expect(filtrarPedidos(PEDIDOS_PAINEL_EXEMPLO, 'enviado').map((p) => p.numero)).toEqual(['1038']);
    expect(filtrarPedidos(PEDIDOS_PAINEL_EXEMPLO, 'todos')).toHaveLength(PEDIDOS_PAINEL_EXEMPLO.length);
    expect(contarPorStatus(PEDIDOS_PAINEL_EXEMPLO, 'pago')).toBe(3);
  });

  it('não altera a lista recebida', () => {
    const copia = [...PEDIDOS_PAINEL_EXEMPLO];
    ordenarPedidos(PEDIDOS_PAINEL_EXEMPLO);
    expect([...PEDIDOS_PAINEL_EXEMPLO]).toEqual(copia);
  });
});

describe('rastreio dos Correios', () => {
  it('aceita 2 letras, 9 números e BR, com espaço e minúscula na entrada', () => {
    expect(validarRastreio('AA123456789BR')).toEqual({ ok: true, codigo: 'AA123456789BR' });
    expect(validarRastreio(' aa 123456789 br ')).toEqual({ ok: true, codigo: 'AA123456789BR' });
  });

  it('recusa o resto com a mensagem do wireframe aprovado', () => {
    for (const ruim of ['AA1234', '', 'AA123456789US', '12AB3456789BR']) {
      expect(validarRastreio(ruim)).toEqual({ ok: false, erro: 'O código tem 2 letras, 9 números e BR. Exemplo: AA123456789BR.' });
    }
  });
});

describe('texto de tempo', () => {
  it('minutos, horas e dias', () => {
    expect(textoHa(15)).toBe('pago há 15 min');
    expect(textoHa(120)).toBe('pago há 2 h');
    expect(textoHa(24 * 60)).toBe('pago há 1 dia');
    expect(textoHa(3 * 24 * 60)).toBe('pago há 3 dias');
  });
});

describe('dados de exemplo', () => {
  it('são fictícios: nome abreviado, sem CPF, telefone ou endereço', () => {
    const texto = JSON.stringify(PEDIDOS_PAINEL_EXEMPLO);
    expect(texto).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/); // CPF
    expect(texto).not.toMatch(/\(\d{2}\)\s?\d{4,5}-?\d{4}/); // telefone
    expect(texto).not.toMatch(/\bRua\b|\bAv\.|\bAvenida\b/); // endereço
    for (const p of PEDIDOS_PAINEL_EXEMPLO) expect(p.cliente).toMatch(/^\p{L}+ E\.$/u);
  });
});
