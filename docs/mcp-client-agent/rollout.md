# Embedded Agent — Staged Rollout Plan

## Rollout Stages

### Stage 1: Local Development and Test Fixtures

**Entry Criteria**: All phases (0–9) implemented. `pnpm typecheck` passes. Security test suite passes.

**Configuration**:
```bash
FEATURE_FLAG_EMBEDDED_AGENT_ROLLOUT_PERCENT=100  # Enabled for all local dev
FEATURE_FLAG_EMBEDDED_AGENT_APPLY_ROLLOUT_PERCENT=100
FEATURE_FLAG_AGENT_LONG_TERM_MEMORY_ROLLOUT_PERCENT=100
```

**Exit Criteria**:
- [ ] Golden eval thresholds met (safety: 100%, overall: 85%)
- [ ] All security test suites pass
- [ ] Health check reports all subsystems healthy
- [ ] Package compatibility check reports no errors

---

### Stage 2: Internal Users — Read-Only and Draft-Only

**Entry Criteria**: Stage 1 complete. Deployed to staging environment.

**Configuration**:
```bash
FEATURE_FLAG_EMBEDDED_AGENT_ROLLOUT_PERCENT=100
FEATURE_FLAG_EMBEDDED_AGENT_APPLY_ROLLOUT_PERCENT=0   # Apply disabled
FEATURE_FLAG_AGENT_LONG_TERM_MEMORY_ROLLOUT_PERCENT=0 # Memory disabled
```

**Monitoring**:
- `agent.run.started` / `agent.run.completed` / `agent.run.failed` rates
- `agent.safety.blocked` count
- `agent.tool.call.completed` / `agent.tool.call.failed` rates
- No `agent.cleanup.runs.stale` events

**Exit Criteria**:
- [ ] 50+ successful agent runs with no P0/P1 issues
- [ ] `agent.run.failed` rate < 5%
- [ ] No safety bypass incidents
- [ ] No tenant isolation violations
- [ ] User feedback is positive

---

### Stage 3: Staging with Apply Enabled for Allowlisted Testers

**Entry Criteria**: Stage 2 complete. 1 week of stable operation.

**Configuration**:
```bash
FEATURE_FLAG_EMBEDDED_AGENT_ROLLOUT_PERCENT=100
FEATURE_FLAG_EMBEDDED_AGENT_APPLY_ROLLOUT_PERCENT=100  # Apply enabled
FEATURE_FLAG_AGENT_LONG_TERM_MEMORY_ROLLOUT_PERCENT=50 # Memory for 50%
```

**Monitoring**:
- All Stage 2 metrics
- `agent.approval.requested` / `agent.approval.approved` / `agent.approval.rejected`
- `agent.draft.applied` success rate
- Workflow version integrity (no silent overwrites)

**Exit Criteria**:
- [ ] 20+ successful apply operations
- [ ] All applies were approval-gated
- [ ] No stale or orphaned approvals
- [ ] Workflow versions are consistent
- [ ] Cost per run within budget

---

### Stage 4: Production Canary — Apply Disabled

**Entry Criteria**: Stage 3 complete. 2 weeks of stable staging operation.

**Configuration**:
```bash
FEATURE_FLAG_EMBEDDED_AGENT_ROLLOUT_PERCENT=5   # 5% of users
FEATURE_FLAG_EMBEDDED_AGENT_APPLY_ROLLOUT_PERCENT=0
FEATURE_FLAG_AGENT_LONG_TERM_MEMORY_ROLLOUT_PERCENT=0
```

**Monitoring**:
- Production error rates
- API latency impact
- Support ticket volume from agent users
- Cost and token usage

**Exit Criteria**:
- [ ] 1 week of stable production operation
- [ ] No increase in support tickets
- [ ] No production incidents
- [ ] Error rates within SLO

---

### Stage 5: Small Production Cohort with Apply Enabled

**Entry Criteria**: Stage 4 complete. No production incidents.

**Configuration**:
```bash
FEATURE_FLAG_EMBEDDED_AGENT_ROLLOUT_PERCENT=10
FEATURE_FLAG_EMBEDDED_AGENT_APPLY_ROLLOUT_PERCENT=10
FEATURE_FLAG_AGENT_LONG_TERM_MEMORY_ROLLOUT_PERCENT=10
```

**Exit Criteria**:
- [ ] 2 weeks of stable operation
- [ ] All metrics within SLO
- [ ] Positive user feedback
- [ ] No security findings

---

### Stage 6: Progressive Expansion

**Entry Criteria**: Stage 5 complete. All SLOs met.

**Expansion Schedule**:
- Week 1: 25% rollout
- Week 2: 50% rollout
- Week 3: 75% rollout
- Week 4: 100% rollout (general availability)

Each expansion requires:
- [ ] No P0/P1 issues in the previous week
- [ ] Error rates within SLO
- [ ] Cost within budget
- [ ] Security eval passing

---

## Rollback Triggers

Immediately roll back to the previous stage if any of the following occur:

- **P0**: Data loss, unauthorized access, or tenant isolation breach
- **P1**: Incorrect workflow mutations applied without approval
- Safety test failure rate > 0%
- Agent run error rate > 10% sustained for 30 minutes
- Cost per run exceeds 2x the budget threshold
- Support ticket spike > 3x baseline

See [runbook.md](./runbook.md) for detailed rollback procedures.

## Rollback Procedure

1. Set `FEATURE_FLAG_EMBEDDED_AGENT_ROLLOUT_PERCENT=0` or enable `KILL_SWITCH_DISABLE_AGENT_RUNS=true`
2. Investigate the root cause
3. Fix and re-validate through the eval suite
4. Resume from the previous stable stage
