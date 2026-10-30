import { LADO_QR, matrizQrExemplo } from '@/lib/loja/qr';

const MARGEM = 4;

// QR DE EXEMPLO (lib/loja/qr.ts): não é lido por aplicativo nenhum e não codifica o código copia e cola.
export function QrExemplo({ semente }: { semente: number }) {
  const matriz = matrizQrExemplo(semente);
  let d = '';
  matriz.forEach((linha, l) => linha.forEach((escuro, c) => {
    if (escuro) d += `M${c + MARGEM} ${l + MARGEM}h1v1h-1z`;
  }));
  const lado = LADO_QR + MARGEM * 2;
  return (
    <div className="mx-auto w-48 max-w-full rounded-md border border-borda bg-qr-fundo p-1">
      <svg viewBox={`0 0 ${lado} ${lado}`} role="img" aria-label="QR code de exemplo do Pix. Não é um código real." className="block h-auto w-full">
        <path d={d} className="fill-qr-ponto" />
      </svg>
    </div>
  );
}
