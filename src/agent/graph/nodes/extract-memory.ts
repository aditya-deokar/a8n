import { createId } from "@paralleldrive/cuid2";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import type { AgentGraphState } from "../state";
import { agentMemoryEnabled } from "@/agent/feature-policy";
import { agentMemoryStore } from "@/agent/memory/store";
import { evaluateMemoryExtraction } from "@/agent/memory/extraction-policy";
import { buildMemoryNamespace, type MemoryCategory } from "@/agent/memory/namespaces";

const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction assistant. Your task is to extract 0–3 compact, reusable facts from this conversation that would help the user in future conversations.

Rules:
- Extract ONLY user preferences, workflow patterns, or tool preferences.
- Each fact must be a single concise sentence (under 200 characters).
- Do NOT extract credentials, API keys, passwords, secrets, or personally identifiable information.
- Do NOT extract raw conversation transcripts.
- Do NOT extract facts that are too specific to this single conversation to be useful later.
- If there is nothing worth remembering, return an empty array.

Categorize each fact as one of:
- "workflow-preferences" — user's preferences for how workflows should be built
- "workflow-patterns" — common patterns, integrations, or node combinations the user uses
- "conversation-summaries" — high-level summary of what was accomplished

Respond with a JSON array of objects, each with "content" (string) and "category" (string). Example:
[{"content": "User prefers Google Sheets as the default data destination.", "category": "workflow-preferences"}]

If nothing is worth remembering, respond with: []`;

/**
 * Create the extract_memory graph node.
 *
 * This node runs after finalize and proposes 0–3 compact memory facts
 * from the conversation. Each fact is filtered through the extraction
 * policy before being stored.
 *
 * Gated by the agentLongTermMemory feature flag.
 */
export function createExtractMemoryNode(model: BaseChatModel) {
  return async function extractMemoryNode(
    state: AgentGraphState,
  ): Promise<Partial<AgentGraphState>> {
    const { userId } = state;

    // Skip if memory is disabled or no userId
    if (!userId || !agentMemoryEnabled({ userId })) {
      return {};
    }

    // Only extract memories from conversations with at least 2 messages
    // (system + user minimum)
    if (state.messages.length < 3) {
      return {};
    }

    try {
      // Build a condensed conversation summary for the extraction model
      const recentMessages = state.messages.slice(-10);
      const conversationSummary = recentMessages
        .map((msg) => {
          const role = msg._getType?.() || "unknown";
          const content =
            typeof msg.content === "string"
              ? msg.content.slice(0, 500)
              : JSON.stringify(msg.content).slice(0, 500);
          return `${role}: ${content}`;
        })
        .join("\n");

      const response = await model.invoke([
        new SystemMessage(EXTRACTION_SYSTEM_PROMPT),
        new HumanMessage(
          `Extract reusable memory facts from this conversation:\n\n${conversationSummary}`,
        ),
      ]);

      const responseText =
        typeof response.content === "string"
          ? response.content
          : Array.isArray(response.content)
            ? response.content
                .map((p) =>
                  typeof p === "string"
                    ? p
                    : p && typeof p === "object" && "text" in p
                      ? String(p.text)
                      : "",
                )
                .join("")
            : "";

      // Parse the JSON array from the model response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return {};

      const proposals: Array<{ content: string; category: string }> =
        JSON.parse(jsonMatch[0]);

      if (!Array.isArray(proposals) || proposals.length === 0) return {};

      // Process each proposed memory through the extraction policy
      for (const proposal of proposals.slice(0, 3)) {
        if (!proposal.content || typeof proposal.content !== "string") continue;

        const category = proposal.category as MemoryCategory;
        if (
          !["workflow-preferences", "workflow-patterns", "conversation-summaries"].includes(
            category,
          )
        ) {
          continue;
        }

        const evaluation = evaluateMemoryExtraction(proposal.content);

        if (evaluation.decision !== "allowed" || !evaluation.redactedContent) {
          continue;
        }

        // Write the approved memory
        await agentMemoryStore.put({
          id: createId(),
          userId,
          namespace: buildMemoryNamespace(userId, category),
          content: evaluation.redactedContent,
          data: {
            source: "agent-extraction",
            category,
            extractedAt: new Date().toISOString(),
          },
        });
      }
    } catch {
      // Memory extraction is best-effort — never fail the run
    }

    return {};
  };
}
