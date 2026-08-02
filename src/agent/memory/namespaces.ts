/**
 * Canonical memory namespaces for the agent long-term memory store.
 *
 * Each namespace is a string array used as a composite key in the
 * `agent_memory_item` table. The first element is always the userId
 * to guarantee tenant isolation at the storage layer.
 */

export type MemoryCategory =
  | "workflow-preferences"
  | "workflow-patterns"
  | "conversation-summaries";

const AGENT_NAMESPACE_PREFIX = "a8n-agent" as const;

/**
 * Build a fully-qualified namespace array for a user + category.
 */
export function buildMemoryNamespace(
  userId: string,
  category: MemoryCategory,
): string[] {
  return [userId, AGENT_NAMESPACE_PREFIX, category];
}

/**
 * All supported memory categories for iteration / UI display.
 */
export const MEMORY_CATEGORIES: readonly MemoryCategory[] = [
  "workflow-preferences",
  "workflow-patterns",
  "conversation-summaries",
] as const;

/**
 * Human-readable labels for memory categories.
 */
export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  "workflow-preferences": "Workflow Preferences",
  "workflow-patterns": "Workflow Patterns",
  "conversation-summaries": "Conversation Summaries",
};
