import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // `server-only` é tratado pelo próprio Next no build; no Vitest (Node puro) vira o módulo vazio do Next.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'server-only': fileURLToPath(new URL('./node_modules/next/dist/compiled/server-only/empty.js', import.meta.url)),
    },
  },
  test: { environment: 'node', include: ['**/*.test.ts'], exclude: ['node_modules/**', 'e2e/**', '.next/**'] },
});
