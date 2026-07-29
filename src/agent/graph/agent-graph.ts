import {
  END,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { toolsCondition } from "@langchain/langgraph/prebuilt";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

import { AgentGraphAnnotation, type AgentGraphState } from "./state";
import { loadContextNode } from "./nodes/load-context";
import { createClassifyRequestNode } from "./nodes/classify-request";
import { createPlanNode } from "./nodes/plan";
import { createToolCallNode } from "./nodes/tool-call";
import { createValidateNode } from "./nodes/validate";
import { createPreviewNode } from "./nodes/preview";
import { finalizeNode } from "./nodes/finalize";
import { humanApprovalNode } from "./nodes/human-approval";
import { createApplyNode } from "./nodes/apply";
import { syncEditorNode } from "./nodes/sync-editor";

/**
 * Build the full agent state machine graph.
 *
 * Graph flow:
 *   START → load_context → classify → [route by intent] →
 *     build/modify: agent_decide → [tool_calls] → tools → agent_decide → ...
 *                   ... eventually → finalize → END
 *     explain/discover/diagnose: agent_decide → [tool_calls] → tools → agent_decide → ... → finalize → END
 *     approval flow: ... → human_approval → [interrupt] → apply → sync_editor → finalize → END
 *     unsupported: finalize → END
 */
export function createAgentGraph(params: {
  model: BaseChatModel;
  tools: DynamicStructuredTool[];
  checkpointer: BaseCheckpointSaver;
  allowApply?: boolean;
}) {
  const { model, tools, checkpointer, allowApply = false } = params;

  // Create typed node functions
  const classifyNode = createClassifyRequestNode(model);
  const planNode = createPlanNode(model, tools);
  const toolCallNode = createToolCallNode(tools);
  const validateNode = createValidateNode(model, tools);
  const previewNode = createPreviewNode(model, tools);
  const applyNode = createApplyNode(tools);

  // The main agent decision node — the model decides what to do next
  const modelWithTools = model.bindTools ? model.bindTools(tools) : model;
  async function agentDecideNode(
    state: AgentGraphState,
  ): Promise<Partial<AgentGraphState>> {
    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] };
  }

  // Route based on classification
  function classifyRouter(
    state: AgentGraphState,
  ): "plan" | "agent_decide" | "finalize" {
    const phase = state.requestPhase;
    if (phase === "build" || phase === "modify") {
      return "plan";
    }
    if (
      phase === "explain" ||
      phase === "discover" ||
      phase === "diagnose"
    ) {
      return "agent_decide";
    }
    return "finalize";
  }

  // Route after agent decides — check for tool calls or if we should preview/finalize
  function agentDecideRouter(
    state: AgentGraphState,
  ): "tools" | "human_approval" | "finalize" {
    const lastMessage = state.messages[state.messages.length - 1];

    // Check if the model wants to call tools
    if (
      lastMessage &&
      "tool_calls" in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      return "tools";
    }

    // If we have a preview and apply is enabled, route to approval
    if (
      allowApply &&
      state.draftStatus === "previewed" &&
      state.previewPayload
    ) {
      return "human_approval";
    }

    return "finalize";
  }

  // Route after tools — back to agent or to specific handling
  function toolsRouter(
    state: AgentGraphState,
  ): "agent_decide" | "finalize" {
    // After tools execute, go back to agent to decide next step
    return "agent_decide";
  }

  // Route after plan — execute via tools or ask clarifications
  function planRouter(
    state: AgentGraphState,
  ): "tools" | "agent_decide" | "finalize" {
    const lastMessage = state.messages[state.messages.length - 1];

    if (
      lastMessage &&
      "tool_calls" in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      return "tools";
    }

    // If plan generated text (clarifications), go to agent_decide
    // for further interaction
    return "agent_decide";
  }

  // Route after approval
  function approvalRouter(
    state: AgentGraphState,
  ): "apply" | "finalize" {
    if (state.draftStatus === "applying") {
      return "apply";
    }
    return "finalize";
  }

  // Route after apply
  function applyRouter(
    state: AgentGraphState,
  ): "sync_editor" | "finalize" {
    if (state.draftStatus === "applied") {
      return "sync_editor";
    }
    return "finalize";
  }

  // Build the graph
  const graph = new StateGraph(AgentGraphAnnotation)
    // Add all nodes
    .addNode("load_context", loadContextNode)
    .addNode("classify", classifyNode)
    .addNode("plan", planNode)
    .addNode("agent_decide", agentDecideNode)
    .addNode("tools", toolCallNode)
    .addNode("human_approval", humanApprovalNode)
    .addNode("apply", applyNode)
    .addNode("sync_editor", syncEditorNode)
    .addNode("finalize", finalizeNode)

    // Wire the edges
    .addEdge(START, "load_context")
    .addEdge("load_context", "classify")
    .addConditionalEdges("classify", classifyRouter, [
      "plan",
      "agent_decide",
      "finalize",
    ])
    .addConditionalEdges("plan", planRouter, [
      "tools",
      "agent_decide",
      "finalize",
    ])
    .addConditionalEdges("agent_decide", agentDecideRouter, [
      "tools",
      "human_approval",
      "finalize",
    ])
    .addConditionalEdges("tools", toolsRouter, [
      "agent_decide",
      "finalize",
    ])
    .addConditionalEdges("human_approval", approvalRouter, [
      "apply",
      "finalize",
    ])
    .addConditionalEdges("apply", applyRouter, [
      "sync_editor",
      "finalize",
    ])
    .addEdge("sync_editor", "finalize")
    .addEdge("finalize", END)

    // Compile with checkpointer for durable state
    .compile({ checkpointer });

  return graph;
}
