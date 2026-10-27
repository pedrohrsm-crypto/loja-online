-- Excluir a conta apaga o perfil e mantém o registro de venda sem o titular (módulo Privacidade).
begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000d');
insert into public.pedidos (usuario_id, produto, valor_centavos, status) values ('00000000-0000-0000-0000-00000000000d', 'curso', 1000, 'pago');
delete from auth.users where id = '00000000-0000-0000-0000-00000000000d';
do $$ declare n int; begin
  select count(*) into n from public.perfis where id = '00000000-0000-0000-0000-00000000000d';
  assert n = 0, 'perfil sobrou';
  select count(*) into n from public.pedidos where usuario_id is null and produto = 'curso' and status = 'pago';
  assert n = 1, 'registro de venda sumiu ou manteve o titular';
end $$;
rollback;
