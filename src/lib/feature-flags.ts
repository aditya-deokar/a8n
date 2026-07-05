import "server-only";
import { createHash } from "node:crypto";
import {
  experiments,
  featureFlags,
  killSwitches,
  type ExperimentKey,
  type FeatureFlagKey,
  type KillSwitchKey,
} from "@/config/feature-flags";
import { emitObservabilityEvent } from "@/lib/observability";

type EvaluationContext = {
  userId?: string;
  email?: string;
  plan?: string;
  environment?: string;
};

type FlagSnapshot = {
  enabled: boolean;
  reason: string;
  rolloutPercent: number;
};

function envBoolean(value: string | undefined) {
  if (!value) return undefined;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return undefined;
}

function envPercent(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.min(100, Math.floor(parsed)));
}

function hashBucket(parts: string[]) {
  const input = parts.join(":");
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 8);
  return parseInt(hash, 16) % 100;
}

function identityFor(context: EvaluationContext) {
  return context.userId || context.email || "anonymous";
}

function parseOverrides() {
  const raw = process.env.FEATURE_FLAG_OVERRIDES;
  const overrides = new Map<string, boolean>();
  if (!raw) return overrides;

  for (const entry of raw.split(",")) {
    const [key, value] = entry.split("=").map((part) => part.trim());
    const parsed = envBoolean(value);
    if (key && parsed !== undefined) overrides.set(key, parsed);
  }

  return overrides;
}

function featureFlagsGloballyEnabled() {
  return process.env.FEATURE_FLAGS_ENABLED !== "false";
}

export function getFeatureFlagSnapshot(
  key: FeatureFlagKey,
  context: EvaluationContext = {},
): FlagSnapshot {
  const definition = featureFlags[key];
  const overrides = parseOverrides();
  const explicit = overrides.get(key);
  const rolloutPercent =
    envPercent(process.env[definition.rolloutEnv]) ??
    envPercent(process.env.CANARY_ROLLOUT_PERCENT) ??
    definition.rolloutPercent;

  if (!featureFlagsGloballyEnabled()) {
    return { enabled: false, reason: "feature_flags_disabled", rolloutPercent: 0 };
  }

  if (explicit !== undefined) {
    return {
      enabled: explicit,
      reason: "env_override",
      rolloutPercent: explicit ? 100 : 0,
    };
  }

  if (definition.defaultEnabled) {
    return { enabled: true, reason: "default_enabled", rolloutPercent: 100 };
  }

  const bucket = hashBucket([key, identityFor(context)]);
  const enabled = bucket < rolloutPercent;
  return {
    enabled,
    reason: enabled ? "rollout_bucket" : "rollout_bucket_excluded",
    rolloutPercent,
  };
}

export function isFeatureEnabled(
  key: FeatureFlagKey,
  context: EvaluationContext = {},
) {
  return getFeatureFlagSnapshot(key, context).enabled;
}

export function isKillSwitchEnabled(key: KillSwitchKey) {
  const definition = killSwitches[key];
  return envBoolean(process.env[definition.env]) === true;
}

export function assertKillSwitchOff(key: KillSwitchKey) {
  if (!isKillSwitchEnabled(key)) return;

  emitObservabilityEvent({
    name: "kill_switch_blocked_operation",
    component: "system",
    severity: "warn",
    message: `${key} is enabled.`,
    attributes: {
      killSwitch: key,
      env: killSwitches[key].env,
    },
  });

  throw new Error(`Operation blocked by kill switch: ${key}`);
}

export function assignExperimentVariant(
  key: ExperimentKey,
  context: EvaluationContext,
) {
  const definition = experiments[key];
  const override = process.env[definition.variantOverrideEnv];
  if (override && definition.variants.some((variant) => variant.key === override)) {
    return override;
  }

  const bucket = hashBucket([key, identityFor(context)]);
  let cursor = 0;

  for (const variant of definition.variants) {
    cursor += variant.weight;
    if (bucket < cursor) return variant.key;
  }

  return definition.variants[0]?.key || "control";
}

export function recordExperimentExposure(
  key: ExperimentKey,
  variant: string,
  context: EvaluationContext = {},
) {
  if (process.env.EXPERIMENT_EVENT_LOG_ENABLED === "false") return;

  emitObservabilityEvent({
    name: "experiment_exposure",
    component: "system",
    severity: "info",
    userId: context.userId,
    attributes: {
      experiment: key,
      variant,
      plan: context.plan,
      environment: context.environment,
    },
  });
}

export function getFeatureFlagDiagnostics(context: EvaluationContext = {}) {
  return {
    flags: Object.keys(featureFlags).map((key) => {
      const flagKey = key as FeatureFlagKey;
      return {
        key: flagKey,
        ...getFeatureFlagSnapshot(flagKey, context),
      };
    }),
    killSwitches: Object.keys(killSwitches).map((key) => {
      const switchKey = key as KillSwitchKey;
      return {
        key: switchKey,
        enabled: isKillSwitchEnabled(switchKey),
        env: killSwitches[switchKey].env,
      };
    }),
  };
}
