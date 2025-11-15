import axios from 'axios';
import { getPool } from '../lib/db.js';

type GitHubRelease = {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
};

const CLIENT_REPOS = {
  // Execution Clients
  'geth': 'ethereum/go-ethereum',
  'reth': 'paradigmxyz/reth',
  'nethermind': 'NethermindEth/nethermind',
  'besu': 'hyperledger/besu',
  'erigon': 'ledgerwatch/erigon',
  
  // Consensus Clients
  'prysm': 'prysmaticlabs/prysm',
  'lighthouse': 'sigp/lighthouse',
  'teku': 'Consensys/teku',
  'nimbus': 'status-im/nimbus-eth2',
  'lodestar': 'ChainSafe/lodestar',
  
  // L2 Clients
  'op-geth': 'ethereum-optimism/op-geth',
  'optimism': 'ethereum-optimism/optimism',
  'arbitrum': 'OffchainLabs/nitro',
  'base': 'base-org/node',
};

async function fetchGitHubReleases(repo: string): Promise<GitHubRelease[]> {
  try {
    const url = `https://api.github.com/repos/${repo}/releases?per_page=10`;
    const headers: any = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'EVM-Upgrades-Monitor'
    };
    
    // Use GitHub token if available
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.error(`  Rate limited on ${repo}. Set GITHUB_TOKEN in .env for higher limits.`);
    } else {
      console.error(`  Failed to fetch ${repo}:`, error.message);
    }
    return [];
  }
}

function detectUpgradeKeywords(text: string): {
  isUpgrade: boolean;
  forkName?: string;
  isHardFork: boolean;
} {
  const lowerText = text.toLowerCase();
  
  // Check for hard fork keywords
  const isHardFork = 
    lowerText.includes('hard fork') ||
    lowerText.includes('hardfork') ||
    lowerText.includes('network upgrade') ||
    lowerText.includes('mainnet upgrade');
  
  // Check for fork names
  const forkNames = ['fusaka', 'pectra', 'dencun', 'cancun', 'shapella', 'capella', 'shanghai'];
  const forkName = forkNames.find(name => lowerText.includes(name));
  
  // Check for upgrade indicators
  const isUpgrade = 
    isHardFork ||
    !!forkName ||
    lowerText.includes('breaking change') ||
    lowerText.includes('protocol upgrade') ||
    (lowerText.includes('upgrade') && lowerText.includes('required'));
  
  return {
    isUpgrade,
    forkName: forkName ? forkName.charAt(0).toUpperCase() + forkName.slice(1) : undefined,
    isHardFork
  };
}

export async function scrapeGitHubReleases(): Promise<void> {
  console.log('Scraping GitHub releases for Ethereum clients...');
  
  const pool = getPool();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  let totalReleases = 0;
  let upgradeReleases = 0;
  
  for (const [clientName, repo] of Object.entries(CLIENT_REPOS)) {
    console.log(`\n[${clientName}] Checking ${repo}...`);
    
    const releases = await fetchGitHubReleases(repo);
    
    if (releases.length === 0) {
      console.log(`  No releases found`);
      continue;
    }
    
    // Only check recent releases (last week)
    const recentReleases = releases.filter(r => {
      const publishedDate = new Date(r.published_at);
      return publishedDate > oneWeekAgo && !r.prerelease;
    });
    
    if (recentReleases.length === 0) {
      console.log(`  No new releases in the last week`);
      continue;
    }
    
    console.log(`  Found ${recentReleases.length} recent release(s)`);
    totalReleases += recentReleases.length;
    
    for (const release of recentReleases) {
      const fullText = `${release.name} ${release.body}`;
      const detection = detectUpgradeKeywords(fullText);
      
      if (detection.isUpgrade) {
        console.log(`  ⚠️  UPGRADE: ${release.name} (${release.tag_name})`);
        if (detection.forkName) {
          console.log(`     Fork: ${detection.forkName}`);
        }
        if (detection.isHardFork) {
          console.log(`     Type: Hard Fork`);
        }
        
        upgradeReleases++;
        
        // Check if this release is already in DB
        const existingRelease = await pool.query(
          'SELECT id FROM releases WHERE chain_id = $1 AND tag = $2',
          ['eth-mainnet', release.tag_name]
        );
        
        if (existingRelease.rows.length > 0) {
          console.log(`     → Already tracked`);
          continue;
        }
        
        // Insert into releases table
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
          'eth-mainnet', // Default to mainnet, could be smarter based on client
          repo,
          release.tag_name,
          release.html_url,
          detection.forkName || null,
          new Date(release.published_at),
          `${clientName}: ${release.name}`,
          JSON.stringify({ body: release.body.slice(0, 1000), prerelease: release.prerelease })
        ]);
        
        console.log(`     → Saved to database`);
        
        // Create a separate release notification entry (don't modify main upgrade plan)
        // This allows individual client releases to trigger their own alerts
        if (detection.forkName) {
          // Create a unique "release" upgrade plan for this specific client
          const releaseKey = `${detection.forkName}-${clientName}`;
          
          const existing = await pool.query(
            'SELECT id FROM upgrade_plans WHERE chain_id = $1 AND fork_name = $2 AND source_summary LIKE $3',
            ['eth-mainnet', releaseKey, `%${clientName}%`]
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
              'eth-mainnet',
              releaseKey,
              'release_posted',
              0.85,
              `${clientName} ${release.tag_name} released for ${detection.forkName} - ${release.html_url}`
            ]);
            
            console.log(`     → Created release alert for ${clientName}`);
          }
        }
      }
    }
  }
  
  console.log(`\n✓ Scanned ${totalReleases} recent releases, found ${upgradeReleases} upgrade(s)`);
}
