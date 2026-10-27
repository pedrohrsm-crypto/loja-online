import { entrarNaArea } from '@/lib/seguranca/area';
import { SemAcesso } from '@/components/sem-acesso';

export default async function LayoutAdmin({ children }: LayoutProps<'/admin'>) {
  const { resultado } = await entrarNaArea('admin');
  if (resultado.tipo === 'sem-acesso') return <SemAcesso causa={resultado.causa} />;
  return <>{children}</>;
}
