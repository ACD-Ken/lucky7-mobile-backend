// server/lib/lucky7.js
// Super7 redesign: full BaZi 4-pillar + Five Elements for Hot_1/Cold_1

// ─── BaZi constants ───────────────────────────────────────────────────────────
const STEM_ELEMENTS   = ['Wood','Wood','Fire','Fire','Earth','Earth','Metal','Metal','Water','Water'];
const BRANCH_ELEMENTS = ['Water','Earth','Wood','Wood','Earth','Fire','Fire','Earth','Metal','Metal','Earth','Water'];

// Month earthly branch by calendar month index (0 = Jan)
const MONTH_BRANCH = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];

// 寅月 (Jan) heavenly stem start, indexed by yearStem % 5  → 丙,戊,庚,壬,甲
const MONTH_STEM_START = [2, 4, 6, 8, 0];

// 子时 (midnight) heavenly stem start, indexed by dayStem % 5 → 甲,丙,戊,庚,壬
const HOUR_STEM_START = [0, 2, 4, 6, 8];

// Five Elements resonance pools 1-49 (Earth ≠ Metal)
const RES_POOLS = {
  Wood:  [1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 34, 41, 42, 43, 44],
  Fire:  [3, 4, 7, 8, 13, 14, 17, 18, 23, 24, 27, 28, 33, 34, 37, 38, 43, 44, 47, 48],
  Earth: [5, 6, 7, 8, 15, 16, 17, 18, 25, 26, 27, 28, 35, 36, 37, 38, 45, 46, 47, 48],
  Metal: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 39, 40, 45, 46, 47, 49],
  Water: [1, 2, 5, 6, 11, 12, 15, 16, 21, 22, 25, 26, 31, 32, 35, 36, 41, 42, 45, 46]
};

// Five Elements controlling (克) cycle
const CONTROLS = { Wood: 'Earth', Fire: 'Metal', Earth: 'Water', Metal: 'Wood', Water: 'Fire' };

// Day pillar reference: 2000-01-01 = 丁亥 (stem=3, branch=11)
const DAY_REF_DATE   = new Date(Date.UTC(2000, 0, 1));
const DAY_REF_STEM   = 3;
const DAY_REF_BRANCH = 11;

// Current reference year for luck pillar age calculation
const REF_YEAR = 2026;

// ─── Internal helpers ─────────────────────────────────────────────────────────
function calcDayPillar(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const daysSince = Math.round((dt.getTime() - DAY_REF_DATE.getTime()) / 86400000);
  return {
    stem:   ((DAY_REF_STEM   + daysSince) % 10 + 10) % 10,
    branch: ((DAY_REF_BRANCH + daysSince) % 12 + 12) % 12,
  };
}

function calcHourBranch(timeStr) {
  if (!timeStr) return null;
  const h = parseInt(timeStr.split(':')[0]);
  if (h === 23) return 0;              // 子時 starts at 23:00
  return Math.floor((h + 1) / 2) % 12;
}

function pickFromPool(pool, stem, branch, usedSet, drawStem = 0, drawBranch = 0) {
  // draw date stem/branch shifts the anchor so same person → different numbers on different draw dates
  const anchor = (stem * 7 + branch * 3 + drawStem * 5 + drawBranch * 2) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const n = pool[(anchor + i) % pool.length];
    if (!usedSet.has(n)) { usedSet.add(n); return n; }
  }
  for (let n = 1; n <= 49; n++) {
    if (!usedSet.has(n)) { usedSet.add(n); return n; }
  }
  return null;
}

function getDrawDayInfo(draw_date) {
  const { stem, branch } = calcDayPillar(draw_date);
  return { stem, branch, elem: STEM_ELEMENTS[stem] };
}

// ─── BaZi 4-pillar + Luck pillar → User_5 ────────────────────────────────────
// draw_date: YYYY-MM-DD — incorporated so User_5 changes per draw date
export function computeUser5(dob, sex, birthTime, draw_date) {
  const [by, bm, bd] = dob.split('-').map(Number);

  // Year pillar
  const yearStem   = ((by - 4) % 10 + 10) % 10;
  const yearBranch = ((by - 4) % 12 + 12) % 12;

  // Month pillar
  const monthBranch = MONTH_BRANCH[bm - 1];
  const monthStem   = (MONTH_STEM_START[yearStem % 5] + (monthBranch - 2 + 12) % 12) % 10;

  // Day pillar (Day Master)
  const { stem: dayStem, branch: dayBranch } = calcDayPillar(dob);

  // Hour pillar (optional)
  let hourStem = null, hourBranchVal = null;
  if (birthTime) {
    hourBranchVal = calcHourBranch(birthTime);
    hourStem = (HOUR_STEM_START[dayStem % 5] + hourBranchVal) % 10;
  }

  // Luck pillar (大运)
  const ageApprox  = Math.max(0, REF_YEAR - by);
  const luckStep   = Math.floor(ageApprox / 10);
  const yangYear   = (yearStem % 2 === 0);
  const forward    = (yangYear && sex === 'Male') || (!yangYear && sex === 'Female');
  const luckStem   = forward
    ? (monthStem + luckStep) % 10
    : ((monthStem - luckStep) % 10 + 10) % 10;
  const luckBranch = forward
    ? (monthBranch + luckStep) % 12
    : ((monthBranch - luckStep) % 12 + 12) % 12;

  // Draw date day pillar — shifts pool selection so User_5 varies by draw date
  const drawDay = draw_date ? calcDayPillar(draw_date) : { stem: 0, branch: 0 };
  const dStem   = drawDay.stem;
  const dBranch = drawDay.branch;

  // Collect pillars (Year / Month / Day / Hour / Luck)
  const pillars = [
    { stem: yearStem,  branch: yearBranch  },
    { stem: monthStem, branch: monthBranch },
    { stem: dayStem,   branch: dayBranch   },
    { stem: luckStem,  branch: luckBranch  },
  ];
  if (hourStem !== null) {
    pillars.push({ stem: hourStem, branch: hourBranchVal });
  }

  // Pick one number per pillar from its stem-element pool
  // draw date stem/branch passed as extra anchor modifiers
  const used  = new Set();
  const user5 = [];
  for (const p of pillars) {
    const elem = STEM_ELEMENTS[p.stem];
    const n = pickFromPool(RES_POOLS[elem], p.stem, p.branch, used, dStem, dBranch);
    if (n !== null) user5.push(n);
  }

  // If no birthTime → 4 pillars → 5th from day-branch element
  if (user5.length < 5) {
    const branchElem = BRANCH_ELEMENTS[dayBranch];
    const n = pickFromPool(RES_POOLS[branchElem], dayBranch, dayStem, used, dStem, dBranch);
    if (n !== null) user5.push(n);
  }

  // Safety fill
  while (user5.length < 5) {
    for (let n = 1; n <= 49; n++) {
      if (!used.has(n)) { used.add(n); user5.push(n); break; }
    }
  }

  return {
    user5:          user5.slice(0, 5),
    dayMasterElem:  STEM_ELEMENTS[dayStem],
    luckPillarElem: STEM_ELEMENTS[luckStem],
  };
}

