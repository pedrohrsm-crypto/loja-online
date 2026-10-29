// Alta fidelidade do Dia 1 (frente alta-fidelidade, #21): Produto, Carrinho, Pagamento Pix e Admin
// pedidos, sempre em 360 px (o ponto de partida do cliente), com axe, transbordo, alvos de 44 px e a
// ação principal visível sem rolar a 140% de fonte. O catálogo vem do Supabase FALSO
// (e2e/apoio/supabase-falso.mjs): o código real de lib/catalogo/ roda por cima, sem banco.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { alvosPequenos, ampliar, inteiroEDescoberto, transbordo } from './apoio/medir';

test.use({ viewport: { width: 360, height: 740 } });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PRECO_22 = /R\$\s22,00/;
const PRECO_30 = /R\$\s30,00/;

async function axe(page: Page) {
  // No fim da página: as barras fixas ficam na posição natural e não cobrem o rodapé (o axe conta alvo coberto como pequeno).
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ") + " " + (n.any[0]?.message ?? "")).join(" | ")}`);
}

async function semSobraNemAlvoPequeno(page: Page) {
  await ampliar(page);
  expect(await transbordo(page), 'rolagem horizontal a 140%').toBeLessThanOrEqual(0);
  expect(await alvosPequenos(page), 'alvos com menos de 44 px').toEqual([]);
}

async function visivelSemRolar(page: Page, alvo: ReturnType<Page['getByRole']>) {
  await ampliar(page);
  await expect(alvo).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await inteiroEDescoberto(alvo), 'o alvo está coberto por uma barra fixa').toBe(true);
}

// Sessão do Supabase falso: o cookie que o @supabase/ssr lê, com o token que o falso reconhece.
async function entrarComo(context: BrowserContext, papel: 'admin' | 'cliente') {
  const sessao = {
    access_token: `token-${papel}`, refresh_token: 'renovacao', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
    user: { id: papel === 'admin' ? '00000000-0000-4000-8000-0000000000a1' : '00000000-0000-4000-8000-0000000000c1', aud: 'authenticated', role: 'authenticated', email: `${papel}@exemplo.test` },
  };
  const valor = 'base64-' + Buffer.from(JSON.stringify(sessao)).toString('base64url');
  // O nome do cookie vem do começo do domínio da URL do Supabase (convenção do @supabase/ssr).
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://exemplo.supabase.co').hostname.split('.')[0];
  await context.addCookies([{ name: `sb-${ref}-auth-token`, value: valor, domain: '127.0.0.1', path: '/' }]);
}

async function semearCarrinho(page: Page, itens: unknown[]) {
  await page.addInitScript((texto) => window.localStorage.setItem('alecrim:carrinho:v1', texto), JSON.stringify(itens));
}

const ITEM_ALECRIM = { variacaoId: 'v-ale-90', slug: 'sabonete-artesanal', nome: 'Sabonete artesanal', aroma: 'alecrim', tamanho: '90 g', precoCentavos: 2200, quantidade: 2 };

