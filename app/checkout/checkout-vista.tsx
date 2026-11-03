'use client';

// Tela 6 — Entrega (#27; wireframe aprovado, tela 6). O CEP do carrinho chega preenchido (A-02); o
// modo de entrega sai das faixas do CEP; na retirada não há endereço (A-08; o do ateliê nunca
// aparece: S-08). Quem cria o pedido é o servidor: recalcula frete e total, confere o catálogo e
// reserva o estoque. Se algo mudou, volta ao carrinho, que marca o item (A-03).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Campo } from '@/components/campo';
import { Aviso } from '@/components/loja/aviso';
import { BarraAcao } from '@/components/loja/barra-acao';
import { EstadoVazio } from '@/components/loja/estado-vazio';
import { FreteCep } from '@/components/loja/frete-cep';
import { formatarPreco } from '@/lib/catalogo/preco';
import type { FreteRegiao } from '@/lib/catalogo/tipos';
import { contarUnidades, situacaoDoItem, subtotalCentavos } from '@/lib/loja/carrinho';
import { useCarrinho } from '@/lib/loja/carrinho-armazenamento';
import { useConferencia } from '@/lib/loja/conferencia';
import { MENSAGEM_FRETE, textoValorFrete } from '@/lib/loja/frete-texto';
import type { ResultadoCriarPedido } from '@/lib/pedidos/criar';
import { exigeEndereco, totalDoPedido } from '@/lib/pedidos/regras';
import { estiloBotao } from '@/lib/ui/botao';
import { criarPedido } from './acoes';

const MENSAGEM_MODO_FORA = 'Este modo de entrega não vale para o CEP informado. Escolha outra opção.';

// "14:32" no fuso do aparelho do comprador.
function hora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function texto(dados: FormData, campo: string): string {
  const v = dados.get(campo);
  return typeof v === 'string' ? v : '';
}

