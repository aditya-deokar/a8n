/* global __ENV */

import http from "k6/http";
import { check, sleep } from "k6";

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

export const options = {
  scenarios: {
    steady_api_load: {
      executor: "constant-vus",
      vus: Number(__ENV.API_LOAD_VUS || 5),
      duration: __ENV.API_LOAD_DURATION || "1m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
  },
};

const baseUrl = __ENV.BASE_URL || "http://127.0.0.1:3000";
const apiPath = __ENV.API_LOAD_PATH || "/api/mcp";

export default function apiLoad() {
  const response = http.post(
    `${baseUrl}${apiPath}`,
    JSON.stringify({
      jsonrpc: "2.0",
      id: "load-api-tools-list",
      method: "tools/list",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: __ENV.MCP_BEARER_TOKEN || "",
      },
      tags: {
        surface: "api",
      },
    },
  );

  check(response, {
    "not 5xx": (res) => res.status < 500,
  });

  sleep(1);
}
