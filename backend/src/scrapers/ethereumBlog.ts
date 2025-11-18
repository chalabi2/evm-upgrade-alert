import axios from 'axios';
import Parser from 'rss-parser';
import { getPool } from '../lib/db.js';
import {
  extractUpgradeInfo as llmExtractUpgradeInfo,
  extractUpgradeInfoFallback,
  type UpgradeExtraction
} from '../lib/llmExtractor.js';
import { shouldSkipUpgradeProcessing } from '../lib/upgradeCache.js';

const parser = new Parser();

type UpgradeStatus = UpgradeExtraction['status'];

type StoredUpgradeDetails = {
  keyPoints: string[];
  affectedChains: string[];
  technicalDetails: UpgradeExtraction['technicalDetails'];
  timeline: UpgradeExtraction['timeline'];
  links: UpgradeExtraction['links'];
  stakeholders: UpgradeExtraction['stakeholders'];
  risks: string[];
  requirements: string[];
  source: string;
  extractedAt: string;
  unixTimestamp: number | null;
  llmExtracted: boolean;
};

interface UpgradeInfo {
  forkName: string;
  status: UpgradeStatus;
  activationEpoch?: number;
  activationTs: Date | null;
  activationUnix?: number;
  targetUnix?: number;
  confidence: number;
  sourceUrl: string;
  sourceSummary: string;
  details: StoredUpgradeDetails;
}

async function fetchBlogPostContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return '';
  }
}

export async function scrapeEthereumBlog(): Promise<void> {
  console.log('Scraping Ethereum blog RSS feed...');
  const chainId = 'eth-mainnet';
  
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

    if (await shouldSkipUpgradeProcessing(chainId, forkName, { requireCountdown: true })) {
      console.log('  Existing alert + LLM details detected, skipping reprocessing.');
      continue;
    }
    
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

    const sourceUrl = item.link || 'https://blog.ethereum.org';

    let llmExtraction: UpgradeExtraction | null = null;
    let llmExtracted = false;
    if (blogHtml) {
      console.log('  Extracting structured details with LLM...');
      llmExtraction = await llmExtractUpgradeInfo(item.title || forkName, blogHtml);
      llmExtracted = !!llmExtraction;
    }

    if (!llmExtraction) {
      console.log('  LLM extraction unavailable, using fallback heuristics');
    }

    const fallbackData = extractUpgradeInfoFallback(
      item.title || forkName,
      blogHtml || item.content || item.contentSnippet || ''
    );

    const derivedUnix = typeof activationTimestamp === 'number' ? activationTimestamp : undefined;
    const activationUnix = llmExtraction?.unixTimestamp ?? derivedUnix ?? null;

    let activationTs: Date | null = null;

    if (llmExtraction?.unixTimestamp) {
      activationTs = new Date(llmExtraction.unixTimestamp * 1000);
    } else {
      const timelineCandidates = [
        llmExtraction?.activationDate,
        llmExtraction?.timeline?.mainnetActivation,
        llmExtraction?.timeline?.upgradeDate
      ];

      for (const candidate of timelineCandidates) {
        if (!candidate) continue;
        const parsed = new Date(candidate);
        if (!Number.isNaN(parsed.getTime())) {
          activationTs = parsed;
          break;
        }
      }
    }

    if (!activationTs && derivedUnix) {
      const parsed = new Date(derivedUnix * 1000);
      activationTs = Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const fallbackStatus = fallbackData.status;
    const normalizedFallbackStatus =
      fallbackStatus === 'scheduled' || fallbackStatus === 'proposed' ? fallbackStatus : undefined;

    const status: UpgradeStatus =
      llmExtraction?.status ||
      normalizedFallbackStatus ||
      ((activationEpoch || activationUnix) ? 'scheduled' : 'proposed');

    const sourceSummary =
      llmExtraction?.description ||
      fallbackData.description ||
      `${forkName} upgrade - Source: ${sourceUrl}`;

    let targetUnix: number | undefined;
    if (activationEpoch) {
      targetUnix = 1606824023 + (activationEpoch * 32 * 12);
    } else if (activationUnix) {
      targetUnix = activationUnix;
    } else if (activationTs) {
      targetUnix = Math.floor(activationTs.getTime() / 1000);
    }

    const normalizedActivationTs = targetUnix ? new Date(targetUnix * 1000) : activationTs || null;

    const details: StoredUpgradeDetails = {
      keyPoints: llmExtraction?.keyPoints ?? fallbackData.keyPoints ?? [],
      affectedChains: llmExtraction?.affectedChains ?? fallbackData.affectedChains ?? ['Ethereum'],
      technicalDetails: llmExtraction?.technicalDetails ?? ({} as UpgradeExtraction['technicalDetails']),
      timeline: llmExtraction?.timeline ?? ({} as UpgradeExtraction['timeline']),
      links: llmExtraction?.links ?? ({} as UpgradeExtraction['links']),
      stakeholders: llmExtraction?.stakeholders ?? ({} as UpgradeExtraction['stakeholders']),
      risks: llmExtraction?.risks ?? [],
      requirements: llmExtraction?.requirements ?? [],
      source: sourceUrl,
      extractedAt: new Date().toISOString(),
      unixTimestamp: llmExtraction?.unixTimestamp ?? fallbackData.unixTimestamp ?? targetUnix ?? null,
      llmExtracted
    };

    upgrades.push({
      forkName,
      status,
      activationEpoch,
      activationTs: normalizedActivationTs,
      activationUnix: activationUnix ?? undefined,
      targetUnix,
      confidence: 0.95,
      sourceUrl,
      sourceSummary,
      details
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
      INSERT INTO upgrade_plans (chain_id, fork_name, status, activation_epoch, activation_ts, confidence, source_summary, details, last_updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (chain_id, fork_name) DO UPDATE SET
        status = EXCLUDED.status,
        activation_epoch = EXCLUDED.activation_epoch,
        activation_ts = EXCLUDED.activation_ts,
        confidence = EXCLUDED.confidence,
        source_summary = EXCLUDED.source_summary,
        details = EXCLUDED.details,
        last_updated_at = NOW()
    `, [
      chainId,
      upgrade.forkName,
      upgrade.status,
      upgrade.activationEpoch || null,
      upgrade.activationTs,
      upgrade.confidence,
      upgrade.sourceSummary,
      JSON.stringify(upgrade.details)
    ]);

    await pool.query(
      `INSERT INTO sources (chain_id, kind, url)
       VALUES ($1, 'blog', $2)
       ON CONFLICT (chain_id, kind, url) DO NOTHING`,
      [chainId, upgrade.sourceUrl]
    );
    
    // Calculate and insert countdown
    if (!upgrade.targetUnix) {
      console.log(`  Skipping countdown for ${upgrade.forkName} (no activation target)`);
      continue;
    }
    
    // Ethereum mainnet: genesisUnix: 1606824023, slotSeconds: 12, slotsPerEpoch: 32
    const targetUnix = upgrade.targetUnix;
    
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
      chainId,
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
