// Pagamento Pix (tela 7) e webhook (#32), em 360 px, sobre o Supabase FALSO e o Mercado Pago FALSO
// (e2e/apoio/mercadopago-falso.mjs). O código real de lib/pagamentos/ roda por cima: cria a order, mostra o
// QR, consulta o estado real e confirma pelo GET. Cada teste semeia o próprio pedido (os projetos rodam em
// paralelo). O Pix real na sandbox fica para a prévia da Vercel (roteiro no PR).
import { expect, test } from '@playwright/test';
import { axe, semearCarrinho, semSobraNemAlvoPequeno, visivelSemRolar } from './apoio/comum';
import { IDS, entrarComo } from './apoio/sessao';
import { aprovarOrder, lerOrderFalsa, lerPedido, ligarOrder, notificacao, semearOrder, semearPedido } from './apoio/pix';

test.use({ viewport: { width: 360, height: 740 } });

// Sabonete de lavanda 90 g (R$ 22,00, estoque 20 no falso): nenhum outro spec usa esta variação.
const LAVANDA_90 = { variacaoId: 'v-lav-90', slug: 'sabonete-artesanal', nome: 'Sabonete artesanal', aroma: 'lavanda', tamanho: '90 g', precoCentavos: 2200 };
const ITENS = [{ variacao_id: 'v-lav-90', quantidade: 2 }];

test('sem sessão: a tela do Pix vai para /entrar', async ({ page }) => {
  await page.goto('/checkout/pagamento/b0000000-0000-4000-8000-000000000001');
  await expect(page).toHaveURL(/\/entrar\?volta=%2Fcheckout%2Fpagamento%2F/);
});

