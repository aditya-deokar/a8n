import { z } from "zod";
import { auth } from "@/lib/auth";
import { AgentError } from "@/agent/errors";
import { streamAgentRun } from "@/agent/service";
import { encodeSseEvent } from "@/agent/api/events";
import { QuotaExceededError } from "@/lib/entitlements/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(20_000),
  clientMessageId: z.string().trim().min(1).max(120),
  workflowRevision: z.string().optional(),
});

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

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { code: "AGENT_TOOL_VALIDATION_FAILED", message: "Invalid agent run input." },
      { status: 400 },
    );
  }

  const { threadId } = await params;
  const correlationId =
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    `agent_${Date.now()}`;

  try {
    const events = await streamAgentRun({
      context: {
        userId: session.user.id,
        userName: session.user.name || "a8n user",
        userEmail: session.user.email || "unknown@a8n.local",
        threadId,
        langgraphThreadId: threadId,
        correlationId,
        authInfo: {
          userId: session.user.id,
          userName: session.user.name || "a8n user",
          userEmail: session.user.email || "unknown@a8n.local",
          scopes: ["workflows:read", "workflows:write", "credentials:read", "executions:read", "system:read"],
          method: "session",
        },
      },
      message: parsed.data.message,
      clientMessageId: parsed.data.clientMessageId,
      workflowRevision: parsed.data.workflowRevision,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of events) {
            controller.enqueue(encoder.encode(encodeSseEvent(event)));
          }
        } catch (error) {
          const message =
            error instanceof AgentError ? error.message : "Agent stream failed.";
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
    if (error instanceof QuotaExceededError) {
      return Response.json(
        { error: "QUOTA_EXCEEDED", ...error.toPayload() },
        { status: 402 },
      );
    }

    const agentError =
      error instanceof AgentError
        ? error
        : new AgentError("AGENT_INTERNAL_ERROR", "Unable to start agent run.", {
            cause: error,
          });
    const status =
      agentError.code === "AGENT_FEATURE_DISABLED" ? 404 :
      agentError.code === "AGENT_THREAD_NOT_FOUND" ? 404 :
      agentError.code === "AGENT_SAFETY_BLOCKED" ? 422 : 400;
    return Response.json(
      { code: agentError.code, message: agentError.message },
      { status },
    );
  }
}
