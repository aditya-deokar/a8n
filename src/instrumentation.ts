export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { emitObservabilityEvent } = await import("@/lib/observability");

  emitObservabilityEvent({
    name: "app_boot",
    component: "system",
    severity: "info",
    message: "Application instrumentation registered.",
    attributes: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA,
    },
  });
}
