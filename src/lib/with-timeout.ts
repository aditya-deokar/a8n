export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Rejects when the wrapped promise exceeds `ms`. Use for outbound calls whose
 * client libraries have no built-in timeout support.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "Operation",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Default per-call timeouts for outbound providers (milliseconds). */
export const OUTBOUND_TIMEOUTS = {
  httpRequestMs: 30_000,
  aiModelMs: 120_000,
  smtpMs: 30_000,
  googleSheetsMs: 30_000,
} as const;
