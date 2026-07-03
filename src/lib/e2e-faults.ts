import { isE2EMode } from "@/lib/e2e-safety";

export type E2EFaultName = "prisma" | "inngest" | "polar";

const globalForE2EFaults = globalThis as unknown as {
  e2eFaults?: Set<E2EFaultName>;
};

function requireE2EMockMode() {
  if (!isE2EMode() || process.env.E2E_EXTERNAL_SERVICES !== "mock") {
    throw new Error("E2E fault injection is only available in E2E mock mode.");
  }
}

function faults() {
  globalForE2EFaults.e2eFaults ??= new Set<E2EFaultName>();
  return globalForE2EFaults.e2eFaults;
}

export function setE2EFault(name: E2EFaultName) {
  requireE2EMockMode();
  faults().add(name);
}

export function clearE2EFaults() {
  requireE2EMockMode();
  globalForE2EFaults.e2eFaults = new Set<E2EFaultName>();
}

export function consumeE2EFault(name: E2EFaultName) {
  if (!isE2EMode() || process.env.E2E_EXTERNAL_SERVICES !== "mock") {
    return false;
  }

  const activeFaults = faults();
  const active = activeFaults.has(name);
  if (active) activeFaults.delete(name);
  return active;
}

export function throwIfE2EFault(name: E2EFaultName, message: string) {
  if (consumeE2EFault(name)) {
    throw new Error(message);
  }
}
