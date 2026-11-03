// Tela 9 (frente entrar-codigo, #28 e #24): destino depois de entrar, código de 6 dígitos na mesma
// tela do cadastro e segundo fator TOTP da dona. O Auth é o Supabase FALSO (e2e/apoio/supabase-falso.mjs),
// que responde aal1 e aal2 pelo JWT; o código certo é sempre 123456. Tudo em 360 px.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { alvosPequenos, ampliar, transbordo } from './apoio/medir';
import { entrarComo } from './apoio/sessao';

test.use({ viewport: { width: 360, height: 740 } });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const CODIGO = 'Código de 6 números';

async function axe(page: Page) {
  // No fim da página: a barra fixa de navegação fica na posição natural e não cobre o campo.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

async function entrarComSenha(page: Page, email: string, senha: string) {
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

// Os 6 números inteiros, sem corte, a 140% de fonte (M-UX da tela 9).
async function codigoInteiro(page: Page) {
  const campo = page.getByLabel(CODIGO);
  await campo.fill('123456');
  await ampliar(page);
  await expect(campo).toBeInViewport({ ratio: 1 });
  const corte = await campo.evaluate((el) => (el as HTMLInputElement).scrollWidth - (el as HTMLInputElement).clientWidth);
  expect(corte, 'o código passa da largura do campo').toBeLessThanOrEqual(0);
  expect(await transbordo(page), 'rolagem horizontal a 140%').toBeLessThanOrEqual(0);
  expect(await alvosPequenos(page), 'alvos com menos de 44 px').toEqual([]);
}

test.describe('destino depois de entrar (#24)', () => {
  test('admin entra e cai em Pedidos, passando pelo autenticador', async ({ page }) => {
    await page.goto('/admin/pedidos');
    await expect(page).toHaveURL(/\/entrar\?volta=%2Fadmin%2Fpedidos$/);
    await entrarComSenha(page, 'admin@exemplo.test', 'senha-da-dona');
    await expect(page).toHaveURL(/\/entrar\/autenticador\?volta=%2Fadmin%2Fpedidos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Código do autenticador' })).toBeVisible();
    await page.getByLabel(CODIGO).fill('123456');
    await page.getByRole('button', { name: 'Entrar no painel' }).click();
    await expect(page).toHaveURL(/\/admin\/pedidos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeVisible();
  });

  test('admin sem rota de origem também cai em Pedidos (casa do papel lido no banco)', async ({ page }) => {
    await page.goto('/entrar');
    await entrarComSenha(page, 'admin@exemplo.test', 'senha-da-dona');
    await expect(page).toHaveURL(/\/entrar\/autenticador\?volta=%2Fadmin%2Fpedidos$/);
    await page.getByLabel(CODIGO).fill('123456');
    await page.getByRole('button', { name: 'Entrar no painel' }).click();
    await expect(page).toHaveURL(/\/admin\/pedidos$/);
  });

  test('comprador volta para a rota de origem, com o carrinho intacto (A-06)', async ({ page }) => {
    const item = { variacaoId: 'v-ale-90', slug: 'sabonete-artesanal', nome: 'Sabonete artesanal', aroma: 'alecrim', tamanho: '90 g', precoCentavos: 2200, quantidade: 2 };
    await page.addInitScript((texto) => {
      if (!window.localStorage.getItem('alecrim:carrinho:v1')) window.localStorage.setItem('alecrim:carrinho:v1', texto);
    }, JSON.stringify([item]));
    await page.goto('/entrar?volta=%2Fcarrinho');
    await entrarComSenha(page, 'cliente@exemplo.test', 'senha-do-cliente');
    await expect(page).toHaveURL(/\/carrinho$/);
    await expect(page.getByTestId('barra-total')).toContainText(/R\$\s44,00/);
  });

  test('comprador sem rota de origem vai para /conta', async ({ page }) => {
    await page.goto('/entrar');
    await entrarComSenha(page, 'cliente@exemplo.test', 'senha-do-cliente');
    await expect(page).toHaveURL(/\/conta$/);
  });

  for (const mal of ['//mal.com', '/\\mal.com', 'https://mal.com', 'javascript:alert(1)']) {
    test(`volta=${mal} é ignorado`, async ({ page }) => {
      await page.goto(`/entrar?volta=${encodeURIComponent(mal)}`);
      await expect(page.locator('input[name="volta"]')).toHaveCount(0);
      await entrarComSenha(page, 'cliente@exemplo.test', 'senha-do-cliente');
      await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/conta$/);
    });
  }

  test('a volta forjada no formulário também é ignorada (a Server Action confere de novo)', async ({ page }) => {
    await page.goto('/entrar');
    await page.locator('form').evaluate((f) => {
      const i = document.createElement('input');
      i.type = 'hidden';
      i.name = 'volta';
      i.value = '//mal.com';
      f.appendChild(i);
    });
    await entrarComSenha(page, 'cliente@exemplo.test', 'senha-do-cliente');
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/conta$/);
  });

  test('senha errada: mensagem que diz o que fazer, e-mail preservado', async ({ page }) => {
    await page.goto('/entrar');
    await entrarComSenha(page, 'cliente@exemplo.test', 'senha-errada');
    await expect(page.getByRole('main').getByRole('alert')).toContainText('E-mail ou senha incorretos');
    await expect(page.getByLabel('E-mail')).toHaveValue('cliente@exemplo.test');
  });
});

test.describe('segundo fator da dona (aal2)', () => {
  test('admin sem aal2 não vê Pedidos: vai para o desafio, nunca para /conta', async ({ page, context, request }) => {
    await entrarComo(context, 'admin', 'aal1');
    await page.goto('/admin/pedidos');
    await expect(page).toHaveURL(/\/entrar\/autenticador\?volta=%2Fadmin%2Fpedidos$/);
    await expect(page.locator('body')).not.toContainText('Ana E.');
    // Também sem seguir o redirecionamento: nem o HTML nem o payload levam os pedidos.
    const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
    for (const caminho of ['/admin/pedidos', '/admin']) {
      const r = await request.get(caminho, { headers: { cookie }, maxRedirects: 0 });
      expect(r.status(), caminho).toBeGreaterThanOrEqual(300);
      expect(r.status(), caminho).toBeLessThan(400);
      expect(r.headers().location, caminho).toContain('/entrar/autenticador');
      expect(await r.text(), caminho).not.toContain('Ana E.');
    }
  });

  test('código errado do autenticador: avisa e lembra do relógio do celular', async ({ page, context }) => {
    await entrarComo(context, 'admin', 'aal1');
    await page.goto('/entrar/autenticador');
    await page.getByLabel(CODIGO).fill('000000');
    await page.getByRole('button', { name: 'Entrar no painel' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Código incorreto');
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Confira o horário do celular');
    await expect(page).toHaveURL(/\/entrar\/autenticador$/);
  });

  test('a dona sem autenticador ativa pelo QR e entra no painel', async ({ page }) => {
    await page.goto('/admin/pedidos');
    await entrarComSenha(page, 'dona-nova@exemplo.test', 'senha-da-dona');
    await expect(page.getByRole('heading', { level: 1, name: 'Proteja o painel' })).toBeVisible();
    await page.getByRole('button', { name: 'Mostrar o QR do autenticador' }).click();
    await expect(page.getByRole('img', { name: 'QR code do autenticador do Ateliê Alecrim' })).toBeVisible();
    await page.getByText('Não consegue ler o QR? Use a chave').click();
    await expect(page.getByText('SEGREDOFALSODOE2E')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByLabel(CODIGO).fill('123456');
    await page.getByRole('button', { name: 'Ativar e entrar' }).click();
    await expect(page).toHaveURL(/\/admin\/pedidos$/);
  });

  test('o comprador não é afetado: /conta abre com aal1 e o autenticador não é para ele', async ({ page, context }) => {
    await entrarComo(context, 'cliente');
    await page.goto('/conta');
    await expect(page.getByRole('heading', { level: 1, name: 'Minha conta' })).toBeVisible();
    await page.goto('/entrar/autenticador');
    await expect(page).toHaveURL(/\/conta$/);
  });

  test('desafio: axe, alvos de 44 px e o código inteiro a 140%', async ({ page, context }) => {
    await entrarComo(context, 'admin', 'aal1');
    await page.goto('/entrar/autenticador');
    expect(await axe(page)).toEqual([]);
    await codigoInteiro(page);
  });
});

test.describe('código de 6 dígitos no cadastro (D-LO-6)', () => {
  async function cadastrar(page: Page, email: string) {
    await page.goto('/entrar?modo=cadastro');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha (mínimo 8 caracteres)').fill('uma-senha-longa');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Confirme seu e-mail' })).toBeVisible();
  }

  test('cadastro pede o código na mesma tela; código certo entra na conta', async ({ page }) => {
    await cadastrar(page, 'novo@exemplo.test');
    await expect(page).toHaveURL(/\/entrar\?modo=cadastro$/);
    await page.getByLabel(CODIGO).fill('123 456');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page).toHaveURL(/\/conta$/);
  });

  test('o código volta para a rota de origem', async ({ page }) => {
    await page.goto('/entrar?volta=%2Fcarrinho&modo=cadastro');
    await page.getByLabel('E-mail').fill('novo@exemplo.test');
    await page.getByLabel('Senha (mínimo 8 caracteres)').fill('uma-senha-longa');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await page.getByLabel(CODIGO).fill('123456');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page).toHaveURL(/\/carrinho$/);
  });

  test('e-mail novo e e-mail que já tem conta veem a MESMA tela (anti-enumeração)', async ({ page }) => {
    await cadastrar(page, 'alguem-novo@exemplo.test');
    const novo = await page.locator('main').innerText();
    await cadastrar(page, 'cliente@exemplo.test');
    const existente = await page.locator('main').innerText();
    expect(existente).toBe(novo);
    expect(novo).toContain('Se este e-mail ainda não tem conta');
  });

  test('código errado: diz o que fazer; o reenvio espera e responde igual', async ({ page }) => {
    await cadastrar(page, 'novo@exemplo.test');
    const reenviar = page.getByRole('button', { name: /Não chegou\? Reenviar em 0:\d\d/ });
    await expect(reenviar).toBeDisabled();
    await page.getByLabel(CODIGO).fill('000000');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Código incorreto ou vencido');
    await expect(page.getByRole('main').getByRole('alert')).toContainText('peça um código novo');
  });

  test('conta sem e-mail confirmado: a senha certa leva ao código', async ({ page }) => {
    await page.goto('/entrar');
    await entrarComSenha(page, 'pendente@exemplo.test', 'senha-pendente');
    await expect(page.getByRole('heading', { level: 1, name: 'Confirme seu e-mail' })).toBeVisible();
    await expect(page.getByText('Falta confirmar o seu e-mail')).toBeVisible();
  });

  test('etapa do código: axe, alvos de 44 px e o código inteiro a 140%', async ({ page }) => {
    await cadastrar(page, 'novo@exemplo.test');
    expect(await axe(page)).toEqual([]);
    await codigoInteiro(page);
  });
});
