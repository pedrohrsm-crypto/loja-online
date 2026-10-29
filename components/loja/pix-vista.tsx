'use client';

// Pagamento Pix (L4), com DADOS DE EXEMPLO (lib/loja/exemplos.ts). Nenhuma chamada ao Mercado Pago.
// Nunca promete "aprovação na hora": o Pix confirma "em instantes", e o estado "em confirmação"
// existe porque pagar no limite do prazo pode demorar a aparecer.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatarPreco } from '@/lib/catalogo/preco';
import { AVISO_EXEMPLO, CODIGO_PIX_EXEMPLO, type PedidoPixExemplo } from '@/lib/loja/exemplos';
import { formatarContagem, segundosRestantes, situacaoExibida } from '@/lib/loja/pix';
import { linkWhatsapp, mensagemPedido } from '@/lib/loja/whatsapp';
import { estiloBotao } from '@/lib/ui/botao';
import { Aviso } from './aviso';
import { BarraAcao } from './barra-acao';
import { NotaExemplo } from './nota-exemplo';
import { EstadoVazio } from './estado-vazio';
import { QrExemplo } from './qr-exemplo';

const ATUALIZA_A_CADA_MS = 10_000;

export function PixVista({ pedido }: { pedido: PedidoPixExemplo }) {
  const router = useRouter();
  const [restante, setRestante] = useState(pedido.segundosRestantes);
  const [jaPaguei, setJaPaguei] = useState(false);
  const [copia, setCopia] = useState<'nao' | 'sim' | 'erro'>('nao');
  const situacao = situacaoExibida(pedido.situacao, restante, jaPaguei);

  // Contagem: o prazo vem do servidor (segundos); aqui só se desconta o relógio local.
  useEffect(() => {
    if (pedido.situacao !== 'aguardando') return;
    const fim = Date.now() + pedido.segundosRestantes * 1000;
    const t = setInterval(() => setRestante(segundosRestantes(fim, Date.now())), 1000);
    return () => clearInterval(t);
  }, [pedido.situacao, pedido.segundosRestantes]);

  // "Atualiza sozinho": enquanto espera, relê o pedido no servidor a cada 10 s.
  useEffect(() => {
    if (situacao !== 'aguardando' && situacao !== 'em-confirmacao') return;
    const t = setInterval(() => router.refresh(), ATUALIZA_A_CADA_MS);
    return () => clearInterval(t);
  }, [situacao, router]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(CODIGO_PIX_EXEMPLO);
      setCopia('sim');
    } catch {
      setCopia('erro');
    }
  }

  const exemplo = <NotaExemplo texto={AVISO_EXEMPLO} />;

  if (situacao === 'pago') {
    return (
      <div className="space-y-4">
        {exemplo}
        <EstadoVazio titulo="Este pedido já foi pago" texto={`O pagamento do pedido nº ${pedido.numero} já foi confirmado. Não é preciso pagar de novo.`}>
          <Link href="/conta" className={estiloBotao('primario')}>Ver minha conta</Link>
        </EstadoVazio>
      </div>
    );
  }

  if (situacao === 'cancelado') {
    return (
      <div className="space-y-4">
        {exemplo}
        <EstadoVazio titulo="Este pedido foi cancelado" texto={`O prazo de pagamento do pedido nº ${pedido.numero} acabou e os itens voltaram para a loja. Monte o carrinho de novo para comprar.`}>
          <Link href="/carrinho" className={estiloBotao('primario')}>Montar o carrinho de novo</Link>
        </EstadoVazio>
      </div>
    );
  }

  if (situacao === 'em-confirmacao') {
    return (
      <div className="space-y-4">
        {exemplo}
        <div className="space-y-2" role="status">
          <h1 className="text-2xl font-bold">Estamos confirmando seu pagamento</h1>
          <p className="text-texto-suave">Isso costuma levar menos de 1 minuto. Não pague de novo: esta página atualiza sozinha.</p>
          <p className="text-sm text-texto-suave">Pedido nº {pedido.numero} · {formatarPreco(pedido.totalCentavos)}</p>
        </div>
        <BarraAcao>
          <a
            href={linkWhatsapp(mensagemPedido(pedido.numero))}
            target="_blank"
            rel="noopener noreferrer"
            className={estiloBotao('primario', 'w-full')}
          >
            Falar no WhatsApp (pedido nº {pedido.numero})<span className="sr-only"> (abre em outra aba)</span>
          </a>
        </BarraAcao>
      </div>
    );
  }

  if (situacao === 'expirado') {
    return (
      <div className="space-y-4">
        {exemplo}
        <h1 className="text-2xl font-bold">O Pix expirou</h1>
        <p className="text-texto-suave">O prazo de 30 minutos acabou.</p>
        <Aviso tipo="atencao" titulo="Você já pagou?">
          Se pagou, espere alguns minutos: vamos confirmar e avisar. Não pague de novo.
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

  return (
    <div className="space-y-4">
      {exemplo}
      <h1 className="text-2xl font-bold">Pague com Pix</h1>
      <p>
        <span className="font-bold">{formatarPreco(pedido.totalCentavos)}</span> · expira em{' '}
        <time role="timer" className="font-bold tabular-nums">{formatarContagem(restante)}</time>
      </p>
      <QrExemplo semente={Number(pedido.numero)} />
      <div className="space-y-1 rounded-md border border-borda bg-superficie p-3">
        <p className="text-sm font-semibold">Pix copia e cola (exemplo)</p>
        <code className="block break-all text-sm select-all">{CODIGO_PIX_EXEMPLO}</code>
      </div>
      <p className="text-sm text-texto-suave">Esta página atualiza sozinha quando o pagamento chegar.</p>
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
