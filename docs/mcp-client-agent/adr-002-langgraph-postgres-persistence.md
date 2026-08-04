# ADR-002: Use LangGraph PostgresSaver for durable agent threads

**Status:** Accepted
**Date:** 2026-07-29

## Context

Agent runs must survive reloads, process restarts, and human approval pauses. Conversation state must not live only in the browser or in a process-local map.

## Decision

Use `@langchain/langgraph-checkpoint-postgres` `PostgresSaver` for graph checkpoints. The saver owns its checkpoint tables in a dedicated configurable PostgreSQL schema and is initialized through its supported `setup()` migration routine. Prisma owns a8n product metadata such as agent threads, runs, and approvals.

## Consequences

- LangGraph state is resumable and compatible with interrupts/time travel.
- Checkpoint schema upgrades follow the package migration mechanism.
- Product queries do not need to understand serialized LangGraph channel values.
- Operational run metadata remains queryable through Prisma.
