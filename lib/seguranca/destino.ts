// Destino depois de entrar (FIDELIDADE.md §1, tela 9 e regra 6; #24). Um lugar só para as duas
// perguntas: "esta rota de volta é segura?" e "para onde vai quem acabou de entrar?". O proxy, a
// guarda de área e as Server Actions de /entrar só chamam daqui.
//
// Open redirect (S-07): o retorno só aceita caminho RELATIVO do próprio site. Recusa `//x` e `/\x`
// (o navegador lê os dois como "outro domínio"), qualquer esquema (`https:`, `javascript:`), espaço
// e caractere de controle (o navegador remove TAB e quebra de linha da URL, e `/\t/mal.com` vira
// `//mal.com`), e o que não for texto.
import { CASA_DO_PAPEL, ehPapel } from './papeis';

/** Cabeçalho da requisição em que o proxy escreve a rota pedida (caminho + busca) para a guarda. */
export const CABECALHO_CAMINHO = 'x-loja-caminho';

/** Volta mais longa que isto não é rota do site: é tentativa de encher o cabeçalho. */
export const LIMITE_VOLTA = 512;

const ORIGEM_FICTICIA = 'https://origem.invalid';

export function destinoSeguro(volta: unknown): string | null {
  if (typeof volta !== 'string') return null;
  if (volta.length === 0 || volta.length > LIMITE_VOLTA) return null;
  if (volta[0] !== '/') return null;
  if (volta[1] === '/' || volta[1] === '\\') return null;
  // Controle (C0, DEL e C1), espaço e barra invertida em qualquer posição.
  if (/[\u0000-\x20\u007f-\u009f\\]/.test(volta)) return null;
  // Segunda opinião do próprio analisador de URL: tem de continuar na mesma origem.
  let url: URL;
  try {
    url = new URL(volta, ORIGEM_FICTICIA);
  } catch {
    return null;
  }
  if (url.origin !== ORIGEM_FICTICIA) return null;
  // `/..//mal.com` normaliza para `//mal.com`: recusa também o que só vira "outro domínio" depois de
  // resolver os pontos. Devolve o texto ORIGINAL, nunca o normalizado.
  if (url.pathname.startsWith('//')) return null;
  return volta;
}

/** As telas de /entrar não são destino: voltar para elas depois de entrar mostraria o login de novo. */
export function ehRotaDeEntrar(caminho: string): boolean {
  return caminho === '/entrar' || caminho.startsWith('/entrar/') || caminho.startsWith('/entrar?') || caminho.startsWith('/entrar#');
}

/**
 * Para onde vai quem acabou de entrar: a rota de origem validada; senão, a casa do papel LIDO NO
 * BANCO (perfis.papel, nunca user_metadata). `null` quando não há volta e o papel não pôde ser lido:
 * quem chama explica, não chuta uma casa (04, 2.2).
 */
export function destinoDepoisDoLogin(p: { volta: unknown; papel: unknown }): string | null {
  const volta = destinoSeguro(p.volta);
  if (volta && !ehRotaDeEntrar(volta)) return volta;
  if (ehPapel(p.papel)) return CASA_DO_PAPEL[p.papel];
  return null;
}

/** Endereço de uma tela de /entrar levando a rota de origem, se ela for segura. */
export function comVolta(tela: string, volta: unknown): string {
  const segura = destinoSeguro(volta);
  if (!segura || ehRotaDeEntrar(segura)) return tela;
  return `${tela}?volta=${encodeURIComponent(segura)}`;
}
