'use client';

// Apresentação do produto (L2). Recebe o produto por prop: a página lê o catálogo no servidor, e
// este componente só escolhe a variação, mostra o preço dela e põe no carrinho do navegador.
import Link from 'next/link';
import { useId, useState } from 'react';
import { formatarPreco, estaEsgotada } from '@/lib/catalogo/preco';
import type { ProdutoComVariacoes, Variacao } from '@/lib/catalogo/tipos';
import { adicionar } from '@/lib/loja/carrinho';
import { gravarCarrinho, lerCarrinhoAgora } from '@/lib/loja/carrinho-armazenamento';
import { alternativaDisponivel, aromasDe, tamanhosDe, trocarAroma, variacaoInicial } from '@/lib/loja/variacao';
import { linkWhatsapp, mensagemProduto } from '@/lib/loja/whatsapp';
import { estiloBotao } from '@/lib/ui/botao';
import { Aviso } from './aviso';
import { FreteCep } from './frete-cep';

const CHIP =
  'flex min-h-11 min-w-11 items-center justify-center rounded-full border border-borda bg-fundo px-4 py-2 text-center peer-checked:border-2 peer-checked:border-texto peer-checked:font-bold peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foco';

function Escolha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-semibold">{rotulo}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function ProdutoVista({ produto }: { produto: ProdutoComVariacoes }) {
  const id = useId();
  const { variacoes } = produto;
  const [escolhidaId, setEscolhidaId] = useState<string | null>(() => variacaoInicial(variacoes)?.id ?? null);
  const [adicionado, setAdicionado] = useState(false);
  const escolhida = variacoes.find((v) => v.id === escolhidaId) ?? null;
  const alternativa = escolhida ? alternativaDisponivel(variacoes, escolhida) : null;

  function escolher(v: Variacao) {
    setEscolhidaId(v.id);
    setAdicionado(false);
  }

  function colocarNoCarrinho(v: Variacao) {
    gravarCarrinho(
      adicionar(lerCarrinhoAgora(), { variacaoId: v.id, slug: produto.slug, nome: produto.nome, aroma: v.aroma, tamanho: v.tamanho, precoCentavos: v.precoCentavos }, v.estoque),
    );
    setAdicionado(true);
  }

  return (
    <article className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-texto-suave">{produto.categoria.nome}</p>
        <h1 className="text-2xl font-bold">{produto.nome}</h1>
        {escolhida ? (
          <p className="text-xl font-bold" data-testid="preco-produto">
            {formatarPreco(escolhida.precoCentavos)}
          </p>
        ) : null}
      </div>

      <div
        role="img"
        aria-label="Foto do produto em breve"
        className="flex aspect-[16/10] items-center justify-center rounded-md border border-borda bg-superficie text-sm text-texto-suave"
      >
        Foto do produto em breve
      </div>

      <p>{produto.descricao}</p>

      {escolhida ? (
        <div className="space-y-4">
          <Escolha rotulo="Aroma">
            {aromasDe(variacoes).map((aroma) => (
              <label key={aroma} className="block">
                <input
                  type="radio"
                  name={`${id}-aroma`}
                  value={aroma}
                  checked={escolhida.aroma === aroma}
                  onChange={() => escolher(trocarAroma(variacoes, escolhida, aroma))}
                  className="peer sr-only"
                />
                <span className={CHIP}>{aroma}</span>
              </label>
            ))}
          </Escolha>

          <Escolha rotulo="Tamanho">
            {tamanhosDe(variacoes, escolhida.aroma).map((v) => (
              <label key={v.id} className="block">
                <input
                  type="radio"
                  name={`${id}-tamanho`}
                  value={v.id}
                  checked={escolhida.id === v.id}
                  onChange={() => escolher(v)}
                  className="peer sr-only"
                />
                <span className={`${CHIP} ${estaEsgotada(v) ? 'text-texto-suave line-through' : ''}`}>
                  {v.tamanho}
                  {estaEsgotada(v) ? <span className="sr-only"> (esgotado)</span> : null}
                </span>
              </label>
            ))}
          </Escolha>

          {estaEsgotada(escolhida) ? (
            <Aviso tipo="atencao" titulo={`${escolhida.aroma} ${escolhida.tamanho} esgotado`}>
              {alternativa ? `${alternativa.aroma} ${alternativa.tamanho} está disponível.` : 'No momento nenhuma opção deste produto está disponível.'}
            </Aviso>
          ) : (
            <p className="text-sm text-texto-suave">{escolhida.estoque} em estoque</p>
          )}
        </div>
      ) : (
        <Aviso tipo="atencao" titulo="Sem opções à venda agora">
          Este produto está sem tamanho ou aroma disponível no momento. Fale com a gente pelo WhatsApp.
        </Aviso>
      )}

      <FreteCep />

      <section className="space-y-1" aria-labelledby={`${id}-ingredientes`}>
        <h2 id={`${id}-ingredientes`} className="font-semibold">
          Ingredientes
        </h2>
        <p className="text-texto-suave">{produto.ingredientes}</p>
      </section>

      <section className="space-y-1" aria-labelledby={`${id}-uso`}>
        <h2 id={`${id}-uso`} className="font-semibold">
          Modo de uso
        </h2>
        <p className="text-texto-suave">{produto.modoDeUso}</p>
      </section>

      <a
        href={linkWhatsapp(escolhida ? mensagemProduto(produto.nome, escolhida.aroma, escolhida.tamanho) : `Olá! Tenho uma dúvida sobre o produto ${produto.nome}.`)}
        target="_blank"
        rel="noopener noreferrer"
        className={estiloBotao('secundario', 'w-full')}
      >
        Tirar dúvida no WhatsApp<span className="sr-only"> (abre em outra aba)</span>
      </a>

      {escolhida ? (
        <div data-testid="barra-compra" className="sticky bottom-(--altura-navegacao) z-30 -mx-4 space-y-2 border-t border-borda bg-fundo px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              {escolhida.aroma} · {escolhida.tamanho}
            </span>
            <span className="font-bold">{formatarPreco(escolhida.precoCentavos)}</span>
          </div>
          {estaEsgotada(escolhida) ? (
            alternativa ? (
              <button type="button" onClick={() => escolher(alternativa)} className={estiloBotao('primario', 'w-full')}>
                Ver {alternativa.aroma} {alternativa.tamanho}
              </button>
            ) : (
              <button type="button" disabled className={estiloBotao('primario', 'w-full')}>
                Esgotado
              </button>
            )
          ) : (
            <button type="button" onClick={() => colocarNoCarrinho(escolhida)} className={estiloBotao('primario', 'w-full')}>
              Adicionar ao carrinho
            </button>
          )}
          <p role="status" className={adicionado ? 'text-sm text-sucesso' : 'sr-only'}>
            {adicionado ? (
              <>
                Adicionado ao carrinho.{' '}
                <Link href="/carrinho" className="font-semibold underline underline-offset-4">
                  Ver carrinho
                </Link>
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </article>
  );
}
