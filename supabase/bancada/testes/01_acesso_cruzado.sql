-- Cada papel tenta ler e escrever o que é de outro usuário e é recusado (ACEITE.md §2).
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@teste'),
  ('00000000-0000-0000-0000-00000000000b', 'b@teste');
insert into public.pedidos (usuario_id, produto, valor_centavos) values
  ('00000000-0000-0000-0000-00000000000a', 'curso', 1000),
  ('00000000-0000-0000-0000-00000000000b', 'curso', 1000);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); end $$;
do $$
declare n int;
begin
  select count(*) into n from public.perfis;
  assert n = 1, format('A vê %s perfis', n);
  select count(*) into n from public.pedidos;
  assert n = 1, format('A vê %s pedidos', n);
  update public.perfis set nome = 'Ana' where id = '00000000-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  assert n = 0, 'A editou o perfil de B';
  update public.perfis set nome = 'Ana' where id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  assert n = 1, 'A não editou o próprio nome';
  begin
    update public.perfis set papel = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'A virou admin';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.pedidos (usuario_id, produto, valor_centavos) values ('00000000-0000-0000-0000-00000000000a', 'x', 1);
    raise exception 'A criou pedido pelo cliente';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.perfis;
    raise exception 'anon leu perfis';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.pedidos;
    raise exception 'anon leu pedidos';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
