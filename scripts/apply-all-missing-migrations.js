const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  console.log('Manually executing ANY missing migrations to bypass pooler limitations...');

  const migrationsDir = path.join(__dirname, '../prisma/migrations');
  const allMigrations = fs.readdirSync(migrationsDir).filter(name => fs.statSync(path.join(migrationsDir, name)).isDirectory());

  for (const name of allMigrations) {
    try {
      // Check if already applied
      const rows = await prisma.$queryRawUnsafe(`
        SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '${name}'
      `);
      if (rows.length > 0) {
        console.log(`⏭️  Skipping ${name} (already in _prisma_migrations)`);
        continue;
      }

      const sqlPath = path.join(migrationsDir, name, 'migration.sql');
      if (!fs.existsSync(sqlPath)) continue;
      
      let sql = fs.readFileSync(sqlPath, 'utf8');
      
      console.log(`⏳ Applying ${name}...`);
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        await prisma.$executeRawUnsafe(stmt);
      }

      // Record it as applied
      await prisma.$executeRawUnsafe(`
        INSERT INTO "_prisma_migrations" (
          id, checksum, finished_at, migration_name, logs, rolled_back_at,
          started_at, applied_steps_count
        )
        VALUES (
          gen_random_uuid()::text,
          'manual-execution',
          NOW(),
          '${name}',
          NULL,
          NULL,
          NOW(),
          1
        );
      `);
      console.log(`✅ Successfully applied and recorded ${name}`);
    } catch (e) {
      console.log(`⚠️  Error applying ${name}: ${e.message}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
