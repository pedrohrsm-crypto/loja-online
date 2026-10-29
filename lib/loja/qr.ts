// Imagem de QR DE EXEMPLO, gerada aqui, sem serviço externo. NÃO é um QR de Pix válido nem
// codifica o código copia e cola: tem os três marcadores de canto de um QR (21 × 21 módulos) e
// miolo pseudoaleatório fixo. O Pix real chega com a Orders API do Mercado Pago (Dias 2 e 3).
export const LADO_QR = 21;

function marcador(l: number, c: number, l0: number, c0: number): boolean | null {
  const dl = l - l0;
  const dc = c - c0;
  if (dl < -1 || dl > 7 || dc < -1 || dc > 7) return null;
  if (dl === -1 || dl === 7 || dc === -1 || dc === 7) return false; // faixa clara ao redor
  const borda = dl === 0 || dl === 6 || dc === 0 || dc === 6;
  const centro = dl >= 2 && dl <= 4 && dc >= 2 && dc <= 4;
  return borda || centro;
}

export function matrizQrExemplo(semente: number): boolean[][] {
  let x = (Math.trunc(semente) >>> 0) || 1;
  const proximo = () => {
    // xorshift32: determinístico, o mesmo pedido sempre desenha a mesma imagem.
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
  const m: boolean[][] = [];
  for (let l = 0; l < LADO_QR; l++) {
    const linha: boolean[] = [];
    for (let c = 0; c < LADO_QR; c++) {
      const cantos = marcador(l, c, 0, 0) ?? marcador(l, c, 0, LADO_QR - 7) ?? marcador(l, c, LADO_QR - 7, 0);
      linha.push(cantos ?? proximo() % 2 === 0);
    }
    m.push(linha);
  }
  return m;
}
