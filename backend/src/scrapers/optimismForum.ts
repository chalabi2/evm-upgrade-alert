import axios from 'axios';
import { getPool } from '../lib/db.js';
import { timestampCountdown } from '../contracts/countdown.js';
import { extractUpgradeInfo as llmExtractUpgradeInfo, extractUpgradeInfoFallback } from '../lib/llmExtractor.js';
import { shouldSkipUpgradeProcessing, shouldSkipUpgradeProcessingBySource } from '../lib/upgradeCache.js';

interface ForumTopic {
  id: number;
  title: string;
  slug: string;
  created_at: string;
  tags?: string[];
  category_id?: number;
}

interface ForumPost {
  id: number;
  cooked: string; // HTML content
  created_at: string;
}

/**
 * Scrapes Optimism governance forum for protocol upgrade proposals
 * Monitors the Technical Proposals category for upgrade announcements
 */
export async function scrapeOptimismForum(): Promise<void> {
  console.log('[Optimism Forum] Starting scrape...');

  try {
    // Fetch latest topics from Technical Proposals category (ID 47) with protocol-upgrade tag
    const response = await axios.get('https://gov.optimism.io/c/technical-proposals/47.json', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EVM-Upgrades-Monitor/1.0'
      },
      timeout: 30000
    });

    const topics: ForumTopic[] = response.data.topic_list?.topics || [];
    console.log(`[Optimism Forum] Found ${topics.length} topics in Technical Proposals`);

    // Filter for protocol upgrade topics (not deprecated)
    const upgradTopics = topics.filter(topic => 
      topic.tags?.includes('protocol-upgrade') && 
      !topic.title.toLowerCase().includes('[deprecated]') &&
      !topic.title.toLowerCase().includes('deprecated')
    );

    console.log(`[Optimism Forum] Found ${upgradTopics.length} active upgrade proposals`);

    for (const topic of upgradTopics) {
      await processUpgradeTopic(topic);
    }

    console.log('[Optimism Forum] Scrape complete');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[Optimism Forum] HTTP error:', error.message);
    } else {
      console.error('[Optimism Forum] Error:', error);
    }
  }
}

