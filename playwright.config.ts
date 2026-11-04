import { defineConfig, devices } from '@playwright/test';

// A suíte inteira roda sempre: quem decide o que roda é este arquivo, não a linha de comando.
// Porta isolada por variável (E2E_PORTA), para duas frentes rodarem a suíte na mesma máquina sem
// uma reaproveitar o servidor da outra: com E2E_PORTA definida, nunca reaproveita.
const PORTA = Number(process.env.E2E_PORTA ?? 3100);
const REUSAR_SERVIDOR = !process.env.CI && !process.env.E2E_PORTA;
// O e2e nunca fala com um Supabase de verdade: e2e/apoio/supabase-falso.mjs responde o catálogo, o
// frete e a guarda de papel com dados fictícios (o código real de lib/catalogo/ roda por cima), e
// e2e/apoio/desviar-supabase.cjs leva para ele toda chamada a *.supabase.co do servidor.
const PORTA_SUPABASE_FALSO = PORTA + 1;
const URL_SUPABASE_FALSO = `http://127.0.0.1:${PORTA_SUPABASE_FALSO}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${PORTA}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
    { name: 'computador', use: { ...devices['Desktop Chrome'] } },
    { name: 'escuro', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
  ],
  webServer: [
    {
      command: 'node e2e/apoio/supabase-falso.mjs',
      url: `${URL_SUPABASE_FALSO}/saude`,
      reuseExistingServer: REUSAR_SERVIDOR,
      timeout: 15_000,
      env: { SUPABASE_FALSO_PORTA: String(PORTA_SUPABASE_FALSO) },
    },
    {
      command: `npm run start -- -p ${PORTA}`,
      url: `http://127.0.0.1:${PORTA}`,
      reuseExistingServer: REUSAR_SERVIDOR,
      timeout: 60_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://exemplo.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'anon-de-teste',
        // O checkout chama criar_pedido com a service_role; o Supabase falso não confere a chave.
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-de-teste',
        NODE_OPTIONS: '--require ./e2e/apoio/desviar-supabase.cjs',
        SUPABASE_FALSO_PORTA: String(PORTA_SUPABASE_FALSO),
      },
    },
  ],
});
