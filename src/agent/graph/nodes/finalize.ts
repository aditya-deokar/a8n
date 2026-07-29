import { AIMessage } from "@langchain/core/messages";
import type { AgentGraphState } from "../state";

/**
 * Write a compact turn summary. Summarizes what was accomplished
 * in the current turn (planned, drafted, validated, applied, etc.)
 */
export async function finalizeNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  const parts: string[] = [];

  if (state.draftStatus === "applied") {
    parts.push(
      "The workflow draft has been applied successfully.",
    );
    if (state.workflowId) {
      parts.push(`Workflow ID: ${state.workflowId}`);
    }
  } else if (state.draftStatus === "previewed") {
    parts.push(
      "A preview has been generated. Please review the proposed changes and approve or reject them.",
    );
  } else if (state.draftStatus === "validated") {
    const report = state.validationReport;
    if (report?.valid) {
      parts.push(
        "The draft has been validated successfully and is ready for preview and apply.",
      );
    } else {
      parts.push(
        "Validation found issues that need to be resolved before applying.",
      );
      if (report?.errors?.length) {
        parts.push(`Errors: ${report.errors.join("; ")}`);
      }
    }
  } else if (state.draftStatus === "created" || state.draftStatus === "answering") {
    parts.push("A draft has been created or updated.");
    if (state.draftId) {
      parts.push(`Draft ID: ${state.draftId}`);
    }
  } else if (state.draftStatus === "planning") {
    parts.push(
      "A workflow plan has been created. The next step is to create a draft.",
    );
  }

  if (state.clarifications.length > 0) {
    parts.push(
      "I need some information to proceed:",
      ...state.clarifications.map((q, i) => `${i + 1}. ${q}`),
    );
  }

  if (state.credentialRefs.length > 0) {
    const missing = state.credentialRefs.filter((c) => !c.connected);
    if (missing.length > 0) {
      parts.push(
        "The following credentials need to be configured:",
        ...missing.map(
          (c) => `- ${c.name} (${c.type}) — please select or create this credential in the credential settings`,
        ),
      );
    }
  }

  // If we have nothing specific, the conversation messages already have the content
  if (parts.length === 0) {
    return {};
  }

  return {
    messages: [new AIMessage(parts.join("\n"))],
  };
}
