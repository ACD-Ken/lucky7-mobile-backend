// server/lib/lucky7.js
// Direct port from lucky7-copilot/lib/lucky7.js

export function toISO(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-');
  const M = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };
  const m1 = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m1) return `${m1[3]}-${M[m1[2]] || '01'}-${m1[1].padStart(2, '0')}`;
  const m2 = s.match(/([A-Za-z]+)\s+(\d{1,2})[,\s]+(\d{4})/);
  if (m2) return `${m2[3]}-${M[m2[1]] || '01'}-${m2[2].padStart(2, '0')}`;
  const m3 = s.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (m3) return `${new Date().getFullYear()}-${M[m3[1]] || '01'}-${m3[2].padStart(2, '0')}`;
  return s.replace(/\//g, '-');
}

export function firstNum(raw) {
  if (!raw) return '';
  const m = String(raw).match(/\b(\d{1,2})\b/);
  return (m && parseInt(m[1]) >= 1 && parseInt(m[1]) <= 49) ? m[1] : '';
}

export function cleanWinning(raw) {
  if (!raw) return '';
  const nums = String(raw)
    .replace(/[^\d,\s]/g, ' ')
    .split(/[,\s]+/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n) && n >= 1 && n <= 49);
  const seen = {};
  const uniq = [];
  nums.forEach(n => { if (!seen[n]) { seen[n] = true; uniq.push(n); } });
  return uniq.slice(0, 6).join(' ');
}

export function scanText(s, state) {
  s = String(s || '');
  if (!state.draw_no) {
    const m = s.match(/Draw\s*(?:No|Number|#)?\s*[:\-]?\s*(\d{3,5})/i);
    if (m) state.draw_no = m[1];
    if (!state.draw_no && !s.match(/\d{4}-\d{2}-\d{2}/)) {
      const m2 = s.match(/\b(\d{4,5})\b/);
      if (m2) state.draw_no = m2[1];
    }
  }
  if (!state.draw_date_serp) {
    const dm = s.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2}[,\s]+\d{4}|\d{4}-\d{2}-\d{2})/);
    if (dm) state.draw_date_serp = dm[1];
  }
  if (!state.winning_numbers_raw) {
    const wm = s.match(/(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})/);
    if (wm) state.winning_numbers_raw = wm[0];
  }
  if (!state.additional_number_raw && s.match(/Additional\s*(?:Number)?/i)) {
    state.additional_number_raw = s.replace(/Additional\s*(?:Number)?\s*[:\-]?/gi, '').trim();
  }
  if (!state.winning_numbers_raw && s.match(/Winning\s*Numbers?/i)) {
    state.winning_numbers_raw = s.replace(/\d*\s*Winning\s*Numbers?\s*[:\-]?/gi, '').trim();
  }
  if (!state.draw_date_serp && s.match(/Draw\s*Date/i)) {
    state.draw_date_serp = s
      .replace(/Draw\s*Date\s*[:\-]?/gi, '')
      .replace(/Singapore Pools.*$/i, '')
      .trim();
  }
}

export function parseSerpApiResponse(serp) {
  const state = { draw_no: '', draw_date_serp: '', winning_numbers_raw: '', additional_number_raw: '' };

  try {
    if (serp.text_blocks && Array.isArray(serp.text_blocks)) {
      serp.text_blocks.forEach(tb => {
        scanText(tb.snippet || tb.text || '', state);
        const items = tb.list || tb.items || [];
        items.forEach(it => scanText(it.snippet || it.text || it.title || '', state));
      });
    }
    if (serp.answer_box) {
      const ab = serp.answer_box;
      if (!state.winning_numbers_raw)   state.winning_numbers_raw   = ab.winning_numbers  || ab.result || '';
      if (!state.additional_number_raw) state.additional_number_raw = ab.additional_number || '';
      if (!state.draw_no)               state.draw_no               = String(ab.draw_no || ab.draw_number || '').replace(/\D/g, '');
      if (!state.draw_date_serp)        state.draw_date_serp        = ab.date || ab.draw_date || '';
      scanText(JSON.stringify(ab), state);
    }
    if (serp.knowledge_graph) { scanText(JSON.stringify(serp.knowledge_graph), state); }
    if (serp.organic_results && Array.isArray(serp.organic_results)) {
      serp.organic_results.slice(0, 5).forEach(r => {
        scanText(r.snippet || '', state);
        scanText(r.title   || '', state);
        if (r.rich_snippet) scanText(JSON.stringify(r.rich_snippet), state);
      });
    }
    if (!state.draw_no || !state.additional_number_raw) {
      const rawStr = JSON.stringify(serp);
      if (!state.draw_no) {
        const dnm = rawStr.match(/"draw_no"\s*:\s*"?(\d{3,5})"?/i) ||
                    rawStr.match(/Draw\s*No[^:]*:\s*(\d{3,5})/i);
        if (dnm) state.draw_no = dnm[1];
      }
      if (!state.additional_number_raw) {
        const anm = rawStr.match(/"additional_number"\s*:\s*"?(\d{1,2})"?/i) ||
                    rawStr.match(/Additional\s*Number[^:]*:\s*(\d{1,2})/i);
        if (anm) state.additional_number_raw = anm[1];
      }
    }
  } catch (e) {
    console.error('SerpAPI parse error:', e.message);
  }

  let draw_no           = String(state.draw_no || '').replace(/\D/g, '').trim();
  const winning_numbers   = cleanWinning(state.winning_numbers_raw);
  const additional_number = firstNum(state.additional_number_raw);
  const past_draw_date    = toISO(state.draw_date_serp);

  if (!draw_no && past_draw_date) {
    const baseMs     = Date.parse('2024-01-01');
    const pastMs     = Date.parse(past_draw_date);
    if (!isNaN(baseMs) && !isNaN(pastMs)) {
      const weeksSince = Math.floor((pastMs - baseMs) / (7 * 24 * 3600 * 1000));
      draw_no = String(3516 + weeksSince * 2);
    }
  }

  return { draw_no, winning_numbers, additional_number, past_draw_date };
}

