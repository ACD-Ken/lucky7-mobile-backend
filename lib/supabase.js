// server/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function fetchDrawHistory(client) {
  const { data, error } = await client
    .from('draws')
    .select('draw_no, date, winning_numbers, additional_number')
    .order('date', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []).map(r => ({
    draw_no:           r.draw_no,
    date:              r.date,
    winning_numbers:   r.winning_numbers,
    additional_number: r.additional_number
  }));
}

export async function upsertDraw(client, draw) {
  const { data: existing } = await client
    .from('draws')
    .select('id')
    .eq('date', draw.date)
    .maybeSingle();
  if (existing) return { skipped: true };

  const { error } = await client.from('draws').insert({
    draw_no:           draw.draw_no || null,
    date:              draw.date,
    winning_numbers:   draw.winning_numbers,
    additional_number: draw.additional_number || null
  });
  if (error) throw error;
  return { skipped: false };
}

export async function saveLog(client, d) {
  const { error } = await client.from('lucky7_log').insert({
    nick_name:            d.nickName,
    dob:                  d.dob,
    sex:                  d.sex,
    draw_date:            d.draw_date || null,
    past_draw_date:       d.past_draw_date || null,
    draw_no:              d.draw_no || null,
    winning_numbers:      d.winning_numbers || null,
    additional_number:    d.additional_number || null,
    hot_numbers:          d.hot_numbers || null,
    cold_numbers:         d.cold_numbers || null,
    hot_count:            d.hot_count || null,
    cold_count:           d.cold_count || null,
    analyzed_draws:       d.analyzed_draws || null,
    dob_digit_sum:        d.dobDigitSum || null,
    day_of_year:          d.dayOfYear || null,
    seed:                 d.seed || null,
    seed_mod49:           d.seedMod49 || null,
    user_element:         d.userElem || null,
    support_element:      d.suppElem || null,
    user_4:               d.user_4 || null,
    hot_4:                d.hot_4 || null,
    cold_4:               d.cold_4 || null,
    final4:               d.Final4 || null,
    final3:               d.Final3 || null,
    user4_arr:            d.user4_arr || null,
    hot4_arr:             d.hot4_arr || null,
    cold4_arr:            d.cold4_arr || null,
    final4_arr:           d.final4_arr || null,
    final3_arr:           d.final3_arr || null,
    mystical_explanation: d.mystical_explanation || null,
    validation_status:    d.validation_status || null,
    validation_errors:    d.validation_errors || null,
    ai_provider:          process.env.AI_PROVIDER || 'deepseek'
  });
  if (error) throw error;
}
