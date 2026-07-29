# ADR-005: Agent runs stream through a dedicated server API

**Status:** Accepted
**Date:** 2026-07-29

## Context

The browser needs streaming progress but must not receive MCP credentials or LangGraph internals. The existing tRPC layer is appropriate for CRUD, while long-lived token/event streams need a dedicated route.

## Decision

Use tRPC for thread metadata and a Node.js SSE route for agent runs. The browser receives typed, redacted events. The live React Flow graph is updated only from an authoritative applied-graph event in a later phase.

## Consequences

- Run reconnection and event cursors are explicit API concerns.
- The browser is never an MCP client.
- Agent orchestration remains server-only and can move to a worker later.
