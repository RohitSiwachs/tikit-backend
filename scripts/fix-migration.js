const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// All migrations that exist in the filesystem but are NOT yet in _prisma_migrations
// (the tables/columns they create already exist from the manual db push / patch scripts)
const MISSING_MIGRATIONS = [
  '20260611000001_backfill_communication_allocation_defaults',
  '20260612154739_add_notification_trigger_override',
  '20260615000000_add_school_invite_codes',
  '20260616000000_performance_indexes',
  '20260618000000_card_code_assigned_at',
  '20260619000000_add_restrict_to_card_holders',
  '20260626064749_add_event_connection_state',
  '20260626094614_add_posted_by_super_admin',
  '20260626122001_add_card_limit',
  '20260701000000_post_image_urls_array',
  '20260701090225_add_countdown_post_fields',
  '20260701092155_restore_imageurls_default',
  '20260703055721_add_temp_admin_password_to_school',
  '20260703091339_add_user_temp_password',
];

async function main() {
  console.log('Inserting missing migration records as applied...\n');

  for (const name of MISSING_MIGRATIONS) {
    try {
      await p.$executeRawUnsafe(`
        INSERT INTO "_prisma_migrations" (
          id, checksum, finished_at, migration_name, logs, rolled_back_at,
          started_at, applied_steps_count
        )
        SELECT
          gen_random_uuid()::text,
          'manual-baseline-fix',
          NOW(),
          '${name}',
          NULL,
          NULL,
          NOW(),
          1
        WHERE NOT EXISTS (
          SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '${name}'
        );
      `);
      console.log(`  ✅ Inserted: ${name}`);
    } catch (e) {
      console.log(`  ⚠️  Skipped (already exists or error): ${name} — ${e.message}`);
    }
  }

  console.log('\nDone. All migrations are now marked as applied.');
}

main().catch(console.error).finally(() => p.$disconnect());
