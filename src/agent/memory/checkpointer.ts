import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AGENT_CONFIG, assertAgentConfig } from "@/agent/config";
import { env } from "@/env";

let checkpointer: PostgresSaver | undefined;
let setupPromise: Promise<void> | undefined;

export function getAgentCheckpointer(): PostgresSaver {
  assertAgentConfig();
  checkpointer ??= PostgresSaver.fromConnString(env.DATABASE_URL, {
    schema: AGENT_CONFIG.checkpointSchema,
  });
  return checkpointer;
}

/**
 * LangGraph owns the checkpoint table migration. Calling setup is idempotent
 * and protected by a process-local promise so concurrent first runs do not
 * race the migration.
 */
export async function ensureAgentCheckpointer(): Promise<PostgresSaver> {
  const saver = getAgentCheckpointer();
  setupPromise ??= saver.setup();
  await setupPromise;
  return saver;
}

export async function closeAgentCheckpointer(): Promise<void> {
  if (!checkpointer) return;
  await checkpointer.end();
  checkpointer = undefined;
  setupPromise = undefined;
}
