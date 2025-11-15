import { scrapeEthereumBlog } from '../scrapers/ethereumBlog.js';
import { getPool } from '../lib/db.js';
import { NotificationDispatcher } from '../notifications/index.js';
import type { GovEventInput, OnchainEventInput } from './normalizers.js';

export class UpgradeMonitor {
  private lastCheckedUpgrades: Map<string, Date> = new Map();
  private sentAlerts: Set<string> = new Set(); // Track sent alerts to avoid duplicates
  private dispatcher = new NotificationDispatcher();

  async monitorAll(): Promise<void> {
    console.log('=== Unified Upgrade Monitor ===\n');

    // 1. Scrape off-chain sources (RSS, blogs, forums)
    await this.scrapeOffChainSources();

    // 2. Process on-chain events (from indexer)
    await this.processOnchainEvents();

    // 3. Check for new/updated upgrades and send alerts
    await this.checkAndAlert();
  }

  private async scrapeOffChainSources(): Promise<void> {
    console.log('[Off-Chain] Scraping sources...');
    
    // Ethereum: RSS feed
    try {
      await scrapeEthereumBlog();
      console.log('[Off-Chain] ✓ Ethereum blog scraped');
    } catch (error) {
      console.error('[Off-Chain] ✗ Ethereum scrape failed:', error);
    }

    // GitHub releases for all major clients
    try {
      const { scrapeGitHubReleases } = await import('../scrapers/githubReleases.js');
      await scrapeGitHubReleases();
      console.log('[Off-Chain] ✓ GitHub releases scraped');
    } catch (error) {
      console.error('[Off-Chain] ✗ GitHub scrape failed:', error);
    }

    // Optimism governance forum (affects OP Stack chains: Optimism, Base, etc)
    try {
      const { scrapeOptimismForum } = await import('../scrapers/optimismForum.js');
      await scrapeOptimismForum();
      console.log('[Off-Chain] ✓ Optimism forum scraped');
    } catch (error) {
      console.error('[Off-Chain] ✗ Optimism forum scrape failed:', error);
    }

    // TODO: Add more scrapers
    // - Arbitrum forum
    // - Avalanche blog
    
    console.log('');
  }

  private async processOnchainEvents(): Promise<void> {
    console.log('[On-Chain] Processing events from indexer...');
    
    const pool = getPool();
    
    // Get recent unprocessed on-chain events
    const events = await pool.query(`
      SELECT 
        oe.*,
        c.name as chain_name,
        wa.label as contract_label
      FROM onchain_events oe
      JOIN chains c ON c.id = oe.chain_id
      LEFT JOIN watch_addresses wa ON wa.address = oe.address AND wa.chain_id = oe.chain_id
      WHERE oe.occurred_at > NOW() - INTERVAL '7 days'
        AND oe.event_name IN ('CallScheduled', 'CallExecuted', 'ExecutionSuccess', 'ProposalExecuted')
      ORDER BY oe.occurred_at DESC
    `);

    if (events.rows.length === 0) {
      console.log('[On-Chain] No recent events\n');
      return;
    }

    console.log(`[On-Chain] Processing ${events.rows.length} event(s)`);

    for (const event of events.rows) {
      await this.createUpgradeFromEvent(event);
    }
    
    console.log('');
  }

