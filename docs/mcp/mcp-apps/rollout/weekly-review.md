# Weekly ChatGPT App Review

Use this every week after launch.

## Tool Usage

- [ ] Review total a8n tool calls.
- [ ] Review top called tools.
- [ ] Review tools with zero or unexpectedly low usage.
- [ ] Review unexpected tool selections from golden prompts.

## Failures

- [ ] Review OAuth authorization failures.
- [ ] Review token refresh failures.
- [ ] Review MCP 4xx/5xx responses.
- [ ] Review tool latency and timeouts.
- [ ] Review widget load errors.
- [ ] Review execution failures surfaced through ChatGPT.

## Safety

- [ ] Review prompt-injection safety metadata events.
- [ ] Review approval-gated write attempts.
- [ ] Confirm destructive/admin tools remain excluded from the ChatGPT profile.
- [ ] Confirm no raw credential secrets appear in tool output or logs.

## Metadata

- [ ] Check whether tool descriptions caused false positives or false negatives.
- [ ] Add direct, indirect, negative, or security prompts for new behavior.
- [ ] Update `src/mcp/evals/chatgpt-app-goals.ts` for production learnings.
- [ ] Run `pnpm mcp:chatgpt:release-check`.

## App Versioning

- [ ] If tool names, schemas, descriptions, `_meta`, or widget resource metadata changed, prepare a new app draft and resubmit.
- [ ] If only server-side behavior changed without metadata-contract changes, document it as a server-only release.
