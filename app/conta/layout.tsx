import { entrarNaArea } from '@/lib/seguranca/area';
import { SemAcesso } from '@/components/sem-acesso';

export default async function LayoutConta({ children }: LayoutProps<'/conta'>) {
  const { resultado } = await entrarNaArea('cliente');
  if (resultado.tipo === 'sem-acesso') return <SemAcesso causa={resultado.causa} />;
  return <>{children}</>;
}