export function calculateHotCold(drawRows) {
  const validDraws = drawRows.filter(r => {
    const wn = r.winning_numbers;
    return wn !== undefined && wn !== null && String(wn).trim() !== '';
  });

  if (validDraws.length === 0) {
    return {
      hotPool: [],
      coldPool: Array.from({ length: 49 }, (_, i) => i + 1),
      analyzedDraws: 0
    };
  }

  validDraws.sort((a, b) =>
    (parseInt(String(b.draw_no || '0').replace(/\D/g, '')) || 0) -
    (parseInt(String(a.draw_no || '0').replace(/\D/g, '')) || 0)
  );
  const last10 = validDraws.slice(0, 10);

  const appeared = new Set();
  last10.forEach(row => {
    String(row.winning_numbers || '').replace(/[^\d,\s]/g, '')
      .split(/[,\s]+/).map(Number)
      .filter(n => n >= 1 && n <= 49)
      .forEach(n => appeared.add(n));
    const a = String(row.additional_number || '').replace(/[^\d\s,]/g, '')
      .split(/[,\s]+/).map(Number).filter(n => n >= 1 && n <= 49);
    if (a.length > 0) appeared.add(a[0]);
  });

  const all49    = Array.from({ length: 49 }, (_, i) => i + 1);
  const hotPool  = all49.filter(n =>  appeared.has(n)).sort((a, b) => a - b);
  const coldPool = all49.filter(n => !appeared.has(n)).sort((a, b) => a - b);

  return { hotPool, coldPool, analyzedDraws: last10.length };
}

