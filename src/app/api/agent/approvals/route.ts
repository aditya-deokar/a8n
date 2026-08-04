import { z } from "zod";
import { auth } from "@/lib/auth";
import { approvalService } from "@/agent/safety/approval-service";
import { AgentError } from "@/agent/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agent/approvals?threadId=X
 *
 * List pending approvals for the authenticated user's thread.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json(
      { code: "AGENT_UNAUTHORIZED", message: "Authentication required." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId");

  if (!threadId) {
    return Response.json(
      { code: "AGENT_TOOL_VALIDATION_FAILED", message: "threadId is required." },
      { status: 400 },
    );
  }

  try {
    const approvals = await approvalService.listPending({
      threadId,
      userId: session.user.id,
    });
    return Response.json({ approvals });
  } catch (error) {
    const agentError =
      error instanceof AgentError
        ? error
        : new AgentError("AGENT_INTERNAL_ERROR", "Unable to list approvals.", {
            cause: error,
          });
    return Response.json(
      { code: agentError.code, message: agentError.message },
      { status: 400 },
    );
  }
}
