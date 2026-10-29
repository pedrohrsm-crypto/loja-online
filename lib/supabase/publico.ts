// Cliente anônimo, sem cookie: para ler o que é público (o catálogo publicado). Não chama
// `cookies()`, então não prende a página ao request; a RLS de anon decide o que volta.
// Para ler o que é do usuário, use clienteServidor().
import { createClient } from '@supabase/supabase-js';
import { ambiente } from '@/lib/ambiente';

export function clientePublico() {
  return createClient(ambiente('NEXT_PUBLIC_SUPABASE_URL'), ambiente('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
