const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Emptying database...');

  try {
    const tables = await prisma.$queryRawUnsafe(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
    `);

    if (tables.length === 0) {
      console.log('No tables found to truncate.');
      return;
    }

    const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
    
    console.log(`Truncating tables: ${tableNames}`);
    
    // TRUNCATE CASCADE will delete all data in the tables and their dependents
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} CASCADE;`);
    
    console.log('Database successfully emptied!');
  } catch (error) {
    console.error('Error emptying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
