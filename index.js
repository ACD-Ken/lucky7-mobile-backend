// server/index.js
// Express backend for LuckyMobile7

import 'dotenv/config';
import express    from 'express';
import cors       from 'cors';
import rateLimit  from 'express-rate-limit';
import pg         from 'pg';
import generateHandler from './routes/generate.js';

// ── Startup migration — creates device_usage table if DATABASE_URL is set ─────
async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('DATABASE_URL not set — skipping auto-migration (device_usage table must be created manually)');
    return;
  }
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS device_usage (
        device_id  TEXT        PRIMARY KEY,
        run_count  INTEGER     NOT NULL DEFAULT 0,
        first_run  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_run   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Migration OK: device_usage table ready');
  } catch (e) {
    console.warn('Migration warning (non-fatal):', e.message);
  } finally {
    await client.end().catch(() => {});
  }
}

const app  = express();
const PORT = process.env.PORT || 3001;

// ── A. Version gate config — bump MIN_VERSION to force app updates ─────────────
const MIN_VERSION = '1.0.0';

function semverCompare(a, b) {
  const pa = String(a || '0').split('.').map(Number);
  const pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return  1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

app.use(cors());
app.use(express.json());

// ── Rate limiting — max 10 requests per IP per minute ─────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'rate_limit', message: 'Too many requests. Please wait a moment.' }
});
app.use('/api/generate', limiter);

// ── Shared secret gate ─────────────────────────────────────────────────────────
app.use('/api', (req, res, next) => {
  const token = req.headers['x-app-secret'];
  if (!token || token !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing app secret.' });
  }
  next();
});

// ── A. Version gate — rejects outdated app versions ───────────────────────────
app.use('/api', (req, res, next) => {
  const version = req.headers['x-app-version'] || '0.0.0';
  if (semverCompare(version, MIN_VERSION) < 0) {
    return res.status(426).json({
      error:   'version_outdated',
      message: `App version ${version} is outdated. Please update to v${MIN_VERSION} or later.`,
      minVersion: MIN_VERSION
    });
  }
  next();
});

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'LuckyMobile7 Backend', minVersion: MIN_VERSION });
});

// Main route
app.post('/api/generate', generateHandler);

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`LuckyMobile7 backend running on http://localhost:${PORT}`);
  });
});
