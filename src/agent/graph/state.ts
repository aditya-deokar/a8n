import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * Classified user intent for routing the agent graph.
 */
export type AgentRequestPhase =
  | "build"
  | "modify"
  | "explain"
  | "discover"
  | "diagnose"
  | "approve"
  | "unsupported";

/**
 * Draft lifecycle status tracked in graph state.
 */
export type AgentDraftStatus =
  | "planning"
  | "created"
  | "answering"
  | "validated"
  | "previewed"
  | "applying"
  | "applied";

/**
 * Sanitized credential reference — the agent sees metadata only, never secrets.
 */
export type CredentialRef = {
  id: string;
  name: string;
  type: string;
  connected: boolean;
};

/**
 * Validation report summary for graph state.
 */
export type ValidationReport = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Preview payload from preview_workflow_diff.
 */
export type PreviewPayload = {
  draftId: string;
  workflowId: string | null;
  confirmationHash: string;
  diff: {
    addedNodes: unknown[];
    removedNodes: unknown[];
    changedNodes: unknown[];
    addedEdges: unknown[];
    removedEdges: unknown[];
  };
  validation: ValidationReport;
};

/**
 * Typed LangGraph state for the agent graph.
 *
 * Extends MessagesAnnotation (which provides the `messages` reducer)
 * and adds workflow/draft/approval context.
 */
export const AgentGraphAnnotation = Annotation.Root({
  // Inherit the messages channel from LangGraph's built-in annotation
  ...MessagesAnnotation.spec,

  /** Sanitized workflow summary loaded at run start */
  workflowContext: Annotation<Record<string, unknown> | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Current active draft ID, if any */
  draftId: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Current draft lifecycle status */
  draftStatus: Annotation<AgentDraftStatus | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Latest validation report */
  validationReport: Annotation<ValidationReport | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Preview payload from preview_workflow_diff — diff + confirmation hash */
  previewPayload: Annotation<PreviewPayload | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** AgentApproval row ID when waiting for approval */
  pendingApprovalId: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Classified intent for the current turn */
  requestPhase: Annotation<AgentRequestPhase>({
    reducer: (_prev, next) => next,
    default: () => "unsupported" as AgentRequestPhase,
  }),

  /** Pending clarification questions for the user */
  clarifications: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  /** Safe credential metadata references needed by draft */
  credentialRefs: Annotation<CredentialRef[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  /** Whether the agent is allowed to create/modify drafts */
  allowDraftWrites: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),

  /** Whether the agent is allowed to use apply (approval-gated) tools */
  allowApply: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),

  /** User ID for scoping tool calls and authorization */
  userId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  /** Workflow ID for scoping context */
  workflowId: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Retrieved long-term memories for context assembly */
  retrievedMemories: Annotation<
    Array<{ content: string; score: number; namespace: string[] }>
  >({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
});

export type AgentGraphState = typeof AgentGraphAnnotation.State;
