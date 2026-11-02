import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const expectedDatabase = process.env.DATABASE_NAME || 'dayromance';

if (!connectionString) {
  throw new Error('DATABASE_URL is required to run PostgreSQL migrations.');
}

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  connectionTimeoutMillis: 10_000
});

try {
  const client = await pool.connect();
  try {
    const database = await client.query('SELECT current_database() AS name');
    if (database.rows[0].name !== expectedDatabase) {
      throw new Error(`Connected database must be "${expectedDatabase}". No schema changes were applied.`);
    }
    await client.query('SELECT pg_advisory_lock($1)', [728194631]);
    await client.query('BEGIN');
    await client.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    await client.query('COMMIT');
    console.log('DayRomance PostgreSQL schema is ready.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [728194631]);
    client.release();
  }
} finally {
  await pool.end();
}