/// ─── Hot_1: 1 number from hot pool via draw-day active element ───────────────
// user5 excluded so hot_1 is always a NEW number not already in User_5
export function computeHot1(hotPool, draw_date, user5) {
  if (!hotPool || hotPool.length === 0) return null;
  const { stem, branch, elem } = getDrawDayInfo(draw_date);
  const activePool = RES_POOLS[elem];
  const anchor     = (stem * 7 + branch * 3) % 49 + 1;
  const excluded   = new Set(user5 || []);
  const available  = hotPool.filter(n => !excluded.has(n));
  const pool       = available.length > 0 ? available : [...hotPool]; // fallback if all hot nums are in user5
  const inActive   = pool.filter(n => activePool.includes(n));
  const candidates = inActive.length > 0 ? inActive : pool;
  return candidates.reduce((best, n) =>
    Math.abs(n - anchor) < Math.abs(best - anchor) ? n : best
  );
}

// ─── Cold_1: 1 number from cold pool via draw-day controlled element ──────────
export function computeCold1(coldPool, draw_date, user5, hot1) {
  if (!coldPool || coldPool.length === 0) return null;
  const { stem, branch, elem } = getDrawDayInfo(draw_date);
  const ctrlElem   = CONTROLS[elem];
  const ctrlPool   = RES_POOLS[ctrlElem];
  const anchor     = (stem * 7 + branch * 3) % 49 + 1;
  const excluded   = new Set([...(user5 || []), ...(hot1 != null ? [hot1] : [])]);
  const available  = coldPool.filter(n => !excluded.has(n));
  const pool       = available.length > 0 ? available : [...coldPool];
  const inCtrl     = pool.filter(n => ctrlPool.includes(n));
  const candidates = inCtrl.length > 0 ? inCtrl : pool;
  return candidates.reduce((best, n) =>
    Math.abs(n - anchor) < Math.abs(best - anchor) ? n : best
  );
}

// ─── Parse AI output (Final4 / Final3 / Mystical) ────────────────────────────
export function parseAiOutput(raw, super7arr) {
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

  let final4   = ex4('Final4');
  let final3   = ex3('Final3');
  const mystical = exMystic();

  // Validate and fix against super7arr
  if (super7arr && super7arr.length > 0) {
    final4 = final4.filter(n => super7arr.includes(n));
    final3 = final3.filter(n => super7arr.includes(n) && !final4.includes(n));
    if (final4.length < 4) {
      const rem = super7arr.filter(n => !final4.includes(n) && !final3.includes(n));
      while (final4.length < 4 && rem.length > 0) final4.push(rem.shift());
    }
    if (final3.length < 3) {
      const rem = super7arr.filter(n => !final4.includes(n) && !final3.includes(n));
      while (final3.length < 3 && rem.length > 0) final3.push(rem.shift());
    }
  }

  return { final4, final3, mystical };
}

// ─── Validate output ──────────────────────────────────────────────────────────
export function validateOutput(parsed, super7arr) {
  const { final4, final3 } = parsed;
  const errs = [];
  if (final4.length !== 4) errs.push(`Final4:need 4 got ${final4.length}`);
  if (final3.length !== 3) errs.push(`Final3:need 3 got ${final3.length}`);
  if (new Set(final4).size !== final4.length) errs.push('Final4:dupes');
  if (new Set(final3).size !== final3.length) errs.push('Final3:dupes');
  final4.forEach(n => { if (n < 1 || n > 49) errs.push(`Final4:${n} OOB`); });
  final3.forEach(n => { if (n < 1 || n > 49) errs.push(`Final3:${n} OOB`); });
  if (super7arr && super7arr.length > 0) {
    final4.forEach(n => { if (!super7arr.includes(n)) errs.push(`Final4:${n} not in super7`); });
    final3.forEach(n => { if (!super7arr.includes(n)) errs.push(`Final3:${n} not in super7`); });
  }
  final3.forEach(n => { if (final4.includes(n)) errs.push(`Final3:${n} in Final4`); });
  return { status: errs.length === 0 ? 'Verified' : 'Needs Review', errors: errs };
}

// ─── Kept utility functions (unchanged) ──────────────────────────────────────
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
