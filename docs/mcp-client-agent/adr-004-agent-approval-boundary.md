# ADR-004: Keep approval outside the language model

**Status:** Accepted
**Date:** 2026-07-29

## Context

Model-generated `approved: true` values are not evidence of user intent. Workflow application changes persistent state and must be bound to the exact preview shown to the user.

## Decision

Approval is represented by a server-owned `AgentApproval` row with an expiry, exact confirmation hash, sanitized preview, and authenticated resolver. The graph pauses before mutation and resumes only after the approval endpoint validates ownership, status, expiry, and hash.

## Consequences

- The model cannot self-approve.
- Replays and stale previews are rejected.
- Phase 3 remains read-only until the Phase 5 apply path is implemented.
