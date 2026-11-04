import { describe, expect, it } from 'vitest';
import { LIMITE_VOLTA, comVolta, destinoDepoisDoLogin, destinoSeguro } from './destino';
import { CASA_DO_PAPEL } from './papeis';

describe('destinoSeguro (regra 6; S-07)', () => {
  it('aceita caminho relativo do próprio site, com busca e âncora', () => {
    for (const ok of ['/', '/conta', '/admin/pedidos', '/carrinho?cep=01001000', '/produto/sabonete-artesanal#ingredientes', '/busca?q=%2F%2Fmal.com']) {
      expect(destinoSeguro(ok), ok).toBe(ok);
    }
  });

  it('recusa //, /\\ e a barra invertida em qualquer posição', () => {
    for (const mal of ['//mal.com', '//mal.com/conta', '/\\mal.com', '\\\\mal.com', '\\/mal.com', '/conta\\..\\..\\mal.com']) {
      expect(destinoSeguro(mal), mal).toBeNull();
    }
  });

  it('recusa esquema: https:, javascript:, data: e o relativo sem barra', () => {
    for (const mal of ['https://mal.com', 'http:/mal.com', 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,oi', 'mal.com', 'conta']) {
      expect(destinoSeguro(mal), mal).toBeNull();
    }
  });

  it('recusa caractere de controle e espaço (o navegador tira TAB e quebra de linha: /\\t/mal.com vira //mal.com)', () => {
    for (const mal of ['/\t/mal.com', '/\n/mal.com', '/\r/mal.com', '\t//mal.com', ' /conta', '/conta\u0000', '/\u007f', '/\u0085/mal.com', '/a b']) {
      expect(destinoSeguro(mal), JSON.stringify(mal)).toBeNull();
    }
  });

  it('recusa o que só vira outro domínio depois de resolver os pontos', () => {
    for (const mal of ['/..//mal.com', '/.//mal.com', '/a/..//mal.com']) {
      expect(destinoSeguro(mal), mal).toBeNull();
    }
  });

  it('recusa vazio, o que não é texto e volta longa demais', () => {
    for (const mal of ['', null, undefined, 42, ['/conta'], { href: '/conta' }]) {
      expect(destinoSeguro(mal), String(mal)).toBeNull();
    }
    expect(destinoSeguro(`/${'a'.repeat(LIMITE_VOLTA)}`)).toBeNull();
    expect(destinoSeguro(`/${'a'.repeat(LIMITE_VOLTA - 1)}`)).not.toBeNull();
  });
});

describe('destino depois de entrar (#24)', () => {
  it('a rota de origem validada vence a casa do papel', () => {
    expect(destinoDepoisDoLogin({ volta: '/carrinho', papel: 'cliente' })).toBe('/carrinho');
    expect(destinoDepoisDoLogin({ volta: '/admin/pedidos', papel: 'admin' })).toBe('/admin/pedidos');
  });

  it('sem volta, ou com volta recusada, vai para a casa do papel lido no banco (admin → Pedidos)', () => {
    expect(destinoDepoisDoLogin({ volta: undefined, papel: 'admin' })).toBe('/admin/pedidos');
    expect(destinoDepoisDoLogin({ volta: '//mal.com', papel: 'admin' })).toBe(CASA_DO_PAPEL.admin);
    expect(destinoDepoisDoLogin({ volta: 'https://mal.com', papel: 'cliente' })).toBe('/conta');
  });

  it('as telas de /entrar não são destino (voltar a elas mostraria o login de novo)', () => {
    expect(destinoDepoisDoLogin({ volta: '/entrar', papel: 'cliente' })).toBe('/conta');
    expect(destinoDepoisDoLogin({ volta: '/entrar/autenticador?volta=%2Fadmin', papel: 'admin' })).toBe('/admin/pedidos');
    expect(destinoDepoisDoLogin({ volta: '/entrarxyz', papel: 'cliente' })).toBe('/entrarxyz');
  });

  it('papel ilegível e sem volta: null, para quem chama explicar em vez de chutar uma casa (04, 2.2)', () => {
    expect(destinoDepoisDoLogin({ volta: undefined, papel: undefined })).toBeNull();
    expect(destinoDepoisDoLogin({ volta: '', papel: 'hacker' })).toBeNull();
  });
});

describe('comVolta', () => {
  it('leva a rota de origem codificada, só se for segura e não for de /entrar', () => {
    expect(comVolta('/entrar', '/admin/pedidos?status=pago')).toBe('/entrar?volta=%2Fadmin%2Fpedidos%3Fstatus%3Dpago');
    expect(comVolta('/entrar', '//mal.com')).toBe('/entrar');
    expect(comVolta('/entrar', null)).toBe('/entrar');
    expect(comVolta('/entrar', '/entrar/autenticador')).toBe('/entrar');
  });
});
