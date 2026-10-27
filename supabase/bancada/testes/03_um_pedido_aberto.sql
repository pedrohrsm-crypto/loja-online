-- Duas abas não abrem dois pedidos do mesmo produto; depois de pago, pode comprar de novo.
begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000c');
insert into public.pedidos (usuario_id, produto, valor_centavos) values ('00000000-0000-0000-0000-00000000000c', 'curso', 1000);
do $$ begin
  begin
    insert into public.pedidos (usuario_id, produto, valor_centavos) values ('00000000-0000-0000-0000-00000000000c', 'curso', 1000);
    raise exception 'dois pedidos abertos';
  exception when unique_violation then null;
  end;
  update public.pedidos set status = 'pago', pago_em = now() where usuario_id = '00000000-0000-0000-0000-00000000000c';
  insert into public.pedidos (usuario_id, produto, valor_centavos) values ('00000000-0000-0000-0000-00000000000c', 'curso', 1000);
end $$;
rollback;
