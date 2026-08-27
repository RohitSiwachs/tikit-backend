const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Applying missing schema patches for School/Event/etc...');
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "School"
        ADD COLUMN IF NOT EXISTS "cardLimit" INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "sharedCodeEnabled" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "sharedCodeExpiry" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "sharedCodeMaxRedemptions" INTEGER,
        ADD COLUMN IF NOT EXISTS "sharedCodeRedemptionCount" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "sharedCodeApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "tempAdminPassword" TEXT;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Card"
        ADD COLUMN IF NOT EXISTS "codeGenerationType" TEXT NOT NULL DEFAULT 'individual';
    `);

    console.log('✅ Schema patched successfully');
  } catch (error) {
    console.error('Error patching schema:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
