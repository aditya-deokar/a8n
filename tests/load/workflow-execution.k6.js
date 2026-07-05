/* global __ENV, __VU, __ITER */

import http from "k6/http";
import { check, sleep } from "k6";

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

export const options = {
  scenarios: {
    workflow_execution_probe: {
      executor: "constant-vus",
      vus: Number(__ENV.WORKFLOW_LOAD_VUS || 2),
      duration: __ENV.WORKFLOW_LOAD_DURATION || "1m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
  },
};

const baseUrl = __ENV.BASE_URL || "http://127.0.0.1:3000";
const workflowId = __ENV.WORKFLOW_ID || "staging-workflow-id-required";

export default function workflowExecutionLoad() {
  const response = http.post(
    `${baseUrl}/api/mcp`,
    JSON.stringify({
      jsonrpc: "2.0",
      id: `load-workflow-${__VU}-${__ITER}`,
      method: "tools/call",
      params: {
        name: "execute_workflow",
        arguments: {
          id: workflowId,
          approved: __ENV.WORKFLOW_LOAD_APPROVED === "true",
        },
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: __ENV.MCP_BEARER_TOKEN || "",
      },
      tags: {
        surface: "workflow-execution",
      },
    },
  );

  check(response, {
    "not 5xx": (res) => res.status < 500,
  });

  sleep(1);
}
