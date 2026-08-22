import prisma from "@/lib/db";
import { PLANS, WORKFLOW_EXECUTION_DAILY_GUARD, type PlanId } from "@/config/plans";
import { getEffectivePlan } from "@/lib/entitlements/get-plan";
import { calendarMonthWindow, utcDayWindow } from "@/lib/entitlements/windows";

export interface EntitlementSnapshot {
  plan: PlanId;
  workflows: { used: number; limit: number | null };
  credentials: { used: number; limit: number | null };
  chats: {
    used: number;
    limit: number | null;
    windowResetAt: string | null;
  };
  executionsToday: { used: number; guard: number };
  generatedAt: string;
}

export async function entitlementSnapshot(userId: string): Promise<EntitlementSnapshot> {
  const now = new Date();
  const plan = await getEffectivePlan(userId);
  const month = calendarMonthWindow(now);
  const day = utcDayWindow(now);

  const [workflowCount, credentialCount, chatCounter, executionCounter] =
    await Promise.all([
      prisma.workflow.count({ where: { userId } }),
      prisma.credential.count({ where: { userId } }),
      prisma.usageCounter.findUnique({
        where: {
          userId_resource_periodStart: {
            userId,
            resource: "agent_chat",
            periodStart: month.periodStart,
          },
        },
        select: { used: true },
      }),
      prisma.usageCounter.findUnique({
        where: {
          userId_resource_periodStart: {
            userId,
            resource: "workflow_execution",
            periodStart: day.periodStart,
          },
        },
        select: { used: true },
      }),
    ]);

  return {
    plan,
    workflows: { used: workflowCount, limit: PLANS[plan].maxWorkflows },
    credentials: { used: credentialCount, limit: PLANS[plan].maxCredentials },
    chats: {
      used: chatCounter?.used ?? 0,
      limit: PLANS[plan].maxAgentChatsPerWindow,
      windowResetAt: month.periodEnd.toISOString(),
    },
    executionsToday: {
      used: executionCounter?.used ?? 0,
      guard: WORKFLOW_EXECUTION_DAILY_GUARD,
    },
    generatedAt: now.toISOString(),
  };
}
