import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacidade' };

// O TEXTO desta política é do cliente (controlador, na LGPD). O starter traz a estrutura e
// o que o produto faz de verdade; o cliente revisa e assina (módulo Privacidade).
export default function Privacidade() {
  return (
    <article className="max-w-prose space-y-4">
      <h1 className="text-3xl font-bold">Política de privacidade</h1>
      <p className="text-texto-suave">Modelo a ser substituído pelo texto aprovado pelo responsável pelos dados.</p>
      <h2 className="text-xl font-semibold">O que guardamos</h2>
      <ul className="list-disc pl-6">
        <li>E-mail e nome, para a sua conta.</li>
        <li>Pedidos e pagamentos, para cumprir a venda. Os dados do cartão ficam com o processador de pagamento, nunca conosco.</li>
      </ul>
      <h2 className="text-xl font-semibold">Seus direitos</h2>
      <p>Você pode excluir a sua conta a qualquer momento em Minha conta. Os dados pessoais são apagados; o registro da venda fica sem identificação, pelo prazo exigido por lei.</p>
    </article>
  );
}
