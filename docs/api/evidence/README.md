# API Evidence

This directory stores internal API release-gate evidence.

Expected generated layout:

```txt
docs/api/evidence/
  release-gates/
    YYYY-MM-DD/
      api-release-gate.json
```

Release-gate JSON should be treated as build evidence. It must not contain raw credentials, API keys, token hashes, database URLs, or bearer tokens.
