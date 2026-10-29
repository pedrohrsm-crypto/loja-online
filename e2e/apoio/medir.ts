// Medições de interface compartilhadas pelos specs: transbordo horizontal e alvos pequenos.
import type { Locator, Page } from '@playwright/test';

export const ESCALA_140 = 'html { font-size: 140% !important; }';
export const ALVO_MINIMO = 44;

export async function ampliar(page: Page): Promise<void> {
  await page.addStyleTag({ content: ESCALA_140 });
}

// Quanto o documento passa da largura da janela (0 = sem rolagem horizontal).
export async function transbordo(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

// Alvos de toque com menos de 44 px em alguma dimensão. O campo de rádio escondido (sr-only) é
// medido pelo rótulo que o envolve; o link "Pular para o conteúdo" mede-se quando recebe foco.
export async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate((minimo) => {
    const seletor = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"]';
    const saida: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(seletor)) {
      if (el.classList.contains('sr-only') && el instanceof HTMLInputElement) {
        // rádio escondido: vale o rótulo
        const rotulo = el.closest('label');
        if (!rotulo) continue;
        const r = rotulo.getBoundingClientRect();
        if (r.width < minimo || r.height < minimo) saida.push(`rótulo de ${el.name}: ${Math.round(r.width)}x${Math.round(r.height)}`);
        continue;
      }
      const estilo = getComputedStyle(el);
      if (estilo.visibility === 'hidden' || estilo.display === 'none') continue;
      // Link dentro de um parágrafo é exceção do WCAG 2.5.8 (alvo em linha de texto).
      if (estilo.display === 'inline') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (el.classList.contains('pular-para-conteudo')) continue;
      // Radios e caixas de seleção visíveis ficam dentro de um rótulo de 44 px: vale o rótulo.
      const alvo = el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox') ? (el.closest('label') ?? el) : el;
      const m = alvo.getBoundingClientRect();
      if (m.width < minimo - 0.5 || m.height < minimo - 0.5) {
        saida.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 30)}": ${Math.round(m.width)}x${Math.round(m.height)}`);
      }
    }
    return saida;
  }, ALVO_MINIMO);
}

// A ação principal está inteira na tela E não coberta pela barra fixa de navegação ou de compra:
// o canto de baixo e o de cima do alvo respondem ao toque pelo próprio alvo.
export async function inteiroEDescoberto(alvo: Locator): Promise<boolean> {
  return alvo.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth) return false;
    const pontos: Array<[number, number]> = [
      [r.left + r.width / 2, r.top + 2],
      [r.left + r.width / 2, r.bottom - 2],
      [r.left + 4, r.top + r.height / 2],
      [r.right - 4, r.top + r.height / 2],
    ];
    return pontos.every(([x, y]) => {
      const topo = document.elementFromPoint(x, y);
      return topo !== null && (el === topo || el.contains(topo));
    });
  });
}
