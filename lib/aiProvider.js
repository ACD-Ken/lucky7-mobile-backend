// server/lib/aiProvider.js
// AI abstraction layer — supports DeepSeek (default) and Claude
// Super7 redesign: AI only ranks super7 → Final4 + Final3 + Mystical

export const SYSTEM_MESSAGE =
  'You are Lucky7 Copilot. You rank pre-computed super7 numbers into Final4 and Final3 based on ' +
  'the user\'s BaZi profile and 2026 Nine Star Ki. ' +
  'Output ONLY the <<<BEGIN_OUTPUT>>> block. No tools. No reasoning. No extra text. Mystical in Chinese.';

export function buildPrompt(ctx) {
  return `You are a metaphysical number ranking AI Agent.

IMPORTANT: Produce DIFFERENT rankings for DIFFERENT users based on their personal BaZi data.

--------------------------------------------------
USER PROFILE
--------------------------------------------------
USER      : ${ctx.nickName}
DOB       : ${ctx.dob}
Gender    : ${ctx.sex}
Draw Date : ${ctx.draw_date}
Day Master: ${ctx.dayMasterElem}
Luck Pillar: ${ctx.luckPillarElem}

--------------------------------------------------
2026 NINE STAR KI CONTEXT
--------------------------------------------------
Annual Star       : ${ctx.annualStar}
Monthly Star      : ${ctx.monthlyStar}
Dominant Influence: ${ctx.dominantInfluence}

--------------------------------------------------
SUPER 7 NUMBERS (server-computed, already balanced)
--------------------------------------------------
User_5  (BaZi Personal 5) : [${ctx.user5_arr.join(', ')}]
Hot_1   (Historical Hot 1): [${ctx.hot1}]
Cold_1  (Historical Cold 1): [${ctx.cold1}]
super7  : [${ctx.super7_arr.join(', ')}]

--------------------------------------------------
YOUR TASK — RANK super7 INTO Final4 + Final3
--------------------------------------------------
Select from the super7 numbers ONLY:

Final4: 4 numbers from super7.
  Priority: strongest DOB resonance, Draw Date 偏财 energy, 2026 九星运转.
  No overlap with Final3.

Final3: exactly the remaining 3 numbers from super7.
  Prefer Cold_1 first, then Hot_1, then personal.
  No overlap with Final4.

RULE: Final4 + Final3 must together contain ALL 7 super7 numbers — no extras, no omissions.

--------------------------------------------------
OUTPUT FORMAT — EXACT, NO DEVIATION
--------------------------------------------------
<<<BEGIN_OUTPUT>>>
Final4: [n, n, n, n]
Final3: [n, n, n]
Mystical:
[4-6 sentences Chinese. Tone: 神秘 九星运转 偏财流动 财神方位. Max 6 sentences.]
<<<END_OUTPUT>>>

Validate before output:
- Final4=4, Final3=3
- No duplicates in any set
- Final3 NO overlap with Final4
- Every super7 number appears exactly once across Final4 + Final3
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
