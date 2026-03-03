// server/lib/aiProvider.js
// AI abstraction layer — supports DeepSeek (default) and Claude
// Super12 redesign: AI selects User_4, Hot_4, Cold_4, super12, Final4, Final3

export const SYSTEM_MESSAGE =
  'You are Lucky7 Copilot. Each user has a unique BaZi Day Master, Luck Pillar, and resonance pool. ' +
  'You MUST produce different numbers for different users. ' +
  'Output ONLY the <<<BEGIN_OUTPUT>>> block. No tools. No reasoning. No extra text. Mystical in Chinese.';

// ── Pre-compute Super12 candidate tier ranking ──────────────────────────────
// Tier 1 = in BOTH draw day pool AND user resonance pool (doubly activated)
// Tier 2 = in draw day pool only (draw day activated)
// Tier 3 = in user resonance pool only (personal identity)
// Tier 4 = in draw day branch pool only (branch energy)
// Tier 5 = no resonance (available but lowest priority)
function buildResonanceTiers(ctx) {
  const parse = s => { try { return JSON.parse(s); } catch { return []; } };

  const userPool    = parse(ctx.userResonancePool);
  const drawDayPool = parse(ctx.drawDayResPool);
  const branchPool  = parse(ctx.drawDayBranchResPool || '[]');

  const inUser    = new Set(userPool);
  const inDrawDay = new Set(drawDayPool);
  const inBranch  = new Set(branchPool);

  const tier1 = [], tier2 = [], tier3 = [], tier4 = [], tier5 = [];

  for (let n = 1; n <= 49; n++) {
    const u = inUser.has(n);
    const d = inDrawDay.has(n);
    const b = inBranch.has(n);
    if (u && d)       tier1.push(n);
    else if (d)       tier2.push(n);
    else if (u)       tier3.push(n);
    else if (b)       tier4.push(n);
    else              tier5.push(n);
  }

  return { tier1, tier2, tier3, tier4, tier5 };
}

