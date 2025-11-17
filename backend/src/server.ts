import http from 'node:http';
import { URL } from 'node:url';
import dotenv from 'dotenv';
import { getPool } from './lib/db.js';
import { encryptSecret } from './lib/crypto.js';

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

type Countdown = {
  chain_id: string;
  fork_name: string;
  target_ts: string;
  window_low_ts?: string | null;
  window_high_ts?: string | null;
  confidence: number;
};

type Upgrade = {
  fork_name: string;
  status: 'proposed'|'approved'|'scheduled'|'queued'|'executed'|'canceled';
  activation_epoch?: number | null;
  activation_ts?: string | null;
  confidence: number;
  source_summary?: string | null;
};

const ALLOWED_CHANNELS = ['discord', 'slack', 'telegram'] as const;
const ALLOWED_STAGES = ['proposed','approved','scheduled','queued','executed','canceled','release_posted','announced'] as const;
const ALERT_TYPES = ['upgrades', 'chain_events', 'releases'] as const;

function json(res: http.ServerResponse, code: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function notFound(res: http.ServerResponse) {
  json(res, 404, { error: 'Not Found' });
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) return notFound(res);
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pool = getPool();

    if (req.method === 'GET' && url.pathname === '/v1/countdowns') {
      const result = await pool.query('SELECT * FROM countdowns ORDER BY chain_id');
      return json(res, 200, result.rows);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/v1/countdowns/')) {
      const chainId = decodeURIComponent(url.pathname.replace('/v1/countdowns/', ''));
      const result = await pool.query('SELECT * FROM countdowns WHERE chain_id = $1', [chainId]);
      return result.rows.length > 0 ? json(res, 200, result.rows[0]) : notFound(res);
    }

    if (req.method === 'GET' && url.pathname === '/v1/upgrades') {
      const status = url.searchParams.get('status');
      const chain = url.searchParams.get('chain');
      
      let query = 'SELECT up.*, c.name as chain_name FROM upgrade_plans up JOIN chains c ON c.id = up.chain_id WHERE 1=1';
      const params: any[] = [];
      
      if (status) {
        params.push(status);
        query += ` AND up.status = $${params.length}`;
      }
      if (chain) {
        params.push(chain);
        query += ` AND up.chain_id = $${params.length}`;
      }
      
      query += ' ORDER BY up.last_updated_at DESC';
      
      const result = await pool.query(query, params);
      return json(res, 200, result.rows);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/v1/upgrades/')) {
      const chainId = decodeURIComponent(url.pathname.replace('/v1/upgrades/', ''));
      const result = await pool.query('SELECT up.*, c.name as chain_name FROM upgrade_plans up JOIN chains c ON c.id = up.chain_id WHERE up.chain_id = $1 ORDER BY up.last_updated_at DESC', [chainId]);
      return json(res, 200, result.rows);
    }

    if (req.method === 'GET' && url.pathname === '/v1/chains') {
      const result = await pool.query('SELECT * FROM chains ORDER BY name');
      return json(res, 200, result.rows);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/v1/chains/')) {
      const chainId = decodeURIComponent(url.pathname.replace('/v1/chains/', ''));
      const result = await pool.query('SELECT * FROM chains WHERE id = $1', [chainId]);
      return result.rows.length > 0 ? json(res, 200, result.rows[0]) : notFound(res);
    }

    if (req.method === 'GET' && url.pathname === '/v1/events') {
      const chain = url.searchParams.get('chain');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      let query = 'SELECT oe.*, c.name as chain_name FROM onchain_events oe JOIN chains c ON c.id = oe.chain_id WHERE 1=1';
      const params: any[] = [];
      
      if (chain) {
        params.push(chain);
        query += ` AND oe.chain_id = $${params.length}`;
      }
      
      params.push(limit);
      query += ` ORDER BY oe.occurred_at DESC LIMIT $${params.length}`;
      
      const result = await pool.query(query, params);
      return json(res, 200, result.rows);
    }

    if (req.method === 'GET' && url.pathname === '/v1/releases') {
      const chain = url.searchParams.get('chain');
      const fork = url.searchParams.get('fork');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      
      let query = 'SELECT r.*, c.name as chain_name FROM releases r LEFT JOIN chains c ON c.id = r.chain_id WHERE 1=1';
      const params: any[] = [];
      
      if (chain) {
        params.push(chain);
        query += ` AND r.chain_id = $${params.length}`;
      }
      if (fork) {
        params.push(fork);
        query += ` AND r.fork_name = $${params.length}`;
      }
      
      params.push(limit);
      query += ` ORDER BY r.published_at DESC LIMIT $${params.length}`;
      
      const result = await pool.query(query, params);
      return json(res, 200, result.rows);
    }

    if (req.method === 'POST' && url.pathname === '/v1/alerts/subscribe') {
      try {
        const raw = await readBody(req);
        const payload = raw ? JSON.parse(raw) : {};

        const userId = typeof payload.user_id === 'string' && payload.user_id.trim().length > 0
          ? payload.user_id.trim()
          : `anonymous-${Date.now()}`;
        const chainId = typeof payload.chain_id === 'string' && payload.chain_id.length > 0
          ? payload.chain_id
          : null;
        const forkFilter = typeof payload.fork_filter === 'string' && payload.fork_filter.length > 0
          ? payload.fork_filter
          : null;

        const requestedChannels: string[] = Array.isArray(payload.channels) ? payload.channels : [];
        const channels = requestedChannels
          .map((channel) => channel.toLowerCase())
          .filter((channel): channel is typeof ALLOWED_CHANNELS[number] => (ALLOWED_CHANNELS as readonly string[]).includes(channel));

        if (channels.length === 0) {
          return json(res, 400, { error: 'At least one supported channel (discord, slack, telegram) is required.' });
        }

        const requestedStages: string[] = Array.isArray(payload.stages) ? payload.stages : [];
        const stages = requestedStages
          .map((stage) => stage.toLowerCase())
          .filter((stage): stage is typeof ALLOWED_STAGES[number] => (ALLOWED_STAGES as readonly string[]).includes(stage as any));
        if (stages.length === 0) {
          stages.push('scheduled');
        }

        const requestedAlertTypes: string[] = Array.isArray(payload.alert_types) ? payload.alert_types : [];
        const alertTypes = requestedAlertTypes
          .map((type) => type.toLowerCase())
          .filter((type): type is typeof ALERT_TYPES[number] => (ALERT_TYPES as readonly string[]).includes(type as any));
        if (alertTypes.length === 0) {
          alertTypes.push('upgrades');
        }

        const discordWebhook = payload.discord_webhook ? encryptSecret(payload.discord_webhook) : null;
        const slackWebhook = payload.slack_webhook ? encryptSecret(payload.slack_webhook) : null;
        const telegramBotToken = payload.telegram_bot_token ? encryptSecret(payload.telegram_bot_token) : null;
        const telegramChatId = payload.telegram_chat_id ? encryptSecret(payload.telegram_chat_id) : null;

        if (channels.includes('discord') && !discordWebhook) {
          return json(res, 400, { error: 'Discord channel requires discord_webhook.' });
        }
        if (channels.includes('slack') && !slackWebhook) {
          return json(res, 400, { error: 'Slack channel requires slack_webhook.' });
        }
        if (channels.includes('telegram') && (!telegramBotToken || !telegramChatId)) {
          return json(res, 400, { error: 'Telegram channel requires bot token and chat id.' });
        }

        const result = await pool.query(
          `INSERT INTO alert_subscriptions (
            user_id, chain_id, fork_filter, stages, alert_types, channels,
            discord_webhook, slack_webhook, telegram_bot_token, telegram_chat_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, user_id, chain_id, fork_filter, stages, alert_types, channels, created_at`,
          [
            userId,
            chainId,
            forkFilter,
            stages,
            alertTypes,
            channels,
            discordWebhook,
            slackWebhook,
            telegramBotToken,
            telegramChatId
          ]
        );

        return json(res, 201, {
          status: 'accepted',
          subscription: result.rows[0]
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid JSON';
        return json(res, 400, { error: message });
      }
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    }

    return notFound(res);
  } catch (err) {
    return json(res, 500, { error: 'Internal Server Error' });
  }
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on :${PORT}`);
  });
}

export default server;
