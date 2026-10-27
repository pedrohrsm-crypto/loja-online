# Runbook — backup e restauração

**Regra:** backup só vale depois de restaurado uma vez. A data da última restauração testada fica no fim deste arquivo.

## Backup
- Plano com backup automático: confira no painel do Supabase a retenção do plano do cliente.
- Plano gratuito (sem backup automático): `pg_dump` semanal da string de conexão do projeto, guardado **na conta do cliente**:
  `pg_dump "$URL" --no-owner --format=custom --file=backup-AAAA-MM-DD.dump`

## Restaurar (ensaio num projeto vazio, nunca por cima da produção)
1. Crie um projeto novo vazio.
2. `pg_restore --no-owner --dbname="$URL_DO_PROJETO_VAZIO" backup-AAAA-MM-DD.dump`
3. Confira: contagem de linhas das tabelas principais igual à da produção no dia do backup.
4. Anote abaixo e apague o projeto de ensaio.

| Data | Backup usado | Tabelas conferidas | Quem |
|---|---|---|---|