export function buildPrompt(ctx) {
  // Pre-compute resonance tiers
  const tiers = buildResonanceTiers(ctx);

  // Draw day harmony/tension classification
  const drawDayStemElem   = ctx.drawDayElem   || 'Earth';
  const drawDayBranchElem = ctx.drawDayBranchElem || drawDayStemElem;
  const drawDayHarmony    = drawDayStemElem === drawDayBranchElem
    ? `HARMONY DAY (${drawDayStemElem}/${drawDayBranchElem}) — double ${drawDayStemElem} energy, very strong`
    : `TENSION DAY (${drawDayStemElem}/${drawDayBranchElem}) — two elements in play, capture both`;

  // Final4 branch rule: harmony vs tension
  const final4BranchRule = drawDayStemElem === drawDayBranchElem
    ? `Draw day is HARMONY (${drawDayStemElem}/${drawDayBranchElem}): MUST include ≥1 number from Tier 1 (doubly activated by both stem+branch ${drawDayStemElem}).`
    : `Draw day is TENSION (${drawDayStemElem}/${drawDayBranchElem}): MUST include ≥1 number resonating with stem (${drawDayStemElem}) AND ≥1 number resonating with branch (${drawDayBranchElem}) — capture both energies.`;

  // Final3 branch + controlling rule
  const final3BranchRule = drawDayStemElem === drawDayBranchElem
    ? `Include ≥1 number from draw day controlling pool (${ctx.drawDayControlsElem}) — suppressed energy emerging.`
    : `Include ≥1 number resonating with draw day branch element (${drawDayBranchElem}) — the secondary energy Final4 may have missed.`;

  return `You are a deterministic metaphysical number selection AI Agent.

IMPORTANT: You MUST produce DIFFERENT numbers for different users. Do NOT reuse previous outputs.

--------------------------------------------------
INPUT DATA
--------------------------------------------------
USER     : ${ctx.nickName}
DOB      : ${ctx.dob}
Gender   : ${ctx.sex}
DRAW DATE: ${ctx.draw_date}

HOT Numbers  : ${ctx.hot_numbers}
COLD Numbers : ${ctx.cold_numbers}

--------------------------------------------------
PER-USER SEED
--------------------------------------------------
DOB digit sum : ${ctx.dobDigitSum}
Day of year   : ${ctx.dayOfYear}
Seed          : ${ctx.seed}
Seed mod 49   : ${ctx.seedMod49}  <-- tie-break anchor

--------------------------------------------------
BAZI 4-PILLAR CHART
--------------------------------------------------
Year  Pillar : ${ctx.yearPillar}
Month Pillar : ${ctx.monthPillar}
Day   Pillar : ${ctx.dayMaster}   <-- Day Master (true BaZi self)
Hour  Pillar : ${ctx.hourPillar}

Day Master Element  : ${ctx.dayMasterElem}   ← Primary identity element
Support Element     : ${ctx.suppElem}         ← Birth season element

--------------------------------------------------
CURRENT 10-YEAR LUCK PILLAR  (${ctx.luckPillarYears})
--------------------------------------------------
Pillar Stem/Branch : ${ctx.luckPillarStem}${ctx.luckPillarBranch}
Luck Pillar Element: ${ctx.luckPillarElem}   ← Active environmental energy

--------------------------------------------------
COMBINED RESONANCE POOL (Day Master + Luck Pillar)
--------------------------------------------------
${ctx.userResonancePool}
(${ctx.resonancePoolSize} numbers — union of Day Master [${ctx.dayMasterElem}] and Luck Pillar [${ctx.luckPillarElem}] pools)

--------------------------------------------------
2026 NINE STAR KI
--------------------------------------------------
Annual Star       : ${ctx.annualStar}
Monthly Star      : ${ctx.monthlyStar}
Dominant Influence: ${ctx.dominantInfluence}

--------------------------------------------------
DRAW DATE DAY PILLAR  (${ctx.draw_date})
--------------------------------------------------
Draw Day Stem/Branch : ${ctx.drawDayPillar}
Draw Day Stem Elem   : ${ctx.drawDayElem}     ← energetic flavour of draw day
Draw Day Branch Elem : ${ctx.drawDayBranchElem}  ← secondary branch energy
Day Type             : ${drawDayHarmony}
Controls Element     : ${ctx.drawDayControlsElem}   ← suppressed energy ready to emerge

Hot_4 alignment pool  (resonates WITH draw day stem ${ctx.drawDayElem}):
${ctx.drawDayResPool}

Draw day branch pool  (resonates WITH draw day branch ${ctx.drawDayBranchElem}):
${ctx.drawDayBranchResPool}

Cold_4 emergence pool (element draw day controls → ${ctx.drawDayControlsElem}):
${ctx.drawDayControlsPool}

--------------------------------------------------
SOUTHWEST WEALTH POOL
--------------------------------------------------
[2, 5, 8, 16, 26, 35, 38, 41, 49]

--------------------------------------------------
SUPER12 DRAW-DAY RESONANCE RANKING
Use these tiers to guide Final4 and Final3 selection.
After building super12, classify each number:
--------------------------------------------------
Tier 1 — STRONGEST (in BOTH draw day pool AND user resonance pool — doubly activated):
${tiers.tier1.length > 0 ? tiers.tier1.join(', ') : 'none'}

Tier 2 — DRAW DAY ACTIVATED (in draw day stem pool only):
${tiers.tier2.length > 0 ? tiers.tier2.join(', ') : 'none'}

Tier 3 — PERSONAL IDENTITY (in user resonance pool only):
${tiers.tier3.length > 0 ? tiers.tier3.join(', ') : 'none'}

Tier 4 — BRANCH ENERGY (in draw day branch pool only):
${tiers.tier4.length > 0 ? tiers.tier4.join(', ') : 'none'}

Tier 5 — AVAILABLE (no special resonance):
${tiers.tier5.length > 0 ? tiers.tier5.join(', ') : 'none'}

Final4 MUST draw ≥2 numbers from Tier 1 or Tier 2 (draw-day activated).
Final3 MUST draw ≥1 number from Tier 3 or Tier 4 (complementary energy).

--------------------------------------------------
SELECTION RULES
--------------------------------------------------
Step 1 - User_4 : 4 numbers from 1-49.
  Use DOB, Gender, Day Master Element (${ctx.dayMasterElem}), Luck Pillar Element (${ctx.luckPillarElem}),
  2026 流年九星, 财神方位.
  MUST include: min 1 number resonating with Day Master element (${ctx.dayMasterElem}).
  MUST include: min 1 number resonating with Luck Pillar element (${ctx.luckPillarElem}).
  MUST include: min 1 from Southwest Wealth Pool.
  MUST include: min 2 from Combined Resonance Pool.
  Tie-break: closest to seed_mod49 = ${ctx.seedMod49}.

Step 2 - Hot_4 : 4 from HOT Numbers only.
  Use 2026 流年九星, 财神方位, 偏财 alignment.
  Draw Day Element is ${ctx.drawDayElem} — hot numbers vibrating with this element are doubly activated.
  MUST include: min 1 HOT number from Draw Day alignment pool ${ctx.drawDayResPool}.
  MUST include: min 1 from Southwest Pool.
  Tie-break: closest to ${ctx.seedMod49}.

Step 3 - Cold_4 : 4 from COLD Numbers only.
  Draw Day Element (${ctx.drawDayElem}) controls ${ctx.drawDayControlsElem} — cold numbers in the controlled
  element carry suppressed energy ready to emerge on draw day.
  MUST include: min 1 COLD number from Cold_4 emergence pool ${ctx.drawDayControlsPool}.
  MUST include: min 1 Southwest (prefer 2 or 8). Try 2 odd + 2 even.
  Tie-break: closest to ${ctx.seedMod49}.

Step 4 - super12: Merge User_4+Hot_4+Cold_4. Exactly 12 unique. Fix duplicates.
  Then classify each super12 number into Tiers 1-5 using the ranking above.

Step 5 - Final4 : 4 from super12. PRIMARY RECOMMENDATION.
  RANKED SELECTION — pick in tier order (highest tier first):
  MUST include: ≥2 numbers from Tier 1 or Tier 2 (draw-day activated numbers).
  MUST include: Exactly 2 from Southwest Wealth Pool.
  MUST include: ≥1 resonating with Day Master element (${ctx.dayMasterElem}).
  MUST include: ≥1 resonating with Luck Pillar element (${ctx.luckPillarElem}).
  ${final4BranchRule}
  Tie-break: closest to ${ctx.seedMod49}.

Step 6 - Final3 : 3 from super12. COMPANION RECOMMENDATION.
  MUST have: Zero overlap with Final4.
  MUST include: Exactly 1 from Southwest Wealth Pool.
  MUST include: ≥1 number from Tier 3 or Tier 4 (complementary energy not in Final4).
  ${final3BranchRule}
  Prioritise Cold_4 numbers from the controlling element (${ctx.drawDayControlsElem}).
  Tie-break: closest to ${ctx.seedMod49}.

--------------------------------------------------
OUTPUT FORMAT — EXACT, NO DEVIATION
--------------------------------------------------
<<<BEGIN_OUTPUT>>>
User_4: [n, n, n, n]
Hot_4: [n, n, n, n]
Cold_4: [n, n, n, n]
super12: [n, n, n, n, n, n, n, n, n, n, n, n]
Final4: [n, n, n, n]
Final3: [n, n, n]
Mystical:
[4-6 sentences Chinese. Reference Day Master ${ctx.dayMasterElem}, Luck Pillar ${ctx.luckPillarElem},
and draw day energy ${ctx.drawDayElem}/${ctx.drawDayBranchElem}.
Tone: 神秘 九星运转 偏财流动 财神方位. Max 6 sentences.]
<<<END_OUTPUT>>>

Validate before output:
- User_4=4, Hot_4=4, Cold_4=4, Final4=4, Final3=3
- super12 exactly 12 unique numbers
- No duplicates in any set
- Final3 NO overlap with Final4
- Hot_4 MUST come from HOT Numbers list
- Cold_4 MUST come from COLD Numbers list
- Final4 and Final3 MUST come from super12
- Final4 MUST have ≥2 numbers from Tier 1 or Tier 2
Output block only. END.`;
}

export async function callAI(prompt) {
  const provider = process.env.AI_PROVIDER || 'deepseek';

  if (provider === 'claude') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model:      'claude-opus-4-6',
      max_tokens: 1024,
      system:     SYSTEM_MESSAGE,
      messages:   [{ role: 'user', content: prompt }]
    });
    return msg.content[0].text;
  }

  // Default: DeepSeek via OpenAI-compatible API
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model:      'deepseek-chat',
      messages:   [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user',   content: prompt }
      ],
      max_tokens:  1024,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
