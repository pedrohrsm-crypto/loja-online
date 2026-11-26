'use client';

// Pagamento Pix (tela 7), com o Pix REAL do Mercado Pago (#32). Os textos, estados e a ordem das ações
// são os da alta fidelidade aprovada (L4 do #21). Nunca promete "aprovação na hora": o Pix confirma "em
// instantes", e o estado "em confirmação" existe porque pagar no limite do prazo pode demorar a aparecer.
// O estado vem do servidor (a página relê o pedido a cada 10 s); aqui só se desconta o relógio local.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { gerarPixDoPedido } from '@/app/checkout/pagamento/[pedido]/acoes';
import { formatarPreco } from '@/lib/catalogo/preco';
import { tirarItensPagos } from '@/lib/loja/carrinho';
import { gravarCarrinho, lerCarrinhoAgora } from '@/lib/loja/carrinho-armazenamento';
import { formatarContagem, PRAZO_PIX_SEGUNDOS, segundosRestantes, situacaoExibida } from '@/lib/loja/pix';
import { linkWhatsapp, mensagemPedido } from '@/lib/loja/whatsapp';
import type { TelaPix } from '@/lib/pagamentos/tela';
import { estiloBotao } from '@/lib/ui/botao';
import { Aviso } from './aviso';
import { BarraAcao } from './barra-acao';
import { EstadoVazio } from './estado-vazio';

const ATUALIZA_A_CADA_MS = 10_000;

function Indisponivel({ numero }: { numero: string | null }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pague com Pix</h1>
      <Aviso tipo="erro" urgente titulo="O Pix está indisponível agora">
        Nada foi cobrado. Tente de novo em alguns minutos; se continuar, fale com a gente pelo WhatsApp.
      </Aviso>
      <BarraAcao>
        <a href={linkWhatsapp(numero ? mensagemPedido(numero) : 'Olá! Não consegui pagar com Pix.')} target="_blank" rel="noopener noreferrer" className={estiloBotao('primario', 'w-full')}>
          Falar no WhatsApp<span className="sr-only"> (abre em outra aba)</span>
        </a>
      </BarraAcao>
    </div>
  );
}

export function PixVista({ tela }: { tela: TelaPix | null }) {
  if (!tela) return <Indisponivel numero={null} />;
  return <PixDoPedido tela={tela} />;
}

