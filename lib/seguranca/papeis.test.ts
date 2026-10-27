// Os papéis moram em dois lugares por necessidade: na configuração (lib/seguranca/papeis.ts) e
// no CHECK da tabela perfis, que o banco precisa validar sozinho. Esta guarda impede que os dois
// divirjam (achado do piloto-a: renomear um papel exigiu mexer em 4 arquivos).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CASA_DO_PAPEL, PAPEIS } from './papeis';

const MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'migrations');

describe('papéis', () => {
  it('o CHECK de perfis.papel na migration tem exatamente os papéis da configuração', () => {
    const sql = readdirSync(MIGRATIONS).sort().map((f) => readFileSync(join(MIGRATIONS, f), 'utf8')).join('\n');
    const m = sql.match(/papel\s+text[^,]*check\s*\(\s*papel\s+in\s*\(([^)]*)\)/i);
    expect(m, 'CHECK de papel não encontrado').not.toBeNull();
    const doBanco = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    expect(doBanco).toEqual([...PAPEIS].sort());
  });

  it('todo papel tem uma casa', () => {
    for (const p of PAPEIS) expect(CASA_DO_PAPEL[p]).toMatch(/^\//);
  });
});