// ---------------------------------------------------------------- Produto
test.describe('Produto', () => {
  const ROTA = '/produto/sabonete-artesanal';

  test('estado normal: axe sem violação, sem sobra e sem alvo pequeno a 140%', async ({ page }) => {
    await page.goto(ROTA);
    await expect(page.getByRole('heading', { level: 1, name: 'Sabonete artesanal' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await semSobraNemAlvoPequeno(page);
  });

  test('"Adicionar ao carrinho" fica visível sem rolar a 140%', async ({ page }) => {
    await page.goto(ROTA);
    await visivelSemRolar(page, page.getByRole('button', { name: 'Adicionar ao carrinho' }));
  });

  test('trocar o tamanho muda o preço do produto e o da barra de compra (alecrim: 90 g R$ 22,00; 140 g R$ 30,00)', async ({ page }) => {
    await page.goto(ROTA);
    await page.getByText('alecrim', { exact: true }).click();
    await page.getByText('90 g', { exact: true }).click();
    await expect(page.getByTestId('preco-produto')).toHaveText(PRECO_22);
    await expect(page.getByTestId('barra-compra')).toContainText('alecrim · 90 g');
    await expect(page.getByTestId('barra-compra')).toHaveText(PRECO_22);
    await page.getByText('140 g', { exact: true }).click();
    await expect(page.getByTestId('preco-produto')).toHaveText(PRECO_30);
    await expect(page.getByTestId('barra-compra')).toContainText('alecrim · 140 g');
    await expect(page.getByTestId('barra-compra')).toHaveText(PRECO_30);
  });

  test('o balão de tamanho mostra só o tamanho, sem preço', async ({ page }) => {
    await page.goto(ROTA);
    const tamanhos = page.getByRole('group', { name: 'Tamanho' });
    await expect(tamanhos).toContainText('90 g');
    await expect(tamanhos).not.toContainText('R$');
  });

  test('variação esgotada: avisa e oferece a que está disponível', async ({ page }) => {
    await page.goto('/produto/vela-aromatica');
    await page.getByText('alecrim', { exact: true }).click();
    await expect(page.getByText('alecrim 150 g esgotado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ver lavanda 150 g' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test('produto indisponível: 404 com o caminho de volta para os produtos', async ({ page }) => {
    const resposta = await page.goto('/produto/nao-existe');
    expect(resposta?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Este produto não está mais à venda' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver produtos' })).toHaveAttribute('href', '/');
    expect(await axe(page)).toEqual([]);
  });

  test('banco fora do ar: estado de erro honesto, nunca "não está mais à venda"', async ({ page }) => {
    await page.goto('/produto/quebrado');
    await expect(page.getByRole('alert').filter({ hasText: 'Não conseguimos carregar o catálogo agora. Tente de novo em instantes.' })).toBeVisible();
    await expect(page.getByText('não está mais à venda')).toHaveCount(0);
    // sem item no carrinho, não diz que o carrinho continua salvo
    await expect(page.getByText(/continuam salvos/)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Tentar de novo' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test('já no máximo do estoque: diz isso em vez de fingir que somou', async ({ page }) => {
    await semearCarrinho(page, [{ ...ITEM_ALECRIM, variacaoId: 'v-lar-90', aroma: 'laranja-doce', quantidade: 7 }]);
    await page.goto(ROTA);
    await page.getByText('laranja-doce', { exact: true }).click();
    await page.getByText('90 g', { exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click();
    await expect(page.getByText('Você já tem o máximo disponível no carrinho.')).toBeVisible();
  });

  test('frete pelo CEP: formata no blur e mostra as opções da região', async ({ page }) => {
    await page.goto(ROTA);
    const campo = page.getByLabel('Frete para o CEP');
    await campo.fill('01310100');
    await expect(campo).toHaveValue('01310100'); // nada de formatar a cada tecla
    await campo.blur();
    await expect(campo).toHaveValue('01310-100');
    await page.getByRole('button', { name: 'Calcular' }).click();
    await expect(page.getByText('Motoboy')).toBeVisible();
    await expect(page.getByText('Grátis')).toBeVisible();
  });

  test('banco fora do ar com item no carrinho: avisa que os itens continuam salvos', async ({ page }) => {
    await semearCarrinho(page, [ITEM_ALECRIM]);
    await page.goto('/produto/quebrado');
    await expect(page.getByText('Os itens do seu carrinho continuam salvos neste aparelho.')).toBeVisible();
  });

  test('frete pelo CEP: CEP inválido e CEP sem entrega dizem o que fazer', async ({ page }) => {
    await page.goto(ROTA);
    const campo = page.getByLabel('Frete para o CEP');
    await campo.fill('123');
    await page.getByRole('button', { name: 'Calcular' }).click();
    await expect(page.getByText('O CEP precisa ter 8 números. Exemplo: 01310-100.')).toBeVisible();
    await campo.fill('70000-000');
    await page.getByRole('button', { name: 'Calcular' }).click();
    await expect(page.getByText(/Ainda não entregamos neste CEP/)).toBeVisible();
  });

  test('WhatsApp abre com a mensagem pronta do produto e variação escolhidos', async ({ page }) => {
    await page.goto(ROTA);
    const link = page.getByRole('link', { name: /Tirar dúvida no WhatsApp/ });
    const href = (await link.getAttribute('href')) ?? '';
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(decodeURIComponent(href)).toContain('Sabonete artesanal');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('adicionar ao carrinho avisa e a navegação mostra a contagem', async ({ page }) => {
    await page.goto(ROTA);
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Adicionado ao carrinho.' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: /Carrinho/ })).toContainText('(1)');
  });
});

// ---------------------------------------------------------------- Carrinho
test.describe('Carrinho', () => {
  test('vazio: diz que está vazio e leva aos produtos; axe, sobra e alvos', async ({ page }) => {
    await page.goto('/carrinho');
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver produtos' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await semSobraNemAlvoPequeno(page);
  });

  test('com itens: quantidade −/+ de 44 px, subtotal, frete pelo CEP e total', async ({ page }) => {
    await semearCarrinho(page, [ITEM_ALECRIM]);
    await page.goto('/carrinho');
    await expect(page.getByText('Sabonete artesanal · alecrim · 90 g')).toBeVisible();
    await expect(page.getByText(/Subtotal \(2 itens\)/)).toBeVisible();
    const mais = page.getByRole('button', { name: /Aumentar a quantidade/ });
    const caixa = await mais.boundingBox();
    expect(caixa?.width).toBeGreaterThanOrEqual(44);
    expect(caixa?.height).toBeGreaterThanOrEqual(44);
    await mais.click();
    await expect(page.getByText(/Subtotal \(3 itens\)/)).toBeVisible();
    await page.getByLabel('CEP para o frete').fill('20040020');
    await page.getByRole('button', { name: 'Calcular' }).click();
    await expect(page.getByRole('radio', { name: /Correios/ })).toBeChecked();
    // 3 × R$ 22,00 + frete dos Correios R$ 30,00
    await expect(page.getByTestId('barra-total')).toContainText(/R\$\s96,00/);
    expect(await axe(page)).toEqual([]);
    await semSobraNemAlvoPequeno(page);
  });

  test('"Finalizar compra" fica visível sem rolar a 140% e diz a verdade sobre o pagamento', async ({ page }) => {
    await semearCarrinho(page, [ITEM_ALECRIM]);
    await page.goto('/carrinho');
    const finalizar = page.getByRole('button', { name: 'Finalizar compra' });
    await visivelSemRolar(page, finalizar);
    await finalizar.click();
    await expect(page.getByText('O pagamento ainda não está disponível')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver a tela de pagamento (exemplo)' })).toHaveAttribute('href', '/checkout/pagamento/1042');
  });

  test('item esgotado e preço que mudou: marca as linhas e "continuar" limpa o carrinho', async ({ page }) => {
    const esgotado = { variacaoId: 'v-vela-ale-150', slug: 'vela-aromatica', nome: 'Vela aromática', aroma: 'alecrim', tamanho: '150 g', precoCentavos: 4500, quantidade: 1 };
    await semearCarrinho(page, [{ ...ITEM_ALECRIM, precoCentavos: 2000 }, esgotado]);
    await page.goto('/carrinho');
    await expect(page.getByText('Um item mudou desde que você o adicionou')).toBeVisible();
    await expect(page.getByText('Esgotado', { exact: true })).toBeVisible();
    await expect(page.getByText(/2 × R\$\s22,00 \(antes R\$\s20,00\)/)).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Continuar com o que está disponível' }).click();
    await expect(page.getByText('Vela aromática')).toHaveCount(0);
    await expect(page.getByText('Um item mudou desde que você o adicionou')).toHaveCount(0);
    await expect(page.getByTestId('barra-total')).toContainText(/R\$\s44,00/);
  });

  test('quantidade acima do estoque: marca a linha, só conta o disponível e "continuar" ajusta', async ({ page }) => {
    // laranja-doce 90 g tem 7 em estoque no catálogo falso
    await semearCarrinho(page, [{ ...ITEM_ALECRIM, variacaoId: 'v-lar-90', aroma: 'laranja-doce', quantidade: 9 }]);
    await page.goto('/carrinho');
    await expect(page.getByText('Um item mudou desde que você o adicionou')).toBeVisible();
    await expect(page.getByText(/Só 7 unidades disponíveis, e o carrinho tem 9/)).toBeVisible();
    await expect(page.getByTestId('barra-total')).toContainText(/R\$\s154,00/); // 7 × R$ 22,00, não 9
    // a linha, o subtotal e o rótulo contam as mesmas 7 unidades
    await expect(page.getByRole('listitem').filter({ hasText: 'Sabonete artesanal · laranja-doce · 90 g' }).getByText(/^R\$\s154,00$/)).toBeVisible();
    await expect(page.getByText('Subtotal (7 itens)')).toBeVisible();
    await expect(page.locator('dl')).toContainText(/R\$\s154,00/);
    await expect(page.getByRole('button', { name: 'Finalizar compra' })).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Continuar com o que está disponível' }).click();
    await expect(page.getByText('Um item mudou desde que você o adicionou')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Aumentar a quantidade/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Finalizar compra' })).toBeVisible();
  });

  test('acima do estoque e preço mudado ao mesmo tempo: os dois avisos e o preço de hoje', async ({ page }) => {
    await semearCarrinho(page, [{ ...ITEM_ALECRIM, variacaoId: 'v-lar-90', aroma: 'laranja-doce', precoCentavos: 2000, quantidade: 9 }]);
    await page.goto('/carrinho');
    await expect(page.getByText(/Só 7 unidades disponíveis, e o carrinho tem 9/)).toBeVisible();
    await expect(page.getByText(/7 × R\$\s22,00 \(antes R\$\s20,00\)/)).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'laranja-doce · 90 g' }).getByText(/^R\$\s154,00$/)).toBeVisible();
    await expect(page.getByText('Subtotal (7 itens)')).toBeVisible();
  });

  test('catálogo fora do ar: mantém os itens e avisa que não conferiu', async ({ page }) => {
    await semearCarrinho(page, [{ ...ITEM_ALECRIM, slug: 'quebrado' }]);
    await page.goto('/carrinho');
    await expect(page.getByText('Não conseguimos conferir preço e estoque agora')).toBeVisible();
    await expect(page.getByText('Sabonete artesanal · alecrim · 90 g')).toBeVisible();
  });

  test('sem localStorage (navegador interno): o carrinho vale na aba e a tela avisa', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } });
    });
    await page.goto('/produto/sabonete-artesanal');
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click();
    await page.getByRole('link', { name: 'Ver carrinho' }).click();
    await expect(page.getByText('Este navegador não salva o carrinho')).toBeVisible();
    await expect(page.getByText(/Sabonete artesanal · sem fragrância · 90 g/)).toBeVisible();
  });

  test('carrinho salvo com lixo no localStorage vira carrinho vazio, sem quebrar a tela', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('alecrim:carrinho:v1', '{quebrado'));
    await page.goto('/carrinho');
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible();
  });
});

// ---------------------------------------------------------------- Pagamento Pix
test.describe('Pagamento Pix', () => {
  test('aguardando: declarado como exemplo, QR, copia e cola e contagem; axe, sobra e alvos', async ({ page }) => {
    await page.goto('/checkout/pagamento/1042');
    await expect(page.getByRole('heading', { name: 'Pague com Pix' })).toBeVisible();
    await expect(page.getByText(/Demonstração\./)).toBeVisible();
    await expect(page.getByRole('img', { name: /QR code de exemplo/ })).toBeVisible();
    await expect(page.getByRole('timer')).toHaveText(/^(29:\d\d|30:00)$/);
    expect(await axe(page)).toEqual([]);
    await semSobraNemAlvoPequeno(page);
  });

  test('"Copiar código Pix" fica visível sem rolar a 140% e copia o código de exemplo', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/checkout/pagamento/1042');
    const copiar = page.getByRole('button', { name: 'Copiar código Pix' });
    await visivelSemRolar(page, copiar);
    await copiar.click();
    await expect(page.getByText('Código copiado.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^EXEMPLO-NAO-E-UM-PIX/);
  });

  test('nunca promete aprovação na hora, e não chama o Mercado Pago', async ({ page }) => {
    const chamadas: string[] = [];
    page.on('request', (r) => { if (/mercadopago|mercadolibre/i.test(r.url())) chamadas.push(r.url()); });
    for (const n of ['1042', '1043', '1044']) {
      await page.goto(`/checkout/pagamento/${n}`);
      await expect(page.locator('main')).not.toHaveText(/na hora|imediat|instantane/i);
    }
    expect(chamadas).toEqual([]);
  });

  test('a contagem de 30 minutos zera e o Pix vira "expirado", sem esconder o "Já pagou?"', async ({ page }) => {
    await page.clock.install();
    await page.goto('/checkout/pagamento/1042');
    await expect(page.getByRole('heading', { name: 'Pague com Pix' })).toBeVisible();
    await page.clock.fastForward('31:00');
    await expect(page.getByRole('heading', { name: 'O Pix expirou' })).toBeVisible();
    await expect(page.getByText('Você já pagou?')).toBeVisible();
  });

  test('em confirmação: não pede para pagar de novo e chama o WhatsApp com o nº do pedido', async ({ page }) => {
    await page.goto('/checkout/pagamento/1043');
    await expect(page.getByRole('heading', { name: 'Estamos confirmando seu pagamento' })).toBeVisible();
    await expect(page.getByText('Não pague de novo: esta página atualiza sozinha.')).toBeVisible();
    const href = (await page.getByRole('link', { name: /Falar no WhatsApp/ }).getAttribute('href')) ?? '';
    expect(decodeURIComponent(href)).toContain('pedido nº 1043');
    expect(await axe(page)).toEqual([]);
    await visivelSemRolar(page, page.getByRole('link', { name: /Falar no WhatsApp/ }));
    await semSobraNemAlvoPequeno(page);
  });

  test('expirado: "Já pagou?" vem antes de "Tentar de novo"; "Já paguei" leva a "em confirmação"', async ({ page }) => {
    await page.goto('/checkout/pagamento/1044');
    await expect(page.getByRole('heading', { name: 'O Pix expirou' })).toBeVisible();
    const pergunta = await page.getByText('Você já pagou?').boundingBox();
    const tentar = await page.getByRole('link', { name: 'Não paguei: tentar de novo' }).boundingBox();
    expect(pergunta && tentar && pergunta.y < tentar.y).toBe(true);
    expect(await axe(page)).toEqual([]);
    await visivelSemRolar(page, page.getByRole('button', { name: 'Já paguei: acompanhar o pedido' }));
    await semSobraNemAlvoPequeno(page);
    await page.getByRole('button', { name: 'Já paguei: acompanhar o pedido' }).click();
    await expect(page.getByRole('heading', { name: 'Estamos confirmando seu pagamento' })).toBeVisible();
  });

  test('pedido que não existe responde 404', async ({ page }) => {
    const r = await page.goto('/checkout/pagamento/9999');
    expect(r?.status()).toBe(404);
  });
});

// ---------------------------------------------------------------- Admin pedidos
test.describe('Admin pedidos', () => {
  test('sem sessão vai para /entrar', async ({ page }) => {
    await page.goto('/admin/pedidos');
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test('comprador não vê os pedidos da dona', async ({ page, context }) => {
    await entrarComo(context, 'cliente');
    await page.goto('/admin/pedidos');
    await expect(page).not.toHaveURL(/\/admin\/pedidos/);
    await expect(page.locator('body')).not.toContainText('Ana E.');
  });

  test('dona: cartões, pagos primeiro; axe, sobra e alvos a 140%', async ({ page, context }) => {
    await entrarComo(context, 'admin');
    await page.goto('/admin/pedidos');
    await expect(page.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pagos \(3\)$/ })).toHaveAttribute('aria-pressed', 'true');
    const numeros = await page.locator('main li strong').allTextContents();
    expect(numeros).toEqual(['Nº 1042', 'Nº 1043', 'Nº 1045']);
    expect(await axe(page)).toEqual([]);
    await semSobraNemAlvoPequeno(page);
  });

  test('a ação do primeiro pedido fica visível sem rolar a 140%', async ({ page, context }) => {
    await entrarComo(context, 'admin');
    await page.goto('/admin/pedidos');
    await visivelSemRolar(page, page.getByRole('button', { name: 'Marcar como separado' }).first());
  });

  test('navegação do painel: 3 destinos, 2 desligados e nenhum link quebrado', async ({ page, context, request }) => {
    await entrarComo(context, 'admin');
    await page.goto('/admin/pedidos');
    const nav = page.getByRole('navigation', { name: 'Painel' });
    await expect(nav.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link')).toHaveCount(1);
    await expect(nav.getByText('em breve')).toHaveCount(2);
    await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
    const hrefs = await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    for (const h of new Set(hrefs)) {
      const r = await request.get(h, { headers: { cookie: (await context.cookies()).map((c) => `${c.name}=${c.value}`).join('; ') }, maxRedirects: 5 });
      expect(r.status(), h).toBeLessThan(400);
    }
  });

  test('filtro por status e "Todos"', async ({ page, context }) => {
    await entrarComo(context, 'admin');
    await page.goto('/admin/pedidos');
    await page.getByRole('button', { name: /Separados/ }).click();
    await expect(page.locator('main li strong')).toHaveText(['Nº 1040']);
    await page.getByRole('button', { name: 'Todos' }).click();
    await expect(page.locator('main li strong')).toHaveCount(6);
  });

  test('marcar como separado tira o pedido da fila dos pagos e deixa claro que é exemplo', async ({ page, context }) => {
    await entrarComo(context, 'admin');
    await page.goto('/admin/pedidos');
    await page.getByRole('button', { name: 'Marcar como separado' }).first().click();
    await expect(page.getByRole('button', { name: /^Pagos \(2\)$/ })).toBeVisible();
    await expect(page.getByText(/Exemplo: nada foi gravado/)).toBeVisible();
  });

  test('enviado pelos Correios exige o código de rastreio, formatado ao sair do campo', async ({ page, context }) => {
    await entrarComo(context, 'admin');
    await page.goto('/admin/pedidos');
    await page.getByRole('button', { name: /Separados/ }).click();
    await page.getByRole('button', { name: 'Marcar como enviado' }).click();
    await expect(page.getByText('O código tem 2 letras, 9 números e BR. Exemplo: AA123456789BR.')).toBeVisible();
    const campo = page.getByLabel('Código de rastreio dos Correios');
    await campo.fill('aa123456789br');
    await expect(campo).toHaveValue('aa123456789br');
    await campo.blur();
    await expect(campo).toHaveValue('AA123456789BR');
    await page.getByRole('button', { name: 'Marcar como enviado' }).click();
    await expect(page.getByText(/marcado como "enviado"/)).toBeVisible();
  });

  test('estorno tem estilo destrutivo, pede motivo e não usa as cores do primário', async ({ page, context }) => {
    await entrarComo(context, 'admin');
    await page.goto('/admin/pedidos');
    const primario = page.getByRole('button', { name: 'Marcar como separado' }).first();
    const fundoPrimario = await primario.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.getByRole('button', { name: /Estornar pagamento/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Estornar o pedido nº 1042?' })).toBeVisible();
    const confirmar = page.getByRole('button', { name: /Sim, estornar/ });
    const fundoPerigo = await confirmar.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fundoPerigo).not.toBe(fundoPrimario);
    await confirmar.click();
    await expect(page.getByText('Informe o motivo do estorno.')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByLabel('Motivo').fill('Desistência em 7 dias');
    await confirmar.click();
    await expect(page.getByText(/Estorno do pedido nº 1042 simulado/)).toBeVisible();
  });
});

// ---------------------------------------------------------------- Navegação da loja
test.describe('Navegação da loja', () => {
  test('a barra inferior tem só destinos que existem, com o atual marcado', async ({ page, request }) => {
    await page.goto('/carrinho');
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link')).toHaveCount(3);
    await expect(nav.getByRole('link', { name: /Carrinho/ })).toHaveAttribute('aria-current', 'page');
    for (const href of await nav.getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) {
      const r = await request.get(href);
      expect(r.status(), href).toBeLessThan(400);
    }
  });
});
