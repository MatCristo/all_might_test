# CLAUDE.md

This repository is a reduced copy of the Telelaudo panel (`all-might`), used as a technical hiring test. It keeps two screens — **Integração** (report delivery logs and resend) and **Status das aplicações** (the background applications' `ExecucaoNoPrazo` metric) — plus login and password change. Everything runs locally against seeded PostgreSQL and LocalStack; there is no production configuration and none should be added.

## Commands

```bash
docker compose up -d                                              # test_db, LocalStack, all_might container
docker exec -it all_might sh -c "cd /app && go test ./..."        # backend tests (test_application/)
docker exec -it all_might sh -c "cd /app && go run ."             # API on :1323
go build ./... && go vet ./...
```

Frontend, from `frontend/all_might/`: `npm run dev` (:5173), `npm run build`, `npm run lint`, `npm run test`.

`test/database/create_database.sql` and `test/localstack/config_localstack.py` are container init scripts: after changing either, `docker compose down && docker compose up -d`.

## Architecture

Go REST API on Echo, organized by domain under `internal/`.

- **Startup** (`main.go`): `config.Init()` → `aws.Init()` → `db.Init()` → `auth.Init()` → routes → `appstatus.StartRefresher()`.
- `internal/platform/`
  - `config` — env vars (`ALLOW_ORIGIN`, `COOKIE_SECURE_MODE`).
  - `aws` — Secrets Manager, CloudWatch Logs and CloudWatch (metrics) clients, always pointed at LocalStack (`https://localhost.localstack.cloud:4566`). DB credentials and the JWT secret come from the LocalStack secret `allMightJson`.
  - `db` — two GORM connections: `DBClinux` (database `test`) and `DBTIApplications` (`ti_applications`), plus the test transaction helpers.
  - `auth` — JWT (HS256) and bcrypt; `SessionLifetime` drives both the token `exp` and the cookie `MaxAge`.
  - `authz` / `middleware` — `RequireLogin` reads the `jwt` cookie and loads the user's pages from `user_permissions`; `RequirePermission(page)` answers 403. The pages are `page:integracao` and `page:status`.
- `internal/shared/models` — DTOs; `internal/shared/utils` — `IsValidPassword`.
- `internal/domain/` — handler package + `<name>store` for queries: `user` (login/logout/change password), `permission` (`GET /api/me`), `report` (delivery logs, resend), `company` (company list for the filter), `health`, `appstatus` (`GET /api/status/applications`: reads `ExecucaoNoPrazo` from CloudWatch, `status.go` turns the points into state/since/segments, `cache.go` rebuilds the report every 5 minutes in the background).
- `routes/routes.go` — every route and the permission it needs. Only `/api/login`, `/api/logout`, `/api/health`, `/api/me` and `/api/user/change_password` need none; `TestPermissions` fails if a new route forgets one.

**Tests** (`test_application/`): each suite calls the `Init`s, wraps everything in `db.TestInitTransaction()` and `defer db.TestRollback()`, and exercises handlers with `httptest`.

**Seed users**: `davi@` and `test2@telelaudo.com.br` (password `davi1234`), `teste.admin@` and `teste.support@telelaudo.com.br` (password `teste1234`), all holding every page.

**Simulated metric**: `test/localstack/application_metrics.py` (mounted into LocalStack, started by `config_localstack.py`) seeds 8 days of `ExecucaoNoPrazo` and keeps publishing every 5 minutes, one scenario per application. LocalStack's `GetMetricData` is slow (~5 s per application for 7 days of 5-minute periods), hence the cache.

## Frontend

`frontend/all_might/` — React 19 + TypeScript + Vite, React Router v7, Bootstrap 5.

- `src/main.tsx` — routes: `/` (Integração, `pages/home`), `/status` (Status das aplicações, `pages/status`), `/login`, `/reset-password`.
- `src/navigation/pages.ts` — sidebar entries and the landing page after login.
- `src/handlers/request.ts` — the one fetch wrapper (`credentials: 'include'`); `VITE_API_URL` comes from `.env`.
- `src/context/context.tsx` — toasts, dark mode and the session (`MeContext`).
- `src/styles/tokens.css` — the colour tokens for both themes.
- Tests are vitest, colocated as `*.test.ts(x)`; pages mount through `src/test/renderPage.tsx`.
