// Tela 6 — Entrega (#27), em 360 px, sobre o Supabase FALSO: o catálogo, o frete e a guarda de papel
// reais rodam por cima; a função criar_pedido falsa responde pelo id da variação (ver
// e2e/apoio/supabase-falso.mjs). A reserva de verdade (T12, T13) é provada na bancada SQL.
import { expect, test } from '@playwright/test';
import { axe, semearCarrinho, semSobraNemAlvoPequeno, visivelSemRolar } from './apoio/comum';
import { entrarComo } from './apoio/sessao';

test.use({ viewport: { width: 360, height: 740 } });

const OLEO = { slug: 'oleo-corporal', nome: 'Óleo corporal', tamanho: '100 ml' };
const LAVANDA = { ...OLEO, variacaoId: 'a0000000-0000-4000-8000-000000000001', aroma: 'lavanda', precoCentavos: 5200, quantidade: 2 };
const ESGOTA_NA_RESERVA = { ...OLEO, variacaoId: 'a0000000-0000-4000-8000-000000000002', aroma: 'alecrim', precoCentavos: 5200, quantidade: 1 };
const BANCO_SEM_FUNCAO = { ...OLEO, variacaoId: 'a0000000-0000-4000-8000-000000000003', aroma: 'sem fragrância', precoCentavos: 5000, quantidade: 1 };

test('sem sessão: a entrega vai para /entrar e volta para /checkout depois de entrar', async ({ page }) => {
  await semearCarrinho(page, [LAVANDA], '20040-002');
  await page.goto('/checkout');
  await expect(page).toHaveURL(/\/entrar\?volta=%2Fcheckout$/);
  // Entra pelo formulário (o falso aceita esta senha) e chega à entrega, com o CEP do carrinho.
  await page.getByLabel('E-mail').fill('cliente@exemplo.test');
  await page.getByLabel('Senha').fill('senha-do-cliente');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Entrega' })).toBeVisible();
  await expect(page.getByLabel('CEP para o frete')).toHaveValue('20040-002');
});

