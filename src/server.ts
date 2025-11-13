import http from 'node:http';
import { URL } from 'node:url';
import dotenv from 'dotenv';
import { getPool } from './lib/db.js';

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

    if (req.method === 'GET' && url.pathname.startsWith('/v1/upgrades/')) {
      const chainId = decodeURIComponent(url.pathname.replace('/v1/upgrades/', ''));
      const result = await pool.query('SELECT * FROM upgrade_plans WHERE chain_id = $1 ORDER BY last_updated_at DESC', [chainId]);
      return json(res, 200, result.rows);
    }

    if (req.method === 'POST' && url.pathname === '/v1/alerts/subscribe') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          return json(res, 202, { status: 'accepted', subscription: payload });
        } catch {
          return json(res, 400, { error: 'Invalid JSON' });
        }
      });
      return;
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
