// server/routes/generate.js
// POST /api/generate — Super7 redesign: BaZi server-side, AI ranks only

import { toISO, calculateHotCold, computeUser5, computeHot1, computeCold1,
         parseAiOutput, validateOutput, parseSerpApiResponse } from '../lib/lucky7.js';
import { buildPrompt, callAI }                                  from '../lib/aiProvider.js';
import { createServiceClient, fetchDrawHistory, upsertDraw, saveLog } from '../lib/supabase.js';

const MONTH_STARS = { 1:6, 2:5, 3:4, 4:3, 5:2, 6:1, 7:9, 8:8, 9:7, 10:6, 11:5, 12:4 };
const STAR_NAMES  = { 1:'Water', 2:'Earth', 3:'Wood', 4:'Wood', 5:'Earth', 6:'Metal', 7:'Metal', 8:'Earth', 9:'Fire' };

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
    const { nickName, birthdate, sex, drawDate, birthTime } = req.body;

    if (!nickName || !birthdate || !sex || !drawDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dob       = toISO(birthdate);
    const draw_date = toISO(drawDate);

    // Step 1: Draw history (always needed for hot/cold pools)
    const db       = createServiceClient();
    const drawRows = await fetchDrawHistory(db);

    // Step 2: Draw data — try SerpAPI, fallback to most recent DB record
    let drawData = await fetchLatestDraw();
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
        drawData = { draw_no: '', past_draw_date: '', winning_numbers: '', additional_number: '' };
        console.log('No draw data available — proceeding with empty draw context');
      }
    }

    // Step 3: Hot/cold pools from last 10 draws
    const { hotPool, coldPool, analyzedDraws } = calculateHotCold(drawRows);

    // Step 4: Server-side BaZi computation → User_5
    const baziResult = computeUser5(dob, sex, birthTime || null);
    const user5arr   = baziResult.user5;

    // Step 5: Hot_1 and Cold_1 from historical pools via Five Elements
    const hot1  = computeHot1(hotPool, draw_date, user5arr)           ?? (hotPool[0]  ?? 1);
    const cold1 = computeCold1(coldPool, draw_date, user5arr, hot1)  ?? (coldPool[0] ?? 2);

    // Step 6: Build super7 = user5 ∪ {hot1} ∪ {cold1}, exactly 7 unique numbers
    const super7Set = new Set(user5arr);
    super7Set.add(hot1);
    super7Set.add(cold1);
    let super7arr = [...super7Set];
    if (super7arr.length < 7) {
      for (let n = 1; n <= 49 && super7arr.length < 7; n++) {
        if (!super7Set.has(n)) { super7Set.add(n); super7arr.push(n); }
      }
    }
    super7arr = super7arr.slice(0, 7).sort((a, b) => a - b);

    // Step 7: AI context
    const drawMonthN = parseInt(draw_date.split('-')[1]) || 2;
    const mStarN     = MONTH_STARS[drawMonthN] || 5;
    const mStarNm    = STAR_NAMES[mStarN] || 'Earth';

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
      analyzed_draws:    analyzedDraws,
      user5_arr:         user5arr,
      hot1,
      cold1,
      super7_arr:        super7arr,
      dayMasterElem:     baziResult.dayMasterElem,
      luckPillarElem:    baziResult.luckPillarElem,
      annualStar:         '8 (Earth)',
      monthlyStar:        `${mStarN}(${mStarNm})`,
      dominantInfluence:  `Earth to ${mStarNm}`,
    };

    // Step 8: AI call — ranks super7 → Final4 + Final3 + Mystical
    const prompt    = buildPrompt(ctx);
    const aiRaw     = await callAI(prompt);
    const parsed    = parseAiOutput(aiRaw, super7arr);
    const validated = validateOutput(parsed, super7arr);

    // Step 9: Result object
    const result = {
      ...ctx,
      user_5:               user5arr.join(', '),
      hot_1:                String(hot1),
      cold_1:               String(cold1),
      super7:               super7arr.join(', '),
      Final4:               parsed.final4.join(', '),
      Final3:               parsed.final3.join(', '),
      user5_arr:            user5arr,
      hot1_arr:             [hot1],
      cold1_arr:            [cold1],
      super7_arr:           super7arr,
      final4_arr:           parsed.final4,
      final3_arr:           parsed.final3,
      mystical_explanation: parsed.mystical,
      validation_status:    validated.status,
      validation_errors:    validated.errors.join(', ')
    };

    // Step 10: Save draw
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

    // Step 11: Save log
    try { await saveLog(db, result); }
    catch (e) { console.error('saveLog error:', e.message); }

    // Step 12: Return to client
    return res.status(200).json({ success: true, result });

  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
