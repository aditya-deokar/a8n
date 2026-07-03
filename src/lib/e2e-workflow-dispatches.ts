import { isE2EMode } from "@/lib/e2e-safety";

export type E2EWorkflowDispatch = {
  eventId: string;
  workflowId: string;
  data: Record<string, unknown>;
  createdAt: string;
};

const globalForE2EDispatches = globalThis as unknown as {
  e2eWorkflowDispatches?: E2EWorkflowDispatch[];
};

function requireE2EMockMode() {
  if (!isE2EMode() || process.env.E2E_EXTERNAL_SERVICES !== "mock") {
    throw new Error("E2E workflow dispatch recorder is only available in E2E mock mode.");
  }
}

function dispatches() {
  globalForE2EDispatches.e2eWorkflowDispatches ??= [];
  return globalForE2EDispatches.e2eWorkflowDispatches;
}

export function recordE2EWorkflowDispatch(
  eventId: string,
  data: { workflowId: string; [key: string]: unknown },
) {
  requireE2EMockMode();

  const dispatch = {
    eventId,
    workflowId: data.workflowId,
    data: { ...data },
    createdAt: new Date().toISOString(),
  };

  dispatches().push(dispatch);
  return dispatch;
}

export function listE2EWorkflowDispatches(workflowId?: string) {
  requireE2EMockMode();

  const allDispatches = dispatches();
  return workflowId
    ? allDispatches.filter((dispatch) => dispatch.workflowId === workflowId)
    : [...allDispatches];
}

export function clearE2EWorkflowDispatches() {
  requireE2EMockMode();
  globalForE2EDispatches.e2eWorkflowDispatches = [];
}
