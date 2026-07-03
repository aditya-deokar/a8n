# MCP SBOM Evidence

Store release SBOM or offline package inventory files here.

Recommended filenames:

```txt
YYYY-MM-DD-mcp-sbom.json
YYYY-MM-DD-pnpm-audit.json
```

The deterministic Phase 12 check verifies this folder exists. CI or release infrastructure should additionally run a registry-backed vulnerability audit.
