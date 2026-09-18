# Verification transcript — after

Captured on feat/mcp-app-audit-optimization at 39b2cf5, working tree clean.

## Exit codes
```
typecheck=0
test:mcp=0
test:mcp:offline=0
mcp:contract:check=0
mcp:safety:check=0
mcp:continuous:check=0
mcp:runtime:audit=0
widget e2e=0
lint=2
```

## pnpm test:mcp
```
 Test Files  24 passed (24)
      Tests  113 passed (113)
```

## pnpm test:mcp:offline (4 suites)
```
MCP non-technical workflow evaluation
Cases: 50/50 passed (100%)
a8n MCP safety readiness check
Result: PASS
a8n ChatGPT app eval suite
Cases: 8/8 passed
Result: PASS
a8n MCP adversarial eval suite
Cases: 29/29 passed
Result: PASS
```

## pnpm mcp:runtime:audit
```
  profile default          tools= 52  resources= 21  templates= 5  prompts= 3
  profile chatgpt          tools= 26  resources= 21  templates= 5  prompts= 3
  profile embedded_agent   tools= 28  resources= 21  templates= 5  prompts= 3
  [PASS] [default] registers at least one tool
  [PASS] [default] registers resources
  [PASS] [chatgpt] registers at least one tool
  [PASS] [chatgpt] registers resources
  [PASS] [embedded_agent] registers at least one tool
  [PASS] [embedded_agent] registers resources
  [PASS] [default] every widget tool points at a registered resource
  [PASS] [chatgpt] every widget tool points at a registered resource
  [PASS] [embedded_agent] every widget tool points at a registered resource
  [PASS] widget HTML bundles are built and self-contained
  [PASS] [default] every contracted tool is registered at runtime
  [PASS] [default] no tool is registered without a contract entry
  [PASS] [chatgpt] every contracted ChatGPT tool is registered at runtime
  [PASS] [chatgpt] no forbidden tool is exposed at runtime
  [PASS] [default] every tool has a title or description
  [PASS] [default] every tool carries behavior annotations
  [PASS] [chatgpt] every tool has a title or description
  [PASS] [chatgpt] every tool carries behavior annotations
  [PASS] [embedded_agent] every tool has a title or description
  [PASS] [embedded_agent] every tool carries behavior annotations
  [PASS] model-facing docs and prompts only name registered tools
  [PASS] client-initialized hook does not double-register resources
  PASSED — 0 required failure(s), 0 warning(s)
```

## Widget e2e (chromium + mobile-chrome)
```
[78/78] [mobile-chrome] › tests\e2e\mcp\widgets.spec.ts:383:7 › MCP App widgets › draft preview renders a large draft without breaking layout
  78 passed (36.2s)
```

## pnpm lint — still broken, see the audit document
```
ESLint: 9.39.4
TypeError: Cannot read properties of undefined (reading 'Cjs')
 ELIFECYCLE  Command failed with exit code 2.
```
