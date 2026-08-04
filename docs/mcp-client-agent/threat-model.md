# Embedded Agent — Threat Model

## Overview

This document enumerates the threat vectors considered for the embedded workflow agent and the mitigations in place for each.

## Threat Vectors

### 1. Prompt Injection

**Risk**: An attacker crafts input to override the agent's instructions, extract system prompts, or cause unauthorized actions.

**Mitigations**:
- `agent-input-policy.ts` detects common injection patterns (role override, system prompt extraction, jailbreak delimiters, DAN mode, privilege escalation).
- All tool output, workflow names, and external content are treated as untrusted data in the system prompt.
- Nested injection detection checks base64 and URL-encoded payloads.
- Character sanitization strips null bytes, control characters, and homoglyph Unicode.

### 2. Tenant Isolation

**Risk**: User A accesses User B's threads, runs, approvals, memories, or workflows.

**Mitigations**:
- All data queries include `userId` in the WHERE clause.
- Memory namespaces use `userId` as the first element.
- Approval resolution checks `approval.userId === params.userId`.
- MCP tool calls pass authenticated `McpAuthInfo` with the current user's identity.
- Security tests in `tenant-isolation.test.ts` verify these boundaries.

### 3. Secret Exfiltration

**Risk**: Users paste credentials in chat, or the agent extracts and stores secrets.

**Mitigations**:
- `secret-policy.ts` detects 14+ secret patterns (OpenAI, Stripe, Slack, AWS, GitHub, GitLab, PEM keys, credential assignments) before the model sees the input.
- `extraction-policy.ts` rejects memory content containing secrets, PII (SSN, credit cards, emails), and raw transcripts.
- `redaction.ts` strips secrets from memory content before embedding.
- The system prompt explicitly forbids requesting or revealing credentials.
- Security tests in `secret-exfiltration.test.ts` verify all patterns.

### 4. Approval Bypass

**Risk**: The agent self-approves, replays an approval, or applies a different diff than what was previewed.

**Mitigations**:
- Approval is a server-owned state transition, not a prompt convention.
- `confirmationHash` cryptographically binds the approval to the exact diff.
- `consumeApproval` checks hash match and transitions APPROVED → CONSUMED (one-time use).
- Expired approvals are rejected even if previously approved.
- The model cannot resolve approvals — only authenticated API calls can.
- Security tests in `approval-bypass.test.ts` verify these boundaries.

### 5. Tool Scope Escalation

**Risk**: The agent calls tools outside its allowlist or invokes write tools when only reads are permitted.

**Mitigations**:
- `EMBEDDED_AGENT_TOOL_NAMES` is a static allowlist of 27 tools.
- `tool-policy.ts` enforces three risk tiers: `read_only`, `draft_write`, `approval_gated_write`.
- Each tool call is verified against the current mode (`allowDraftWrites`, `allowApply`).
- MCP tool contracts specify risk levels and required profiles.
- Security tests in `tool-policy-enforcement.test.ts` verify these boundaries.

### 6. Memory Poisoning

**Risk**: An attacker stores malicious content in long-term memory to influence future conversations.

**Mitigations**:
- `extraction-policy.ts` filters all proposed memories before storage.
- Only three categories are allowed: workflow-preferences, workflow-patterns, conversation-summaries.
- Content length limits (5–2000 chars) and semantic value checks prevent abuse.
- Raw transcripts are rejected.
- Users can delete individual or all memories via the API.
- Memory is gated by the `agentLongTermMemory` feature flag.

### 7. Denial of Service

**Risk**: A user overwhelms the agent with concurrent requests or extremely long conversations.

**Mitigations**:
- Per-user concurrent run limiter (`concurrency.ts`, default 2 runs).
- Input length limit (10,000 characters).
- Tool call budget per run (`maxToolCalls`, default 30).
- Run timeout (`runTimeoutMs`, default 30s).
- Token-based cost budget (`maxRunCostUsd`, default $0.50).
- Stale run cleanup marks runs stuck >5min as failed.

### 8. Model Provider Compromise

**Risk**: The model provider returns unexpected or malicious content.

**Mitigations**:
- Tool output is treated as untrusted data.
- The system prompt instructs the model to never reveal credentials.
- Kill switches can disable agent runs (`disableAgentRuns`) or mutations (`disableAgentMutations`) instantly.
- Provider fallback is available if configured.

## Kill Switches

| Kill Switch | Env Variable | Effect |
|---|---|---|
| `disableAgentRuns` | `KILL_SWITCH_DISABLE_AGENT_RUNS` | Stops all new agent runs |
| `disableAgentMutations` | `KILL_SWITCH_DISABLE_AGENT_MUTATIONS` | Blocks draft writes and applies |

## Conclusion

The agent implements defense-in-depth across all threat vectors. No single layer is relied upon for security — each vector has multiple independent mitigations.
