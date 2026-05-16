# Reviewer Presentation Script

This script is designed for a project reviewer, not a coding interview panel. The goal is to make the project feel clear, complete, and technically strong without sounding over-rehearsed.

## Presentation goal

By the end of the presentation, the reviewer should understand:

- what problem the project solves
- what the product does from a user perspective
- how the main architecture works
- what makes the implementation technically meaningful
- what tradeoffs were made
- what can be improved in the future

## Recommended duration

- Full version: 8 to 12 minutes
- Short version: 4 to 5 minutes

## Presentation structure

1. Opening
2. Problem statement
3. Product overview
4. Live workflow demo
5. Technical architecture
6. Key engineering decisions
7. Challenges and learnings
8. Future improvements
9. Closing

---

## Full script

## 1. Opening

"Good morning/afternoon. Today I am presenting my final-year project, which is an AI-powered workflow automation platform called Nodebase.

The idea behind this project is to let users visually design automation workflows, connect external services such as AI providers and communication platforms, and execute those workflows reliably. In addition to the normal web application experience, the platform also exposes an MCP server, which allows AI clients to interact with the system in a standardized way."

Pause for 1 second.

"So in simple terms, this project combines three things:

1. a visual workflow builder
2. a durable execution engine
3. an AI-ready integration layer"

---

## 2. Problem statement

"The problem I wanted to solve is that many automation systems are either too technical for normal users, or they are not designed with AI-native integration in mind.

Traditional automation tools let users connect triggers and actions, but they usually stop at human-driven interfaces. On the other hand, modern AI systems need structured ways to discover tools, read context, and execute actions safely.

So this project tries to bridge both worlds. It gives users a visual interface for automation, while also making the platform usable by AI clients through Model Context Protocol, or MCP."

---

## 3. Product overview

"From a user perspective, the platform supports the full workflow lifecycle.

First, a user authenticates into the dashboard. Then they can create a workflow, add nodes in a drag-and-drop editor, connect those nodes into a directed graph, store credentials securely, execute the workflow, and view execution history.

The node system supports different categories such as:

- triggers like manual trigger, Google Form trigger, and Stripe trigger
- executor nodes like HTTP request
- AI model nodes such as OpenAI, Anthropic, and Gemini
- messaging nodes such as Discord and Slack

So this is not just a static builder. It is a full automation platform with persistence, execution, and observability."

---

## 4. Demo script

Use this while showing the system.

### Demo intro

"I'll now quickly demonstrate the product flow."

### Demo step 1: dashboard

"This is the main dashboard where users can manage workflows, credentials, executions, and MCP keys."

### Demo step 2: create workflow

"Here I create a new workflow. Each workflow is represented internally as a graph made of nodes and connections."

### Demo step 3: editor

"This is the visual editor. The user can add nodes, configure them, and connect them to define execution order."

### Demo step 4: credentials

"If a node depends on an external service, the user can store credentials securely. These credentials are encrypted before being saved."

### Demo step 5: execution

"When the user executes a workflow, the system does not run everything directly inside the browser request. Instead, it triggers an event-driven execution pipeline. That makes the workflow execution more reliable."

### Demo step 6: execution history

"Here we can see the execution history, including success, failure, timing, and output details. This is important because in automation systems, visibility into what happened is just as important as execution itself."

### Demo step 7: MCP

"This section is for MCP integration. The platform can generate scoped API keys and expose tools, resources, and prompts through an MCP server endpoint. This means external AI clients can interact with the platform in a standard and secure way."

### Demo transition back to explanation

"That was the product view. Now I'll explain the technical design behind it."

---

## 5. Technical architecture

"The architecture is divided into clear layers, and that was a deliberate design decision.

At the frontend layer, I used Next.js 16 with React 19. The workflow editor is built with React Flow, which is well suited for graph-based interfaces.

At the internal API layer, I used tRPC. This gives end-to-end type safety between frontend and backend, which helped reduce boilerplate and made the development workflow much faster.

At the data layer, I used Prisma with PostgreSQL. The main entities include User, Workflow, Node, Connection, Execution, Credential, and API Key.

For authentication, I used Better Auth. For premium feature gating, I integrated Polar.

For execution, I used Inngest. This is one of the most important parts of the system because workflow execution is asynchronous and may involve retries, failures, or external API calls.

Finally, for AI integration, I implemented an MCP server using the MCP TypeScript SDK and exposed it through a Streamable HTTP route."

---

## 6. Explain the architecture in a reviewer-friendly way

"A key architectural decision in this project is that I did not use one API style for everything.

For the web application itself, I used tRPC because it is ideal for a TypeScript-to-TypeScript full-stack application.

But for AI clients, I used MCP, because MCP is not just another API. It is a protocol designed specifically for exposing tools, resources, and prompts in a standardized way for intelligent clients.

So the project has two API surfaces:

- tRPC for the first-party web app
- MCP for external AI-driven access

That separation makes the system cleaner because each interface is optimized for its own consumer."

---

## 7. Workflow execution explanation

"The workflow engine is another major technical part of the project.

