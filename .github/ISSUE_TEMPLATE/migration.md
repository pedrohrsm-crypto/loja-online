---
name: Migration SQL
about: Mudança de schema, com o checklist de segurança do framework
title: "migration: <o que muda>"
labels: migration
---

**Arquivo:** `supabase/migrations/<timestamp>_<nome>.sql`

## O que muda no schema

## Checklist (05 do framework, seção 3)
- [ ] Prefixo de timestamp único
- [ ] Idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`) e dentro de `BEGIN…COMMIT`
- [ ] Autossuficiente (cria dependências com `IF NOT EXISTS`)
- [ ] Ordem: tabelas e triggers → funções → políticas
- [ ] RLS habilitada em toda tabela nova
- [ ] Privilégio **por coluna** nas tabelas escritas pelo cliente (`REVOKE ALL` + `GRANT (colunas)`)
- [ ] Colunas privilegiadas congeladas por trigger
- [ ] `SECURITY DEFINER` com `REVOKE … FROM anon, public`
- [ ] `ASSERT has_column_privilege` / `has_function_privilege` dentro da migration
- [ ] Prova de RLS terminando em `RAISE EXCEPTION`
- [ ] Código tolera a ausência da coluna nova (42703 / PGRST204)
- [ ] Tipos do banco regenerados

## Aplicação
- [ ] Aplicada em produção **antes** do deploy — data/hora: ____
- [ ] Conferida com `to_regclass` / `information_schema` — resultado: ____
