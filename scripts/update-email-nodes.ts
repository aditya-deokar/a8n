import prisma from "../src/lib/db";
import { NodeType } from "../src/generated/prisma";

async function main() {
  const emailNodes = await prisma.node.findMany({
    where: {
      type: NodeType.EMAIL,
    },
  });

  for (const node of emailNodes) {
    if (node.data && typeof node.data === 'object' && !Array.isArray(node.data)) {
      await prisma.node.update({
        where: { id: node.id },
        data: {
          data: {
            ...node.data,
            to: "adityadeokar80@gmail.com",
          },
        },
      });
      console.log(`Updated email recipient for node ${node.id} (${node.name})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
