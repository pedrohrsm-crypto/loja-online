import Link from 'next/link';
import { EstadoVazio } from '@/components/loja/estado-vazio';
import { estiloBotao } from '@/lib/ui/botao';

// Produto despublicado, link antigo do Instagram ou slug que não existe (FIDELIDADE.md, tela 4).
// Ainda não há página de categoria (outra frente): "Ver produtos" leva ao início da loja.
export default function ProdutoIndisponivel() {
  return (
    <EstadoVazio titulo="Este produto não está mais à venda" texto="Ele saiu do catálogo. Veja outros produtos da casa.">
      <Link href="/" className={estiloBotao('primario')}>
        Ver produtos
      </Link>
    </EstadoVazio>
  );
}
