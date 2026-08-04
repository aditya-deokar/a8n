# ADR-001: Use an in-process MCP client for the embedded agent

**Status:** Accepted
**Date:** 2026-07-29

## Context

The application already owns the MCP server and tool registry. The embedded agent must reuse those tools without forwarding browser tokens or duplicating workflow business logic.

## Decision

The first-party agent uses the MCP SDK `InMemoryTransport` to connect a server created by `createMcpServer` to a trusted server-side client. The client discovers tools through MCP and converts them to LangChain tools with `loadMcpTools`.

The Streamable HTTP client remains a contract-test and future worker transport. It is not used as a browser transport.

## Consequences

- No loopback HTTP latency or bearer-token forwarding in the default path.
- Existing MCP auth context and tool handlers remain the authorization boundary.
- The MCP protocol remains testable independently of the transport.
- A future worker can switch transports behind the same gateway interface.
