import type { NextConfig } from 'next';

// Cabeçalhos de segurança (módulo Segurança). A CSP estrita fica para o trabalho que precisar:
// ela depende dos scripts de terceiros do cliente (analytics, chat) e quebra fácil.
const CABECALHOS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: CABECALHOS }];
  },
};

export default nextConfig;
