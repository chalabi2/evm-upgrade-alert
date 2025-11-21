import axios from 'axios';

const LLM_ENDPOINT = process.env.LLM_ENDPOINT;

export interface UpgradeExtraction {
  title: string;
  forkName: string;
  description: string;
  status: 'proposed' | 'approved' | 'scheduled' | 'queued' | 'executed' | 'canceled';
  activationDate?: string; // ISO 8601 format
  unixTimestamp?: number;
  keyPoints: string[];
  affectedChains: string[];
  technicalDetails: {
    features?: string[];
    breaking_changes?: string[];
    eips?: string[];
    dependencies?: string[];
  };
  timeline: {
    proposalDate?: string;
    voteStartDate?: string;
    voteEndDate?: string;
    upgradeDate?: string;
    activationDate?: string;
    mainnetActivation?: string;
    testnetActivation?: string;
  };
  links: {
    proposal?: string;
    documentation?: string;
    specifications?: string[];
    github?: string[];
  };
  stakeholders: {
    proposer?: string;
    reviewers?: string[];
    impacted?: string[];
  };
  risks: string[];
  requirements: string[];
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'The full title of the upgrade proposal'
    },
    forkName: {
      type: 'string',
      description: 'The short name/codename of the fork (e.g., "Jovian", "Fusaka", "Canyon")'
    },
    description: {
      type: 'string',
      description: 'A concise 1-2 sentence summary of what this upgrade does'
    },
    status: {
      type: 'string',
      enum: ['proposed', 'approved', 'scheduled', 'queued', 'executed', 'canceled'],
      description: 'Current status of the upgrade'
    },
    activationDate: {
      type: 'string',
      description: 'ISO 8601 formatted date when the upgrade will activate (if mentioned)'
    },
    unixTimestamp: {
      type: 'number',
      description: 'Unix timestamp of mainnet activation (if mentioned in tables/text)'
    },
    keyPoints: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of 3-5 key features or changes in this upgrade'
    },
    affectedChains: {
      type: 'array',
      items: { type: 'string' },
      description: 'Which chains are affected (e.g., ["Optimism", "Base", "All OP Stack chains"])'
    },
    technicalDetails: {
      type: 'object',
      properties: {
        features: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of technical features being added'
        },
        breaking_changes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Any breaking changes or incompatibilities'
        },
        eips: {
          type: 'array',
          items: { type: 'string' },
          description: 'EIP numbers mentioned (e.g., ["EIP-7594", "EIP-7892"])'
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Dependencies on other upgrades or software versions'
        }
      }
    },
    timeline: {
      type: 'object',
      properties: {
        proposalDate: { type: 'string', description: 'When proposal was created' },
        voteStartDate: { type: 'string', description: 'When voting starts' },
        voteEndDate: { type: 'string', description: 'When voting ends' },
        upgradeDate: { type: 'string', description: 'When upgrade will be executed' },
        mainnetActivation: { type: 'string', description: 'Mainnet activation date/time' },
        testnetActivation: { type: 'string', description: 'Testnet activation date/time' }
      }
    },
    links: {
      type: 'object',
      properties: {
        proposal: { type: 'string', description: 'Link to the proposal' },
        documentation: { type: 'string', description: 'Link to documentation' },
        specifications: {
          type: 'array',
          items: { type: 'string' },
          description: 'Links to technical specifications'
        },
        github: {
          type: 'array',
          items: { type: 'string' },
          description: 'GitHub PR/issue links'
        }
      }
    },
    stakeholders: {
      type: 'object',
      properties: {
        proposer: { type: 'string', description: 'Who proposed this' },
        reviewers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Who reviewed/approved'
        },
        impacted: {
          type: 'array',
          items: { type: 'string' },
          description: 'Who needs to take action (node operators, users, etc)'
        }
      }
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
      description: 'Security risks or concerns mentioned'
    },
    requirements: {
      type: 'array',
      items: { type: 'string' },
      description: 'Requirements for operators/users (software versions, actions needed)'
    }
  },
  required: ['title', 'forkName', 'description', 'status', 'keyPoints', 'affectedChains']
};

/**
 * Extract a specific section from text
 */
function extractSection(text: string, sectionName: string, maxLength: number): string {
  const regex = new RegExp(`${sectionName}[\\s\\S]{0,${maxLength}}`, 'i');
  const match = text.match(regex);
  return match ? match[0] : '';
}

/**
 * Extract all tables from text
 */
function extractTables(text: string, maxLength: number): string {
  const tableRegex = /\[TABLE\][\s\S]*?\[\/TABLE\]/g;
  const tables = text.match(tableRegex) || [];
  return tables.join('\n\n').slice(0, maxLength);
}

