'use client';

// Carrinho no navegador (localStorage), lido com useSyncExternalStore. Todo acesso ao storage tem
// try/catch: navegador interno do Instagram, modo privado ou cota cheia não derrubam a tela; nesses
// casos o carrinho vive na memória da aba e `persistente` avisa a tela.
import { useSyncExternalStore } from 'react';
import { lerCarrinhoSeguro, type ItemCarrinho } from './carrinho';

const CHAVE_CARRINHO = 'alecrim:carrinho:v1';
const CHAVE_CEP = 'alecrim:cep:v1';

type Estado = { itens: ItemCarrinho[]; cep: string; persistente: boolean };

let memoria: { itens: ItemCarrinho[]; cep: string } = { itens: [], cep: '' };
let persistente = true;
let cache: { texto: string | null; cep: string; estado: Estado } | null = null;
const ouvintes = new Set<() => void>();

function lerStorage(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    persistente = false;
    return null;
  }
}

function gravarStorage(chave: string, valor: string): void {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    persistente = false;
  }
}

function avisar(): void {
  ouvintes.forEach((f) => f());
}

function instantaneo(): Estado {
  const texto = lerStorage(CHAVE_CARRINHO);
  const cep = lerStorage(CHAVE_CEP) ?? memoria.cep;
  // Com storage indisponível, vale o que está na memória da aba.
  const fonte = persistente ? texto : JSON.stringify(memoria.itens);
  if (cache && cache.texto === fonte && cache.cep === cep && cache.estado.persistente === persistente) return cache.estado;
  const itens = persistente ? lerCarrinhoSeguro(texto) : memoria.itens;
  cache = { texto: fonte, cep, estado: { itens, cep, persistente } };
  return cache.estado;
}

function assinar(f: () => void): () => void {
  ouvintes.add(f);
  window.addEventListener('storage', f);
  return () => {
    ouvintes.delete(f);
    window.removeEventListener('storage', f);
  };
}

// `null` no servidor e na primeira renderização do navegador: a tela mostra "carregando", e não
// "carrinho vazio" (que seria mentira para quem tem itens salvos).
export function useCarrinho(): Estado | null {
  return useSyncExternalStore(assinar, instantaneo, () => null);
}

export function gravarCarrinho(itens: ItemCarrinho[]): void {
  memoria = { ...memoria, itens };
  gravarStorage(CHAVE_CARRINHO, JSON.stringify(itens));
  avisar();
}

export function lerCarrinhoAgora(): ItemCarrinho[] {
  return instantaneo().itens;
}

export function gravarCep(cep: string): void {
  memoria = { ...memoria, cep };
  gravarStorage(CHAVE_CEP, cep);
  avisar();
}
