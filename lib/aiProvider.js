// server/lib/aiProvider.js
// AI abstraction layer — supports DeepSeek (default) and Claude
// Adapted from lucky7-copilot for Node.js / Express

export const SYSTEM_MESSAGE =
  'You are Lucky7 Copilot. Each user has a unique DOB, seed_mod49, and resonance pool. ' +
  'You MUST produce different numbers for different users. ' +
  'Output ONLY the <<<BEGIN_OUTPUT>>> block. No tools. No reasoning. No extra text. Mystical in Chinese.';

export function buildPrompt(ctx) {
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
PER-USER ELEMENT
--------------------------------------------------
BaZi Element    : ${ctx.userElem}
Support Element : ${ctx.suppElem}

User Resonance Pool (20 numbers):
${ctx.userResonancePool}

--------------------------------------------------
2026 NINE STAR KI
--------------------------------------------------
Annual Star       : ${ctx.annualStar}
Monthly Star      : ${ctx.monthlyStar}
Dominant Influence: ${ctx.dominantInfluence}

--------------------------------------------------
SOUTHWEST WEALTH POOL
--------------------------------------------------
[2, 5, 8, 16, 26, 35, 38, 41, 49]

--------------------------------------------------
SELECTION RULES
--------------------------------------------------
Step 1 - User_4 : 4 numbers from 1-49.
  Use DOB, Gender, BaZi Element, 2026 流年九星, 财神方位.
  Min 1 from Southwest Pool. Min 2 from User Resonance Pool.
  Tie-break: closest to seed_mod49 = ${ctx.seedMod49}.

Step 2 - Hot_4 : 4 from HOT Numbers.
  Use 2026 流年九星, 财神方位, 偏财 alignment.
  Min 1 from Southwest Pool. Min 1 matching dominant element.
  Tie-break: closest to ${ctx.seedMod49}.

Step 3 - Cold_4 : 4 from COLD Numbers.
  Use 2026 流年九星, 财神方位, Draw Date 偏财 energy.
  Min 1 Southwest (prefer 2 or 8). Try 2 odd + 2 even.
  Tie-break: closest to ${ctx.seedMod49}.

Step 4 - super12: Merge User_4+Hot_4+Cold_4. Exactly 12 unique. Fix duplicates.

Step 5 - Final4 : 4 from super12.
  Use DOB, Gender, BaZi, 2026 流年九星, 财神方位, Draw Date 偏财.
  Exactly 2 from Southwest Pool. Min 2 from User Resonance Pool.
  Tie-break: closest to ${ctx.seedMod49}.

Step 6 - Final3 : 3 from super12.
  Use DOB, Gender, BaZi, 2026 流年九星, 财神方位, Draw Date 偏财.
  Exactly 1 from Southwest Pool. No overlap with Final4.
  Prioritise Cold_4 numbers. Tie-break: closest to ${ctx.seedMod49}.

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
[4-6 sentences Chinese. Tone: 神秘 九星运转 偏财流动 财神方位. Max 6 sentences.]
<<<END_OUTPUT>>>

Validate before output:
- User_4=4, Hot_4=4, Cold_4=4, Final4=4, Final3=3
- super12 exactly 12 unique numbers
- No duplicates in any set
- Final3 NO overlap with Final4
- Hot_4 MUST come from HOT Numbers list
- Cold_4 MUST come from COLD Numbers list
- Final4 and Final3 MUST come from super12
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
