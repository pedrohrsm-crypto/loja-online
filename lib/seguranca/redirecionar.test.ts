import { describe, expect, it } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { redirecionarComCookies } from './redirecionar';

describe('redirecionar com cookies (04, erro 2.1)', () => {
  it('o redirect leva os cookies renovados', () => {
    const req = new NextRequest('https://exemplo.test/conta');
    const resposta = NextResponse.next();
    resposta.cookies.set('sb-projeto-auth-token', 'novo');
    const r = redirecionarComCookies(req, resposta, '/entrar');
    expect(r.headers.get('location')).toBe('https://exemplo.test/entrar');
    expect(r.cookies.get('sb-projeto-auth-token')?.value).toBe('novo');
  });
});
