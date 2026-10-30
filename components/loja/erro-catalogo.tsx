import { Aviso } from './aviso';
import { estiloBotao } from '@/lib/ui/botao';
import { BarraAcao } from './barra-acao';
import { CarrinhoSalvo } from './carrinho-salvo';

export const TEXTO_ERRO_CATALOGO = 'Não conseguimos carregar o catálogo agora. Tente de novo em instantes.';

// Estado de erro honesto: a leitura falhou (ok: false), e a tela diz isso em vez de mostrar uma
// lista vazia como se a loja não tivesse produto. `href` recarrega a mesma página.
export function ErroCatalogo({ href }: { href: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Não foi possível carregar</h1>
      <Aviso tipo="erro" titulo={TEXTO_ERRO_CATALOGO} urgente>
        <CarrinhoSalvo />
      </Aviso>
      <BarraAcao>
        <a href={href} className={estiloBotao('primario')}>
          Tentar de novo
        </a>
      </BarraAcao>
    </div>
  );
}
