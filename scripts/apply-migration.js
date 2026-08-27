const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function migrate() {
  try {
    await p.$executeRawUnsafe(
      'ALTER TABLE "TicketType" ADD COLUMN "freeForHostSchool" BOOLEAN NOT NULL DEFAULT false'
    );
    console.log('✅ Column freeForHostSchool added successfully');
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      console.log('✅ Column freeForHostSchool already exists, skipping');
    } else {
      console.error('❌ Migration error:', e.message);
      process.exit(1);
    }
  }

  // Backfill: set freeForHostSchool=true for existing price=0 ticket types
  try {
    const result = await p.$executeRawUnsafe(
      'UPDATE "TicketType" SET "freeForHostSchool" = true WHERE price = 0'
    );
    console.log('✅ Backfill complete (price=0 rows set to freeForHostSchool=true)');
  } catch (e) {
    console.log('⚠️  Backfill skipped:', e.message);
  }

  await p.$disconnect();
}

migrate();
