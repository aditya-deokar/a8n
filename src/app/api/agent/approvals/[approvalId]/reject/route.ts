import { z } from "zod";
import { auth } from "@/lib/auth";
import { approvalService } from "@/agent/safety/approval-service";
import { resumeAgentRun } from "@/agent/service";
import { encodeSseEvent } from "@/agent/api/events";
import { AgentError } from "@/agent/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/**
 * POST /api/agent/approvals/:approvalId/reject
 *
 * Reject a pending approval. Validates session, ownership, status, and expiry.
 * Resumes the paused LangGraph thread with the rejection so the agent can respond.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<any> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json(
      { code: "AGENT_UNAUTHORIZED", message: "Authentication required." },
      { status: 401 },
    );
  }

  const { approvalId } = await params;
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  const reason = body.success ? body.data.reason : undefined;
  const correlationId =
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    `rejection_${Date.now()}`;

  try {
    const result = await approvalService.resolveApproval({
      approvalId,
      userId: session.user.id,
      action: "reject",
      reason,
    });

    // Resume the agent run with the rejection
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
      approvalDecision: { approved: false, reason },
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
            error instanceof AgentError ? error.message : "Rejection resume failed.";
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
        : new AgentError("AGENT_INTERNAL_ERROR", "Unable to reject.", {
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
