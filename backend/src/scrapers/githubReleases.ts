import axios from 'axios';
import { getPool } from '../lib/db.js';

type GitHubRelease = {
  tag_name: string;
  name: string;
  body?: string | null;
  published_at: string;
  html_url: string;
  prerelease: boolean;
};

type UpgradeDetection = {
  isUpgrade: boolean;
  forkName?: string;
  isHardFork: boolean;
  signals: string[];
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = Number(process.env.GITHUB_RELEASE_LOOKBACK_DAYS ?? '30');
const MAX_RELEASES_PER_REPO = Number(process.env.GITHUB_RELEASES_PER_REPO ?? '60');
const MAX_RELEASE_LEAD_DAYS = Number(process.env.GITHUB_RELEASE_MAX_LEAD_DAYS ?? '35');
const PENDING_UPGRADE_STATUSES = ['proposed', 'approved', 'scheduled', 'queued', 'release_posted'];

const BASE_FORK_NAMES = [
  'Fusaka',
  'Pectra',
  'Prague',
  'Osaka',
  'Dencun',
  'Cancun',
  'Shapella',
  'Capella',
  'Shanghai',
  'Bellatrix',
  'Altair',
  'Merge',
  'Electra',
];

const HARD_FORK_KEYWORDS = [
  'hard fork',
  'hardfork',
  'network upgrade',
  'mainnet upgrade',
  'protocol upgrade',
  'consensus upgrade',
  'fork activation',
];

const UPGRADE_INTENT_KEYWORDS = [
  'required upgrade',
  'upgrade required',
  'mandatory upgrade',
  'breaking change',
  'consensus change',
  'activation epoch',
  'activation ts',
  'activation date',
  'fork window',
  'enable fork',
  'protocol change',
  'upgrade timeline',
  'forced upgrade',
];

const CLIENT_REPOS = {
  // Execution Clients
  'geth': { repo: 'ethereum/go-ethereum', chains: ['eth-mainnet'] },
  'reth': { repo: 'paradigmxyz/reth', chains: ['eth-mainnet'] },
  'nethermind': { repo: 'NethermindEth/nethermind', chains: ['eth-mainnet'] },
  'besu': { repo: 'hyperledger/besu', chains: ['eth-mainnet'] },
  'erigon': { repo: 'ledgerwatch/erigon', chains: ['eth-mainnet'] },
  
  // Consensus Clients
  'prysm': { repo: 'prysmaticlabs/prysm', chains: ['eth-mainnet'] },
  'lighthouse': { repo: 'sigp/lighthouse', chains: ['eth-mainnet'] },
  'teku': { repo: 'Consensys/teku', chains: ['eth-mainnet'] },
  'nimbus': { repo: 'status-im/nimbus-eth2', chains: ['eth-mainnet'] },
  'lodestar': { repo: 'ChainSafe/lodestar', chains: ['eth-mainnet'] },
  
  // L2 Clients - OP Stack releases apply to all OP Stack chains
  'op-geth': { repo: 'ethereum-optimism/op-geth', chains: ['op-mainnet', 'base-mainnet'] },
  'optimism': { repo: 'ethereum-optimism/optimism', chains: ['op-mainnet', 'base-mainnet'] },
  'arbitrum': { repo: 'OffchainLabs/nitro', chains: ['arbitrum-one'] },
  'base': { repo: 'base-org/node', chains: ['base-mainnet'] },
};

async function fetchGitHubReleases(
  repo: string,
  options: { max: number; lookbackDate: Date }
): Promise<GitHubRelease[]> {
  try {
    const releases: GitHubRelease[] = [];
    const perPage = Math.min(100, Math.max(10, options.max));
    let page = 1;

    const headers: any = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'EVM-Upgrades-Monitor'
    };
    
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    
    while (releases.length < options.max) {
      const url = `https://api.github.com/repos/${repo}/releases?per_page=${perPage}&page=${page}`;
      const response = await axios.get(url, { headers });
      const batch = response.data as GitHubRelease[];
      if (!Array.isArray(batch) || batch.length === 0) {
        break;
      }

      releases.push(...batch);

      const oldestInBatch = batch[batch.length - 1];
      const shouldStop =
        batch.length < perPage ||
        (oldestInBatch && new Date(oldestInBatch.published_at) < options.lookbackDate);

      if (shouldStop) {
        break;
      }

      page += 1;
    }

    return releases;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.error(`  Rate limited on ${repo}. Set GITHUB_TOKEN in .env for higher limits.`);
    } else {
      console.error(`  Failed to fetch ${repo}:`, error.message);
    }
    return [];
  }
}

