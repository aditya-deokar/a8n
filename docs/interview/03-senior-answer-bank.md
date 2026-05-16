# Senior Answer Bank

Use these as speaking models, not scripts to memorize word-for-word.

## 1. Tell me about your project.

"I built a workflow automation platform where users design DAG-based workflows in a visual editor, connect external services, and run those workflows through a durable execution engine. The architecture has two API surfaces: tRPC for the first-party web application and MCP for external AI clients. That split let me optimize developer velocity internally while still exposing a standardized interface for agents and IDE tools."

## 2. Why did you choose tRPC instead of REST?

"For the first-party application, tRPC was the best fit because both ends of the product are TypeScript. It gave us end-to-end type safety without code generation, strong middleware composition for auth, and very natural TanStack Query integration for caching and SSR prefetch. If I were building a public multi-language platform API, I would strongly consider REST or GraphQL alongside it, but for product development speed inside one codebase, tRPC was the higher-leverage choice."

## 3. If you already had tRPC, why did you also build MCP?

"Because they solve different interface problems. tRPC is excellent for our own web app, but it is not a standard discovery and tool-execution protocol for AI clients. MCP gives us tools, resources, and prompts in a format that agentic clients already understand. So tRPC is our product-native interface, while MCP is our agent-native interface."

## 4. Walk me through workflow execution end to end.

"A user triggers execution through the app or a tool call. Instead of running the workflow inside that request, we emit an event to Inngest. The execution function creates an execution record, loads the workflow graph, topologically sorts the nodes, resolves the owning user, and then invokes executors node by node while passing a context object forward. On completion it marks the execution as success and persists the final output. On failure it updates the execution row with the error and stack information."

## 5. Why was event-driven execution important here?

"Because workflow execution is exactly the kind of work that should not depend on an HTTP request lifecycle. It can call external APIs, take variable time, and fail halfway through. By moving it to Inngest, we get retries, durability, and a cleaner operational boundary. The request layer becomes responsible for initiating work, not owning the whole runtime."

## 6. How do you ensure nodes run in the right order?

"The graph is treated as a DAG, so node order is derived from topology rather than storage order. Before execution we run a topological sort over nodes and connections. That guarantees a node only runs after its dependencies. It is a simple algorithmic step, but it is the key bridge between a visual graph model and deterministic runtime behavior."

## 7. How did you think about extensibility?

"I used registries and feature modules instead of centralizing everything in monolithic files. For example, node execution is driven by an executor registry keyed by `NodeType`, and MCP capabilities are registered through separate tool, resource, and prompt registries. That means adding a new node type or MCP capability is mostly additive work instead of risky cross-cutting edits."

## 8. How is authentication and authorization handled?

"For the web app, Better Auth provides session management and tRPC procedures enforce access through middleware. For MCP, bearer auth supports either a scoped API key or a session token. I think of that as two layers: authentication proves who the caller is, and authorization decides what they are allowed to do. The MCP side is especially important because scoped keys let us expose least-privilege automation instead of handing every client full account power."

## 9. How do you handle tenant isolation?

"I do not rely on frontend checks. User ownership is enforced in backend queries by scoping reads and writes with the authenticated user. Workflows, credentials, executions, and keys are all filtered by owner. That means even if someone tampers with a client payload, the database access layer still enforces tenant boundaries."

## 10. How are secrets protected?

"Credentials are encrypted before persistence, so the database is not storing provider secrets in plaintext. On the MCP side, API keys are not stored raw either; the service stores a SHA-256 hash and only returns the raw key once at creation time. That is a good pattern because compromise of the database should not automatically reveal reusable bearer secrets."

## 11. Why expose MCP resources and prompts, not just tools?

"Because tools alone are action surfaces. Resources reduce hallucination by giving agents authoritative context like schemas and docs, and prompts help structure common workflows. In other words, tools tell the model what it can do, resources tell it what is true, and prompts help it use the platform effectively."

## 12. Why use stateless Streamable HTTP for MCP?

"The official MCP SDK guidance makes Streamable HTTP the right transport for remote servers, and stateless mode is a good fit for a Next.js route handler and horizontally scalable deployment. It avoids sticky session complexity and keeps each request self-contained. The tradeoff is that you give up resumable session behavior, but for this platform the operational simplicity was worth it."

## 13. What is the biggest architectural strength of the project?

"The biggest strength is that the boundaries match the real responsibilities of the system. Product interactions, long-running workflow execution, and AI-agent access each have different requirements, and the architecture acknowledges that instead of collapsing everything into one API or one runtime model."

## 14. What is the biggest weakness or limitation?

"The biggest limitation is operational maturity, not product concept. For example, the current rate limiting strategy is not ideal for distributed production, and workflow updates still replace the full graph instead of applying a patch. Those are reasonable tradeoffs for project scope, but they are the first things I would evolve for real production hardening."

## 15. How would you scale this system?

"I would scale it in layers. Web traffic can scale horizontally because the product API is request-based. Execution throughput would be scaled independently through the event-processing layer. Shared concerns like rate limiting and audit logs would move to distributed infrastructure such as Redis and centralized observability. I would also separate concerns in deployment so the UI tier and the workflow runtime tier can scale based on different load shapes."

## 16. How would you test this project?

"I would test it at three levels. First, unit tests around utilities like graph ordering, scope checks, and encryption behavior. Second, integration tests around tRPC procedures and MCP handlers to verify auth, validation, and database behavior. Third, end-to-end tests that create a workflow, execute it, and verify the resulting execution record and UI-visible state. For a workflow platform, graph validity and permission boundaries deserve especially strong integration coverage."

## 17. How would you debug a failed production workflow?

"I would start from the execution record because the system treats executions as first-class runtime objects. From there I would inspect workflow ID, node order, status transitions, error payload, and the final successful node. Then I would correlate that with logs and any external API call failures. The important thing is that the architecture stores enough execution state to debug behavior after the fact rather than relying on transient console output."

## 18. What would you improve if you had more time?

"I would focus on production hardening: distributed rate limiting, structured traces across workflow steps and MCP calls, richer graph validation before persistence, and more granular policy enforcement for MCP tools. I would also consider diff-based workflow updates for better auditability and lower write amplification."

## 19. Why is this more than a student CRUD project?

"Because the complexity is not just in forms and tables. The project has orchestration, a graph execution model, asynchronous processing, secret handling, per-tenant authorization, and an AI-standard external interface. The interesting engineering work is in the boundaries and failure modes, not just the pages."

## 20. What senior mindset did you apply while building it?

"I tried to think in terms of interfaces, failure boundaries, and future change. Instead of just asking 'how do I make this work,' I asked 'what kind of responsibility is this, what layer should own it, and what will break when this grows.' That is why the project ended up with separate API surfaces, an event-driven runtime, and explicit security layers."
