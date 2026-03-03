// server/routes/generate.js
// POST /api/generate — Super12 pipeline aligned with lucky7-copilot

import { toISO, calculateHotCold, calculateBaZi,
         parseAiOutput, validateOutput, parseSerpApiResponse } from '../lib/lucky7.js';
import { buildPrompt, callAI }                                  from '../lib/aiProvider.js';
import { createServiceClient, fetchDrawHistory, upsertDraw, saveLog,
         checkAndIncrementDeviceRun }                           from '../lib/supabase.js';

async function fetchLatestDraw() {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;
  try {
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine',  'google');
    url.searchParams.set('q',
      'singapore pools latest toto draw result winning numbers additional number draw number date');
    url.searchParams.set('api_key', apiKey);
    const res  = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const serp   = await res.json();
    const parsed = parseSerpApiResponse(serp);
    return parsed.winning_numbers ? parsed : null;
  } catch (e) {
    console.warn('SerpAPI fetch failed:', e.message);
    return null;
  }
}

export default async function generateHandler(req, res) {
  try {
    const { nickName, birthdate, sex, drawDate, manualDraw, birthTime } = req.body;

    if (!nickName || !birthdate || !sex || !drawDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dob       = toISO(birthdate);
    const draw_date = toISO(drawDate);

    // ── Device run-count gate ─────────────────────────────────────────────────
    const db       = createServiceClient();
    const deviceId = req.headers['x-device-id'] || null;
    const MAX_RUNS = 20;
    const { allowed, runCount } = await checkAndIncrementDeviceRun(db, deviceId, MAX_RUNS);
    if (!allowed) {
      return res.status(403).json({
        error:    'run_limit_reached',
        message:  `You have reached the maximum of ${MAX_RUNS} runs for this device.`,
        runCount,
        maxRuns:  MAX_RUNS
      });
    }

    // ── Draw history (needed for hot/cold pools) ──────────────────────────────
    const drawRows = await fetchDrawHistory(db);

    // ── Draw data: manualDraw → SerpAPI → latest DB record → needsManualDraw ──
    let drawData = manualDraw || await fetchLatestDraw();
    if (!drawData || !drawData.winning_numbers) {
      const latest = drawRows.find(r => r.winning_numbers);
      if (latest) {
        drawData = {
          draw_no:           latest.draw_no   || '',
          past_draw_date:    latest.date       || '',
          winning_numbers:   latest.winning_numbers,
          additional_number: latest.additional_number || ''
        };
        console.log('SerpAPI unavailable — using latest DB draw:', drawData.past_draw_date);
      } else {
        return res.status(200).json({ needsManualDraw: true });
      }
    }

    // ── Hot/cold pools from last 20 draws ────────────────────────────────────
    const { hotPool, coldPool, analyzedDraws } = calculateHotCold(drawRows);

    // ── BaZi 4-Pillar + Luck Pillar + Draw Day Pillar ────────────────────────
    const meta = calculateBaZi(dob, sex, draw_date, birthTime || null);

    // ── AI context ───────────────────────────────────────────────────────────
    const ctx = {
      nickName,
      dob,
      sex,
      draw_date,
      past_draw_date:    drawData.past_draw_date    || '',
      draw_no:           drawData.draw_no           || '',
      winning_numbers:   drawData.winning_numbers,
      additional_number: drawData.additional_number || '',
      hot_numbers:       hotPool.join(','),
      cold_numbers:      coldPool.join(','),
      hot_count:         hotPool.length,
      cold_count:        coldPool.length,
      analyzed_draws:    analyzedDraws,
      ...meta
    };

    // ── AI call with retry (up to 3 attempts if validation fails) ────────────
    const prompt = buildPrompt(ctx);
    const MAX_AI_ATTEMPTS = 3;
    let parsed, validated, attempt = 0;
    do {
      attempt++;
      const aiRaw = await callAI(prompt);
      parsed      = parseAiOutput(aiRaw);
      validated   = validateOutput(parsed, hotPool, coldPool);
      if (validated.status === 'Verified') break;
      console.warn(`AI attempt ${attempt}/${MAX_AI_ATTEMPTS} → ${validated.status}: ${validated.errors.join(', ')}${attempt < MAX_AI_ATTEMPTS ? ' — retrying…' : ' — using last result'}`);
    } while (attempt < MAX_AI_ATTEMPTS);

    // ── Result object ─────────────────────────────────────────────────────────
    const result = {
      ...ctx,
      user_4:               parsed.user4.join(', '),
      hot_4:                parsed.hot4.join(', '),
      cold_4:               parsed.cold4.join(', '),
      super12:              parsed.super12.join(', '),
      Final4:               parsed.final4.join(', '),
      Final3:               parsed.final3.join(', '),
      user4_arr:            parsed.user4,
      hot4_arr:             parsed.hot4,
      cold4_arr:            parsed.cold4,
      super12_arr:          parsed.super12,
      final4_arr:           parsed.final4,
      final3_arr:           parsed.final3,
      mystical_explanation: parsed.mystical,
      validation_status:    validated.status,
      validation_errors:    validated.errors.join(', ')
    };

    // ── Save draw (dedup guard) ───────────────────────────────────────────────
    if (result.past_draw_date && result.winning_numbers) {
      try {
        await upsertDraw(db, {
          draw_no:           result.draw_no           || null,
          date:              result.past_draw_date,
          winning_numbers:   result.winning_numbers,
          additional_number: result.additional_number || null
        });
      } catch (e) { console.error('upsertDraw error:', e.message); }
    }

    // ── Save log ─────────────────────────────────────────────────────────────
    try { await saveLog(db, result); }
    catch (e) { console.error('saveLog error:', e.message); }

    // ── Return to client ─────────────────────────────────────────────────────
    return res.status(200).json({ success: true, result });

  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
