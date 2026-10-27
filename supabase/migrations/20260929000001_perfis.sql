-- Módulo Segurança: perfis com papel. RLS protege LINHAS, não colunas (04, erros 1.4 e 1.5):
-- o usuário edita o próprio nome, mas nunca o próprio papel, por GRANT por coluna.
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '' check (char_length(nome) <= 120),
  papel text not null default 'cliente' check (papel in ('cliente', 'admin')),
  criado_em timestamptz not null default now()
);

alter table public.perfis enable row level security;
revoke all on public.perfis from anon, authenticated;
grant select on public.perfis to authenticated;
grant update (nome) on public.perfis to authenticated;

-- `(select auth.uid())` em vez de `auth.uid()`: avaliado uma vez por consulta, não por linha.
create policy perfis_ler_o_proprio on public.perfis
  for select to authenticated using (id = (select auth.uid()));
create policy perfis_editar_o_proprio on public.perfis
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create function public.criar_perfil() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id) values (new.id);
  return new;
end $$;
-- REVOKE de PUBLIC não basta no Supabase: os privilégios padrão dão EXECUTE a anon (04, 1.6).
revoke execute on function public.criar_perfil() from public, anon, authenticated;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil();

do $$ begin
  assert not has_table_privilege('anon', 'public.perfis', 'select'), 'anon lê perfis';
  assert not has_table_privilege('authenticated', 'public.perfis', 'insert'), 'authenticated cria perfil';
  assert not has_table_privilege('authenticated', 'public.perfis', 'delete'), 'authenticated apaga perfil';
  assert not has_column_privilege('authenticated', 'public.perfis', 'papel', 'update'), 'authenticated muda o próprio papel';
  assert has_column_privilege('authenticated', 'public.perfis', 'nome', 'update'), 'authenticated não consegue editar o nome';
  assert not has_function_privilege('anon', 'public.criar_perfil()', 'execute'), 'anon executa criar_perfil';
  assert not has_function_privilege('authenticated', 'public.criar_perfil()', 'execute'), 'authenticated executa criar_perfil';
end $$;
