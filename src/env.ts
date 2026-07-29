import { z, type ZodIssue } from "zod";

export type EnvValidationProfile = "development" | "test" | "production";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

const requiredString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1),
);

const normalizeBooleanEnv = (value: unknown) => {
  const normalized = emptyToUndefined(value);
  if (typeof normalized === "boolean") return normalized ? "true" : "false";
  if (typeof normalized !== "string") return normalized;

  const lowered = normalized.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(lowered)) return "true";
  if (["0", "false", "no", "n", "off"].includes(lowered)) return "false";
  return normalized;
};

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().url().optional(),
);

const optionalBoolean = z
  .preprocess(normalizeBooleanEnv, z.enum(["true", "false"]).optional())
  .transform((value) => (value === undefined ? undefined : value === "true"));

const optionalPositiveInt = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);

const optionalNonNegativeInt = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(0).optional(),
);

const optionalPercent = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(0).max(100).optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  A8N_ENV_PROFILE: z
    .preprocess(
      emptyToUndefined,
      z.enum(["development", "test", "production"]).optional(),
    )
    .optional(),
  VERCEL_ENV: z
    .preprocess(
      emptyToUndefined,
      z.enum(["development", "preview", "production"]).optional(),
    )
    .optional(),
  CI: optionalBoolean,

  DATABASE_URL: requiredString,

  BETTER_AUTH_SECRET: requiredString,
  BETTER_AUTH_URL: optionalUrl,
  NEXT_PUBLIC_APP_URL: z.string().trim().url(),
  APP_URL: optionalUrl,
  NEXT_PUBLIC_WEBHOOK_BASE_URL: optionalUrl,

  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

  ENCRYPTION_KEY: requiredString,

  POLAR_ACCESS_TOKEN: optionalString,
  POLAR_SUCCESS_URL: optionalUrl,

  INNGEST_EVENT_KEY: optionalString,
  INNGEST_SIGNING_KEY: optionalString,

  OBSERVABILITY_LOG_ENABLED: optionalBoolean,
  OBSERVABILITY_LOG_LEVEL: z
    .preprocess(emptyToUndefined, z.enum(["debug", "info", "warn", "error", "fatal"]).optional())
    .optional(),
  OBSERVABILITY_LOG_FORMAT: z
    .preprocess(emptyToUndefined, z.enum(["json", "pretty"]).optional())
    .optional(),
  OBSERVABILITY_REDACTION_STRICT: optionalBoolean,
  OBSERVABILITY_INCLUDE_ERROR_STACK: optionalBoolean,
  OBSERVABILITY_CLIENT_LOG_ENABLED: optionalBoolean,
  OBSERVABILITY_REQUEST_BODY_LOG_ENABLED: optionalBoolean,
  OBSERVABILITY_SLOW_QUERY_MS: optionalPositiveInt,
  OBSERVABILITY_SAMPLE_DEBUG_RATE: optionalNonNegativeInt,
  OBSERVABILITY_PROVIDER: z
    .preprocess(emptyToUndefined, z.enum(["console", "sentry", "otel", "datadog"]).optional())
    .optional(),
  OBSERVABILITY_METRICS_ENDPOINT: optionalUrl,
  ERROR_TRACKING_DSN: optionalString,
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  OTEL_SERVICE_NAME: optionalString,
  OTEL_HEADERS: optionalString,
  ALERT_WEBHOOK_URL: optionalUrl,
  RELEASE_VERSION: optionalString,
  ROLLBACK_TARGET: optionalString,
  BACKUP_PROVIDER: optionalString,
  RESTORE_DRILL_TARGET: optionalString,
  BASE_URL: optionalUrl,
  API_LOAD_PATH: optionalString,
  WEBHOOK_LOAD_PATH: optionalString,
  MCP_BEARER_TOKEN: optionalString,
  WORKFLOW_ID: optionalString,

  FEATURE_FLAGS_ENABLED: optionalBoolean,
  FEATURE_FLAG_OVERRIDES: optionalString,
  FEATURE_FLAG_NEW_WORKFLOW_EDITOR_ROLLOUT_PERCENT: optionalPercent,
  FEATURE_FLAG_API_CANARY_ROLLOUT_PERCENT: optionalPercent,
  FEATURE_FLAG_MCP_ENHANCED_TOOLING_ROLLOUT_PERCENT: optionalPercent,
  FEATURE_FLAG_CREDENTIAL_ROTATION_FLOW_ROLLOUT_PERCENT: optionalPercent,
  FEATURE_FLAG_EMBEDDED_AGENT_ROLLOUT_PERCENT: optionalPercent,
  FEATURE_FLAG_EMBEDDED_AGENT_APPLY_ROLLOUT_PERCENT: optionalPercent,
  FEATURE_FLAG_AGENT_LONG_TERM_MEMORY_ROLLOUT_PERCENT: optionalPercent,
  FEATURE_FLAG_AGENT_PROVIDER_FALLBACK_ROLLOUT_PERCENT: optionalPercent,
  CANARY_ROLLOUT_PERCENT: optionalPercent,
  EXPERIMENT_EVENT_LOG_ENABLED: optionalBoolean,
  EXPERIMENT_WORKFLOW_ONBOARDING_V2_VARIANT: optionalString,
  KILL_SWITCH_DISABLE_WORKFLOW_EXECUTION: optionalBoolean,
  KILL_SWITCH_DISABLE_WEBHOOK_PROCESSING: optionalBoolean,
  KILL_SWITCH_DISABLE_MCP_MUTATIONS: optionalBoolean,
  KILL_SWITCH_READ_ONLY_MODE: optionalBoolean,
  KILL_SWITCH_DISABLE_AGENT_RUNS: optionalBoolean,
  KILL_SWITCH_DISABLE_AGENT_MUTATIONS: optionalBoolean,

  OPENAI_API_KEY: optionalString,
  AGENT_MODEL_PROVIDER: z
    .preprocess(emptyToUndefined, z.enum(["openai", "mock"]).optional())
    .optional(),
  AGENT_MODEL_NAME: optionalString,
  AGENT_FALLBACK_MODEL_NAME: optionalString,
  AGENT_CHECKPOINT_SCHEMA: optionalString,
  AGENT_MAX_STEPS: optionalPositiveInt,
  AGENT_RUN_TIMEOUT_MS: optionalPositiveInt,
  AGENT_MAX_TOOL_CALLS: optionalPositiveInt,
  AGENT_MEMORY_TTL_DAYS: optionalPositiveInt,
  AGENT_EMBEDDING_MODEL: optionalString,
  AGENT_EMBEDDING_DIMENSIONS: optionalPositiveInt,
  AGENT_TOOL_TIMEOUT_MS: optionalPositiveInt,

  MCP_APP_PROFILE: optionalString,
  MCP_AUDIT_LOG_ENABLED: optionalBoolean,
  MCP_AUDIT_DB_ENABLED: optionalBoolean,
  MCP_OBSERVABILITY_LOG_ENABLED: optionalBoolean,
  MCP_API_KEY_HMAC_SECRET: optionalString,
  MCP_OAUTH_TOKEN_HMAC_SECRET: optionalString,
  MCP_CORS_ORIGINS: optionalString,
  MCP_RATE_LIMIT_BACKEND: z
    .preprocess(emptyToUndefined, z.enum(["memory", "database"]).optional())
    .optional(),
  MCP_SAFE_FETCH_ALLOWLIST_MODE: optionalBoolean,
  MCP_SAFE_FETCH_ALLOWLIST_DOMAINS: optionalString,

  MCP_OAUTH_ISSUER: optionalUrl,
  MCP_OAUTH_RESOURCE: optionalUrl,
  MCP_OAUTH_REDIRECT_URIS: optionalString,
  MCP_OAUTH_CLIENT_ID: optionalString,
  MCP_OAUTH_ALLOW_DYNAMIC_CLIENT_REGISTRATION: optionalBoolean,
  MCP_OAUTH_DYNAMIC_CLIENT_REGISTRATION_APPROVED: optionalBoolean,
  MCP_OAUTH_ROTATE_REFRESH_TOKENS: optionalBoolean,
  MCP_OAUTH_EXACT_REDIRECT_URIS: optionalBoolean,
  MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS: optionalPositiveInt,
  MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS: optionalPositiveInt,
  MCP_OAUTH_AUTH_CODE_TTL_SECONDS: optionalPositiveInt,

  MCP_ALERT_WINDOW_MS: optionalPositiveInt,
  MCP_ALERT_AUTH_FAILURE_THRESHOLD: optionalPositiveInt,
  MCP_ALERT_SCOPE_DENIAL_THRESHOLD: optionalPositiveInt,
  MCP_ALERT_PROMPT_INJECTION_THRESHOLD: optionalPositiveInt,
  MCP_ALERT_APPROVAL_BYPASS_THRESHOLD: optionalPositiveInt,
  MCP_ALERT_TOOL_ERROR_RATE_PERCENT: optionalPositiveInt,
  MCP_ALERT_RATE_LIMIT_DENIAL_THRESHOLD: optionalPositiveInt,
  MCP_ALERT_OAUTH_TOKEN_ERROR_THRESHOLD: optionalPositiveInt,
  MCP_ALERT_AUDIT_PERSIST_FAILURE_THRESHOLD: optionalPositiveInt,

  MCP_DISABLE_SIDE_EFFECT_TOOLS: optionalBoolean,
  MCP_DISABLE_CREDENTIAL_MUTATION: optionalBoolean,
  MCP_FORCE_READ_ONLY_CHATGPT_PROFILE: optionalBoolean,
  MCP_SAFETY_STRICT_MODE: optionalBoolean,

  A8N_WEBHOOK_SHARED_SECRET: optionalString,
  GOOGLE_FORM_WEBHOOK_SECRET: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_WEBHOOK_SHARED_SECRET: optionalString,
  WEBHOOK_SHARED_SECRET: optionalString,

  CRON_SECRET: optionalString,
  MCP_MAINTENANCE_SECRET: optionalString,

  NGROK_URL: optionalUrl,
  NGROK_AUTHTOKEN: optionalString,
  VERCEL_URL: optionalString,
  PREVIEW_URL: optionalUrl,
  STAGING_URL: optionalUrl,

  E2E_TESTS: optionalBoolean,
  E2E_EXTERNAL_SERVICES: z
    .preprocess(emptyToUndefined, z.enum(["mock", "live"]).optional())
    .optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export type EnvValidationOptions = {
  profile?: EnvValidationProfile;
};

