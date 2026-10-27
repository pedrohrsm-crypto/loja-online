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

  it('mensagem crua do banco nunca vai para o usuário', () => {
    const achados = FONTES.filter((f) => f.arquivo.startsWith('app/') && /error\.message|erro\.message/.test(f.texto)).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });

  it('a chave da service_role só é lida em lib/supabase/admin.ts', () => {
    const achados = FONTES.filter((f) => f.texto.includes('SUPABASE_SERVICE_ROLE_KEY') && f.arquivo !== 'lib/supabase/admin.ts').map((f) => f.arquivo);
    expect(achados).toEqual([]);
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

  it('nenhuma página afirma o usuário com ! (sessão expirada vira erro 500; 04, 2.9)', () => {
    const achados = FONTES.filter((f) => f.arquivo.startsWith('app/') && /\buser!\./.test(f.texto)).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });
});
