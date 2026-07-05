export function currentEnvironment() {
  return (
    process.env.A8N_ENV_PROFILE ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    "development"
  );
}

export function currentRelease() {
  return process.env.RELEASE_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
}

export function baseLogFields() {
  const service = process.env.OTEL_SERVICE_NAME || "a8n";
  const environment = currentEnvironment();
  const release = currentRelease();

  return {
    service,
    environment,
    release,
    provider: process.env.OBSERVABILITY_PROVIDER || "console",
    env: environment,
    version: release,
    "service.name": service,
    "deployment.environment": environment,
    "deployment.version": release,
  };
}