async function processUpgradeTopic(topic: ForumTopic): Promise<void> {
  console.log(`[Optimism Forum] Processing: ${topic.title}`);

  try {
    // Fetch full topic details including first post
    const topicUrl = `https://gov.optimism.io/t/${topic.slug}/${topic.id}.json`;
    const response = await axios.get(topicUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EVM-Upgrades-Monitor/1.0'
      },
      timeout: 30000
    });

    const topicData = response.data;
    const firstPost: ForumPost = topicData.post_stream?.posts?.[0];

    if (!firstPost) {
      console.log(`[Optimism Forum] No post content found for topic ${topic.id}`);
      return;
    }

    const sourceUrl = `https://gov.optimism.io/t/${topic.slug}/${topic.id}`;

    const chainId = 'op-mainnet';
    let fallbackData = extractUpgradeInfoFallback(topic.title, firstPost.cooked);
    const fallbackForkName = fallbackData.forkName;

    if (await shouldSkipUpgradeProcessingBySource(chainId, sourceUrl)) {
      console.log(`[Optimism Forum] Existing alert + LLM details found for source ${sourceUrl}. Skipping.`);
      return;
    }

    if (fallbackForkName && await shouldSkipUpgradeProcessing(chainId, fallbackForkName)) {
      console.log(`[Optimism Forum] Existing alert + LLM details found for ${fallbackForkName}. Skipping.`);
      return;
    }

    // Extract upgrade details using LLM (with fallback to regex)
    console.log(`[Optimism Forum] Extracting upgrade info using LLM...`);
    let llmExtraction = await llmExtractUpgradeInfo(topic.title, firstPost.cooked);
    let llmExtracted = false;
    
    if (!llmExtraction) {
      console.log(`[Optimism Forum] LLM extraction failed, using fallback parser`);
      if (!fallbackData.forkName) {
        fallbackData = extractUpgradeInfoFallback(topic.title, firstPost.cooked);
      }
      if (!fallbackData.forkName) {
        console.log(`[Optimism Forum] Could not extract upgrade info from: ${topic.title}`);
        return;
      }
      llmExtraction = fallbackData as any;
    } else {
      llmExtracted = true;
    }

    // Determine activation timestamp from multiple sources
    let activationTs: Date | null = null;
    if (llmExtraction?.unixTimestamp) {
      activationTs = new Date(llmExtraction.unixTimestamp * 1000);
    } else if (llmExtraction?.activationDate) {
      activationTs = new Date(llmExtraction.activationDate);
    } else if (llmExtraction?.timeline?.mainnetActivation) {
      activationTs = new Date(llmExtraction.timeline.mainnetActivation);
    } else if (llmExtraction?.timeline?.upgradeDate) {
      activationTs = new Date(llmExtraction.timeline.upgradeDate);
    }

    // Set status to scheduled if we have an activation date
    let status = llmExtraction?.status || 'proposed';
    if (activationTs && status === 'proposed') {
      status = 'scheduled';
    }

    const upgradeInfo = {
      chainId,
      forkName: llmExtraction?.forkName,
      status,
      activationTs,
      description: llmExtraction?.description,
      details: {
        keyPoints: llmExtraction?.keyPoints || [],
        affectedChains: llmExtraction?.affectedChains || [],
        technicalDetails: llmExtraction?.technicalDetails || {},
        timeline: llmExtraction?.timeline || {},
        links: llmExtraction?.links || {},
        stakeholders: llmExtraction?.stakeholders || {},
        risks: llmExtraction?.risks || [],
        requirements: llmExtraction?.requirements || [],
        source: sourceUrl,
        extractedAt: new Date().toISOString(),
        llmExtracted,
        // Store the unix timestamp if we have it
        unixTimestamp: llmExtraction?.unixTimestamp || null
      }
    };

    const pool = getPool();
    
    // Check if we already have this upgrade tracked
    const existing = await pool.query(
      `SELECT id FROM upgrade_plans WHERE chain_id = $1 AND fork_name = $2`,
      [upgradeInfo.chainId, upgradeInfo.forkName]
    );

    if (existing.rows.length > 0) {
      // Update existing upgrade with latest info
      await pool.query(
        `UPDATE upgrade_plans 
         SET status = $1, activation_ts = $2, source_summary = $3, details = $4, last_updated_at = NOW()
         WHERE chain_id = $5 AND fork_name = $6`,
        [upgradeInfo.status, upgradeInfo.activationTs, upgradeInfo.description, JSON.stringify(upgradeInfo.details), upgradeInfo.chainId, upgradeInfo.forkName]
      );
      console.log(`[Optimism Forum] Updated upgrade: ${upgradeInfo.forkName} for ${upgradeInfo.chainId}`);
    } else {
      // Create new upgrade plan
      await pool.query(
        `INSERT INTO upgrade_plans (chain_id, fork_name, status, activation_ts, source_summary, details, last_updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [upgradeInfo.chainId, upgradeInfo.forkName, upgradeInfo.status, upgradeInfo.activationTs, upgradeInfo.description, JSON.stringify(upgradeInfo.details)]
      );
      console.log(`[Optimism Forum] Created new upgrade: ${upgradeInfo.forkName} for ${upgradeInfo.chainId}`);
    }

    // Record the source
    await pool.query(
      `INSERT INTO sources (chain_id, kind, url)
       VALUES ($1, 'forum', $2)
       ON CONFLICT (chain_id, kind, url) DO NOTHING`,
      [upgradeInfo.chainId, sourceUrl]
    );

    // Ensure countdown exists for OP Stack chains
    if (activationTs) {
      const targetUnix = Math.floor(activationTs.getTime() / 1000);
      const window = timestampCountdown(targetUnix, 1800);

      await pool.query(
        `INSERT INTO countdowns (chain_id, fork_name, target_ts, window_low_ts, window_high_ts, confidence)
         VALUES ($1, $2, to_timestamp($3), to_timestamp($4), to_timestamp($5), $6)
         ON CONFLICT (chain_id) DO UPDATE SET
           fork_name = EXCLUDED.fork_name,
           target_ts = EXCLUDED.target_ts,
           window_low_ts = EXCLUDED.window_low_ts,
           window_high_ts = EXCLUDED.window_high_ts,
           confidence = EXCLUDED.confidence`,
        [
          upgradeInfo.chainId,
          upgradeInfo.forkName,
          window.targetUnix,
          window.windowLowUnix ?? null,
          window.windowHighUnix ?? null,
          window.confidence
        ]
      );
    }

  } catch (error) {
    console.error(`[Optimism Forum] Error processing topic ${topic.id}:`, error);
  }
}


