#!/usr/bin/env node
// One-time fix: delete the failed 20260312100000_add_quickbooks record so
// prisma migrate deploy can proceed. Safe to run every startup — it's a no-op
// once the record is gone.
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  try {
    await client.connect();
    const res = await client.query(
      "DELETE FROM _prisma_migrations WHERE migration_name = '20260312100000_add_quickbooks'",
    );
    if (res.rowCount > 0) {
      console.log('Cleared failed migration record: 20260312100000_add_quickbooks');
    }
  } catch (e) {
    console.log('fix-migrations skipped:', e.message);
  } finally {
    await client.end().catch(() => {});
  }
}

run();
