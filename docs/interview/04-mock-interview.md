# Mock Interview Pack

## How to practice

For each question:

1. answer out loud in 60 to 120 seconds
2. mention one technical detail from the repo
3. mention one tradeoff
4. end with one improvement idea

If you can do that consistently, your answers will sound senior.

## Round 1: Project and architecture

### Q1. What did you build?

Strong answer should include:

- workflow automation platform
- visual DAG editor
- durable execution engine
- internal tRPC plus external MCP

### Q2. What are the main components of the architecture?

Strong answer should include:

- Next.js app
- tRPC API layer
- Prisma and Postgres
- Inngest execution runtime
- MCP server

### Q3. Why is the workflow model represented as nodes and connections?

Strong answer should include:

- workflows are graphs, not simple forms
- graph model supports dependency ordering
- execution engine can derive order through topological sort

### Q4. Why did you use both tRPC and MCP?

Strong answer should include:

- internal vs external consumer distinction
- product DX vs agent interoperability
- different protocols for different jobs

### Q5. Why did you choose an event-driven execution model?

Strong answer should include:

- long-running and failure-prone work should be decoupled from requests
- retries and durability
- execution records and observability

## Round 2: Deep technical questions

### Q6. How does `workflows.update` persist the editor state?

Strong answer should include:

- nodes and edges come from the frontend
- persistence is transactional
- old nodes and connections are replaced
- simple consistency now, better diffing later

### Q7. How do you protect one user's data from another?

Strong answer should include:

- backend query scoping by user ID
- protected procedures
- do not trust frontend-only checks

### Q8. How are credentials secured?

Strong answer should include:

- encrypted before database persistence
- secret values not treated like normal fields
- separate credential entity from workflow definition

### Q9. How are MCP API keys handled safely?

Strong answer should include:

- raw key shown once
- database stores only hash
- keys can expire or be revoked
- scopes reduce blast radius

### Q10. Why use Streamable HTTP for MCP?

Strong answer should include:

- official MCP remote-server transport
- appropriate for network-accessible clients
- stateless mode fits Next.js route handlers

### Q11. How do tools, resources, and prompts differ?

Strong answer should include:

- tools perform actions
- resources provide read-only context
- prompts guide common workflows

### Q12. What happens when a workflow fails halfway through?

Strong answer should include:

- failure is captured in execution state
- Inngest failure hook updates the record
- easier postmortem and debugging

### Q13. How would you add a new node type?

Strong answer should include:

- add enum value
- implement executor
- register executor
- add UI component
- wire real-time channel if needed

### Q14. How would you improve production readiness?

Strong answer should include:

- distributed rate limit
- tracing and structured logs
- stronger validation and tests
- patch-based graph persistence

## Round 3: Senior judgment questions

### Q15. What was the hardest design decision?

Good answer direction:

- choosing to keep tRPC and MCP separate
- explaining why that complexity is justified

### Q16. What tradeoff did you consciously accept?

Good answer direction:

- stateless MCP over resumable sessions
- full graph replacement over patch semantics
- in-memory rate limit for current scope

### Q17. If this had to support enterprise customers, what would change first?

Good answer direction:

- stronger audit logging
- distributed enforcement for limits
- policy and scope hardening
- better observability and SLOs

### Q18. If multiple teams worked on this, how would you keep it maintainable?

Good answer direction:

- feature-based modules
- clear API ownership
- ADRs for major decisions
- registry patterns for extension points

### Q19. What would you monitor in production?

Good answer direction:

- workflow success/failure rate
- execution latency
- queue backlog
- MCP auth failures
- tool usage by scope and client

### Q20. What makes this architecture scalable?

Good answer direction:

- execution decoupled from request cycle
- separate scaling characteristics by layer
- stateless request handling where possible

## Whiteboard prompts

Practice explaining these on paper:

1. Draw the request path for a tRPC mutation from UI to database.
2. Draw the execution path for a workflow run from trigger to execution record.
3. Draw the MCP request path including auth, rate limit, transport, and tool registry.
4. Draw the data model around `Workflow`, `Node`, `Connection`, and `Execution`.

## Self-scoring rubric

Score yourself from 1 to 5 on each:

- clarity
- architecture depth
- tradeoff awareness
- security awareness
- operational awareness
- ability to connect code to product value

## Red flags to avoid

- only describing libraries without explaining why they were chosen
- saying "we used microservices" when the codebase is not actually microservices
- ignoring failure handling and only describing happy paths
- treating auth and authorization as the same thing
- saying MCP and tRPC are interchangeable
