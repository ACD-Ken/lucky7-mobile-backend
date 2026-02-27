// server/routes/generate.js
// POST /api/generate — ported from lucky7-copilot Next.js API route

import { toISO, calculateHotCold, calculateMetaphysics,
         parseAiOutput, validateOutput, parseSerpApiResponse } from '../lib/lucky7.js';
import { buildPrompt, callAI }                                  from '../lib/aiProvider.js';
import { createServiceClient, fetchDrawHistory, upsertDraw, saveLog } from '../lib/supabase.js';

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
    const { nickName, birthdate, sex, drawDate, manualDraw } = req.body;

    if (!nickName || !birthdate || !sex || !drawDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dob       = toISO(birthdate);
    const draw_date = toISO(drawDate);

    // Step 1: Draw history (always needed)
    const db       = createServiceClient();
    const drawRows = await fetchDrawHistory(db);

    // Step 2: Draw data — try SerpAPI, fallback to most recent DB record
    let drawData = await fetchLatestDraw();
    if (!drawData || !drawData.winning_numbers) {
      // Use the most recent draw from DB as fallback
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
        // No draw data at all — generate with empty draw context (AI still works)
        drawData = { draw_no: '', past_draw_date: '', winning_numbers: '', additional_number: '' };
        console.log('No draw data available — proceeding with empty draw context');
      }
    }

    // Step 3: Hot/cold pools
    const { hotPool, coldPool, analyzedDraws } = calculateHotCold(drawRows);

    // Step 4: Metaphysics
    const meta = calculateMetaphysics(dob, draw_date);

    // Step 5: AI context
    const ctx = {
      nickName, dob, sex, draw_date,
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

    // Step 6: AI call
    const prompt    = buildPrompt(ctx);
    const aiRaw     = await callAI(prompt);
    const parsed    = parseAiOutput(aiRaw);
    const validated = validateOutput(parsed, hotPool, coldPool);

    // Step 7: Result object
    const result = {
      ...ctx,
      user_4:               parsed.user4.join(', '),
      hot_4:                parsed.hot4.join(', '),
      cold_4:               parsed.cold4.join(', '),
      Final4:               parsed.final4.join(', '),
      Final3:               parsed.final3.join(', '),
      user4_arr:            parsed.user4,
      hot4_arr:             parsed.hot4,
      cold4_arr:            parsed.cold4,
      final4_arr:           parsed.final4,
      final3_arr:           parsed.final3,
      mystical_explanation: parsed.mystical,
      validation_status:    validated.status,
      validation_errors:    validated.errors.join(', ')
    };

    // Step 8: Save draw
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

    // Step 9: Save log
    try { await saveLog(db, result); }
    catch (e) { console.error('saveLog error:', e.message); }

    // Step 10: Return to client
    return res.status(200).json({ success: true, result });

  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
