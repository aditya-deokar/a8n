# Database optimization evidence

Measurements behind the query and index changes in the MCP audit PR.

## How to reproduce

A throwaway Postgres is required; the seed writes and deletes rows.

```bash
docker compose up -d db-local
pnpm db:local:migrate

export DATABASE_URL=postgresql://a8n_dev:a8n_dev@127.0.0.1:5432/a8n_dev
pnpm mcp:db:benchmark -- --seed --label before   # seeds and measures
# apply prisma/migrations/20260918140256_mcp_query_indexes
pnpm mcp:db:benchmark -- --label after
```

The seed is deliberately sized at 1,200 workflows, 9,600 nodes, 14,400
executions, 180,000 audit rows and 6,000 OAuth tokens. On a few hundred rows
Postgres prefers a sequential scan whatever indexes exist, so a smaller dataset
would produce a before/after comparison that proves nothing.

## EXPLAIN (ANALYZE, BUFFERS)

Median of three runs each, same machine, same seeded data, warm cache. Only the
indexes differ between the two columns.

| Query | Before (median of 3) | After (median of 3) | Change | Plan |
|---|---|---|---|---|
| graph: nodes by workflow | 0.624 ms | 0.085 ms | -86% | seq scan -> index |
| graph: connections by workflow | 0.445 ms | 0.045 ms | -90% | seq scan -> index |
| list_executions: page 1 | 3.416 ms | 3.197 ms | -6% | seq scan -> seq scan |
| list_workflows: page 1 | 0.130 ms | 0.046 ms | -65% | index -> index |
| audit: failed events last 24h | 0.853 ms | 0.073 ms | -91% | index -> index |
| audit: retention sweep scan | 12.001 ms | 5.386 ms | -55% | seq scan -> index |
| oauth: active access tokens per client | 0.566 ms | 0.597 ms | +5% | index -> index |
| oauth: latest token usage per client | 0.374 ms | 0.222 ms | -41% | index -> index |
| oauth: consent listing | 0.029 ms | 0.043 ms | +48% | seq scan -> seq scan |
| **Total** | **18.438 ms** | **9.694 ms** | **-47%** | seq scans 5 -> 2 |

`explain-before.json` and `explain-after.json` hold a full run from each side,
including per-node scan types and shared buffer counts.

### Reading the two regressions honestly

`oauth: consent listing` (+48%) and `oauth: active access tokens per client`
(+5%) are sub-millisecond queries over a 30-row and a 6,000-row table. At that
scale the numbers are dominated by run-to-run noise, not by the change - the
consent listing still plans a sequential scan in both columns, which is the
correct plan for 30 rows. They are reported rather than dropped because
selecting only the favourable rows would make the rest of the table worthless.

`list_executions` is a real, unresolved case: it filters through a relation and
sorts by `startedAt`, which no single index serves well. See "Not fixed" in the
audit document.

## Statement counts

`pnpm mcp:query:count` counts the SQL the `/mcp` dashboard prefetch issues.
With 10 connected OAuth clients:

| Path | Before | After |
|---|---|---|
| `listOAuthConnections` | 42 | 6 |
| `securitySummary` | 46 | 10 |
| **Dashboard prefetch total** | **88** | **16** |

The check fails if the statement count scales with the number of connected
clients, which is the property that matters - the absolute numbers move with
the fixture size, the shape does not.

Raw output: `query-count-before.json`, `query-count-after.json`.

## Applying to production

`concurrent-indexes.sql` holds the `CREATE INDEX CONCURRENTLY` variant for a
database large enough that the migration's locks matter, together with the
rollback statements.
