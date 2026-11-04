// Mercado Pago FALSO para o e2e (#32): responde a Orders API no formato da referência oficial
// (POST /v1/orders, GET /v1/orders/{id}, POST /v1/orders/{id}/cancel), só em 127.0.0.1, com dados
// fictícios. O e2e/apoio/desviar-mercadopago.cjs leva para cá toda chamada do servidor a
// api.mercadopago.com. Nunca fala com o Mercado Pago de verdade e não conhece nenhuma credencial real.
//
// Como no real: exige `Authorization: Bearer …` e `X-Idempotency-Key` nas mutações; a mesma chave com o
// mesmo corpo devolve a mesma order (a doc não diz; o código também trata 409). O Pix de teste não se
// paga lendo o QR: o e2e aprova pela rota de controle POST /teste/aprovar/{id} (no real, `APRO` faz isso).
// Rotas de controle (só o e2e usa): POST /teste/order (semeia), POST /teste/aprovar/{id}, GET /teste/order/{id}.
import { createServer } from 'node:http';

const PORTA = Number(process.env.MERCADOPAGO_FALSO_PORTA ?? 3102);
const orders = new Map();
const porChave = new Map();
let sequencia = 0;

function json(res, status, corpo) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(corpo));
}

function lerCorpo(req) {
  return new Promise((resolve) => {
    let t = '';
    req.on('data', (p) => (t += p));
    req.on('end', () => {
      try { resolve(t ? JSON.parse(t) : {}); } catch { resolve(null); }
    });
  });
}

function comPix(o) {
  return {
    id: o.id, type: 'online', processing_mode: 'automatic', external_reference: o.external_reference, total_amount: o.total_amount,
    country_code: 'BRA', status: o.status, status_detail: o.status_detail, capture_mode: 'automatic',
    transactions: { payments: [{ id: `PAY${o.id.slice(3)}`, amount: o.total_amount, status: o.status, status_detail: o.status_detail,
      payment_method: { id: 'pix', type: 'bank_transfer', ticket_url: 'https://exemplo.invalid/ticket',
        qr_code: `00020126580014br.gov.bcb.pix-FALSO-${o.id}`,
        // PNG de 1×1 em base64: só para a tela ter uma imagem de verdade para mostrar.
        qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==' } }] },
  };
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/saude') return json(res, 200, { ok: true });

  // ---------------------------------------------------------------- controle do e2e
  if (url.pathname === '/teste/order' && req.method === 'POST') {
    const c = await lerCorpo(req);
    const o = { id: c.id, external_reference: c.external_reference, total_amount: c.total_amount, status: c.status ?? 'action_required', status_detail: c.status_detail ?? 'waiting_transfer', payer: null, gets: 0 };
    orders.set(o.id, o);
    return json(res, 201, comPix(o));
  }
  const aprovar = url.pathname.match(/^\/teste\/aprovar\/([^/]+)$/);
  if (aprovar && req.method === 'POST') {
    const o = orders.get(aprovar[1]);
    if (!o) return json(res, 404, { errors: [{ code: 'not_found' }] });
    Object.assign(o, { status: 'processed', status_detail: 'accredited' });
    return json(res, 200, comPix(o));
  }
  const ver = url.pathname.match(/^\/teste\/order\/([^/]+)$/);
  if (ver) {
    const o = orders.get(ver[1]) ?? [...orders.values()].find((x) => x.external_reference === ver[1]);
    return o ? json(res, 200, { ...comPix(o), payer: o.payer, gets: o.gets, chave: o.chave }) : json(res, 404, {});
  }

  // ---------------------------------------------------------------- Orders API
  if (!/^Bearer \S+/.test(String(req.headers.authorization ?? ''))) return json(res, 401, { errors: [{ code: 'invalid_credentials' }] });

  if (url.pathname === '/v1/orders' && req.method === 'POST') {
    const chave = String(req.headers['x-idempotency-key'] ?? '');
    if (!chave) return json(res, 400, { errors: [{ code: 'empty_required_header' }] });
    if (chave.length > 128) return json(res, 400, { errors: [{ code: 'invalid_idempotency_key_length' }] });
    const c = await lerCorpo(req);
    if (!c || c.type !== 'online' || !c.external_reference || !c.total_amount || !c.payer?.email) return json(res, 400, { errors: [{ code: 'required_properties' }] });
    const pagamento = c.transactions?.payments?.[0];
    if (pagamento?.payment_method?.id !== 'pix' || pagamento.amount !== c.total_amount) return json(res, 400, { errors: [{ code: 'invalid_total_amount' }] });
    const ja = porChave.get(chave);
    if (ja) return json(res, 201, comPix(orders.get(ja)));
    sequencia += 1;
    const id = `ORD01FALSO${String(Date.now()).slice(-6)}${String(sequencia).padStart(4, '0')}`;
    const o = { id, external_reference: c.external_reference, total_amount: c.total_amount, status: 'action_required', status_detail: 'waiting_transfer', payer: c.payer, expiracao: pagamento.expiration_time, chave, gets: 0 };
    orders.set(id, o);
    porChave.set(chave, id);
    return json(res, 201, comPix(o));
  }
  const m = url.pathname.match(/^\/v1\/orders\/([^/]+)(\/cancel)?$/);
  if (m) {
    const o = orders.get(m[1]);
    if (!o) return json(res, 404, { errors: [{ code: 'order_not_found' }] });
    if (m[2] && req.method === 'POST') {
      if (!req.headers['x-idempotency-key']) return json(res, 400, { errors: [{ code: 'empty_required_header' }] });
      if (o.status !== 'action_required' && o.status !== 'created') return json(res, 409, { errors: [{ code: 'order_cannot_be_canceled' }] });
      Object.assign(o, { status: 'canceled', status_detail: 'canceled' });
      return json(res, 200, comPix(o));
    }
    o.gets += 1;
    return json(res, 200, comPix(o));
  }
  return json(res, 404, { errors: [{ code: 'rota do Mercado Pago falso não existe: ' + url.pathname }] });
});

servidor.listen(PORTA, '127.0.0.1', () => console.log(`Mercado Pago falso em http://127.0.0.1:${PORTA}`));
