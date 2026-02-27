// server/index.js
// Express backend for LuckyMobile7

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import generateHandler from './routes/generate.js';

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'LuckyMobile7 Backend' });
});

// Main route
app.post('/api/generate', generateHandler);

app.listen(PORT, () => {
  console.log(`LuckyMobile7 backend running on http://localhost:${PORT}`);
});