When a user runs a workflow, the platform sends an execution event to Inngest. Then the execution function creates an execution record in the database, loads the workflow graph, performs a topological sort to determine the correct node order, and then executes each node one by one.

This matters because the workflow is a DAG, which means execution order depends on graph dependencies, not just the order in which nodes were created.

Each node type is mapped to an executor function through a registry pattern, which makes the system extensible. If I want to add a new node type later, I do not need to rewrite the whole engine. I only need to add the node definition, executor, and registration."

---

## 8. Security explanation

"Security was handled in multiple layers.

For the application side, authenticated procedures are protected using middleware. Data access is scoped by user ID so one user cannot access another user's workflows or credentials.

For secret management, credentials are encrypted before being stored.

For the MCP layer, authentication supports either session tokens or scoped API keys. These API keys are stored as hashes, not plaintext, and permissions are controlled through scopes. That means an AI client can be granted only the access it needs, instead of full unrestricted access."

---

## 9. Why this project is technically strong

"I believe this project is technically strong for three reasons.

First, it is not only a frontend project. It includes architecture, authentication, persistence, orchestration, and external integration.

Second, it handles real system concerns such as durable execution, failure tracking, tenant isolation, encrypted credentials, and API design.

Third, it introduces an AI-native integration model through MCP, which makes the project more forward-looking than a standard workflow dashboard."

---

## 10. Challenges and learnings

"One of the main challenges was designing the boundary between the normal product API and the AI-facing API.

Initially, it may seem simpler to expose everything through one interface, but that would have mixed two very different concerns. Through this project, I learned that internal application APIs and agent-facing protocols should be designed differently, even if they operate on the same core data.

Another challenge was workflow execution. A graph-based workflow system is not just a CRUD application. It requires thinking about execution order, failure handling, extensibility, and observability."

---

## 11. Limitations and future improvements

"Like any project, this one has areas that can be improved.

Some next improvements would be:

- distributed rate limiting instead of in-memory limits
- deeper automated testing for workflow execution and MCP tools
- patch-based workflow updates instead of full graph replacement
- stronger observability with tracing and structured logs
- support for more node types and more integrations

So the current project is functionally complete, but there is still clear room for production-level hardening."

---

## 12. Closing

"To conclude, this project is an AI-powered workflow automation platform that combines a visual workflow editor, a durable execution engine, and an MCP-based AI integration layer.

The key value of the project is that it is not only solving a user interaction problem, but also exposing the platform in a way that intelligent clients can use safely and effectively.

Thank you. I'd be happy to answer any questions."

---

## Short 4-minute version

"Good morning/afternoon. My project is an AI-powered workflow automation platform called Nodebase.

The main goal of the project is to let users visually create workflows, connect external services, and execute them reliably. A workflow is represented as a graph of nodes and connections, so users can model triggers and actions in a drag-and-drop interface.

From the technical side, I used Next.js and React for the frontend, Prisma and PostgreSQL for persistence, Better Auth for authentication, and Inngest for durable workflow execution.

One of the most important architectural decisions was using two API layers. The internal web app uses tRPC for end-to-end type safety, while the external AI integration uses MCP through a dedicated `/api/mcp` endpoint. I chose this because the web app and AI clients have different interface needs.

When a workflow is executed, the system sends an event to Inngest, loads the workflow graph, performs topological sorting, and executes each node in the correct dependency order. Execution results are stored so users can inspect success or failure later.

For security, credentials are encrypted, data is scoped per user, and MCP access uses scoped API keys or sessions.

Overall, the project is significant because it combines workflow automation, durable orchestration, and AI-native interoperability in one system.

Thank you."

---

## Suggested reviewer questions and ready responses

### Q1. Why did you choose this project?

"I wanted to build something beyond a normal CRUD system. Workflow automation naturally introduces graph modeling, asynchronous execution, external integrations, and system design tradeoffs. Adding MCP also let me explore AI interoperability in a practical way."

### Q2. Why did you use both tRPC and MCP?

"Because they solve different problems. tRPC is optimized for internal full-stack development, while MCP is optimized for AI-client interoperability. Using both made the architecture more intentional."

### Q3. What is the most technically interesting part?

"The most technically interesting part is the workflow execution engine, because it has to convert a visual graph into a valid execution order and run it durably with proper error handling."

### Q4. What would you improve if this became a real product?

"I would improve distributed infrastructure concerns first: rate limiting, observability, testing depth, and more production-grade policy enforcement."

### Q5. What did you learn from this project?

"I learned that good system design is about choosing the right boundaries. Product APIs, execution runtimes, and AI-facing protocols may work on the same business domain, but they still need different designs."

---

## Delivery tips

- Speak slightly slower than normal.
- Do not rush the architecture section.
- During the demo, explain user value first and technical detail second.
- If a reviewer asks about a library, answer with the problem it solved.
- If you forget a detail, return to the three anchors:
  - visual workflow builder
  - durable execution engine
  - MCP-based AI integration

## Best final line

"The strongest part of this project is that it brings together user experience, system design, and AI integration in one coherent platform."
