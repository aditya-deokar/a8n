import { polarClient } from "@/lib/polar";

export async function requireActiveSubscription(userId: string): Promise<void> {
  const customer = await polarClient.customers.getStateExternal({
    externalId: userId,
  });

  if (!customer.activeSubscriptions || customer.activeSubscriptions.length === 0) {
    throw new Error("Active subscription required");
  }
}
