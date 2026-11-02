import 'dotenv/config';
import pg from 'pg';
import { processDueGiftReminders } from './gift-reminders.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set.');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  max: 2,
  connectionTimeoutMillis: 10_000
});

try {
  const result = await processDueGiftReminders(pool);
  console.log(`Gift reminders processed: ${result.processed}; sent: ${result.sent}.`);
} finally {
  await pool.end();
}
