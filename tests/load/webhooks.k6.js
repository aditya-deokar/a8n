/* global __ENV, __VU, __ITER */

import http from "k6/http";
import { check, sleep } from "k6";

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

export const options = {
  scenarios: {
    webhook_burst: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: Number(__ENV.WEBHOOK_PREALLOCATED_VUS || 10),
      stages: [
        { duration: "20s", target: Number(__ENV.WEBHOOK_BURST_RPS || 10) },
        { duration: "40s", target: Number(__ENV.WEBHOOK_BURST_RPS || 10) },
        { duration: "20s", target: 1 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

const baseUrl = __ENV.BASE_URL || "http://127.0.0.1:3000";
const webhookPath = __ENV.WEBHOOK_LOAD_PATH || "/api/webhooks/google-form";

export default function webhookBurst() {
  const payload = {
    formId: "load-test-form",
    responseId: `load-${__VU}-${__ITER}`,
    submittedAt: new Date().toISOString(),
    answers: {
      source: "k6",
      mode: "staging-load-test",
    },
  };

  const response = http.post(`${baseUrl}${webhookPath}`, JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "x-a8n-webhook-secret": __ENV.WEBHOOK_SHARED_SECRET || "load-test-placeholder",
    },
    tags: {
      surface: "webhook",
    },
  });

  check(response, {
    "not 5xx": (res) => res.status < 500,
  });

  sleep(1);
}
