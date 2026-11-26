// supabase/functions/hr-pub/index.ts — השער הציבורי של הנהלה רוחנית: מה שהדפים הציבוריים (הריפו dapim) קוראים וכותבים בלי מפתח למסד.
// cfg — הגדרה אחת מרשימה סגורה (הטפסים, האסיפה ואנשי הקשר); submit — שורת תגובה חדשה ל-hr_enroll או ל-hr_intake, הוספה בלבד.
// הקבצים, הטיוטות והשיבוץ — בשער hr-gate, כמו תמיד. תגובה חדשה — התראה למי שסומן «מקבל התראות» ומייל לבעלים (sh-gate).
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(URL_, KEY, { auth: { persistSession: false } });
const CFG_KEYS = ['enroll_form', 'intake_form', 'meeting_cfg', 'contacts'];
const TABLES: Record<string, string> = { enroll: 'hr_enroll', intake: 'hr_intake' };
const FORM_NAME: Record<string, string> = { enroll: 'טופס רישום', intake: 'קבלה לישיבה' };
const CLS_NAME: Record<string, string> = { a: 'שיעור א׳', b: 'שיעור ב׳', g: 'שיעור ג׳', s: 'התלמידים השלוחים' };
const ROW_MAX = 200000;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function out(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
const isObj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);

// ההתראה — שם התלמיד בלבד, והשיעור כשהוא כבר במצבה (לפי מספר הזהות); בלי שאר הפרטים
async function notifyNew(form: string, data: Record<string, any>) {
  const name = [data.first, data.last].map((x) => String(x || '').trim()).filter(Boolean).join(' ') || 'תלמיד';
  let cls = '';
  const id = String(data.idnum || '').trim().toUpperCase();
  if (/^[0-9A-Z]{5,20}$/.test(id)) {
    const r = await db.from('hr_students_rows').select('data').eq('deleted', false).eq('data->>idnum', id).limit(1);
    const c = r.data && r.data[0] && r.data[0].data && r.data[0].data.cls;
    if (c && CLS_NAME[c]) cls = CLS_NAME[c];
  }
  await fetch(URL_ + '/functions/v1/sh-gate', { method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send', app: 'hanhala-ruchanit', mail: true, tag: form,
      title: FORM_NAME[form] + ' — תגובה חדשה', body: name + (cls ? ' · ' + cls : '') }) }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return out({ error: 'method' }, 405);
  let b: Record<string, any>;
  try { b = JSON.parse(await req.text()); } catch { return out({ error: 'bad_request' }, 400); }
  const act = String(b.action || '');

  // באותה צורה שהמסד מחזיר — מערך של { value } — כדי שהדף יקרא אותה כמו תמיד
  if (act === 'cfg') {
    const key = String(b.key || '');
    if (CFG_KEYS.indexOf(key) < 0) return out({ error: 'bad_request' }, 400);
    const r = await db.from('hr_settings').select('value').eq('key', key).maybeSingle();
    if (r.error) return out({ error: 'db' }, 500);
    return out(r.data ? [{ value: r.data.value }] : []);
  }

  if (act === 'submit') {
    const form = String(b.form || ''), table = TABLES[form], row = b.row;
    if (!table || !isObj(row)) return out({ error: 'bad_request' }, 400);
    const id = String(row.client_id || ''), year = Number(row.school_year);
    if (!/^[0-9a-f]{16}$/.test(id) || !(year > 5700 && year < 6000) || !isObj(row.data) || !isObj(row.files || {})) return out({ error: 'bad_request' }, 400);
    if (JSON.stringify(row).length > ROW_MAX) return out({ error: 'size' }, 413);
    const r = await db.from(table).insert({ client_id: id, school_year: year, data: row.data, files: row.files || {}, updated_at: Date.now() });
    if (r.error) { console.error('[hr-pub submit]', r.error); return out({ error: r.error.code === '23505' ? 'exists' : 'db' }, r.error.code === '23505' ? 409 : 500); }
    // ברקע — ההורה אינו ממתין לשליחה
    // @ts-ignore EdgeRuntime
    EdgeRuntime.waitUntil(notifyNew(form, row.data));
    return out({ ok: true });
  }

  return out({ error: 'bad_action' }, 400);
});
