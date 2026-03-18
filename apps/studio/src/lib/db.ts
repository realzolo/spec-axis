import { Pool, type PoolClient } from 'pg';

declare global {
   
  var __pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not configured');
}

const pool = global.__pgPool ?? new Pool({
  connectionString,
  max: 10,
});

if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryOne<T = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function exec(text: string, params: unknown[] = []): Promise<void> {
  await pool.query(text, params);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
