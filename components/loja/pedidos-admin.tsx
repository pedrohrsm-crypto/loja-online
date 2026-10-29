'use client';

// Painel de pedidos da dona (L5), em cartões, pagos primeiro. As ações são SÓ VISUAIS nesta frente:
// mudam o estado na tela e não gravam nada (dados de exemplo em lib/loja/exemplos.ts). Quando houver
// pedido de verdade, as transições logísticas e o estorno viram Server Actions com guarda de papel.
import { useId, useState } from 'react';
import { formatarPreco } from '@/lib/catalogo/preco';
import { AVISO_EXEMPLO_ADMIN } from '@/lib/loja/exemplos';
import {
  contarPorStatus, exigeRastreio, filtrarPedidos, normalizarRastreio, proximoStatus, ROTULO_ACAO, ROTULO_STATUS,
  textoHa, validarRastreio, type FiltroPedidos, type PedidoPainel, type StatusPedido,
} from '@/lib/loja/pedidos';
import { ROTULO_MODO } from '@/lib/loja/frete-texto';
import { linkWhatsapp, mensagemPedido } from '@/lib/loja/whatsapp';
import { estiloBotao } from '@/lib/ui/botao';
import { Aviso } from './aviso';
import { NotaExemplo } from './nota-exemplo';


const FILTROS: Array<{ valor: FiltroPedidos; rotulo: string; status?: StatusPedido }> = [
  { valor: 'pago', rotulo: 'Pagos', status: 'pago' },
  { valor: 'separado', rotulo: 'Separados', status: 'separado' },
  { valor: 'enviado', rotulo: 'Enviados', status: 'enviado' },
  { valor: 'entregue', rotulo: 'Entregues', status: 'entregue' },
  { valor: 'todos', rotulo: 'Todos' },
];

