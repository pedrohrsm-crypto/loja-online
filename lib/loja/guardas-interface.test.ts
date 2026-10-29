// Guardas da interface da alta fidelidade (04, categoria 7): nascem dos erros que o catálogo de erros
// do framework prevê para telas de 360 px. Cada uma reprova também a variante nova da mesma classe.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(__dirname, '..', '..');

function arquivos(pastas: string[], extensao: RegExp): Array<{ arquivo: string; texto: string }> {
  const saida: Array<{ arquivo: string; texto: string }> = [];
  const andar = (p: string) => {
    const st = statSync(p);
    if (st.isDirectory()) readdirSync(p).forEach((f) => andar(join(p, f)));
    else if (extensao.test(p) && !/\.test\.tsx?$/.test(p)) saida.push({ arquivo: relative(RAIZ, p), texto: readFileSync(p, 'utf8') });
  };
  pastas.forEach((p) => andar(join(RAIZ, p)));
  return saida;
}

const TSX = arquivos(['app', 'components'], /\.tsx$/);
const FONTES = arquivos(['app', 'components', 'lib'], /\.tsx?$/);

// Abertura de `<button ...>` até o `>` que a fecha, sem confundir com o `=>` de uma arrow function.
export function aberturasDeBotao(texto: string): string[] {
  const achados: string[] = [];
  for (const m of texto.matchAll(/<button\b/g)) {
    let profundidade = 0;
    let i = m.index ?? 0;
    for (; i < texto.length; i++) {
      const c = texto[i];
      if (c === '{') profundidade++;
      else if (c === '}') profundidade--;
      else if (c === '>' && profundidade === 0 && texto[i - 1] !== '=') break;
    }
    achados.push(texto.slice(m.index, i + 1));
  }
  return achados;
}

describe('guardas da interface', () => {
  it('todo <button> tem type (sem type, dentro de formulário vira submit)', () => {
    const sem = TSX.flatMap((f) => aberturasDeBotao(f.texto).filter((a) => !/\btype=/.test(a)).map((a) => `${f.arquivo}: ${a.slice(0, 60)}`));
    expect(sem).toEqual([]);
  });

  it('o leitor de botões enxerga o <button> com arrow function e sem type', () => {
    expect(aberturasDeBotao('<button onClick={() => x()} className="a">ok</button>')).toHaveLength(1);
    expect(aberturasDeBotao('<button type="button" onClick={() => x()}>ok</button>').every((a) => /type=/.test(a))).toBe(true);
    expect(aberturasDeBotao('<button onClick={() => x()}>ok</button>').some((a) => !/type=/.test(a))).toBe(true);
  });

  it('formata a entrada no blur, nunca no onChange (o cursor pula e a tecla some)', () => {
    const achados = TSX.flatMap((f) =>
      f.texto.split('\n').map((l, i) => ({ f: f.arquivo, i, l })).filter(({ l }) => /onChange=/.test(l) && /formatar|normalizar/.test(l)).map(({ f, i }) => `${f}:${i + 1}`),
    );
    expect(achados).toEqual([]);
  });

  it('o número do WhatsApp mora numa constante só (lib/loja/whatsapp.ts)', () => {
    const achados = FONTES.filter((f) => f.arquivo !== 'lib/loja/whatsapp.ts' && /wa\.me\/|5500900000000/.test(f.texto)).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });

  it('as telas novas não chamam o Mercado Pago nem o código de pagamento herdado', () => {
    const achados = FONTES.filter(
      (f) => /^(components\/(loja|cabecalho|navegacao)|lib\/loja|app\/(produto|carrinho|checkout|admin\/pedidos))/.test(f.arquivo) && /lib\/pagamentos|mercadopago|api\.mercadopago/i.test(f.texto),
    ).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });

  it('os dados de exemplo moram num módulo só (lib/loja/exemplos.ts)', () => {
    const achados = FONTES.filter((f) => f.arquivo !== 'lib/loja/exemplos.ts' && /EXEMPLO-NAO-E-UM-PIX|Ana E\./.test(f.texto)).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });
});
