# Slow Query Review Template

Use this template when a query causes latency, CPU, IO, lock, or cost issues.

## Summary

Query or code path:

Owner:

Environment:

Detected by:

Related release/PR:

## Impact

Observed latency:

p95/p99:

Rows scanned:

Rows returned:

Database CPU/IO impact:

User impact:

Cost impact:

## Query

```sql
-- Redact secrets and private user data.
```

## EXPLAIN

```text
Paste EXPLAIN or EXPLAIN ANALYZE output from a safe environment.
```

## Findings

- Missing index:
- Bad filter:
- Unbounded pagination:
- N+1 behavior:
- Lock/contention:
- Inefficient join:
- Large payload:

## Options

| Option | Benefit | Risk | Owner |
|---|---|---|---|
| Add index |  |  |  |
| Rewrite query |  |  |  |
| Add pagination/limit |  |  |  |
| Cache result |  |  |  |
| Move work async |  |  |  |

## Decision

Chosen option:

Migration needed:

Backfill needed:

Rollback plan:

Validation plan:

## Follow-Up

Action item:

Owner:

Due date:

Tracking link:
