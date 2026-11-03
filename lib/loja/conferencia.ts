'use client';

// Conferência do carrinho contra o catálogo de hoje (preço, estoque, publicado), usada pelo
// carrinho (tela 5) e pela entrega (tela 6). `null` enquanto confere. Falha de rede ou da ação
// volta { ok: false }: a tela diz que não conferiu, nunca finge que está tudo certo.
import { useEffect, useState } from 'react';
import { conferirCarrinho, type ResultadoConferencia } from './acoes';
import type { ItemCarrinho } from './carrinho';

export function useConferencia(itens: readonly ItemCarrinho[] | null): ResultadoConferencia | null {
  const [conferencia, setConferencia] = useState<{ chave: string; resultado: ResultadoConferencia } | null>(null);
  const chave = itens && itens.length > 0 ? [...new Set(itens.map((i) => i.slug))].sort().join(',') : null;
  useEffect(() => {
    if (!chave) return;
    let cancelado = false;
    conferirCarrinho(chave.split(','))
      .then((resultado) => !cancelado && setConferencia({ chave, resultado }))
      .catch(() => !cancelado && setConferencia({ chave, resultado: { ok: false } }));
    return () => {
      cancelado = true;
    };
  }, [chave]);
  return conferencia?.chave === chave ? conferencia.resultado : null;
}