  private async createUpgradeFromEvent(event: any): Promise<void> {
    const pool = getPool();
    
    let status = 'queued';
    let forkName = 'Protocol Upgrade';
    
    // Determine status from event type
    if (event.event_name === 'CallExecuted' || event.event_name === 'ExecutionSuccess' || event.event_name === 'ProposalExecuted') {
      status = 'executed';
    }
    
    // Try to extract fork name from event args or use generic
    const args = event.args as any;
    if (args?.description) {
      // Try to extract fork name from description
      const match = args.description.match(/\b([A-Z][a-z]+(?:ka|tra|cun|don|lin))\b/);
      if (match) forkName = match[1];
    }
    
    // Calculate activation time from timelock delay
    let activationTs = null;
    if (event.event_name === 'CallScheduled' && args?.delay) {
      const delay = parseInt(args.delay);
      activationTs = new Date((event.occurred_at.getTime() / 1000 + delay) * 1000);
    }

    // Check if we already have this upgrade
    const existing = await pool.query(
      `SELECT id, status FROM upgrade_plans 
       WHERE chain_id = $1 
       AND (fork_name = $2 OR source_summary LIKE $3)
       LIMIT 1`,
      [event.chain_id, forkName, `%${event.tx_hash}%`]
    );

    if (existing.rows.length > 0) {
      // Update existing
      await pool.query(`
        UPDATE upgrade_plans 
        SET status = $1, activation_ts = $2, last_updated_at = NOW()
        WHERE id = $3
      `, [status, activationTs, existing.rows[0].id]);
      
      console.log(`[On-Chain] ✓ Updated ${event.chain_name}: ${forkName} -> ${status}`);
    } else {
      // Create new
      await pool.query(`
        INSERT INTO upgrade_plans (
          chain_id, fork_name, status, activation_ts, confidence, source_summary, last_updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        event.chain_id,
        forkName,
        status,
        activationTs,
        0.99,
        `${event.contract_label || 'Contract'} ${event.event_name} - tx: ${event.tx_hash.slice(0, 10)}...`
      ]);
      
      console.log(`[On-Chain] ✓ Created ${event.chain_name}: ${forkName} (${status})`);
      
      // Create countdown if we have activation time
      if (activationTs) {
        const targetUnix = Math.floor(activationTs.getTime() / 1000);
        await pool.query(`
          INSERT INTO countdowns (chain_id, fork_name, target_ts, confidence)
          VALUES ($1, $2, to_timestamp($3), 0.99)
          ON CONFLICT (chain_id) DO UPDATE SET
            fork_name = EXCLUDED.fork_name,
            target_ts = EXCLUDED.target_ts,
            confidence = EXCLUDED.confidence
        `, [event.chain_id, forkName, targetUnix]);
      }
    }
  }

  private async checkAndAlert(): Promise<void> {
    console.log('[Alerts] Checking for upgrades to notify...');
    
    const pool = getPool();
    
    // Get all active upgrades:
    // 1. Scheduled/queued with future dates
    // 2. Release posts (don't need countdowns)
    const result = await pool.query(`
      SELECT 
        up.id,
        up.chain_id,
        c.name as chain_name,
        up.fork_name,
        up.status,
        up.activation_epoch,
        up.activation_ts,
        up.confidence,
        up.source_summary,
        up.details,
        up.last_updated_at
      FROM upgrade_plans up
      JOIN chains c ON c.id = up.chain_id
      WHERE (
        (up.status IN ('scheduled', 'queued') AND up.last_updated_at > NOW() - INTERVAL '1 day')
        OR
        (up.status = 'release_posted' AND up.last_updated_at > NOW() - INTERVAL '1 day')
      )
      ORDER BY up.last_updated_at DESC
    `);

    if (result.rows.length === 0) {
      console.log('[Alerts] No recent upgrades to notify\n');
      return;
    }

    console.log(`[Alerts] Found ${result.rows.length} upgrade(s) to check`);

    for (const upgrade of result.rows) {
      // For scheduled/queued upgrades, skip if activation_ts is in the past
      if (upgrade.status !== 'release_posted' && upgrade.activation_ts) {
        const activationDate = new Date(upgrade.activation_ts);
        if (activationDate < new Date()) {
          console.log(`[Alerts] ⊘ Skipping ${upgrade.chain_name} - ${upgrade.fork_name} (past upgrade: ${activationDate.toISOString()})`);
          continue;
        }
      }
      
      // For scheduled/queued without activation_ts, still send alert (might be announced but date TBD)
      if (upgrade.status !== 'release_posted' && !upgrade.activation_ts) {
        console.log(`[Alerts] → ${upgrade.chain_name} - ${upgrade.fork_name} (scheduled, date TBD)`);
      }
      
      const key = `${upgrade.chain_id}-${upgrade.fork_name}-${upgrade.status}`;
      
      // Check if we've already sent this alert (deduplication)
      if (this.sentAlerts.has(key)) {
        console.log(`[Alerts] ⊘ Already sent: ${upgrade.chain_name} - ${upgrade.fork_name} (${upgrade.status})`);
        continue;
      }
      
      const lastChecked = this.lastCheckedUpgrades.get(key);
      
      // Send notification if new or updated
      if (!lastChecked || upgrade.last_updated_at > lastChecked) {
        await this.sendAlert(upgrade);
        this.lastCheckedUpgrades.set(key, upgrade.last_updated_at);
        this.sentAlerts.add(key); // Mark as sent
      }
    }
    
    console.log('');
  }

  private async sendAlert(upgrade: any): Promise<void> {
    const pool = getPool();
    
    // Get countdown
    const countdownResult = await pool.query(
      'SELECT * FROM countdowns WHERE chain_id = $1',
      [upgrade.chain_id]
    );
    const countdown = countdownResult.rows[0];

    // Build alert with rich details from LLM extraction
    const alert = {
      chain_id: upgrade.chain_id,
      chain_name: upgrade.chain_name,
      fork_name: upgrade.fork_name,
      stage: upgrade.status,
      ts: new Date().toISOString(),
      activation_epoch: upgrade.activation_epoch,
      activation_ts: upgrade.activation_ts?.toISOString() || null,
      target_ts: countdown?.target_ts?.toISOString() || null,
      window_low_ts: countdown?.window_low_ts?.toISOString() || null,
      window_high_ts: countdown?.window_high_ts?.toISOString() || null,
      confidence: parseFloat(upgrade.confidence),
      links: this.getLinks(upgrade.chain_id),
      details: {
        source: upgrade.source_summary,
        // Merge in all the rich LLM-extracted data
        ...(upgrade.details || {}),
        // Add unix timestamp if available for countdown calculation
        unixTimestamp: upgrade.details?.unixTimestamp || null,
        timeline: upgrade.details?.timeline || null,
        keyPoints: upgrade.details?.keyPoints || [],
        requirements: upgrade.details?.requirements || [],
        risks: upgrade.details?.risks || [],
        technicalDetails: upgrade.details?.technicalDetails || {},
        stakeholders: upgrade.details?.stakeholders || {}
      }
    };

    // Get channels
    const channels: any[] = [];
    const config: any = {};

    if (process.env.DISCORD_WEBHOOK_URL) {
      channels.push('discord');
      config.discord = { webhook_url: process.env.DISCORD_WEBHOOK_URL };
    }
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      channels.push('telegram');
      config.telegram = {
        bot_token: process.env.TELEGRAM_BOT_TOKEN,
        chat_id: process.env.TELEGRAM_CHAT_ID
      };
    }
    if (process.env.SLACK_WEBHOOK_URL) {
      channels.push('slack');
      config.slack = { webhook_url: process.env.SLACK_WEBHOOK_URL };
    }

    if (channels.length === 0) {
      console.log(`[Alerts] ⊘ ${upgrade.chain_name} - ${upgrade.fork_name}: No channels configured`);
      return;
    }

    console.log(`[Alerts] → ${upgrade.chain_name} - ${upgrade.fork_name} (${upgrade.status})`);
    console.log(`[Alerts]   Sending to: ${channels.join(', ')}`);
    
    try {
      const results = await this.dispatcher.dispatch(alert, channels, config);
      for (const r of results) {
        console.log(`[Alerts]   ${r.success ? '✓' : '✗'} ${r.channel}${r.error ? ': ' + r.error : ''}`);
      }
    } catch (error) {
      console.error(`[Alerts]   ✗ Failed:`, error);
    }
  }

  private getLinks(chainId: string): string[] {
    const links: Record<string, string[]> = {
      'eth-mainnet': ['https://blog.ethereum.org', 'https://ethereum.org/en/roadmap/'],
      'eth-sepolia': ['https://blog.ethereum.org'],
      'op-mainnet': ['https://community.optimism.io/docs/chain/upgrades/'],
      'base-mainnet': ['https://www.base.org/'],
      'arbitrum-one': ['https://forum.arbitrum.foundation/'],
      'avalanche-c': ['https://github.com/ava-labs/avalanchego/releases']
    };
    return links[chainId] || [];
  }
}
