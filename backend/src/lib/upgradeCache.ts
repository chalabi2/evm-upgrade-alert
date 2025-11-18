import { getPool } from './db.js';

type DetailsShape = {
  llmExtracted?: boolean;
  keyPoints?: unknown;
  affectedChains?: unknown;
  technicalDetails?: Record<string, unknown>;
  timeline?: Record<string, unknown>;
  source?: string;
};

function hasStructuredDetails(details: DetailsShape | null): boolean {
  if (!details) {
    return false;
  }

  if (details.llmExtracted) {
    return true;
  }

  if (Array.isArray(details.keyPoints) && details.keyPoints.length > 0) {
    return true;
  }

  if (Array.isArray(details.affectedChains) && details.affectedChains.length > 0) {
    return true;
  }

  if (details.technicalDetails && Object.keys(details.technicalDetails).length > 0) {
    return true;
  }

  if (details.timeline && Object.keys(details.timeline).length > 0) {
    return true;
  }

  if (typeof details.source === 'string' && details.source.length > 0) {
    return true;
  }

  return false;
}

interface SkipOptions {
  requireCountdown?: boolean;
}

async function checkSkipByFork(
  chainId: string,
  forkName: string,
  options: SkipOptions = {}
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT 
        up.details,
        COALESCE((up.details ->> 'llmExtracted')::boolean, false) AS llm_extracted,
        (cd.chain_id IS NOT NULL) AS has_countdown
     FROM upgrade_plans up
     LEFT JOIN countdowns cd
       ON cd.chain_id = up.chain_id
      AND cd.fork_name = up.fork_name
     WHERE up.chain_id = $1 AND up.fork_name = $2
     LIMIT 1`,
    [chainId, forkName]
  );

  if (result.rowCount === 0) {
    return false;
  }

  const row = result.rows[0] as {
    details: DetailsShape | null;
    llm_extracted: boolean;
    has_countdown: boolean;
  };

  const hasDetails = hasStructuredDetails(row.details) || row.llm_extracted;
  if (!hasDetails) {
    return false;
  }

  if (options.requireCountdown) {
    return row.has_countdown;
  }

  return true;
}

export async function shouldSkipUpgradeProcessing(
  chainId: string,
  forkName: string,
  options: SkipOptions = {}
): Promise<boolean> {
  return checkSkipByFork(chainId, forkName, options);
}

export async function shouldSkipUpgradeProcessingBySource(
  chainId: string,
  sourceUrl: string,
  options: SkipOptions = {}
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT fork_name
     FROM upgrade_plans
     WHERE chain_id = $1
       AND details ->> 'source' = $2
     LIMIT 1`,
    [chainId, sourceUrl]
  );

  if (result.rowCount === 0) {
    return false;
  }

  const forkName = result.rows[0]?.fork_name as string | undefined;
  if (!forkName) {
    return false;
  }

  return checkSkipByFork(chainId, forkName, options);
}

