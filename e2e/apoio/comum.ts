// Passos compartilhados pelos specs da loja: axe, sobra e alvos a 140%, ação visível sem rolar e
// carrinho semeado no localStorage. Vieram de alta-fidelidade.spec.ts quando o checkout (#27) passou a
// precisar dos mesmos passos: um lugar só. A sessão mora em e2e/apoio/sessao.ts (#30).
import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { alvosPequenos, ampliar, inteiroEDescoberto, transbordo } from './medir';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export async function axe(page: Page) {
  // No fim da página: as barras fixas ficam na posição natural e não cobrem o rodapé (o axe conta alvo coberto como pequeno).
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ") + " " + (n.any[0]?.message ?? "")).join(" | ")}`);
}

export async function semSobraNemAlvoPequeno(page: Page) {
  await ampliar(page);
  expect(await transbordo(page), 'rolagem horizontal a 140%').toBeLessThanOrEqual(0);
  expect(await alvosPequenos(page), 'alvos com menos de 44 px').toEqual([]);
}

export async function visivelSemRolar(page: Page, alvo: ReturnType<Page['getByRole']>) {
  await ampliar(page);
  await expect(alvo).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await inteiroEDescoberto(alvo), 'o alvo está coberto por uma barra fixa').toBe(true);
}

export async function semearCarrinho(page: Page, itens: unknown[], cep?: string) {
  await page.addInitScript(
    ([texto, c]) => {
      window.localStorage.setItem('alecrim:carrinho:v1', texto);
      if (c) window.localStorage.setItem('alecrim:cep:v1', c);
    },
    [JSON.stringify(itens), cep ?? ''] as const,
  );
}
