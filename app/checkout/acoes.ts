'use server';

// Server Action do checkout (tela 6, #27). Toda Server Action é uma entrada pública por POST:
// a sessão é conferida AQUI (não só na página), o id do comprador vem de auth.getUser() e a
// entrada é tratada como não confiável (guia de Server Actions do Next 16, "Security").
// A regra mora em lib/pedidos/; aqui só se ligam as portas reais.
import { lerFretePorCep } from '@/lib/catalogo/ler';
import { criarPedido as criar, type ResultadoCriarPedido } from '@/lib/pedidos/criar';
import { clienteAdmin } from '@/lib/supabase/admin';
import { clienteServidor } from '@/lib/supabase/servidor';

export async function criarPedido(entrada: unknown): Promise<ResultadoCriarPedido> {
  return criar(entrada, {
    usuarioId: async () => {
      const supabase = await clienteServidor();
      const { data, error } = await supabase.auth.getUser();
      // Sessão ausente ou expirada volta como erro do Auth: é "sem sessão", não falha do banco.
      if (error || !data.user) return null;
      return data.user.id;
    },
    lerFrete: (cep) => lerFretePorCep(cep),
    // service_role: só o servidor cria pedido e mexe no estoque (a função recusa anon e authenticated).
    criarNoBanco: async (args) => {
      const { data, error } = await clienteAdmin().rpc('criar_pedido', args);
      return { data, error };
    },
  });
}