function detectUpgradeKeywords(text: string, forkCandidates: string[] = []): UpgradeDetection {
  const lowerText = text.toLowerCase();
  const signals = new Set<string>();
  let matchedForkName: string | undefined;
  let isHardFork = false;

  for (const keyword of HARD_FORK_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      isHardFork = true;
      signals.add(`hard-fork:${keyword}`);
    }
  }

  const candidateForks = forkCandidates
    .filter(Boolean)
    .map(name => ({ original: name, normalized: name.toLowerCase() }));

  const forkMatch = candidateForks.find(candidate => lowerText.includes(candidate.normalized));
  if (forkMatch) {
    matchedForkName = forkMatch.original;
    signals.add(`fork:${forkMatch.original}`);
  }

  for (const keyword of UPGRADE_INTENT_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      signals.add(`upgrade:${keyword}`);
    }
  }

  if (lowerText.includes('mainnet') && (lowerText.includes('upgrade') || lowerText.includes('activation'))) {
    signals.add('mainnet-upgrade');
  }

  return {
    isUpgrade: signals.size > 0,
    forkName: matchedForkName,
    isHardFork,
    signals: Array.from(signals)
  };
}

type PendingUpgrade = {
  fork_name: string;
  activation_ts: Date | null;
};

async function loadPendingUpgrades(): Promise<Map<string, PendingUpgrade[]>> {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT chain_id, fork_name, activation_ts
      FROM upgrade_plans
      WHERE status = ANY($1)
    `,
    [PENDING_UPGRADE_STATUSES]
  );

  const pending = new Map<string, PendingUpgrade[]>();
  for (const row of result.rows) {
    if (!row.fork_name) continue;
    const upgrades = pending.get(row.chain_id) ?? [];
    upgrades.push({
      fork_name: row.fork_name,
      activation_ts: row.activation_ts ? new Date(row.activation_ts) : null
    });
    pending.set(row.chain_id, upgrades);
  }
  return pending;
}

function getForkCandidates(chainIds: string[], pendingUpgrades: Map<string, PendingUpgrade[]>): string[] {
  const names = new Set(BASE_FORK_NAMES);
  for (const chainId of chainIds) {
    const upgrades = pendingUpgrades.get(chainId);
    if (upgrades) {
      for (const upgrade of upgrades) {
        if (upgrade.fork_name) names.add(upgrade.fork_name);
      }
    }
  }
  return Array.from(names);
}

function shouldTrackReleaseForChain(
  chainId: string,
  publishedAt: Date,
  pendingUpgrades: Map<string, PendingUpgrade[]>
): boolean {
  const upgrades = pendingUpgrades.get(chainId);
  if (!upgrades || upgrades.length === 0) {
    return true;
  }

  const maxLeadMs = MAX_RELEASE_LEAD_DAYS * DAY_IN_MS;
  for (const upgrade of upgrades) {
    if (!upgrade.activation_ts) {
      return true;
    }
    const leadMs = upgrade.activation_ts.getTime() - publishedAt.getTime();
    if (leadMs >= 0 && leadMs <= maxLeadMs) {
      return true;
    }
  }

  return false;
}

function explainSkipReason(
  chainId: string,
  publishedAt: Date,
  pendingUpgrades: Map<string, PendingUpgrade[]>
): string {
  const upgrades = pendingUpgrades.get(chainId);
  if (!upgrades || upgrades.length === 0) {
    return 'no pending upgrades tracked';
  }
  const activationSummaries = upgrades
    .map(upgrade =>
      upgrade.activation_ts
        ? `${upgrade.fork_name} @ ${upgrade.activation_ts.toISOString()}`
        : `${upgrade.fork_name} @ TBD`
    )
    .join(', ');
  return `outside ${MAX_RELEASE_LEAD_DAYS}d lead window (published ${publishedAt.toISOString()}; upgrades: ${activationSummaries})`;
}

export async function scrapeGitHubReleases(): Promise<void> {
  console.log(`Scraping GitHub releases for Ethereum clients (last ${LOOKBACK_DAYS} days)...`);
  
  const pool = getPool();
  const lookbackDate = new Date(Date.now() - LOOKBACK_DAYS * DAY_IN_MS);
  const pendingUpgrades = await loadPendingUpgrades();
  
  let totalReleases = 0;
  let upgradeReleases = 0;
  
  for (const [clientName, config] of Object.entries(CLIENT_REPOS)) {
    console.log(`\n[${clientName}] Checking ${config.repo}...`);
    
    const releases = await fetchGitHubReleases(config.repo, {
      max: MAX_RELEASES_PER_REPO,
      lookbackDate
    });
    
    if (releases.length === 0) {
      console.log(`  No releases found`);
      continue;
    }
    
    const recentReleases = releases.filter(r => {
      const publishedDate = new Date(r.published_at);
      return publishedDate > lookbackDate && !r.prerelease;
    });
    
    if (recentReleases.length === 0) {
      console.log(`  No new releases in the last ${LOOKBACK_DAYS} day(s)`);
      continue;
    }
    
    console.log(`  Found ${recentReleases.length} recent release(s)`);
    totalReleases += recentReleases.length;
    
    const forkCandidates = getForkCandidates(config.chains, pendingUpgrades);
    
    for (const release of recentReleases) {
      const publishedDate = new Date(release.published_at);
      const fullText = `${release.tag_name} ${release.name ?? ''} ${release.body ?? ''}`;
      const detection = detectUpgradeKeywords(fullText, forkCandidates);
      
      if (detection.isUpgrade) {
        console.log(`  ⚠️  UPGRADE: ${release.name} (${release.tag_name})`);
        if (detection.signals.length > 0) {
          console.log(`     Signals: ${detection.signals.join(', ')}`);
        }
        if (detection.forkName) {
          console.log(`     Fork: ${detection.forkName}`);
        }
        if (detection.isHardFork) {
          console.log(`     Type: Hard Fork`);
        }
        
        upgradeReleases++;
        
        // Insert release for each applicable chain
        for (const chainId of config.chains) {
          if (!shouldTrackReleaseForChain(chainId, publishedDate, pendingUpgrades)) {
            console.log(`     → Skipping ${chainId}: ${explainSkipReason(chainId, publishedDate, pendingUpgrades)}`);
            continue;
          }
          // Check if this release is already in DB for this chain
          const existingRelease = await pool.query(
            'SELECT id FROM releases WHERE chain_id = $1 AND tag = $2',
            [chainId, release.tag_name]
          );
          
          if (existingRelease.rows.length > 0) {
            console.log(`     → Already tracked for ${chainId}`);
            continue;
          }
          
          const truncatedBody = release.body ? release.body.slice(0, 2000) : '';
          
          await pool.query(`
            INSERT INTO releases (
              chain_id,
              repo,
              tag,
              url,
              fork_name,
              published_at,
              title,
              raw_json
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            chainId,
            config.repo,
            release.tag_name,
            release.html_url,
            detection.forkName || null,
            publishedDate,
            `${clientName}: ${release.name}`,
            JSON.stringify({ body: truncatedBody, prerelease: release.prerelease, signals: detection.signals })
          ]);
          
          console.log(`     → Saved to database for ${chainId}`);
        }
        
        // Create upgrade plans for chains where this is relevant
        if (detection.forkName) {
          for (const chainId of config.chains) {
            // Create a unique "release" upgrade plan for this specific client
            const releaseKey = `${detection.forkName}-${clientName}`;
            
            const existing = await pool.query(
              'SELECT id FROM upgrade_plans WHERE chain_id = $1 AND fork_name = $2 AND source_summary LIKE $3',
              [chainId, releaseKey, `%${clientName}%`]
            );
            
            if (existing.rows.length === 0) {
              await pool.query(`
                INSERT INTO upgrade_plans (
                  chain_id,
                  fork_name,
                  status,
                  confidence,
                  source_summary,
                  last_updated_at
                )
                VALUES ($1, $2, $3, $4, $5, NOW())
              `, [
                chainId,
                releaseKey,
                'release_posted',
                0.85,
                `${clientName} ${release.tag_name} released for ${detection.forkName} - ${release.html_url}`
              ]);
              
              console.log(`     → Created release alert for ${clientName} on ${chainId}`);
            }
          }
        }
      }
    }
  }
  
  console.log(`\n✓ Scanned ${totalReleases} recent releases, found ${upgradeReleases} upgrade(s)`);
}
