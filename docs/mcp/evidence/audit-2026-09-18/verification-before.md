# Verification transcript — before

Captured on feat/agent at cbfe433, before any change in this PR.

## pnpm mcp:contract:check
```
- tool contract names are unique: ok
- source-registered tools are all in manifest: ok
- manifest tools are all source-registered: ok
- every tool has at least one profile: ok
- every tool declares required scopes: ok
- every tool declares known output schema: ok
- ChatGPT profile has 28 tools: failed
- ChatGPT policy is generated from contract: ok
- forbidden tools are absent from ChatGPT profile: ok
- forbidden list is generated from contract: ok
- approval-gated tools require approval: ok
- side-effect and destructive tools require approval: ok
- destructive tools declare confirmation examples: ok
- destructive tools are not in ChatGPT profile: ok
- admin tools are not in ChatGPT profile: ok
- resource names are unique: ok
- resource URIs are unique: ok
- widget resources use MCP app MIME type: ok
- prompt names are unique: ok
- prompts do not ask for secrets in chat: ok
- native outputSchema flags match source: ok (warning)
Result: FAIL
```

## pnpm mcp:safety:check (via test:mcp:offline)
```
a8n MCP safety readiness check
- chatgpt tool policy has 28 tools: failed
- chatgpt tool policy excludes forbidden tools: ok
- all chatgpt tools are marked MVP-visible: ok
- approval-gated tools require approval: ok
- prompt injection warnings detected: ok
- mcp response carries safety metadata: ok
- secret-looking strings are redacted: ok

Result: FAIL
```

## pnpm mcp:continuous:check
```
- policy-as-code covers every MCP tool contract: ok (required)
- policy-as-code has no high-risk approval gaps: ok (required)
- policy-as-code keeps forbidden/admin tools out of ChatGPT: ok (required)
- semantic safety classifier flags blended attacks: ok (required)
- eval trend dashboard script exists: ok (required)
- eval dashboard evidence folder is documented: ok (required)
- customer MCP dashboard includes security center: failed (required)
- MCP dashboard can list and revoke OAuth connections: ok (required)
- red-team exercise process is documented: ok (required)
- responsible disclosure process is documented: ok (required)
- adversarial corpus covers required attack classes: ok (required)
- release gate includes continuous-improvement check: ok (required)
Result: FAIL
```

## pnpm test:mcp
```
     × returns OAuth-aware 401 for missing bearer token 38561ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  1 failed | 20 passed (21)
      Tests  1 failed | 91 passed (92)
```

## pnpm lint
```
ESLint: 9.39.4
TypeError: Cannot read properties of undefined (reading 'Cjs')
 ELIFECYCLE  Command failed with exit code 2.
```