test.describe('com sessão', () => {
  test.beforeEach(async ({ context }) => entrarComo(context, 'cliente'));

  test('Correios: CEP do carrinho preenchido, endereço e quem recebe; axe, sobra e alvos a 140%', async ({ page }) => {
    await semearCarrinho(page, [LAVANDA], '20040-002');
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { level: 1, name: 'Entrega' })).toBeVisible();
    await expect(page.getByLabel('CEP para o frete')).toHaveValue('20040-002');
    await expect(page.getByRole('radio', { name: /Correios/ })).toBeChecked();
    await expect(page.getByLabel('Endereço')).toBeVisible();
    await expect(page.getByLabel('Quem recebe')).toBeVisible();
    await expect(page.getByLabel('WhatsApp para contato')).toBeVisible();
    // 2 × R$ 52,00 + Correios R$ 30,00
    await expect(page.getByTestId('barra-total')).toContainText(/R\$\s134,00/);
    expect(await axe(page)).toEqual([]);
    await semSobraNemAlvoPequeno(page);
  });

  test('retirada: sem endereço (o do ateliê nunca aparece), só o WhatsApp para combinar', async ({ page }) => {
    await semearCarrinho(page, [LAVANDA], '01310-100');
    await page.goto('/checkout');
    await expect(page.getByRole('radio', { name: /Retirada/ })).toBeChecked();
    await expect(page.getByLabel('WhatsApp para combinar')).toBeVisible();
    await expect(page.getByLabel('Endereço')).toHaveCount(0);
    await expect(page.getByText(/passamos o endereço por lá/)).toBeVisible();
    await page.getByRole('radio', { name: /Motoboy/ }).check();
    await expect(page.getByLabel('Endereço')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await semSobraNemAlvoPequeno(page);
  });

  test('"Reservar os itens" fica visível sem rolar a 140%', async ({ page }) => {
    await semearCarrinho(page, [LAVANDA], '20040-002');
    await page.goto('/checkout');
    await expect(page.getByRole('radio', { name: /Correios/ })).toBeChecked();
    await visivelSemRolar(page, page.getByRole('button', { name: 'Reservar os itens' }));
  });

  test('cria o pedido: reserva os itens, mostra o número e o prazo, e diz que nada foi cobrado', async ({ page }) => {
    await semearCarrinho(page, [LAVANDA], '20040-002');
    await page.goto('/checkout');
    await page.getByLabel('Endereço').fill('Rua de Exemplo, 10, ap. 2');
    await page.getByLabel('Quem recebe').fill('Ana Exemplo');
    await page.getByLabel('WhatsApp para contato').fill('(21) 90000-0000');
    await page.getByRole('button', { name: 'Reservar os itens' }).click();
    await expect(page.getByRole('heading', { name: 'Pedido reservado' })).toBeVisible();
    await expect(page.getByText(/Pedido nº B0000000 · R\$\s134,00/)).toBeVisible();
    await expect(page.getByText(/Separamos os seus itens até as \d{2}:\d{2}\. Nada foi cobrado/)).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test('a sessão terminou antes de reservar: o aviso leva a /entrar e volta para /checkout', async ({ page, context }) => {
    await semearCarrinho(page, [LAVANDA], '01310-100');
    await page.goto('/checkout');
    await page.getByLabel('WhatsApp para combinar').fill('(11) 90000-0000');
    await context.clearCookies();
    await page.getByRole('button', { name: 'Reservar os itens' }).click();
    const aviso = page.getByRole('alert').filter({ hasText: 'Sua sessão terminou' });
    await expect(aviso).toBeVisible();
    await expect(aviso.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar?volta=%2Fcheckout');
  });

  test('WhatsApp e endereço em branco: o servidor recusa e cada campo diz o que fazer', async ({ page }) => {
    await semearCarrinho(page, [LAVANDA], '20040-002');
    await page.goto('/checkout');
    await page.getByLabel('WhatsApp para contato').fill('123');
    await page.getByRole('button', { name: 'Reservar os itens' }).click();
    await expect(page.getByText('Digite o WhatsApp com DDD. Exemplo: (11) 90000-0000.')).toBeVisible();
    await expect(page.getByText('Digite rua, número e complemento.')).toBeVisible();
    await expect(page.getByLabel('WhatsApp para contato')).toHaveValue('123');
    expect(await axe(page)).toEqual([]);
  });

  test('esgotou na hora da reserva (outro comprador levou): volta ao carrinho', async ({ page }) => {
    await semearCarrinho(page, [ESGOTA_NA_RESERVA], '01310-100');
    await page.goto('/checkout');
    await expect(page.getByRole('radio', { name: /Retirada/ })).toBeChecked();
    await page.getByLabel('WhatsApp para combinar').fill('(11) 90000-0000');
    await page.getByRole('button', { name: 'Reservar os itens' }).click();
    await expect(page).toHaveURL(/\/carrinho$/);
  });

  test('preço mudou desde o carrinho: avisa antes de pedir os dados e leva de volta (A-03)', async ({ page }) => {
    await semearCarrinho(page, [{ ...LAVANDA, precoCentavos: 5000 }], '20040-002');
    await page.goto('/checkout');
    await expect(page.getByText('Um item mudou desde que você o adicionou')).toBeVisible();
    await expect(page.getByLabel('WhatsApp para contato')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Voltar ao carrinho' })).toHaveAttribute('href', '/carrinho');
    expect(await axe(page)).toEqual([]);
  });

  test('schema antigo (a função ainda não existe): erro honesto, nada cobrado, sem 500', async ({ page }) => {
    await semearCarrinho(page, [BANCO_SEM_FUNCAO], '01310-100');
    await page.goto('/checkout');
    await page.getByLabel('WhatsApp para combinar').fill('(11) 90000-0000');
    await page.getByRole('button', { name: 'Reservar os itens' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Não deu para criar o pedido' })).toContainText('Nada foi cobrado');
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled();
  });

  test('carrinho vazio: diz que está vazio e leva aos produtos', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver produtos' })).toHaveAttribute('href', '/');
  });
});