export function CheckoutVista() {
  const router = useRouter();
  const carrinho = useCarrinho();
  const itens = carrinho?.itens ?? null;
  const conferido = useConferencia(itens);
  const [frete, setFrete] = useState<FreteRegiao | null>(null);
  const [resultado, setResultado] = useState<ResultadoCriarPedido | null>(null);
  const [pendente, iniciar] = useTransition();

  if (resultado?.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Pedido reservado</h1>
        <Aviso titulo={`Pedido nº ${resultado.pedidoId.slice(0, 8).toUpperCase()} · ${formatarPreco(resultado.totalCentavos)}`}>
          Separamos os seus itens até as {hora(resultado.expiraEm)}. Nada foi cobrado: o pagamento por Pix ou cartão chega na próxima etapa do projeto.
        </Aviso>
        <BarraAcao>
          <Link href="/" className={estiloBotao('primario', 'w-full')}>
            Voltar ao início
          </Link>
        </BarraAcao>
      </div>
    );
  }

  if (itens === null) {
    return (
      <div role="status" className="space-y-3">
        <h1 className="text-2xl font-bold">Entrega</h1>
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

  const atuais = conferido?.ok ? conferido.atuais : undefined;
  // Esgotou, mudou de preço ou saiu do ar desde o carrinho: volta para lá, com o item marcado (A-03).
  if (atuais && itens.some((i) => situacaoDoItem(i, atuais[i.variacaoId]).tipo !== 'ok')) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Entrega</h1>
        <Aviso tipo="atencao" titulo="Um item mudou desde que você o adicionou">
          Ele esgotou, mudou de preço ou saiu do catálogo. Confira no carrinho antes de continuar.
        </Aviso>
        <BarraAcao>
          <Link href="/carrinho" className={estiloBotao('primario', 'w-full')}>
            Voltar ao carrinho
          </Link>
        </BarraAcao>
      </div>
    );
  }

  const subtotal = subtotalCentavos(itens, atuais);
  const unidades = contarUnidades(itens, atuais);
  const total = totalDoPedido(subtotal, frete?.valorCentavos ?? null);
  const comEndereco = frete ? exigeEndereco(frete.modo) : false;
  const erros = resultado && !resultado.ok && resultado.motivo === 'invalido' ? resultado.erros : {};

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!frete || !itens || !carrinho) return;
    const dados = new FormData(e.currentTarget);
    const entrada = {
      itens: itens.map((i) => ({ variacaoId: i.variacaoId, quantidade: i.quantidade, precoCentavos: i.precoCentavos })),
      cep: carrinho.cep,
      modo: frete.modo,
      telefone: texto(dados, 'telefone'),
      nome: comEndereco ? texto(dados, 'nome') : null,
      endereco: comEndereco ? texto(dados, 'endereco') : null,
    };
    iniciar(async () => {
      let r: ResultadoCriarPedido;
      try {
        r = await criarPedido(entrada);
      } catch {
        r = { ok: false, motivo: 'indisponivel' };
      }
      if (!r.ok && r.motivo === 'mudou') {
        router.push('/carrinho');
        return;
      }
      setResultado(r);
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Entrega</h1>

      {conferido && !conferido.ok ? (
        <Aviso tipo="atencao" titulo="Não conseguimos conferir preço e estoque agora">
          Você pode continuar: conferimos de novo ao reservar os itens.
        </Aviso>
      ) : null}

      {resultado && !resultado.ok && resultado.motivo === 'indisponivel' ? (
        <Aviso tipo="erro" urgente titulo="Não deu para criar o pedido">
          Nada foi cobrado. Tente de novo; se continuar, fale com a gente pelo WhatsApp.
        </Aviso>
      ) : null}
      {resultado && !resultado.ok && resultado.motivo === 'sem-sessao' ? (
        <Aviso tipo="erro" urgente titulo="Sua sessão terminou">
          Entre de novo para continuar. Seu carrinho continua salvo neste aparelho.{' '}
          <Link href="/entrar" className="font-semibold underline underline-offset-4">
            Entrar
          </Link>
        </Aviso>
      ) : null}
      {resultado && !resultado.ok && resultado.motivo === 'frete' ? (
        <Aviso tipo="erro" urgente titulo="Confira a entrega">
          {resultado.frete === 'modo-fora-da-faixa' ? MENSAGEM_MODO_FORA : MENSAGEM_FRETE[resultado.frete]}
        </Aviso>
      ) : null}

      <FreteCep selecionavel aoEscolher={setFrete} />

      <form id="form-entrega" noValidate onSubmit={enviar} className="space-y-4">
        {frete && comEndereco ? (
          <>
            <Campo nome="endereco" rotulo="Endereço" ajuda="Rua, número e complemento." autoComplete="street-address" erro={erros.endereco} obrigatorio />
            <Campo nome="nome" rotulo="Quem recebe" autoComplete="name" erro={erros.nome} obrigatorio />
          </>
        ) : null}
        {frete && !comEndereco ? (
          <p className="text-sm text-texto-suave">Combinamos o dia e o horário pelo WhatsApp depois do pagamento e passamos o endereço por lá.</p>
        ) : null}
        {frete ? (
          <Campo
            nome="telefone"
            rotulo={comEndereco ? 'WhatsApp para contato' : 'WhatsApp para combinar'}
            tipo="tel"
            modoTeclado="tel"
            ajuda="Com DDD. Exemplo: (11) 90000-0000."
            autoComplete="tel"
            erro={erros.telefone}
            obrigatorio
          />
        ) : (
          <p className="text-sm text-texto-suave">Informe o CEP para ver como receber.</p>
        )}
        {erros.itens || erros.cep || erros.modo ? (
          <p role="alert" className="text-sm text-erro">{erros.itens ?? erros.cep ?? erros.modo}</p>
        ) : null}
      </form>

      <dl className="space-y-1">
        <div className="flex justify-between gap-3">
          <dt>{unidades} {unidades === 1 ? 'item' : 'itens'}</dt>
          <dd className="font-semibold">{formatarPreco(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Frete{frete ? ` (${frete.nome})` : ''}</dt>
          <dd className="font-semibold">{frete ? textoValorFrete(frete.valorCentavos) : 'informe o CEP'}</dd>
        </div>
      </dl>

      <BarraAcao testid="barra-total">
        <div className="flex items-baseline justify-between gap-3">
          <strong>{frete ? 'Total' : 'Total sem frete'}</strong>
          <span className="text-lg font-bold">{formatarPreco(total)}</span>
        </div>
        <button type="submit" form="form-entrega" className={estiloBotao('primario', 'w-full')} disabled={!frete || pendente}>
          {pendente ? 'Reservando os itens…' : 'Ir para o pagamento'}
        </button>
      </BarraAcao>
    </div>
  );
}
