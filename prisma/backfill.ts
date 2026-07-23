/**
 * One-time backfill after adding criticality/maturityLevel to InternalControl.
 * Estimates maturity from implementation status for any control still at the
 * default (maturityLevel 0 + NOT started statuses are left alone).
 *
 * Run with: npm run db:backfill
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const controls = await prisma.internalControl.findMany();
  let updated = 0;

  for (const c of controls) {
    if (c.maturityLevel > 0) continue; // already set manually — don't touch

    let maturityLevel = 0;
    if (c.status === "IMPLEMENTED") maturityLevel = 3; // Defined
    else if (c.status === "IN_PROGRESS") maturityLevel = 1; // Initial

    if (maturityLevel === 0) continue;

    await prisma.internalControl.update({
      where: { id: c.id },
      data: { maturityLevel },
    });
    updated++;
  }

  console.log(`Backfilled maturity for ${updated} of ${controls.length} controls.`);
  console.log("Criticality defaults to MEDIUM — adjust per control in the Controls Library.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
