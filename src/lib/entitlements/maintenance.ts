import prisma from "@/lib/db";

const USAGE_COUNTER_RETENTION_DAYS = 70;
const PROCESSED_WEBHOOK_RETENTION_DAYS = 90;

export async function cleanupExpiredUsageCounters(now: Date = new Date()) {
  const cutoff = new Date(
    now.getTime() - USAGE_COUNTER_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const deleted = await prisma.usageCounter.deleteMany({
    where: { periodEnd: { lt: cutoff } },
  });
  return { usageCountersDeleted: deleted.count };
}

export async function cleanupProcessedWebhookEvents(now: Date = new Date()) {
  const cutoff = new Date(
    now.getTime() - PROCESSED_WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const deleted = await prisma.processedWebhookEvent.deleteMany({
    where: { receivedAt: { lt: cutoff } },
  });
  return { processedWebhookEventsDeleted: deleted.count };
}
