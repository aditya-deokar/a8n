# MCP Red-Team Exercise Template

## Metadata

- Date:
- Owner:
- Participants:
- Environment:
- Release or commit:
- Scope:

## Attack Areas

- Prompt injection and indirect prompt injection.
- Secret exfiltration through tool output, audit logs, widgets, or evidence files.
- Tool poisoning and malicious tool-selection pressure.
- Excessive agency and approval bypass.
- OAuth abuse: wrong client, redirect URI, resource, expired token, reused code, revoked token.
- SSRF and unsafe outbound egress.
- MCP Apps widget injection.
- Cross-tenant authorization.

## Results

| Attack | Expected Control | Result | Evidence | Follow-up |
|---|---|---|---|---|
| | | | | |

## Stop-Ship Review

- [ ] No P0 issue remains open.
- [ ] Every confirmed issue has an owner.
- [ ] Every fixed issue has a regression eval or test.
- [ ] Production guardrails are still enabled.
- [ ] Incident docs and release gate evidence are linked.

## Follow-Up Evals

Add new eval cases under `src/mcp/evals/adversarial/` and reference them from any related incident record.
