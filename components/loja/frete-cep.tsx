'use client';

// Frete pelo CEP (produto e carrinho). A leitura é uma Server Action sobre lib/catalogo/. O CEP é
// formatado ao sair do campo (blur), nunca a cada tecla, e fica salvo no navegador para o carrinho.
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { calcularFrete, type ResultadoFrete } from '@/lib/loja/acoes';
import { gravarCep, useCarrinho } from '@/lib/loja/carrinho-armazenamento';
import { formatarCepNoBlur, ROTULO_MODO, textoValorFrete } from '@/lib/loja/frete-texto';
import type { FreteRegiao } from '@/lib/catalogo/tipos';
import { normalizarCep } from '@/lib/catalogo/frete';
import { estiloBotao } from '@/lib/ui/botao';

type Props = {
  // No carrinho o comprador escolhe uma das opções; no produto elas só informam.
  selecionavel?: boolean;
  aoEscolher?: (opcao: FreteRegiao | null) => void;
};

export function FreteCep({ selecionavel = false, aoEscolher }: Props) {
  const id = useId();
  const salvo = useCarrinho();
  const [digitado, setDigitado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoFrete | null>(null);
  const [escolhido, setEscolhido] = useState(0);
  const [pendente, iniciar] = useTransition();
  const automatico = useRef(false);
  const valor = digitado ?? salvo?.cep ?? '';

  function calcular(cep: string) {
    iniciar(async () => {
      const r = await calcularFrete(cep);
      setResultado(r);
      setEscolhido(0);
      if (r.ok) gravarCep(formatarCepNoBlur(cep));
      aoEscolher?.(r.ok ? (r.opcoes[0] ?? null) : null);
    });
  }

  // CEP que o comprador já informou antes (outra tela ou outra visita): calcula uma vez sozinho.
  useEffect(() => {
    if (automatico.current || !salvo || !normalizarCep(salvo.cep)) return;
    automatico.current = true;
    calcular(salvo.cep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salvo]);

  return (
    <form
      className="space-y-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const formatado = formatarCepNoBlur(valor);
        setDigitado(formatado);
        calcular(formatado);
      }}
    >
      <label htmlFor={`${id}-cep`} className="block font-medium">
        {selecionavel ? 'CEP para o frete' : 'Frete para o CEP'}
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-cep`}
          name="cep"
          inputMode="numeric"
          autoComplete="postal-code"
          value={valor}
          onChange={(e) => setDigitado(e.target.value)}
          onBlur={(e) => setDigitado(formatarCepNoBlur(e.target.value))}
          aria-describedby={`${id}-ajuda`}
          aria-invalid={resultado && !resultado.ok ? true : undefined}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-borda bg-fundo px-3 text-texto"
        />
        <button type="submit" disabled={pendente} className={estiloBotao('secundario')}>
          {pendente ? 'Calculando…' : 'Calcular'}
        </button>
      </div>
      <p id={`${id}-ajuda`} className="text-sm text-texto-suave">
        Só números. Exemplo: 01310-100.
      </p>
      <div aria-live="polite" className="space-y-1">
        {resultado && !resultado.ok ? <p className="text-sm text-erro">{resultado.mensagem}</p> : null}
        {resultado?.ok ? (
          selecionavel ? (
            <fieldset className="space-y-1">
              <legend className="sr-only">Como receber</legend>
              {resultado.opcoes.map((o, i) => (
                <label key={o.modo} className="flex min-h-11 items-center gap-3 rounded-md border border-borda px-3 py-1">
                  <input
                    type="radio"
                    name={`${id}-frete`}
                    checked={escolhido === i}
                    onChange={() => {
                      setEscolhido(i);
                      aoEscolher?.(o);
                    }}
                    className="size-6 shrink-0 accent-primaria"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block">{ROTULO_MODO[o.modo]}</span>
                    <span className="block text-sm text-texto-suave">{o.prazoTexto}</span>
                  </span>
                  <span className="font-semibold">{textoValorFrete(o.valorCentavos)}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <ul className="space-y-1 text-sm">
              {resultado.opcoes.map((o) => (
                <li key={o.modo}>
                  {ROTULO_MODO[o.modo]} · <span className="font-semibold">{textoValorFrete(o.valorCentavos)}</span> · {o.prazoTexto}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </form>
  );
}
