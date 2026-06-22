import prisma from "../src/lib/db";
import { encrypt } from "../src/lib/encryption";
import { CredentialType } from "../src/generated/prisma";

async function main() {
  const existing = await prisma.credential.findFirst({
    where: {
      type: CredentialType.SMTP_EMAIL,
      name: "Demo SMTP Email Credential - replace",
    },
  });

  if (existing) {
    await prisma.credential.update({
      where: { id: existing.id },
      data: {
        value: encrypt(JSON.stringify({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          user: "ganeshpawardev@gmail.com",
          pass: "rordtjsrbwxcnbpx",
          from: "Demo Results <ganeshpawardev@gmail.com>",
        }, null, 2)),
      },
    });
    console.log("Updated existing SMTP credential with the new gmail settings.");
  } else {
    console.log("No existing SMTP credential found.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