export function resolveEnvProfile(input: NodeJS.ProcessEnv): EnvValidationProfile {
  if (
    input.A8N_ENV_PROFILE === "development" ||
    input.A8N_ENV_PROFILE === "test" ||
    input.A8N_ENV_PROFILE === "production"
  ) {
    return input.A8N_ENV_PROFILE;
  }

  if (input.VERCEL_ENV === "production") return "production";
  if (input.NODE_ENV === "test" || normalizeBooleanEnv(input.CI) === "true") {
    return "test";
  }
  if (input.NODE_ENV === "production") return "production";
  return "development";
}

function addIssue(
  issues: ZodIssue[],
  path: string,
  message: string,
) {
  issues.push({
    code: "custom",
    input: undefined,
    path: [path],
    message,
  });
}

function requireProductionValue(
  parsed: AppEnv,
  issues: ZodIssue[],
  key: keyof AppEnv,
) {
  if (!parsed[key]) {
    addIssue(issues, String(key), `${String(key)} is required in production.`);
  }
}

function requireSecretLength(
  parsed: AppEnv,
  issues: ZodIssue[],
  key: keyof AppEnv,
  minLength: number,
) {
  const value = parsed[key];
  if (typeof value === "string" && value.length < minLength) {
    addIssue(
      issues,
      String(key),
      `${String(key)} must be at least ${minLength} characters.`,
    );
  }
}