function PixDoPedido({ tela }: { tela: TelaPix }) {
  const router = useRouter();
  const [restante, setRestante] = useState(tela.segundosRestantes);
  const [jaPaguei, setJaPaguei] = useState(false);
  const [copia, setCopia] = useState<'nao' | 'sim' | 'erro'>('nao');
  const [falhaAoGerar, setFalhaAoGerar] = useState(false);
  const pediu = useRef(false);
  const servidor = tela.situacao === 'gerando' ? 'aguardando' : tela.situacao;
  const situacao = situacaoExibida(servidor, restante, jaPaguei);

  // Contagem: o prazo vem do servidor (segundos); aqui só se desconta o relógio local.
  useEffect(() => {
    if (tela.situacao !== 'aguardando' && tela.situacao !== 'gerando') return;
    const fim = Date.now() + tela.segundosRestantes * 1000;
    const t = setInterval(() => setRestante(segundosRestantes(fim, Date.now())), 1000);
    return () => clearInterval(t);
  }, [tela.situacao, tela.segundosRestantes]);

  // "Atualiza sozinho": enquanto espera, relê o pedido no servidor a cada 10 s.
  useEffect(() => {
    if (situacao !== 'aguardando' && situacao !== 'em-confirmacao') return;
    const t = setInterval(() => router.refresh(), ATUALIZA_A_CADA_MS);
    return () => clearInterval(t);
  }, [situacao, router]);

  // Pedido aberto sem Pix: pede ao servidor uma vez e relê a página.
  useEffect(() => {
    if (tela.situacao !== 'gerando' || pediu.current) return;
    pediu.current = true;
    gerarPixDoPedido(tela.pedidoId)
      .then((r) => (r.ok || r.motivo !== 'indisponivel' ? router.refresh() : setFalhaAoGerar(true)))
      .catch(() => setFalhaAoGerar(true));
  }, [tela.situacao, tela.pedidoId, router]);

  // Pagamento confirmado: o carrinho esvazia do que o pedido levou (L6).
  useEffect(() => {
    if (tela.situacao !== 'pago') return;
    const atual = lerCarrinhoAgora();
    const resto = tirarItensPagos(atual, tela.itens);
    if (resto.length !== atual.length || resto.some((i, n) => i.quantidade !== atual[n].quantidade)) gravarCarrinho(resto);
  }, [tela.situacao, tela.itens]);

  async function copiar() {
    if (!tela.qrCode) return;
    try {
      await navigator.clipboard.writeText(tela.qrCode);
      setCopia('sim');
    } catch {
      setCopia('erro');
    }
  }

  if (situacao === 'pago') {
    return (
      <EstadoVazio titulo="Pagamento confirmado" texto={`Recebemos o pagamento do pedido nº ${tela.numero}. Não é preciso pagar de novo: agora é com a gente separar os seus itens.`}>
        <Link href="/conta" className={estiloBotao('primario')}>Ver minha conta</Link>
      </EstadoVazio>
    );
  }

  if (situacao === 'cancelado') {
    return (
      <EstadoVazio titulo="Este pedido foi cancelado" texto={`O pedido nº ${tela.numero} foi cancelado e os itens voltaram para a loja. Se você mudou o carrinho, pague o pedido novo; se não, monte o carrinho de novo.`}>
        <Link href="/carrinho" className={estiloBotao('primario')}>Ir para o carrinho</Link>
      </EstadoVazio>
    );
  }

  if (situacao === 'em-confirmacao') {
    return (
      <div className="space-y-4">
        <div className="space-y-2" role="status">
          <h1 className="text-2xl font-bold">Estamos confirmando seu pagamento</h1>
          <p className="text-texto-suave">Se você pagou perto do fim do prazo, a confirmação pode demorar. Não pague de novo: esta página atualiza sozinha.</p>
          <p className="text-sm text-texto-suave">Pedido nº {tela.numero} · {formatarPreco(tela.totalCentavos)}</p>
        </div>
        <BarraAcao>
          <a href={linkWhatsapp(mensagemPedido(tela.numero))} target="_blank" rel="noopener noreferrer" className={estiloBotao('primario', 'w-full')}>
            Falar no WhatsApp (pedido nº {tela.numero})<span className="sr-only"> (abre em outra aba)</span>
          </a>
        </BarraAcao>
      </div>
    );
  }

  if (situacao === 'expirado') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">O Pix expirou</h1>
        <p className="text-texto-suave">O prazo de {PRAZO_PIX_SEGUNDOS / 60} minutos acabou.</p>
        <Aviso tipo="atencao" titulo="Você já pagou?">
          Se pagou, espere alguns minutos: a confirmação aparece nesta página quando chegar. Não pague de novo.
        </Aviso>
        <BarraAcao>
          <button type="button" className={estiloBotao('primario')} onClick={() => setJaPaguei(true)}>
            Já paguei: acompanhar o pedido
          </button>
          <Link href="/carrinho" className={estiloBotao('secundario')}>
            Não paguei: tentar de novo
          </Link>
        </BarraAcao>
      </div>
    );
  }

  if (tela.situacao === 'gerando' || !tela.qrCode) {
    if (falhaAoGerar) return <Indisponivel numero={tela.numero} />;
    return (
      <div className="space-y-3" role="status">
        <h1 className="text-2xl font-bold">Pague com Pix</h1>
        <p className="text-texto-suave">Gerando o seu Pix de {formatarPreco(tela.totalCentavos)}…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pague com Pix</h1>
      <p>
        <span className="font-bold">{formatarPreco(tela.totalCentavos)}</span> · expira em{' '}
        <time role="timer" className="font-bold tabular-nums">{formatarContagem(restante)}</time>
      </p>
      {tela.qrCodeBase64 ? (
        <div className="mx-auto w-48 max-w-full rounded-md border border-borda bg-qr-fundo p-1">
          {/* Imagem que o Mercado Pago gera para este Pix (data URL): o next/image não otimiza nada aqui. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${tela.qrCodeBase64}`} alt={`QR code do Pix do pedido nº ${tela.numero}`} className="block h-auto w-full" />
        </div>
      ) : (
        <p className="text-sm text-texto-suave">Use o código copia e cola abaixo no aplicativo do seu banco.</p>
      )}
      <div className="space-y-1 rounded-cartao border border-borda bg-superficie p-4 shadow-cartao">
        <p className="text-sm font-semibold">Pix copia e cola</p>
        <code className="block break-all text-sm select-all">{tela.qrCode}</code>
      </div>
      <p className="text-sm text-texto-suave">Pedido nº {tela.numero}. Esta página atualiza sozinha quando o pagamento chegar.</p>
      <div data-testid="barra-copiar" className="sticky bottom-(--altura-navegacao) z-30 -mx-4 space-y-1 border-t border-borda bg-fundo px-4 py-3">
        <button type="button" className={estiloBotao('primario', 'w-full')} onClick={copiar}>
          Copiar código Pix
        </button>
        <p role="status" className={copia === 'nao' ? 'sr-only' : copia === 'sim' ? 'text-sm text-sucesso' : 'text-sm text-erro'}>
          {copia === 'sim' ? 'Código copiado.' : copia === 'erro' ? 'Não foi possível copiar. Selecione o código acima e copie.' : ''}
        </p>
      </div>
    </div>
  );
}
