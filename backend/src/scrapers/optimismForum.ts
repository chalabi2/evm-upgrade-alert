import axios from 'axios';
import { getPool } from '../lib/db.js';
import { extractUpgradeInfo as llmExtractUpgradeInfo, extractUpgradeInfoFallback } from '../lib/llmExtractor.js';

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

    // Extract upgrade details using LLM (with fallback to regex)
    console.log(`[Optimism Forum] Extracting upgrade info using LLM...`);
    let llmExtraction = await llmExtractUpgradeInfo(topic.title, firstPost.cooked);
    
    if (!llmExtraction) {
      console.log(`[Optimism Forum] LLM extraction failed, using fallback parser`);
      const fallbackData = extractUpgradeInfoFallback(topic.title, firstPost.cooked);
      if (!fallbackData.forkName) {
        console.log(`[Optimism Forum] Could not extract upgrade info from: ${topic.title}`);
        return;
      }
      llmExtraction = fallbackData as any;
    }

    // Determine activation timestamp from multiple sources
    let activationTs: Date | null = null;
    if (llmExtraction.unixTimestamp) {
      activationTs = new Date(llmExtraction.unixTimestamp * 1000);
    } else if (llmExtraction.activationDate) {
      activationTs = new Date(llmExtraction.activationDate);
    } else if (llmExtraction.timeline?.mainnetActivation) {
      activationTs = new Date(llmExtraction.timeline.mainnetActivation);
    } else if (llmExtraction.timeline?.upgradeDate) {
      activationTs = new Date(llmExtraction.timeline.upgradeDate);
    }

    // Set status to scheduled if we have an activation date
    let status = llmExtraction.status || 'proposed';
    if (activationTs && status === 'proposed') {
      status = 'scheduled';
    }

    const upgradeInfo = {
      chainId: 'op-mainnet',
      forkName: llmExtraction.forkName,
      status,
      activationTs,
      description: llmExtraction.description,
      details: {
        keyPoints: llmExtraction.keyPoints || [],
        affectedChains: llmExtraction.affectedChains || [],
        technicalDetails: llmExtraction.technicalDetails || {},
        timeline: llmExtraction.timeline || {},
        links: llmExtraction.links || {},
        stakeholders: llmExtraction.stakeholders || {},
        risks: llmExtraction.risks || [],
        requirements: llmExtraction.requirements || [],
        source: sourceUrl,
        extractedAt: new Date().toISOString(),
        // Store the unix timestamp if we have it
        unixTimestamp: llmExtraction.unixTimestamp || null
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

  } catch (error) {
    console.error(`[Optimism Forum] Error processing topic ${topic.id}:`, error);
  }
}


