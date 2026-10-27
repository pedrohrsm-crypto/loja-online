-- A reserva de evento do webhook: nova, em andamento, recuperada, duplicada; e só o servidor chama.
begin;
set local role service_role;
do $$ begin
  assert public.reservar_evento_pagamento('evt_1', 'x') = 'reservado', 'primeira reserva';
  assert public.reservar_evento_pagamento('evt_1', 'x') = 'em-andamento', 'reserva recente';
  update public.eventos_pagamento set reservado_em = now() - interval '10 minutes' where id = 'evt_1';
  assert public.reservar_evento_pagamento('evt_1', 'x') = 'recuperado', 'reserva parada';
  update public.eventos_pagamento set processado_em = now() where id = 'evt_1';
  assert public.reservar_evento_pagamento('evt_1', 'x') = 'duplicado', 'evento concluído';
end $$;
reset role;
set local role authenticated;
do $$ begin
  perform public.reservar_evento_pagamento('evt_2', 'x');
  raise exception 'authenticated reservou evento';
exception when insufficient_privilege then null;
end $$;
rollback;
