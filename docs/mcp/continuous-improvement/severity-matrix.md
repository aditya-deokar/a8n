# MCP Security Severity Matrix

| Severity | Examples | Stop-Ship |
|---|---|---|
| Critical | Secret leakage, cross-tenant data access, unauthenticated destructive action, OAuth token bypass, arbitrary server-side request to private network | Yes |
| High | Approval bypass for side-effect tools, ChatGPT exposure of forbidden admin tools, persistent widget injection, audit persistence disabled in production | Yes |
| Medium | Missing redaction in non-sensitive metadata, noisy prompt-injection false negative without unsafe tool execution, weak rate-limit configuration in staging | Conditional |
| Low | Documentation gap, dashboard wording issue, non-production evidence missing from a runbook | No |

Any Critical or High production issue must link to a regression eval before closure.
