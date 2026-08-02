# Embedded Agent — Incident Response Runbook

## Kill Switches

### Disable All Agent Runs

**When**: Agent is producing incorrect, harmful, or unexpected results.

```bash
# Set in environment
KILL_SWITCH_DISABLE_AGENT_RUNS=true

# Or via feature flag override
FEATURE_FLAG_OVERRIDES=embeddedAgent=false
```

**Effect**: All new `streamAgentRun` calls throw immediately. Existing in-flight runs continue to completion.

**Recovery**: Remove the env variable and restart. Existing workflows and versions are unaffected.

---

### Disable Agent Mutations

**When**: Agent is creating incorrect drafts or applying unwanted changes, but read-only assistance is still valuable.

```bash
KILL_SWITCH_DISABLE_AGENT_MUTATIONS=true

# Or disable apply specifically
FEATURE_FLAG_OVERRIDES=embeddedAgentApply=false
```

**Effect**: Draft-write and apply tools throw `AGENT_TOOL_NOT_ALLOWED`. Read-only tools (list, get, explain, search) continue working.

**Recovery**: Remove the env variable and restart.

---

### Disable Agent Memory

**When**: Memory is producing incorrect or harmful context in conversations.

```bash
FEATURE_FLAG_OVERRIDES=agentLongTermMemory=false
```

**Effect**: Memory retrieval and extraction are skipped. Existing memories are preserved but not used.

**Recovery**: Remove the override. Run `deleteAllMemories` if the stored data is compromised.

---

## Rollback Procedures

### Step 1: Stop the Bleeding

1. Enable the relevant kill switch (see above).
2. Verify in logs that new runs are being blocked.
3. Monitor for in-flight runs to complete (max 30s timeout).

### Step 2: Investigate

1. Check observability events: `agent.run.failed`, `agent.safety.blocked`.
2. Review recent agent runs in the database: `SELECT * FROM agent_run WHERE status = 'FAILED' ORDER BY "createdAt" DESC LIMIT 20`.
3. Check for stale runs: `SELECT * FROM agent_run WHERE status = 'RUNNING' AND "startedAt" < NOW() - INTERVAL '5 minutes'`.
4. Review approval state: `SELECT * FROM agent_approval WHERE status = 'PENDING' ORDER BY "requestedAt" DESC`.

### Step 3: Clean Up

1. Run cleanup jobs:
   ```typescript
   import { runAllCleanupJobs } from "@/agent/cleanup";
   const results = await runAllCleanupJobs();
   console.log(results);
   ```

2. If approvals are in an unknown state:
   ```sql
   UPDATE agent_approval SET status = 'EXPIRED' WHERE status = 'PENDING';
   ```

3. If runs are stuck:
   ```sql
   UPDATE agent_run SET status = 'FAILED', "completedAt" = NOW(), "errorMessage" = 'Manual cleanup' WHERE status = 'RUNNING';
   ```

### Step 4: Roll Back Code (Last Resort)

Only after confirming no in-flight apply is in an unknown state:

1. Revert the application deployment to the previous version.
2. Leave existing workflows and versions intact — do NOT delete user data.
3. Preserve run and audit evidence in the database for investigation.
4. Keep the kill switch enabled during rollback.

### Step 5: Post-Incident

1. Document the incident in the team's incident log.
2. Review and update the relevant security test suite.
3. Add the failure scenario to the golden task eval set.
4. Update this runbook if new procedures were discovered.

---

## Escalation Path

| Severity | Action | Notify |
|---|---|---|
| P0 — Data loss or unauthorized access | Enable `disableAgentRuns` immediately | Engineering lead + Security |
| P1 — Incorrect workflow mutations | Enable `disableAgentMutations` | Engineering lead |
| P2 — Degraded accuracy or performance | Monitor, consider `disableAgentRuns` | On-call engineer |
| P3 — Cosmetic or minor issues | File a bug, no kill switch needed | Product owner |

---

## Monitoring Checklist

- [ ] `agent.run.failed` rate < 5%
- [ ] `agent.safety.blocked` count reviewed daily
- [ ] `agent.approval.expired` count trending down
- [ ] `agent.concurrency.limit.hit` not spiking
- [ ] `agent.model.cost.estimated` within budget
- [ ] No `agent.cleanup.runs.stale` in normal operation
