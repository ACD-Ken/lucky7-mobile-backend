// server/index.js
// Express backend for LuckyMobile7

import 'dotenv/config';
import express    from 'express';
import cors       from 'cors';
import rateLimit  from 'express-rate-limit';
import generateHandler from './routes/generate.js';

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Fix 2: Rate limiting — max 10 requests per IP per minute ──────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1-minute window
  max:      10,          // max 10 calls per IP per window
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'rate_limit', message: 'Too many requests. Please wait a moment.' }
});
app.use('/api/generate', limiter);

// ── Fix 1: Shared secret gate — rejects any call without the correct header ───
app.use('/api', (req, res, next) => {
  const token = req.headers['x-app-secret'];
  if (!token || token !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing app secret.' });
  }
  next();
});

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'LuckyMobile7 Backend' });
});

// Main route
app.post('/api/generate', generateHandler);

app.listen(PORT, () => {
  console.log(`LuckyMobile7 backend running on http://localhost:${PORT}`);
});
