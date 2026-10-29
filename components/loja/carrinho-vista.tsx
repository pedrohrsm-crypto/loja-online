'use client';

// Carrinho (L3). Vive no navegador; o catálogo de hoje é conferido por uma Server Action de leitura.
// Sem checkout real: o botão final diz a verdade sobre o que ainda não existe.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatarPreco } from '@/lib/catalogo/preco';
import type { FreteRegiao } from '@/lib/catalogo/tipos';
import { conferirCarrinho, type ResultadoConferencia } from '@/lib/loja/acoes';
import {
  continuarComDisponiveis, contarUnidades, definirQuantidade, QUANTIDADE_MAXIMA, remover,
  situacaoDoItem, subtotalCentavos, tetoDoItem, type Situacao,
} from '@/lib/loja/carrinho';
import { gravarCarrinho, useCarrinho } from '@/lib/loja/carrinho-armazenamento';
import { textoValorFrete } from '@/lib/loja/frete-texto';
import { estiloBotao } from '@/lib/ui/botao';
import { Aviso } from './aviso';
import { EstadoVazio } from './estado-vazio';
import { FreteCep } from './frete-cep';

const OK: Situacao = { tipo: 'ok' };

export function CarrinhoVista() {
  const carrinho = useCarrinho();
  const itens = carrinho?.itens ?? null;
  const [frete, setFrete] = useState<FreteRegiao | null>(null);
  const [mostrarCheckout, setMostrarCheckout] = useState(false);
  const [conferencia, setConferencia] = useState<{ chave: string; resultado: ResultadoConferencia } | null>(null);

  const chave = itens && itens.length > 0 ? [...new Set(itens.map((i) => i.slug))].sort().join(',') : null;
  useEffect(() => {
    if (!chave) return;
    let cancelado = false;
    conferirCarrinho(chave.split(','))
      .then((resultado) => !cancelado && setConferencia({ chave, resultado }))
      // Falha de rede ou da ação: a tela diz que não conferiu; nunca finge que está tudo certo.
      .catch(() => !cancelado && setConferencia({ chave, resultado: { ok: false } }));
    return () => {
      cancelado = true;
    };
  }, [chave]);

  if (itens === null) {
    return (
      <div role="status" className="space-y-3">
        <h1 className="text-2xl font-bold">Carrinho</h1>
        <p className="text-texto-suave">Carregando o seu carrinho…</p>
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <EstadoVazio titulo="Seu carrinho está vazio" texto="Escolha um aroma para começar.">
        <Link href="/" className={estiloBotao('primario')}>
          Ver produtos
        </Link>
      </EstadoVazio>
    );
  }

  const conferido = conferencia?.chave === chave ? conferencia.resultado : null;
  const atuais = conferido?.ok ? conferido.atuais : undefined;
  const situacoes = itens.map((i) => (atuais ? situacaoDoItem(i, atuais[i.variacaoId]) : OK));
  const comProblema = situacoes.some((s) => s.tipo !== 'ok');
  const subtotal = subtotalCentavos(itens, atuais);
  const total = subtotal + (frete?.valorCentavos ?? 0);
  const unidades = contarUnidades(itens);
  const nada = subtotal === 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Carrinho</h1>

      {!carrinho?.persistente ? (
        <Aviso titulo="Este navegador não salva o carrinho">Os itens valem só enquanto esta aba estiver aberta.</Aviso>
      ) : null}

      {conferido && !conferido.ok ? (
        <Aviso tipo="atencao" titulo="Não conseguimos conferir preço e estoque agora">
          Seus itens continuam salvos. Recarregue a página em instantes para conferir de novo.
        </Aviso>
      ) : null}

      {comProblema ? (
        <Aviso tipo="atencao" titulo="Um item mudou desde que você o adicionou">
          Veja as linhas marcadas abaixo.
        </Aviso>
      ) : null}

      <ul className="space-y-3">
        {itens.map((item, indice) => {
          const s = situacoes[indice];
          const teto = tetoDoItem(atuais?.[item.variacaoId]?.estoque ?? QUANTIDADE_MAXIMA);
          const precoUnitario = s.tipo === 'preco-mudou' ? s.precoAgoraCentavos : item.precoCentavos;
          const fora = s.tipo === 'esgotado' || s.tipo === 'indisponivel';
          return (
            <li key={item.variacaoId} className="space-y-2 rounded-md border border-borda p-3">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/produto/${item.slug}`} className="inline-flex min-h-11 min-w-0 items-center underline underline-offset-4">
                  {item.nome} · {item.aroma} · {item.tamanho}
                </Link>
                {fora ? (
                  <span className="shrink-0 font-semibold text-atencao">{s.tipo === 'esgotado' ? 'Esgotado' : 'Indisponível'}</span>
                ) : (
                  <span className="shrink-0 font-bold">{formatarPreco(precoUnitario * item.quantidade)}</span>
                )}
              </div>
              {s.tipo === 'acima-do-estoque' ? (
                <p className="text-sm text-atencao">
                  Só {s.disponivel} {s.disponivel === 1 ? 'unidade disponível' : 'unidades disponíveis'}, e o carrinho tem {item.quantidade}. Use &ldquo;Continuar com o que está disponível&rdquo; ou diminua a quantidade.
                </p>
              ) : null}
              {s.tipo === 'preco-mudou' ? (
                <p className="text-sm text-atencao">
                  {item.quantidade} × {formatarPreco(s.precoAgoraCentavos)} (antes {formatarPreco(s.precoAntesCentavos)})
                </p>
              ) : null}
              {fora ? (
                <p className="text-sm text-texto-suave">
                  {s.tipo === 'esgotado' ? 'Este item esgotou.' : 'Este item saiu do catálogo.'} Remova para continuar.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {!fora ? (
                  <>
                    <button
                      type="button"
                      className={estiloBotao('secundario')}
                      aria-label={`Diminuir a quantidade de ${item.nome} ${item.aroma} ${item.tamanho}`}
                      disabled={item.quantidade <= 1}
                      onClick={() => gravarCarrinho(definirQuantidade(itens, item.variacaoId, item.quantidade - 1, teto))}
                    >
                      −
                    </button>
                    <output aria-label="Quantidade" className="min-w-8 text-center font-semibold">
                      {item.quantidade}
                    </output>
                    <button
                      type="button"
                      className={estiloBotao('secundario')}
                      aria-label={`Aumentar a quantidade de ${item.nome} ${item.aroma} ${item.tamanho}`}
                      disabled={item.quantidade >= teto}
                      onClick={() => gravarCarrinho(definirQuantidade(itens, item.variacaoId, item.quantidade + 1, teto))}
                    >
                      +
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className={estiloBotao('secundario')}
                  aria-label={`Remover ${item.nome} ${item.aroma} ${item.tamanho}`}
                  onClick={() => gravarCarrinho(remover(itens, item.variacaoId))}
                >
                  Remover
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <FreteCep selecionavel aoEscolher={setFrete} />

      <dl className="space-y-1">
        <div className="flex justify-between gap-3">
          <dt>Subtotal ({unidades} {unidades === 1 ? 'item' : 'itens'})</dt>
          <dd className="font-semibold">{formatarPreco(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Frete{frete ? ` (${frete.nome})` : ''}</dt>
          <dd className="font-semibold">{frete ? textoValorFrete(frete.valorCentavos) : 'informe o CEP'}</dd>
        </div>
      </dl>

      {mostrarCheckout ? (
        <Aviso titulo="O pagamento ainda não está disponível">
          Esta é uma versão de demonstração: o checkout e o pagamento chegam nas próximas etapas do projeto. Seus itens continuam salvos neste aparelho.{' '}
          <Link href="/checkout/pagamento/1042" className="font-semibold underline underline-offset-4">
            Ver a tela de pagamento (exemplo)
          </Link>
        </Aviso>
      ) : null}

      <div data-testid="barra-total" className="sticky bottom-(--altura-navegacao) z-30 -mx-4 space-y-2 border-t border-borda bg-fundo px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <strong>{frete ? 'Total' : 'Total sem frete'}</strong>
          <span className="text-lg font-bold">{formatarPreco(total)}</span>
        </div>
        {comProblema && atuais ? (
          <button type="button" className={estiloBotao('primario', 'w-full')} onClick={() => gravarCarrinho(continuarComDisponiveis(itens, atuais))}>
            Continuar com o que está disponível
          </button>
        ) : (
          <button type="button" className={estiloBotao('primario', 'w-full')} disabled={nada} onClick={() => setMostrarCheckout(true)}>
            Finalizar compra
          </button>
        )}
      </div>
    </div>
  );
}
