// Guardas do repositório (catracas). Cada uma nasceu de um erro real do catálogo (04).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(__dirname, '..');
const PASTAS = ['app', 'components', 'lib', 'proxy.ts'];

function arquivos(): string[] {
  const saida: string[] = [];
  const andar = (p: string) => {
    const st = statSync(p);
    if (st.isDirectory()) readdirSync(p).forEach((f) => andar(join(p, f)));
    else if (/\.(ts|tsx|css)$/.test(p) && !/\.test\.ts$/.test(p)) saida.push(p);
  };
  PASTAS.forEach((p) => andar(join(RAIZ, p)));
  return saida;
}

// Tira comentários de bloco e de linha (sem confundir com `://` de URL), para a guarda ler só código.
function semComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FONTES = arquivos().map((f) => ({ arquivo: relative(RAIZ, f), texto: readFileSync(f, 'utf8') }));

describe('catracas', () => {
  it('nenhuma cor hex fora de app/globals.css (toda cor vem de token)', () => {
    // Cor hex tem pelo menos uma letra (#fff, #1f4fd1); referência de issue (#12) só tem dígitos.
    const HEX = /#(?=[0-9]*[a-f])[0-9a-f]{3}(?:[0-9a-f]{3})?(?![\w-])/i;
    const achados = FONTES.filter((f) => f.arquivo !== 'app/globals.css' && HEX.test(f.texto.replace(/#conteudo/g, '')));
    expect(achados.map((a) => a.arquivo)).toEqual([]);
  });

  it('nenhum tamanho em px (a interface precisa aguentar 140% de fonte)', () => {
    const achados = FONTES.filter((f) => /\b\d+(\.\d+)?px\b/.test(f.texto)).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });

  it('toda variável de ambiente lida no código está no .env.example', () => {
    const exemplo = readFileSync(join(RAIZ, '.env.example'), 'utf8');
    const declaradas = new Set([...exemplo.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]));
    const lidas = new Set<string>();
    for (const f of FONTES) {
      for (const m of f.texto.matchAll(/process\.env\.([A-Z0-9_]+)/g)) lidas.add(m[1]);
      for (const m of f.texto.matchAll(/ambiente\('([A-Z0-9_]+)'\)/g)) lidas.add(m[1]);
      for (const m of f.texto.matchAll(/variavelPreco:\s*'([A-Z0-9_]+)'/g)) lidas.add(m[1]);
    }
    expect([...lidas].filter((v) => !declaradas.has(v)).sort()).toEqual([]);
  });

  it('toda escrita no banco passa por escrever() ou trata o error na mesma instrução (04, 1.7)', () => {
    const achados: string[] = [];
    for (const f of FONTES) {
      if (f.arquivo === 'lib/supabase/escrever.ts') continue;
      const linhas = f.texto.split('\n');
      linhas.forEach((l, i) => {
        if (!/\.(insert|update|upsert|delete)\(/.test(l) || !/\.from\(|db\.|supabase\./.test(linhas.slice(Math.max(0, i - 2), i + 1).join(' '))) return;
        const janela = linhas.slice(Math.max(0, i - 3), i + 4).join(' ');
        const conferida = /escrever\(/.test(janela) || /\.select\('id'\)/.test(janela) || /const\s*\{[^}]*error[^}]*\}\s*=\s*await/.test(janela);
        if (!conferida) achados.push(`${f.arquivo}:${i + 1}`);
      });
    }
    expect(achados).toEqual([]);
  });

  it('o token de atenção (aviso) só aparece nos usos de aviso, numa lista fechada (04, 6.6; 2ª ocorrência)', () => {
    // Token nomeado pelo papel: "atenção" é aviso (Aviso, "Esgotado" e "Indisponível" no carrinho, status do
    // "adicionado"). Marca e selo usam "destaque". Usos permitidos de text-/border-l-/bg- atencao, por arquivo.
    const PERMITIDOS: Record<string, number> = {
      'components/loja/aviso.tsx': 2,
      'components/loja/carrinho-vista.tsx': 3,
      'components/loja/produto-vista.tsx': 1,
    };
    const USO = /\b(?:text|border(?:-l)?|bg)-atencao\b/g;
    const achados = FONTES.map((f) => ({ arquivo: f.arquivo, n: f.texto.match(USO)?.length ?? 0 }))
      .filter((f) => f.n !== (PERMITIDOS[f.arquivo] ?? 0))
      .map((f) => `${f.arquivo}: ${f.n} uso(s), permitido ${PERMITIDOS[f.arquivo] ?? 0}`);
    expect(achados).toEqual([]);
  });

  it('mensagem crua do banco nunca vai para o usuário', () => {
    const achados = FONTES.filter((f) => f.arquivo.startsWith('app/') && /error\.message|erro\.message/.test(f.texto)).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });

  it('a chave da service_role só é lida em lib/supabase/admin.ts', () => {
    const achados = FONTES.filter((f) => f.texto.includes('SUPABASE_SERVICE_ROLE_KEY') && f.arquivo !== 'lib/supabase/admin.ts').map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });

  it('o access token do Mercado Pago só é lido em lib/pagamentos/config.ts, e o cliente HTTP é server-only (#32)', () => {
    const leem = FONTES.filter((f) => f.texto.includes('MERCADOPAGO_ACCESS_TOKEN') && f.arquivo !== 'lib/pagamentos/config.ts').map((f) => f.arquivo);
    expect(leem).toEqual([]);
    // Todo arquivo que fala com a API do Mercado Pago (ou monta o Bearer) começa com import 'server-only'.
    const semGuarda = FONTES.filter((f) => /api\.mercadopago\.com|accessToken\}/.test(f.texto) && !/^(\/\/.*\n)*import 'server-only';/m.test(f.texto)).map((f) => f.arquivo);
    expect(semGuarda).toEqual([]);
    const telas = FONTES.filter((f) => /^['"]use client['"]/.test(f.texto) && /pagamentos\/(mercadopago|repositorios|config)['"]/.test(f.texto)).map((f) => f.arquivo);
    expect(telas).toEqual([]);
  });

  it("nenhum arquivo 'use client' importa o cliente admin", () => {
    const achados = FONTES.filter((f) => /^['"]use client['"]/.test(f.texto) && /supabase\/admin/.test(f.texto)).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });

  it('toda página sob um layout com guarda de área chama a guarda de novo (04, 2.9)', () => {
    // O layout não re-renderiza na navegação e não impede a página de rodar nem de ir no
    // payload RSC (guia de autenticação do Next 16). A página que lê dado precisa da própria guarda.
    const layouts = FONTES.filter((f) => /(^|\/)layout\.tsx$/.test(f.arquivo) && /entrarNaArea\(/.test(f.texto));
    const achados = FONTES.filter((f) => /(^|\/)page\.tsx$/.test(f.arquivo))
      .filter((f) => layouts.some((l) => f.arquivo.startsWith(l.arquivo.replace(/layout\.tsx$/, ''))))
      .filter((f) => !/entrarNaArea\(/.test(f.texto))
      .map((f) => f.arquivo);
    expect(layouts.length).toBeGreaterThan(0);
    expect(achados).toEqual([]);
  });

  it("o layout e TODA página do painel chamam entrarNaArea('admin') (#21; 04, 2.9)", () => {
    // A guarda genérica acima aceita qualquer área e some se o layout perder a guarda; esta prende
    // o painel na área certa e reprova a remoção da guarda do layout.
    const painel = FONTES.filter((f) => /^app\/admin\/(.*\/)?(layout|page)\.tsx$/.test(f.arquivo));
    const sem = painel.filter((f) => !/entrarNaArea\(\s*'admin'\s*\)/.test(semComentarios(f.texto))).map((f) => f.arquivo);
    expect(painel.map((f) => f.arquivo)).toContain('app/admin/layout.tsx');
    expect(sem).toEqual([]);
  });

  it('o papel nunca vem de user_metadata nem de app_metadata (FIDELIDADE §1, regra 1)', () => {
    const achados = FONTES.filter((f) => /\b(user_metadata|app_metadata|raw_user_meta_data|raw_app_meta_data)\b/.test(semComentarios(f.texto))).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });

  it('o aal é lido com o JWT, que o Auth confere (sem ele, vem do cookie sem conferir)', () => {
    // Toda chamada tem de levar um identificador (o JWT); vazio, undefined, null, void 0 ou um
    // literal reprovam, porque o auth-js cai no cookie sem conferir.
    const achados: string[] = [];
    for (const f of FONTES) {
      for (const m of semComentarios(f.texto).matchAll(/getAuthenticatorAssuranceLevel\(([^)]*)\)/g)) {
        const arg = m[1].trim();
        if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(arg) || arg === 'undefined' || arg === 'null') achados.push(`${f.arquivo}: (${arg})`);
      }
    }
    expect(achados).toEqual([]);
  });

  it('a rota de volta só é montada por lib/seguranca/destino.ts (open redirect; S-07)', () => {
    // O literal `?volta=` e as formas do URLSearchParams: set, append e o objeto do construtor.
    const MONTA_VOLTA = /[?&]volta=|\.(set|append)\(\s*['"`]volta['"`]|URLSearchParams\(\s*\{[^}]*\bvolta\b/;
    const achados = FONTES.filter((f) => f.arquivo !== 'lib/seguranca/destino.ts' && MONTA_VOLTA.test(semComentarios(f.texto))).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });

  it('nenhum log leva e-mail, senha, código digitado ou segredo do autenticador (LGPD; 04, 2.5)', () => {
    const achados: string[] = [];
    // Atalho `{ email }` ou valor `x: codigo` dentro da chamada, mesmo quebrada em várias linhas.
    const atalho = /[{,]\s*(email|senha|password|codigo|token|segredo|secret|qr|qr_code)\s*[,}]/;
    const valor = /:\s*(email|senha|password|codigo|segredo|dados)\s*[,})]/;
    for (const f of FONTES) {
      const codigo = semComentarios(f.texto);
      for (const m of codigo.matchAll(/\blog\.(debug|info|warn|error)\(/g)) {
        const fim = codigo.indexOf(');', m.index);
        const chamada = codigo.slice(m.index, fim < 0 ? undefined : fim + 1);
        if (atalho.test(chamada) || valor.test(chamada)) achados.push(`${f.arquivo}:${codigo.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(achados).toEqual([]);
  });

  it('nenhuma página afirma o usuário com ! (sessão expirada vira erro 500; 04, 2.9)', () => {
    const achados = FONTES.filter((f) => f.arquivo.startsWith('app/') && /\buser!\./.test(f.texto)).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });
});
