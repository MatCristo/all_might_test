# all-might (teste)

Versão reduzida do painel interno da Telelaudo, usada como teste técnico. Tem
uma única tela, **Integração**: os logs de entrega de laudos (com filtro por
atendimento e empresa e paginação) e o reenvio de um laudo.

Tudo roda localmente: PostgreSQL com dados fictícios e LocalStack no lugar da
AWS. Não há nenhuma configuração para ambientes reais.

## Stack

- **Backend** — Go 1.24, Echo, GORM/PostgreSQL, AWS SDK v2 (Secrets Manager e
  CloudWatch Logs, apontados para o LocalStack), JWT em cookie HttpOnly.
- **Frontend** — React 19 + TypeScript + Vite, React Router, Bootstrap.

## Subindo o ambiente

```bash
docker compose up -d          # Postgres (test_db), LocalStack e o container all_might
```

`test/database/create_database.sql` e `test/localstack/config_localstack.py`
só rodam na criação dos containers. Depois de alterar um deles:
`docker compose down && docker compose up -d`.

**Backend** (dentro do container, porta 1323):

```bash
docker exec -it all_might sh -c "cd /app && go run ."
```

**Frontend** (`frontend/all_might/`, porta 5173):

```bash
npm install
npm run dev
```

Usuários para entrar no painel: `teste.admin@telelaudo.com.br` e
`teste.support@telelaudo.com.br`, senha `teste1234`.

## Testes

```bash
docker exec -it all_might sh -c "cd /app && go test ./..."   # backend (test_application/)
cd frontend/all_might && npm run test                          # frontend (vitest)
```

Cada suíte Go roda dentro de uma transação que é desfeita no fim
(`db.TestInitTransaction` / `db.TestRollback`).

## Estrutura

```
main.go                 inicialização: config → aws → db → auth → rotas
routes/routes.go        todas as rotas e a permissão que cada uma exige
internal/platform/      config, aws (LocalStack), db, auth (JWT/bcrypt), authz, middleware
internal/shared/        models e utils
internal/domain/        user, permission (/api/me), report, company, health
frontend/all_might/     o painel React
test/                   init do Postgres e do LocalStack
test_application/       testes do backend
```
