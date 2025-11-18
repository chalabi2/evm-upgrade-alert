import pg from 'pg';
import dotenv from 'dotenv';
import { applyMigrations } from './migrations.js';

dotenv.config();

const { Pool } = pg;

let pool: pg.Pool | null = null;
let migrationsPromise: Promise<void> | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/evm_upgrades';
    pool = new Pool({ connectionString });

    const baseQuery = pool.query.bind(pool) as typeof pool.query;
    migrationsPromise = applyMigrations(baseQuery);

    const patchedQuery: typeof baseQuery = ((...args: Parameters<typeof baseQuery>) => {
      if (!migrationsPromise) {
        return baseQuery(...args);
      }
      return (async () => {
        await migrationsPromise;
        return baseQuery(...args);
      })();
    }) as typeof pool.query;

    (pool as unknown as { query: typeof baseQuery }).query = patchedQuery;
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
