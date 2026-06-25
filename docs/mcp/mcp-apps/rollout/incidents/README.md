# Rollout Incidents

Create one Markdown file per production ChatGPT app incident using:

```txt
docs/mcp/mcp-apps/rollout/incident-template.md
```

Before closing a production incident, add or update a regression eval in:

```txt
src/mcp/evals/chatgpt-app-goals.ts
```

Then set the incident frontmatter:

```yaml
status: closed
productionIssue: true
regressionEval: chatgpt-some-eval-id
```

The rollout checker enforces this:

```powershell
pnpm mcp:rollout:check
```
