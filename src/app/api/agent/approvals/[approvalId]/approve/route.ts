import { z } from "zod";
import { auth } from "@/lib/auth";
import { approvalService } from "@/agent/safety/approval-service";
import { resumeAgentRun } from "@/agent/service";
import { encodeSseEvent } from "@/agent/api/events";
import { AgentError } from "@/agent/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agent/approvals/:approvalId/approve
 *
 * Approve a pending approval. Validates session, ownership, status, and expiry.
 * Resumes the paused LangGraph thread to execute the apply path.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<any> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json(
      { code: "AGENT_UNAUTHORIZED", message: "Authentication required." },
      { status: 401 },
    );
  }

  const { approvalId } = await params;
  const correlationId =
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    `approval_${Date.now()}`;

  try {
    const result = await approvalService.resolveApproval({
      approvalId,
      userId: session.user.id,
      action: "approve",
    });

    // Resume the agent run with the approval decision
    const events = await resumeAgentRun({
      context: {
        userId: session.user.id,
        userName: session.user.name || "a8n user",
        userEmail: session.user.email || "unknown@a8n.local",
        threadId: result.threadId,
        langgraphThreadId: result.threadId,
        correlationId,
        authInfo: {
          userId: session.user.id,
          userName: session.user.name || "a8n user",
          userEmail: session.user.email || "unknown@a8n.local",
          scopes: ["workflows:read", "workflows:write", "credentials:read", "executions:read", "system:read"],
          method: "session",
        },
      },
      approvalDecision: { approved: true },
    });

    // Stream the resume events
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of events) {
            controller.enqueue(encoder.encode(encodeSseEvent(event)));
          }
        } catch (error) {
          const message =
            error instanceof AgentError ? error.message : "Approval resume failed.";
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ code: "AGENT_INTERNAL_ERROR", message })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const agentError =
      error instanceof AgentError
        ? error
        : new AgentError("AGENT_INTERNAL_ERROR", "Unable to approve.", {
            cause: error,
          });
    const status =
      agentError.code === "AGENT_APPROVAL_EXPIRED" ? 410 :
      agentError.code === "AGENT_UNAUTHORIZED" ? 403 : 400;
    return Response.json(
      { code: agentError.code, message: agentError.message },
      { status },
    );
  }
}
