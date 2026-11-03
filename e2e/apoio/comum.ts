// Passos compartilhados pelos specs da loja: axe, sobra e alvos a 140%, ação visível sem rolar,
// sessão do Supabase falso e carrinho semeado no localStorage. Vieram de alta-fidelidade.spec.ts
// quando o checkout (#27) passou a precisar dos mesmos passos: um lugar só.
import { expect, type BrowserContext, type Page } from '@playwright/test';
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

// Sessão do Supabase falso: o cookie que o @supabase/ssr lê, com o token que o falso reconhece.
export async function entrarComo(context: BrowserContext, papel: 'admin' | 'cliente') {
  const sessao = {
    access_token: `token-${papel}`, refresh_token: 'renovacao', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
    user: { id: papel === 'admin' ? '00000000-0000-4000-8000-0000000000a1' : '00000000-0000-4000-8000-0000000000c1', aud: 'authenticated', role: 'authenticated', email: `${papel}@exemplo.test` },
  };
  const valor = 'base64-' + Buffer.from(JSON.stringify(sessao)).toString('base64url');
  // O nome do cookie vem do começo do domínio da URL do Supabase (convenção do @supabase/ssr).
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://exemplo.supabase.co').hostname.split('.')[0];
  await context.addCookies([{ name: `sb-${ref}-auth-token`, value: valor, domain: '127.0.0.1', path: '/' }]);
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
