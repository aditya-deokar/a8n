import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const latest = await prisma.mcpOAuthAuthorizationCode.findFirst({
    orderBy: { createdAt: "desc" }
  });
  console.log(latest);
}
main().finally(() => process.exit(0));