function CartaoPedido({ pedido, aoAvancar, aoEstornar }: {
  pedido: PedidoPainel;
  aoAvancar: (numero: string, para: StatusPedido) => void;
  aoEstornar: (numero: string) => void;
}) {
  const id = useId();
  const [rastreio, setRastreio] = useState('');
  const [erroRastreio, setErroRastreio] = useState<string | null>(null);
  const [estornando, setEstornando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erroMotivo, setErroMotivo] = useState<string | null>(null);
  const proximo = proximoStatus(pedido.status);
  const valor = formatarPreco(pedido.totalCentavos);
  const podeEstornar = pedido.status !== 'estornado';

  function avancar() {
    if (!proximo) return;
    if (exigeRastreio(pedido)) {
      const r = validarRastreio(rastreio);
      if (!r.ok) {
        setErroRastreio(r.erro);
        return;
      }
    }
    setErroRastreio(null);
    aoAvancar(pedido.numero, proximo);
  }

  function confirmarEstorno() {
    if (motivo.trim() === '') {
      setErroMotivo('Informe o motivo do estorno.');
      return;
    }
    aoEstornar(pedido.numero);
  }

  return (
    <li className="space-y-3 rounded-md border border-borda p-3">
      <div className="flex items-baseline justify-between gap-3">
        <strong>Nº {pedido.numero}</strong>
        <span className="font-bold">{valor}</span>
      </div>
      <p className="text-sm text-texto-suave">
        {pedido.cliente} · {ROTULO_MODO[pedido.modo]}
      </p>
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-texto-suave">
        <span className="rounded-full border border-borda px-2 py-0.5 font-semibold text-texto">{ROTULO_STATUS[pedido.status]}</span>
        <span>{textoHa(pedido.pagoHaMinutos)}</span>
      </p>
      {exigeRastreio(pedido) ? (
        <div className="space-y-1">
          <label htmlFor={`${id}-rastreio`} className="block font-medium">Código de rastreio dos Correios</label>
          <input
            id={`${id}-rastreio`}
            value={rastreio}
            onChange={(e) => setRastreio(e.target.value)}
            onBlur={(e) => setRastreio(normalizarRastreio(e.target.value))}
            autoCapitalize="characters"
            autoComplete="off"
            aria-invalid={erroRastreio ? true : undefined}
            aria-describedby={erroRastreio ? `${id}-erro-rastreio` : undefined}
            className="min-h-11 w-full rounded-md border border-borda bg-fundo px-3 text-texto"
          />
          {erroRastreio ? <p id={`${id}-erro-rastreio`} className="text-sm text-erro">{erroRastreio}</p> : null}
        </div>
      ) : null}

      {proximo ? (
        <button type="button" className={estiloBotao('primario', 'w-full')} onClick={avancar}>
          {ROTULO_ACAO[pedido.status]}
        </button>
      ) : null}

      <ul className="text-sm">
        {pedido.itens.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>

      {pedido.modo !== 'correios' && pedido.status !== 'entregue' && pedido.status !== 'estornado' ? (
        <a href={linkWhatsapp(mensagemPedido(pedido.numero))} target="_blank" rel="noopener noreferrer" className={estiloBotao('secundario', 'w-full')}>
          Combinar {pedido.modo === 'retirada' ? 'retirada' : 'entrega'} no WhatsApp<span className="sr-only"> (pedido nº {pedido.numero}, abre em outra aba)</span>
        </a>
      ) : null}

      {podeEstornar && !estornando ? (
        <button type="button" className={estiloBotao('perigo-contorno', 'w-full')} onClick={() => setEstornando(true)}>
          Estornar pagamento<span className="sr-only"> do pedido nº {pedido.numero}</span>
        </button>
      ) : null}

      {estornando ? (
        <div className="space-y-3 rounded-md border-2 border-perigo p-3">
          <h3 className="font-bold">Estornar o pedido nº {pedido.numero}?</h3>
          <Aviso tipo="atencao" titulo={`O valor total de ${valor} volta para quem pagou`}>
            No Pix, cai na conta de quem pagou. Esta ação não pode ser desfeita.
          </Aviso>
          <div className="space-y-1">
            <label htmlFor={`${id}-motivo`} className="block font-medium">Motivo</label>
            <input
              id={`${id}-motivo`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-invalid={erroMotivo ? true : undefined}
              aria-describedby={erroMotivo ? `${id}-erro-motivo` : undefined}
              className="min-h-11 w-full rounded-md border border-borda bg-fundo px-3 text-texto"
            />
            {erroMotivo ? <p id={`${id}-erro-motivo`} className="text-sm text-erro">{erroMotivo}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={estiloBotao('secundario')} onClick={() => { setEstornando(false); setErroMotivo(null); }}>
              Cancelar
            </button>
            <button type="button" className={estiloBotao('perigo')} onClick={confirmarEstorno}>
              Sim, estornar {valor}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function PedidosAdmin({ pedidos: iniciais }: { pedidos: readonly PedidoPainel[] }) {
  const [pedidos, setPedidos] = useState<PedidoPainel[]>([...iniciais]);
  const [filtro, setFiltro] = useState<FiltroPedidos>('pago');
  const [aviso, setAviso] = useState('');
  const visiveis = filtrarPedidos(pedidos, filtro);

  function avancar(numero: string, para: StatusPedido) {
    setPedidos((atual) => atual.map((p) => (p.numero === numero ? { ...p, status: para } : p)));
    setAviso(`Pedido nº ${numero} marcado como "${ROTULO_STATUS[para].toLowerCase()}". Exemplo: nada foi gravado.`);
  }

  function estornar(numero: string) {
    setPedidos((atual) => atual.map((p) => (p.numero === numero ? { ...p, status: 'estornado' } : p)));
    setAviso(`Estorno do pedido nº ${numero} simulado. Exemplo: nada foi enviado ao Mercado Pago.`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pedidos</h1>
      <NotaExemplo rotulo="Dados de exemplo." texto={AVISO_EXEMPLO_ADMIN} />

      {/* Uma fileira que rola de lado: quatro fileiras de filtro empurrariam o primeiro pedido para fora da tela. */}
      <div role="group" aria-label="Filtrar por status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            aria-pressed={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
            className={`min-h-11 min-w-11 shrink-0 rounded-full border px-4 py-2 ${filtro === f.valor ? 'border-2 border-texto font-bold' : 'border-borda'}`}
          >
            {f.rotulo}
            {f.status ? ` (${contarPorStatus(pedidos, f.status)})` : ''}
          </button>
        ))}
      </div>

      <p role="status" className={aviso ? 'text-sm text-sucesso' : 'sr-only'}>{aviso}</p>

      {visiveis.length === 0 ? (
        <div className="space-y-1 rounded-md border border-borda bg-superficie p-4 text-center">
          <h2 className="text-lg font-bold">Nenhum pedido neste filtro</h2>
          <p className="text-texto-suave">Quando entrar um pedido pago, ele aparece aqui.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((p) => (
            <CartaoPedido key={`${p.numero}-${p.status}`} pedido={p} aoAvancar={avancar} aoEstornar={estornar} />
          ))}
        </ul>
      )}
    </div>
  );
}
