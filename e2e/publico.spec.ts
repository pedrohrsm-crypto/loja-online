// Barra de qualidade nas telas públicas (docs/freelance/ACEITE.md §3): axe sem violação,
// nada cortado a 360 px com 140% de fonte, teclado com foco visível, e a área protegida
// manda para /entrar sem sessão.
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PUBLICAS = ['/', '/entrar', '/entrar?modo=cadastro', '/privacidade'];

for (const rota of PUBLICAS) {
  test(`axe sem violação em ${rota}`, async ({ page }) => {
    await page.goto(rota);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  test(`sem rolagem horizontal a 140% de fonte em ${rota}`, async ({ page }) => {
    await page.goto(rota);
    await page.addStyleTag({ content: 'html { font-size: 140% !important; }' });
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra).toBeLessThanOrEqual(0);
  });
}

test('o primeiro Tab leva ao "Pular para o conteúdo", visível', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const link = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await expect(link).toBeFocused();
  await expect(link).toBeInViewport();
});

test('área protegida sem sessão vai para /entrar', async ({ page }) => {
  await page.goto('/conta');
  await expect(page).toHaveURL(/\/entrar$/);
});

test('webhook sem assinatura é recusado', async ({ request }) => {
  const r = await request.post('/api/pagamentos/webhook', { data: '{}' });
  expect([400, 500]).toContain(r.status());
});

test('reconciliação sem segredo é recusada', async ({ request }) => {
  const r = await request.get('/api/cron/reconciliar');
  expect(r.status()).toBe(401);
});

test('cabeçalhos de segurança presentes', async ({ request }) => {
  const r = await request.get('/');
  expect(r.headers()['x-content-type-options']).toBe('nosniff');
  expect(r.headers()['x-frame-options']).toBe('DENY');
  expect(r.headers()['x-powered-by']).toBeUndefined();
});

test('formulário de entrada anuncia o erro e preserva o e-mail digitado', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('nao-e-email');
  await page.getByLabel('Senha').fill('12345678');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('form').getByRole('alert')).toHaveText('Informe um e-mail válido.');
  await expect(page.getByLabel('E-mail')).toHaveValue('nao-e-email');
});
