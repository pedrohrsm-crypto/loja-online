// Cliente com a service_role: ignora a RLS. Só no servidor, só depois de autorizar quem pede.
// Nunca importar em arquivo com 'use client' (a chave iria para o navegador).
import { createClient } from '@supabase/supabase-js';
import { ambiente } from '@/lib/ambiente';

export function clienteAdmin() {
  return createClient(ambiente('NEXT_PUBLIC_SUPABASE_URL'), ambiente('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
