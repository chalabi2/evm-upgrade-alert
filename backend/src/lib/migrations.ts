type QueryFunction = (text: string, values?: unknown[]) => Promise<unknown>;

/**
 * Automatically applies idempotent migrations required for runtime features.
 * This keeps long-running services (API, monitor, scheduler) aligned with the
 * latest schema expectations without relying on manual ALTER statements.
 */
export async function applyMigrations(query: QueryFunction): Promise<void> {
  await ensureAlertSubscriptionChainIds(query);
}

async function ensureAlertSubscriptionChainIds(query: QueryFunction): Promise<void> {
  await query(`
    ALTER TABLE IF EXISTS alert_subscriptions
    ADD COLUMN IF NOT EXISTS chain_ids TEXT[]
  `);
}

