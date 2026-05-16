/**
 * Error Boundary Middleware
 *
 * Standardizes error handling across all MCP tool executions.
 * Maps application-specific errors (Prisma, Zod, tRPC) to
 * clean MCP-compatible error responses without leaking internals.
 */

/**
 * Known error categories with user-friendly messages
 */
const ERROR_MAP: Array<{
  match: (error: unknown) => boolean;
  message: (error: unknown) => string;
}> = [
  // Prisma: Record not found
  {
    match: (e) =>
      e instanceof Error &&
      (e.name === "NotFoundError" ||
        e.message.includes("Record to") ||
        e.message.includes("No Workflow found") ||
        e.message.includes("No Credential found") ||
        e.message.includes("No Execution found")),
    message: () => "Resource not found. Please check the ID and try again.",
  },

  // Permission / scope errors
  {
    match: (e) =>
      e instanceof Error && e.message.includes("Permission denied"),
    message: (e) => (e as Error).message,
  },

  // Zod validation errors
  {
    match: (e) =>
      e instanceof Error &&
      (e.name === "ZodError" || e.message.includes("Validation")),
    message: (e) => `Validation error: ${(e as Error).message}`,
  },

  // Rate limit errors
  {
    match: (e) =>
      e instanceof Error && e.message.includes("Rate limit"),
    message: (e) => (e as Error).message,
  },

  // Auth errors
  {
    match: (e) =>
      e instanceof Error &&
      (e.message.includes("UNAUTHORIZED") ||
        e.message.includes("Unauthorized")),
    message: () => "Authentication required. Please provide a valid API key or session token.",
  },

  // Subscription errors
  {
    match: (e) =>
      e instanceof Error &&
      (e.message.includes("FORBIDDEN") ||
        e.message.includes("subscription")),
    message: () => "This operation requires an active subscription.",
  },
];

/**
 * Wrap a tool handler with standardized error handling.
 * Returns a clean error message for known errors,
 * and a generic message for unknown errors (no stack trace leakage).
 *
 * @param toolName - The MCP tool name (for logging context)
 * @param handler - The async tool handler function
 * @returns The handler result or a formatted error response
 */
export async function withErrorBoundary<T>(
  toolName: string,
  handler: () => Promise<T>,
): Promise<T> {
  try {
    return await handler();
  } catch (error) {
    // Find the first matching error handler
    for (const entry of ERROR_MAP) {
      if (entry.match(error)) {
        throw new Error(entry.message(error));
      }
    }

    // Unknown error — log full details server-side, return generic message
    console.error(`[MCP:ERROR] Tool "${toolName}" failed:`, error);

    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && error instanceof Error
      ? `Internal error: ${error.message}`
      : "An internal error occurred. Please try again later.";

    throw new Error(message);
  }
}