export function calculateMetaphysics(dob, drawDate) {
  const dobStr = String(dob || '').replace(/\D/g, '');
  let dobDigitSum = 0;
  for (const c of dobStr) dobDigitSum += parseInt(c);

  const now    = new Date();
  const sgtMs  = now.getTime() + (8 * 60 - now.getTimezoneOffset()) * 60000;
  const sgtNow = new Date(sgtMs);
  const soy    = new Date(Date.UTC(sgtNow.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((sgtNow - soy) / 86400000) + 1;
  const seed      = dayOfYear * 3 + dobDigitSum;
  const seedMod49 = seed % 49 === 0 ? 49 : seed % 49;

  const dobYear  = parseInt((dob || '1970').split('-')[0]) || 1970;
  const dobMonth = parseInt((dob || '1970-01-01').split('-')[1]) || 1;
  const stemIdx  = ((dobYear - 4) % 10 + 10) % 10;
  const elemNames = ['Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth', 'Metal', 'Metal', 'Water', 'Water'];
  const userElem  = elemNames[stemIdx];
  const seasonEl  = { Wood: [2, 3, 4], Fire: [5, 6, 7], Metal: [8, 9, 10], Water: [11, 12, 1] };
  let suppElem = userElem;
  for (const el in seasonEl) {
    if (seasonEl[el].indexOf(dobMonth) !== -1) { suppElem = el; break; }
  }

  const resPools = {
    Wood:  [1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 34, 41, 42, 43, 44],
    Fire:  [3, 4, 7, 8, 13, 14, 17, 18, 23, 24, 27, 28, 33, 34, 37, 38, 43, 44, 47, 48],
    Earth: [5, 6, 7, 8, 15, 16, 17, 18, 25, 26, 27, 28, 35, 36, 37, 38, 45, 46, 47, 48],
    Metal: [5, 6, 7, 8, 15, 16, 17, 18, 25, 26, 27, 28, 35, 36, 37, 38, 45, 46, 47, 48],
    Water: [1, 2, 5, 6, 11, 12, 15, 16, 21, 22, 25, 26, 31, 32, 35, 36, 41, 42, 45, 46]
  };
  const rpRaw = resPools[userElem] || resPools['Earth'];
  const rpSeen = {};
  const resPool = [];
  rpRaw.forEach(n => { if (!rpSeen[n] && n >= 1 && n <= 49) { rpSeen[n] = true; resPool.push(n); } });
  resPool.sort((a, b) => a - b);
  while (resPool.length < 20) {
    for (let ni = 1; ni <= 49 && resPool.length < 20; ni++) {
      if (!rpSeen[ni]) { rpSeen[ni] = true; resPool.push(ni); }
    }
    resPool.sort((a, b) => a - b);
  }

  const drawMonthN    = parseInt((String(drawDate || '').split('-')[1]) || '2') || 2;
  const mStars2026    = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1, 7: 9, 8: 8, 9: 7, 10: 6, 11: 5, 12: 4 };
  const mStarN        = mStars2026[drawMonthN] || 5;
  const starNms       = { 1: 'Water', 2: 'Earth', 3: 'Wood', 4: 'Wood', 5: 'Earth', 6: 'Metal', 7: 'Metal', 8: 'Earth', 9: 'Fire' };
  const mStarNm       = starNms[mStarN] || 'Earth';
  const domInfl       = (starNms[8] || 'Earth') + ' to ' + mStarNm;

  return {
    dobDigitSum,
    dayOfYear,
    seed,
    seedMod49,
    userElem,
    suppElem,
    userResonancePool: '[' + resPool.slice(0, 20).join(',') + ']',
    annualStar:         '8 (Earth)',
    monthlyStar:        `${mStarN}(${mStarNm})`,
    dominantInfluence:  domInfl
  };
}

export function parseAiOutput(raw) {
  const bm    = raw.match(/<<<BEGIN_OUTPUT>>>(.*?)<<<END_OUTPUT>>>/s);
  const block = bm ? bm[1] : raw;

  const ex4 = label => {
    const m = block.match(
      new RegExp(label + '[^\\[]*\\[\\s*(\\d{1,2})\\D+(\\d{1,2})\\D+(\\d{1,2})\\D+(\\d{1,2})', 'i')
    );
    return m ? [1, 2, 3, 4].map(i => parseInt(m[i])) : [];
  };
  const ex3 = label => {
    const m = block.match(
      new RegExp(label + '[^\\[]*\\[\\s*(\\d{1,2})\\D+(\\d{1,2})\\D+(\\d{1,2})', 'i')
    );
    return m ? [1, 2, 3].map(i => parseInt(m[i])) : [];
  };
  const exMystic = () => {
    const m = block.match(/Mystical\s*:\s*\[?([^\n\r]+(?:\n[^\n\r<<<\]]+)*)/i);
    return m ? m[1].trim().replace(/"/g, '') : '数字与2026年财神方位同频，吉祥如意。';
  };

  const user4    = ex4('User_4');
  const hot4     = ex4('Hot_4');
  const cold4    = ex4('Cold_4');
  const final4   = ex4('Final4');
  const final3   = ex3('Final3');
  const mystical = exMystic();

  const s12 = {};
  [...user4, ...hot4, ...cold4].forEach(n => { s12[n] = true; });
  const super12 = Object.keys(s12).map(Number).sort((a, b) => a - b);

  return { user4, hot4, cold4, final4, final3, super12, mystical };
}

export function validateOutput(parsed, hotPool, coldPool) {
  const { user4, hot4, cold4, final4, final3, super12 } = parsed;
  const errs = [];
  const ck4 = (a, l) => { if (a.length !== 4) errs.push(`${l}:need 4 got ${a.length}`); };
  const ck3 = (a, l) => { if (a.length !== 3) errs.push(`${l}:need 3 got ${a.length}`); };
  const cku = (a, l) => { if (new Set(a).size !== a.length) errs.push(`${l}:dupes`); };
  const ckp = (a, p, l) => { a.forEach(n => { if (!p.includes(n)) errs.push(`${l}:${n} not in pool`); }); };
  const ckr = (a, l) => { a.forEach(n => { if (n < 1 || n > 49) errs.push(`${l}:${n} OOB`); }); };

  ck4(user4,  'User_4');  cku(user4,  'User_4');  ckr(user4,  'User_4');
  ck4(hot4,   'Hot_4');   cku(hot4,   'Hot_4');   ckp(hot4,   hotPool,  'Hot_4');
  ck4(cold4,  'Cold_4');  cku(cold4,  'Cold_4');  ckp(cold4,  coldPool, 'Cold_4');
  ck4(final4, 'Final4');  cku(final4, 'Final4');  ckp(final4, super12,  'Final4');
  ck3(final3, 'Final3');  cku(final3, 'Final3');  ckp(final3, super12,  'Final3');
  final3.forEach(n => { if (final4.includes(n)) errs.push(`Final3:${n} in Final4`); });

  return { status: errs.length === 0 ? 'Verified' : 'Needs Review', errors: errs };
}

export const SOUTHWEST_POOL = [2, 5, 8, 16, 26, 35, 38, 41, 49];
