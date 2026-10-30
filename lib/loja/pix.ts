// Regras puras da tela de Pix (L4): contagem de 30 minutos e a situação que a tela mostra.
export const PRAZO_PIX_SEGUNDOS = 30 * 60;

export type SituacaoPix = 'aguardando' | 'em-confirmacao' | 'expirado' | 'pago' | 'cancelado';

// Segundos que faltam até `expiraEmMs`, nunca negativo.
export function segundosRestantes(expiraEmMs: number, agoraMs: number): number {
  return Math.max(0, Math.ceil((expiraEmMs - agoraMs) / 1000));
}

// "29:41". Minutos passam de 59 sem virar hora: o prazo é de 30 minutos.
export function formatarContagem(segundos: number): string {
  const s = Math.max(0, Math.trunc(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// O que a tela mostra: o Pix aguardando vira "expirado" quando a contagem zera. Quem pagou no
// limite e ainda não foi confirmado fica "em confirmação": nunca volta a pedir pagamento.
export function situacaoExibida(servidor: SituacaoPix, restante: number, jaPaguei: boolean): SituacaoPix {
  if (servidor === 'aguardando' && restante <= 0) return jaPaguei ? 'em-confirmacao' : 'expirado';
  if (servidor === 'expirado' && jaPaguei) return 'em-confirmacao';
  return servidor;
}