const SYSTEM_PROMPT = `You are an expert at analyzing blockchain upgrade proposals. 
Extract ALL important information from governance forum posts about network upgrades.

Your task is to comprehensively extract:
1. **Basic Info**: Title, fork name, description, status
2. **Timeline**: ALL dates mentioned - look for:
   - Proposal/announcement date
   - Voting start/end dates
   - Testnet activation dates
   - Mainnet activation dates (CRITICAL - look in tables and text)
   - Upgrade execution dates
3. **Technical Details**: Features, EIPs, breaking changes, dependencies
4. **Stakeholders**: Proposers, reviewers, impacted parties
5. **Requirements**: What operators/users need to do (upgrade software, etc)
6. **Risks**: Security concerns or risks mentioned
7. **Links**: Specifications, documentation, GitHub links
8. **Activation**: Unix timestamps (CRITICAL - look in tables with "UNIX Timestamp" column)

CRITICAL INSTRUCTIONS FOR DATES:
- Look for tables with columns like "UTC Time", "UNIX Timestamp", "Start Slot", "Epoch"
- Extract mainnet activation dates from phrases like "Mainnet activation will be scheduled for 2nd December"
- Extract testnet dates from similar patterns
- If you find a Unix timestamp, ALSO fill in the corresponding timeline date fields
- Format dates as ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)
- If a date is mentioned but not found, leave the field empty (don't guess)

Be EXTREMELY thorough. Extract:
- ALL dates and timestamps (look in tables, text, and lists)
- ALL EIP numbers mentioned
- ALL features and changes
- ALL requirements for node operators
- ALL links to specs, docs, and GitHub

For OP Stack upgrades, they typically affect Optimism, Base, and all OP Stack chains.`;

/**
 * Uses a local LLM to extract structured upgrade information from forum post HTML
 */
export async function extractUpgradeInfo(
  postTitle: string,
  htmlContent: string
): Promise<UpgradeExtraction | null> {
  try {
    // Convert HTML to readable text while preserving table structure
    let textContent = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Preserve table structure with clear markers
      .replace(/<table[^>]*>/gi, '\n[TABLE]\n')
      .replace(/<\/table>/gi, '\n[/TABLE]\n')
      .replace(/<tr[^>]*>/gi, '\n[ROW] ')
      .replace(/<\/tr>/gi, ' [/ROW]')
      .replace(/<th[^>]*>/gi, '[HEADER:')
      .replace(/<\/th>/gi, '] ')
      .replace(/<td[^>]*>/gi, '[CELL:')
      .replace(/<\/td>/gi, '] ')
      // Convert other tags to newlines/spaces
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();

    // Prioritize important sections - extract key parts
    const sections = {
      executiveSummary: extractSection(textContent, 'Executive Summary', 1500),
      specifications: extractSection(textContent, 'Specifications', 1000),
      timeline: extractSection(textContent, 'Action Plan', 1000),
      tables: extractTables(textContent, 2000),
      impactSummary: extractSection(textContent, 'Impact', 800),
    };

    // Combine prioritized content
    textContent = [
      sections.executiveSummary,
      sections.tables,
      sections.timeline,
      sections.specifications,
      sections.impactSummary
    ].filter(Boolean).join('\n\n').slice(0, 8000);

    const response = await axios.post(
      LLM_ENDPOINT || '',
      {
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: `Analyze this blockchain upgrade proposal and extract structured information.

Title: ${postTitle}

Content:
${textContent}

Respond ONLY with a valid JSON object matching this schema (no markdown, no explanation):
${JSON.stringify(EXTRACTION_SCHEMA, null, 2)}`
          }
        ],
        temperature: 1
      },
      {
        headers: {
           'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    let content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[LLM Extractor] No content in response');
      return null;
    }

    // Strip markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let extracted: UpgradeExtraction;
    try {
      extracted = JSON.parse(content);
    } catch (parseError) {
      console.error('[LLM Extractor] JSON parse error:', parseError);
      console.error('[LLM Extractor] Raw content:', content.slice(0, 500));
      return null;
    }

    // Validate required fields
    if (!extracted.title || !extracted.forkName || !extracted.description) {
      console.error('[LLM Extractor] Missing required fields in extraction');
      return null;
    }

    console.log('[LLM Extractor] Successfully extracted:', {
      forkName: extracted.forkName,
      status: extracted.status,
      hasTimestamp: !!extracted.unixTimestamp
    });

    return extracted;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[LLM Extractor] HTTP error:', error.message);
      if (error.response) {
        console.error('[LLM Extractor] Response:', error.response.data);
      }
    } else {
      console.error('[LLM Extractor] Error:', error);
    }
    return null;
  }
}

/**
 * Fallback: Simple regex-based extraction if LLM is unavailable
 */
export function extractUpgradeInfoFallback(
  postTitle: string,
  htmlContent: string
): Partial<UpgradeExtraction> {
  const upgradeMatch = postTitle.match(/Upgrade\s+(\d+)[:\s-]+(.+)/i);
  if (!upgradeMatch) {
    return {};
  }

  const upgradeName = upgradeMatch[2].trim();
  const forkNameMatch = upgradeName.match(/^([A-Z][a-z]+)/);
  const forkName = forkNameMatch ? forkNameMatch[1] : `Upgrade-${upgradeMatch[1]}`;

  let unixTimestamp: number | undefined;
  const unixMatch = htmlContent.match(/UNIX Timestamp.*?(\d{10})/);
  if (unixMatch) {
    unixTimestamp = parseInt(unixMatch[1]);
  }

  return {
    title: postTitle,
    forkName,
    description: upgradeName,
    status: unixTimestamp ? 'scheduled' : 'proposed',
    unixTimestamp,
    keyPoints: [],
    affectedChains: ['Optimism', 'Base']
  };
}