test.describe('com sessão do comprador', () => {
  test.beforeEach(async ({ context }) => entrarComo(context, 'cliente'));

  test('T3: gera o Pix (QR, copia e cola, contagem) e vira "pago" sozinha; o carrinho esvazia', async ({ page, request }) => {
    const p = await semearPedido(request, { usuario_id: IDS.cliente, total_centavos: 7400, itens: ITENS });
    await semearCarrinho(page, [{ ...LAVANDA_90, quantidade: 2 }], '20040-002');
    await page.goto(`/checkout/pagamento/${p.id}`);
    await expect(page.getByRole('heading', { name: 'Pague com Pix' })).toBeVisible();
    await expect(page.getByRole('img', { name: /QR code do Pix do pedido nº/ })).toBeVisible();
    await expect(page.getByRole('timer')).toHaveText(/^(2[45]:\d\d|25:00)$/);
    await expect(page.getByText(/00020126580014br\.gov\.bcb\.pix-FALSO-ORD/)).toBeVisible();
    await expect(page.getByText(/Demonstração|exemplo/i)).toHaveCount(0);

    // O que foi ao Mercado Pago: o total do pedido congelado, PT30M, o id do pedido e, no payer, só o
    // e-mail e o APRO do modo de teste (LGPD: nada além do que a Orders API exige).
    const order = await lerOrderFalsa(request, p.id);
    expect(order).toMatchObject({ total_amount: '74.00', external_reference: p.id, payer: { email: 'cliente@exemplo.test', first_name: 'APRO' } });
    expect(Object.keys(order?.payer as object).sort()).toEqual(['email', 'first_name']);
    expect(String(order?.chave).length).toBeLessThanOrEqual(128);
    expect((await lerPedido(request, p.id)).mp_order_id).toBe(order?.id);

    expect(await axe(page)).toEqual([]);
    await semSobraNemAlvoPequeno(page);

    // A sandbox aprova o APRO sozinha; aqui o falso aprova quando mandado. A tela relê a cada 10 s,
    // consulta a order e confirma pelo GET, sem webhook.
    await aprovarOrder(request, String(order?.id));
    await expect(page.getByRole('heading', { name: 'Pagamento confirmado' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('img', { name: /QR code do Pix/ })).toHaveCount(0);
    expect((await lerPedido(request, p.id)).status).toBe('pago');
    expect(await page.evaluate(() => window.localStorage.getItem('alecrim:carrinho:v1'))).toBe('[]');
    expect(await axe(page)).toEqual([]);
  });

  test('"Copiar código Pix" fica visível sem rolar a 140% e copia o código da order', async ({ page, context, request }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const p = await semearPedido(request, { usuario_id: IDS.cliente, itens: ITENS });
    await page.goto(`/checkout/pagamento/${p.id}`);
    const copiar = page.getByRole('button', { name: 'Copiar código Pix' });
    await expect(copiar).toBeVisible();
    await visivelSemRolar(page, copiar);
    await copiar.click();
    await expect(page.getByText('Código copiado.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^00020126580014br\.gov\.bcb\.pix-FALSO-ORD/);
  });

  test('T12: duas abas no mesmo pedido geram UMA order', async ({ page, context, request }) => {
    const p = await semearPedido(request, { usuario_id: IDS.cliente, itens: ITENS });
    const outra = await context.newPage();
    await Promise.all([page.goto(`/checkout/pagamento/${p.id}`), outra.goto(`/checkout/pagamento/${p.id}`)]);
    await expect(page.getByRole('button', { name: 'Copiar código Pix' })).toBeVisible();
    await expect(outra.getByRole('button', { name: 'Copiar código Pix' })).toBeVisible({ timeout: 20_000 });
    const codigos = await Promise.all([page, outra].map((x) => x.locator('code').innerText()));
    expect(codigos[0]).toBe(codigos[1]);
  });

  test('guarda: pedido de outra pessoa e id inválido respondem 404, sem QR', async ({ page, request }) => {
    const deOutro = await semearPedido(request, { usuario_id: IDS.admin, mp_order_id: 'ORD-DE-OUTRO', mp_qr_code: '000201-de-outro', itens: ITENS });
    const r = await page.goto(`/checkout/pagamento/${deOutro.id}`);
    expect(r?.status()).toBe(404);
    await expect(page.getByText('000201-de-outro')).toHaveCount(0);
    expect((await page.goto('/checkout/pagamento/9999'))?.status()).toBe(404);
  });

  test('pedido já pago não mostra QR nem pede para pagar de novo', async ({ page, request }) => {
    const p = await semearPedido(request, { usuario_id: IDS.cliente, status: 'pago', mp_order_id: 'ORD-PAGO', mp_qr_code: '000201-pago', itens: ITENS });
    await page.goto(`/checkout/pagamento/${p.id}`);
    await expect(page.getByRole('heading', { name: 'Pagamento confirmado' })).toBeVisible();
    await expect(page.getByText('000201-pago')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copiar código Pix' })).toHaveCount(0);
  });

  test('T4: a contagem zera e o Pix vira "expirado", sem esconder o "Já pagou?"', async ({ page, request }) => {
    const p = await semearPedido(request, { usuario_id: IDS.cliente, minutos_restantes: 1, mp_order_id: await semearOrder(request, 'x', '134.00'), mp_qr_code: '000201-quase', itens: ITENS });
    await page.clock.install();
    await page.goto(`/checkout/pagamento/${p.id}`);
    await expect(page.getByRole('heading', { name: 'Pague com Pix' })).toBeVisible();
    await page.clock.fastForward('02:00');
    await expect(page.getByRole('heading', { name: 'O Pix expirou' })).toBeVisible();
    await expect(page.getByText('Você já pagou?')).toBeVisible();
  });

  test('expirado no banco: "Já pagou?" vem antes de "Tentar de novo"; "Já paguei" leva a "em confirmação"', async ({ page, request }) => {
    const p = await semearPedido(request, { usuario_id: IDS.cliente, status: 'cancelado', minutos_restantes: -10, cancelado_em_minutos: -4, itens: ITENS });
    await page.goto(`/checkout/pagamento/${p.id}`);
    await expect(page.getByRole('heading', { name: 'O Pix expirou' })).toBeVisible();
    const pergunta = await page.getByText('Você já pagou?').boundingBox();
    const tentar = await page.getByRole('link', { name: 'Não paguei: tentar de novo' }).boundingBox();
    expect(pergunta && tentar && pergunta.y < tentar.y).toBe(true);
    expect(await axe(page)).toEqual([]);
    await visivelSemRolar(page, page.getByRole('button', { name: 'Já paguei: acompanhar o pedido' }));
    await semSobraNemAlvoPequeno(page);
    await page.getByRole('button', { name: 'Já paguei: acompanhar o pedido' }).click();
    await expect(page.getByRole('heading', { name: 'Estamos confirmando seu pagamento' })).toBeVisible();
    await expect(page.getByText('Não pague de novo: esta página atualiza sozinha.')).toBeVisible();
    const href = (await page.getByRole('link', { name: /Falar no WhatsApp/ }).getAttribute('href')) ?? '';
    expect(decodeURIComponent(href)).toContain(`pedido nº ${p.id.slice(0, 8).toUpperCase()}`);
    expect(await axe(page)).toEqual([]);
    await semSobraNemAlvoPequeno(page);
  });

  test('cancelado antes do prazo (o carrinho virou outro pedido): diz o que fazer, sem QR', async ({ page, request }) => {
    const p = await semearPedido(request, { usuario_id: IDS.cliente, status: 'cancelado', cancelado_em_minutos: 0, itens: ITENS });
    await page.goto(`/checkout/pagamento/${p.id}`);
    await expect(page.getByRole('heading', { name: 'Este pedido foi cancelado' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir para o carrinho' })).toHaveAttribute('href', '/carrinho');
    expect(await axe(page)).toEqual([]);
  });

  test('nunca promete aprovação na hora', async ({ page, request }) => {
    const p = await semearPedido(request, { usuario_id: IDS.cliente, itens: ITENS });
    await page.goto(`/checkout/pagamento/${p.id}`);
    await expect(page.getByRole('button', { name: 'Copiar código Pix' })).toBeVisible();
    await expect(page.locator('main')).not.toHaveText(/na hora|imediat|instantane/i);
  });
});

test('L6: a reserva do próprio comprador não aparece como "Esgotado" no carrinho dele', async ({ page, context, request }) => {
  await entrarComo(context, 'novo');
  // Vela de alecrim 150 g: estoque 0 na vitrine, porque a reserva deste comprador levou a última.
  await semearPedido(request, { usuario_id: IDS.novo, itens: [{ variacao_id: 'v-vela-ale-150', quantidade: 1 }] });
  await semearCarrinho(page, [{ variacaoId: 'v-vela-ale-150', slug: 'vela-aromatica', nome: 'Vela aromática', aroma: 'alecrim', tamanho: '150 g', precoCentavos: 4500, quantidade: 1 }], '20040-002');
  await page.goto('/carrinho');
  await expect(page.getByText('Vela aromática')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalizar compra' }).or(page.getByRole('link', { name: 'Finalizar compra' }))).toBeVisible();
  await expect(page.getByText('Esgotado')).toHaveCount(0);
});

test.describe('webhook do Mercado Pago (rota real)', () => {
  test('T3/T8/T9: notificação assinada → pago pelo GET; repetida → duplicado; outra do mesmo pagamento → ja-pago', async ({ request }) => {
    const p = await semearPedido(request, { usuario_id: IDS.cliente, total_centavos: 7500, itens: ITENS });
    const order = await semearOrder(request, p.id, '75.00', { status: 'processed', status_detail: 'accredited' });
    await ligarOrder(request, p.id, order);
    const n = notificacao(order);
    let r = await request.post(n.url, { headers: n.headers, data: n.data });
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual({ recebido: true, resultado: 'pago' });
    expect((await lerPedido(request, p.id)).status).toBe('pago');
    r = await request.post(n.url, { headers: n.headers, data: n.data });
    expect(await r.json()).toEqual({ recebido: true, resultado: 'duplicado' });
    const outra = notificacao(order, { corpo: { action: 'order.updated', type: 'order', live_mode: false } });
    r = await request.post(outra.url, { headers: outra.headers, data: outra.data });
    expect(await r.json()).toEqual({ recebido: true, resultado: 'ja-pago' });
  });

  test('T10: assinatura errada ou velha → 400; corpo forjado "approved" com a order esperando → nada muda', async ({ request }) => {
    const p = await semearPedido(request, { usuario_id: IDS.cliente, total_centavos: 7500, itens: ITENS });
    const order = await semearOrder(request, p.id, '75.00');
    await ligarOrder(request, p.id, order);
    const errada = notificacao(order, { segredo: 'outro-segredo' });
    expect((await request.post(errada.url, { headers: errada.headers, data: errada.data })).status()).toBe(400);
    const velha = notificacao(order, { ts: Date.now() - 3_600_000 });
    expect((await request.post(velha.url, { headers: velha.headers, data: velha.data })).status()).toBe(400);
    const forjada = notificacao(order, { corpo: { type: 'order', live_mode: false, status: 'approved', data: { id: order, status: 'processed', status_detail: 'accredited', total_amount: '75.00' } } });
    const r = await request.post(forjada.url, { headers: forjada.headers, data: forjada.data });
    expect(await r.json()).toEqual({ recebido: true, resultado: 'aguardando' });
    expect((await lerPedido(request, p.id)).status).toBe('aberto');
  });

  test('T16: live_mode=true num pedido de teste → 200 com aviso, nada muda', async ({ request }) => {
    const p = await semearPedido(request, { usuario_id: IDS.cliente, total_centavos: 7500, itens: ITENS });
    const order = await semearOrder(request, p.id, '75.00', { status: 'processed', status_detail: 'accredited' });
    await ligarOrder(request, p.id, order);
    const n = notificacao(order, { corpo: { type: 'order', live_mode: true, data: { id: order } } });
    const r = await request.post(n.url, { headers: n.headers, data: n.data });
    expect(await r.json()).toEqual({ recebido: true, resultado: 'modo-divergente' });
    expect((await lerPedido(request, p.id)).status).toBe('aberto');
  });

  test('T10b: order paga com valor diferente → nada vira pago', async ({ request }) => {
    const p = await semearPedido(request, { usuario_id: IDS.cliente, total_centavos: 7500, itens: ITENS });
    const order = await semearOrder(request, p.id, '74.99', { status: 'processed', status_detail: 'accredited' });
    await ligarOrder(request, p.id, order);
    const n = notificacao(order);
    expect(await (await request.post(n.url, { headers: n.headers, data: n.data })).json()).toEqual({ recebido: true, resultado: 'valor-divergente' });
    expect((await lerPedido(request, p.id)).status).toBe('aberto');
  });
});
