/**
 * MCP API Key Seed Script
 *
 * Generates a test API key with full access for local development.
 * Run: npx tsx scripts/mcp-seed-key.ts
 *
 * The generated key is printed to stdout. Save it securely.
 */

import "dotenv/config";
import prisma from "../src/lib/db";
import { createApiKey } from "../src/mcp/auth/api-key.service";

async function main() {
  // Find the first available user
  const user = await prisma.user.findFirst({
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    console.error("❌ No users found in the database. Please create an account first.");
    process.exit(1);
  }

  console.log(`\n🔍 Found user: ${user.name} (${user.email})\n`);

  // Check for existing active keys
  const existingKeys = await prisma.apiKey.findMany({
    where: { userId: user.id, revokedAt: null },
    select: { id: true, name: true, keyPrefix: true },
  });

  if (existingKeys.length > 0) {
    console.log(`📋 Existing active keys:`);
    existingKeys.forEach((k) => {
      console.log(`   - ${k.name} (${k.keyPrefix}...)`);
    });
    console.log("");
  }

  // Create a new full-access key
  const result = await createApiKey({
    userId: user.id,
    name: "dev-inspector-key",
    scopes: ["*"],
  });

  console.log("✅ API Key created successfully!\n");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(`│ Raw Key: ${result.rawKey}`);
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("\n⚠️  Save this key — it will NOT be shown again.\n");
  console.log("📌 MCP Inspector configuration:");
  console.log("   Transport: Streamable HTTP");
  console.log("   URL:       http://localhost:3000/api/mcp");
  console.log(`   Header:    Authorization: Bearer ${result.rawKey}`);
  console.log("");
}

main()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
