# ADR-003: Use PostgreSQL pgvector for user-scoped long-term memory

**Status:** Accepted
**Date:** 2026-07-29

## Context

The product already uses PostgreSQL. Long-term memory needs tenant filtering, lifecycle controls, deletion, and semantic recall without introducing another database.

## Decision

Store explicit, redacted user memory items in PostgreSQL with a `vector(1536)` embedding column and cosine-distance retrieval. The memory feature is disabled by default and is separately gated from agent runs. The application owns retention and deletion metadata.

## Consequences

- No second vector database is required.
- SQL authorization filters are applied before similarity ranking.
- Embedding dimensions must match the configured embedding model.
- Memory writes remain a policy decision; chat transcripts are not automatically persisted as long-term memories.
