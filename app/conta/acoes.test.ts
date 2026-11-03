import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bancoFalso, tem, type Passo } from '@/lib/pedidos/banco-falso.apoio';

// A Server Action real, com o Supabase e o Next trocados por falsos.
const estado = vi.hoisted(() => ({ ordem: [] as string[], admin: null as unknown, falhaCancelar: false }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock('@/lib/supabase/servidor', () => ({
  clienteServidor: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }), signOut: async () => ({}) } }),
}));
vi.mock('@/lib/supabase/admin', () => ({ clienteAdmin: () => estado.admin }));
vi.spyOn(console, 'error').mockImplementation(() => {});

const { excluirConta } = await import('./acoes');

function confirmacao(): FormData {
  const f = new FormData();
  f.set('confirmacao', 'EXCLUIR');
  return f;
}

describe('excluirConta (B1)', () => {
  let b: ReturnType<typeof bancoFalso>;
  beforeEach(() => {
    estado.ordem = [];
    b = bancoFalso((cadeia: Passo[]) => {
      estado.ordem.push(cadeia.some(([m]) => m === 'update') ? 'update-legado' : 'ler-com-itens');
      return { data: cadeia.some(([m]) => m === 'update') ? [] : [{ id: 'p1' }], error: null };
    });
    b.aoChamar((fn) => {
      estado.ordem.push(fn);
      return estado.falhaCancelar ? { data: null, error: { code: '42501', message: 'x' } } : { data: true, error: null };
    });
    const db = b.db as unknown as { auth: { admin: { deleteUser: () => Promise<unknown> } } };
    db.auth.admin.deleteUser = async () => (estado.ordem.push('excluir-usuario'), { error: null });
    estado.admin = db;
    estado.falhaCancelar = false;
  });

  it('cancela o pedido com itens pela função que devolve a reserva ANTES de tudo; o UPDATE do starter só pega produto único', async () => {
    await expect(excluirConta({}, confirmacao())).rejects.toThrow('redirect:/?conta=excluida');
    expect(estado.ordem).toEqual(['ler-com-itens', 'cancelar_pedido_aberto', 'update-legado', 'excluir-usuario']);
    const legado = b.consultas.find((c) => c.some(([m]) => m === 'update'));
    expect(legado && tem(legado, 'not', 'produto', 'is', null)).toBe(true);
  });

  it('falha ao devolver a reserva: a conta NÃO é excluída', async () => {
    estado.falhaCancelar = true;
    expect(await excluirConta({}, confirmacao())).toEqual({ erro: 'Não foi possível excluir a conta agora. Tente de novo.' });
    expect(estado.ordem).not.toContain('excluir-usuario');
    expect(estado.ordem).not.toContain('update-legado');
  });
});