function requireHttpsUrl(
  parsed: AppEnv,
  issues: ZodIssue[],
  key: keyof AppEnv,
) {
  const value = parsed[key];
  if (typeof value === "string" && !value.startsWith("https://")) {
    addIssue(issues, String(key), `${String(key)} must use HTTPS in production.`);
  }
}

export function validateEnv(
  input: NodeJS.ProcessEnv = process.env,
  options: EnvValidationOptions = {},
): AppEnv {
  const parsed = envSchema.safeParse(input);

  if (!parsed.success) {
    throw parsed.error;
  }

  const env = parsed.data;
  const profile = options.profile || resolveEnvProfile(input);
  const issues: ZodIssue[] = [];

  requireSecretLength(env, issues, "BETTER_AUTH_SECRET", 32);
  requireSecretLength(env, issues, "ENCRYPTION_KEY", 32);
  requireSecretLength(env, issues, "MCP_API_KEY_HMAC_SECRET", 32);
  requireSecretLength(env, issues, "MCP_OAUTH_TOKEN_HMAC_SECRET", 32);

  const githubPairComplete =
    Boolean(env.GITHUB_CLIENT_ID) === Boolean(env.GITHUB_CLIENT_SECRET);
  if (!githubPairComplete) {
    addIssue(
      issues,
      "GITHUB_CLIENT_SECRET",
      "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be configured together.",
    );
  }

  const googlePairComplete =
    Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET);
  if (!googlePairComplete) {
    addIssue(
      issues,
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.",
    );
  }

  if (profile === "production") {
    requireProductionValue(env, issues, "BETTER_AUTH_URL");
    requireProductionValue(env, issues, "POLAR_ACCESS_TOKEN");
    requireProductionValue(env, issues, "POLAR_SUCCESS_URL");
    requireProductionValue(env, issues, "MCP_API_KEY_HMAC_SECRET");
    requireProductionValue(env, issues, "MCP_OAUTH_TOKEN_HMAC_SECRET");

    requireHttpsUrl(env, issues, "BETTER_AUTH_URL");
    requireHttpsUrl(env, issues, "NEXT_PUBLIC_APP_URL");
    requireHttpsUrl(env, issues, "APP_URL");
    requireHttpsUrl(env, issues, "NEXT_PUBLIC_WEBHOOK_BASE_URL");
    requireHttpsUrl(env, issues, "POLAR_SUCCESS_URL");
    requireHttpsUrl(env, issues, "MCP_OAUTH_ISSUER");
    requireHttpsUrl(env, issues, "MCP_OAUTH_RESOURCE");

    if (env.MCP_CORS_ORIGINS === "*") {
      addIssue(
        issues,
        "MCP_CORS_ORIGINS",
        "MCP_CORS_ORIGINS must not be '*' in production.",
      );
    }
  }

  if (issues.length > 0) {
    throw new z.ZodError(issues);
  }

  return env;
}

export const env = validateEnv();
