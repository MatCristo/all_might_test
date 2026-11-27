# all-might (teste)

Versão reduzida do painel interno da Telelaudo, usada como teste técnico. Tem
duas telas:

- **Integração**: os logs de entrega de laudos (com filtro por atendimento e
  empresa e paginação) e o reenvio de um laudo.
- **Status das aplicações**: se alguma aplicação de background está com
  problema agora, desde quando, e a última semana de cada uma (veja abaixo).

Tudo roda localmente: PostgreSQL com dados fictícios e LocalStack no lugar da
AWS. Não há nenhuma configuração para ambientes reais.

## Stack

- **Backend** — Go 1.24, Echo, GORM/PostgreSQL, AWS SDK v2 (Secrets Manager,
  CloudWatch Logs e CloudWatch Metrics, apontados para o LocalStack), JWT em
  cookie HttpOnly.
- **Frontend** — React 19 + TypeScript + Vite, React Router, Bootstrap.

## Subindo o ambiente

```bash
docker compose up -d          # Postgres (test_db), LocalStack e o container all_might
```

`test/database/create_database.sql` e `test/localstack/config_localstack.py`
só rodam na criação dos containers (o segundo também inicia o simulador de
métricas, `test/localstack/application_metrics.py`). O LocalStack só fica
*healthy* depois que esses scripts terminam, incluindo os 8 dias de histórico
da métrica (~1 min), então o `docker compose up -d` demora um pouco mais. Em
troca, a API e os testes nunca leem a métrica pela metade. Depois de alterar
um deles: `docker compose down && docker compose up -d`.

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
main.go                 inicialização: config → aws → db → auth → rotas → refresher do status
routes/routes.go        todas as rotas e a permissão que cada uma exige
internal/platform/      config, aws (LocalStack), db, auth (JWT/bcrypt), authz, middleware
internal/shared/        models e utils
internal/domain/        user, permission (/api/me), report, company, health, appstatus
frontend/all_might/     o painel React
test/                   init do Postgres e do LocalStack (+ simulador de métricas)
test_application/       testes do backend
```

## Status das aplicações

Substitui o dashboard `monitor_de_aplicacoes` do console da AWS. Cada aplicação
de background publica a cada 5 minutos a métrica `ExecucaoNoPrazo` (namespace
`monitor_de_aplicacoes`, dimensão `Aplicacao`): `1` quando a última execução
terminou no prazo, `0` quando não.

**A tela** (`/status`, permissão `page:status`) responde primeiro à pergunta de
quem está de plantão — *alguma aplicação está com problema agora? desde
quando?* — numa faixa no topo, e depois lista as aplicações com os problemas
primeiro: estado (OK, falhando ou sem dados), desde quando, execuções fora do
prazo na semana, uma linha do tempo de 7 dias (passe o mouse para ver dia,
horário e o trecho) e as ocorrências em texto. Atualiza sozinha a cada minuto
e avisa se o próprio relatório estiver velho.

**Estados**

| Estado | Quando |
|---|---|
| `failing` | o último período com dado tem valor 0 |
| `no_data` | nenhum dado há mais de 15 min (3 períodos) — a aplicação pode ter caído |
| `ok` | o último período com dado tem valor 1 |

Um período ausente no meio da semana vira um trecho "sem dados" na linha do
tempo. Só o período mais recente faltando não é alarme: ele pode ainda estar
chegando.

**API** — `GET /api/status/applications` devolve, por aplicação, o estado atual,
`since`, `last_data_at`, `failed_periods` e os `segments` da janela (trechos
contínuos num mesmo estado). As aplicações são descobertas pela própria métrica
(`ListMetrics`), e a leitura é `GetMetricData` com `Maximum` a cada 5 minutos,
como no dashboard original.

**Cache** — o relatório é montado em segundo plano a cada 5 minutos (o ritmo da
métrica) e a rota responde da memória. Ler o CloudWatch a cada acesso só
repetiria a mesma resposta e o `GetMetricData` é cobrado por métrica lida. No
LocalStack, ler 7 dias de 10 aplicações leva ~50 s, então logo depois de subir
a API o primeiro acesso espera esse tempo; os seguintes são instantâneos. Se a
leitura falha e ainda não há relatório, a rota responde 503, e quem estava
esperando recebe o mesmo erro na hora, sem repetir a consulta.

**Dados simulados** — `test/localstack/application_metrics.py` semeia 8 dias
de histórico e depois continua publicando a cada 5 minutos, como as aplicações
reais. Cada aplicação segue um cenário:

| Aplicação | Cenário |
|---|---|
| storelts | falhando desde 3 h antes de o LocalStack subir |
| critical-notifier | sem dados desde 1 h antes de o LocalStack subir |
| clinuxsend | falhou por 12 h há 2 dias e se recuperou |
| eleva-integration | 6 h sem dados há 4 dias, OK agora |
| notify-hearp | uma execução fora do prazo a cada 8 h |
| demais | sempre no prazo |
