import axios from 'axios';
import Parser from 'rss-parser';
import { getPool } from '../lib/db.js';

const parser = new Parser();

async function fetchBlogPostContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return '';
  }
}

type UpgradeInfo = {
  forkName: string;
  activationEpoch?: number;
  activationTimestamp?: number;
  confidence: number;
  sourceUrl: string;
  publishedAt: Date;
};

export async function scrapeEthereumBlog(): Promise<void> {
  console.log('Scraping Ethereum blog RSS feed...');
  
  const feed = await parser.parseURL('https://blog.ethereum.org/feed.xml');
  console.log(`Found ${feed.items.length} recent posts`);
  
  const upgrades: UpgradeInfo[] = [];
  const now = Date.now();
  const sixMonthsAgo = now - (180 * 24 * 60 * 60 * 1000); // Only look at posts from last 6 months
  
  for (const item of feed.items) {
    // Skip old posts
    const pubDate = new Date(item.pubDate || 0);
    if (pubDate.getTime() < sixMonthsAgo) {
      continue;
    }
    
    const title = item.title?.toLowerCase() || '';
    const content = item.content?.toLowerCase() || item.contentSnippet?.toLowerCase() || '';
    const fullText = title + ' ' + content;
    
    // Look for upgrade/fork announcements
    const isUpgradeAnnouncement = 
      (title.includes('mainnet') || title.includes('upgrade') || title.includes('fork')) &&
      (title.includes('announcement') || title.includes('scheduled') || title.includes('activation'));
    
    if (!isUpgradeAnnouncement) continue;
    
    console.log(`\nAnalyzing: ${item.title}`);
    
    // Extract fork name (common patterns: Pectra, Fusaka, Dencun, etc.)
    const forkNameMatch = fullText.match(/\b([A-Z][a-z]+(?:ka|tra|cun|don|lin|rk))\b/i);
    if (!forkNameMatch) {
      console.log('  No fork name found');
      continue;
    }
    
    const forkName = forkNameMatch[1].charAt(0).toUpperCase() + forkNameMatch[1].slice(1).toLowerCase();
    console.log(`  Fork: ${forkName}`);
    
    // Fetch full blog post HTML for better parsing
    let blogHtml = '';
    if (item.link) {
      console.log(`  Fetching full post from ${item.link}`);
      blogHtml = await fetchBlogPostContent(item.link);
    }
    
    // Extract epoch number from full HTML or RSS content
    let activationEpoch: number | undefined;
    
    // Try to find epoch in full HTML first
    if (blogHtml) {
      // Pattern: "at slot 13,164,544" or "epoch 411392"
      const slotMatch = blogHtml.match(/slot[:\s]+`?(\d{1,3}[,\s]?\d{3}[,\s]?\d{3})`?/i);
      if (slotMatch) {
        const slot = parseInt(slotMatch[1].replace(/[,\s]/g, ''));
        activationEpoch = Math.floor(slot / 32); // 32 slots per epoch
        console.log(`  Found slot ${slot} -> Epoch: ${activationEpoch}`);
      }
      
      if (!activationEpoch) {
        const epochMatch = blogHtml.match(/epoch[:\s]+`?(\d{5,7})`?/i);
        if (epochMatch) {
          activationEpoch = parseInt(epochMatch[1]);
          console.log(`  Found epoch: ${activationEpoch}`);
        }
      }
    }
    
    // Fallback to RSS content
    if (!activationEpoch) {
      const epochMatch = fullText.match(/epoch[:\s]+(\d{5,7})/i);
      activationEpoch = epochMatch ? parseInt(epochMatch[1]) : undefined;
    }
    
    if (activationEpoch && activationEpoch > 100000) { // Sanity check
      console.log(`  Epoch: ${activationEpoch}`);
    }
    
    // Extract timestamp if no epoch
    let activationTimestamp: number | undefined;
    if (!activationEpoch) {
      const dateMatch = fullText.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
      if (dateMatch) {
        const date = new Date(`${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]}`);
        activationTimestamp = Math.floor(date.getTime() / 1000);
        console.log(`  Timestamp: ${date.toUTCString()}`);
      }
    }
    
    if (!activationEpoch && !activationTimestamp) {
      console.log('  No activation time found');
      continue;
    }
    
    upgrades.push({
      forkName,
      activationEpoch,
      activationTimestamp,
      confidence: 0.95,
      sourceUrl: item.link || 'https://blog.ethereum.org',
      publishedAt: new Date(item.pubDate || Date.now())
    });
  }
  
  if (upgrades.length === 0) {
    console.log('\nNo upgrades found in recent posts');
    return;
  }
  
  console.log(`\nFound ${upgrades.length} upgrade(s), saving to database...`);
  
  const pool = getPool();
  
  for (const upgrade of upgrades) {
    // Insert upgrade plan
    await pool.query(`
      INSERT INTO upgrade_plans (chain_id, fork_name, status, activation_epoch, activation_ts, confidence, source_summary, last_updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (chain_id, fork_name) DO UPDATE SET
        status = EXCLUDED.status,
        activation_epoch = EXCLUDED.activation_epoch,
        activation_ts = EXCLUDED.activation_ts,
        confidence = EXCLUDED.confidence,
        source_summary = EXCLUDED.source_summary,
        last_updated_at = NOW()
    `, [
      'eth-mainnet',
      upgrade.forkName,
      'scheduled',
      upgrade.activationEpoch || null,
      upgrade.activationTimestamp ? new Date(upgrade.activationTimestamp * 1000) : null,
      upgrade.confidence,
      `${upgrade.forkName} upgrade - Source: ${upgrade.sourceUrl}`
    ]);
    
    // Calculate and insert countdown
    let targetUnix: number;
    
    if (upgrade.activationEpoch) {
      // Ethereum mainnet: genesisUnix: 1606824023, slotSeconds: 12, slotsPerEpoch: 32
      targetUnix = 1606824023 + (upgrade.activationEpoch * 32 * 12);
    } else if (upgrade.activationTimestamp) {
      targetUnix = upgrade.activationTimestamp;
    } else {
      continue;
    }
    
    const bufferSeconds = 32 * 12; // 384 seconds (32 slots)
    
    await pool.query(`
      INSERT INTO countdowns (chain_id, fork_name, target_ts, window_low_ts, window_high_ts, confidence)
      VALUES ($1, $2, to_timestamp($3), to_timestamp($4), to_timestamp($5), $6)
      ON CONFLICT (chain_id) DO UPDATE SET
        fork_name = EXCLUDED.fork_name,
        target_ts = EXCLUDED.target_ts,
        window_low_ts = EXCLUDED.window_low_ts,
        window_high_ts = EXCLUDED.window_high_ts,
        confidence = EXCLUDED.confidence
    `, [
      'eth-mainnet',
      upgrade.forkName,
      targetUnix,
      targetUnix - bufferSeconds,
      targetUnix + bufferSeconds,
      upgrade.confidence
    ]);
    
    console.log(`✓ ${upgrade.forkName} saved`);
    console.log(`  Target: ${new Date(targetUnix * 1000).toUTCString()}`);
  }
}
