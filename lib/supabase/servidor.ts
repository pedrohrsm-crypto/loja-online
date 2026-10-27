// Cliente do Supabase para Server Components, Server Actions e Route Handlers (Next 16:
// `cookies()` é assíncrono). Em Server Component o `set` falha e é ignorado: quem renova a
// sessão é o proxy.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ambiente } from '@/lib/ambiente';

export async function clienteServidor() {
  const loja = await cookies();
  return createServerClient(ambiente('NEXT_PUBLIC_SUPABASE_URL'), ambiente('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    cookies: {
      getAll: () => loja.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => loja.set(name, value, options));
        } catch {
          // Server Component: sem escrita de cookie; o proxy renova.
        }
      },
    },
  });
}
