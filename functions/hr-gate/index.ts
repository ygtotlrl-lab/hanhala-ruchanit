// functions/hr-gate/index.ts — שער השרת של הנהלה רוחנית (Supabase Edge Function)
// מה שהטופס הציבורי שולח (hr_enroll · הדלי hr-enroll) נקרא רק כאן, במפתח השירות, ואחרי כניסה מקוונת:
// login מאמת שם וסיסמה מול hr_users (אותה גזירה כמו core/auth.js) ומחזיר אסימון חתום ל-30 יום;
// כל פעולה אחרת בודקת את האסימון, שהמשתמש עדיין פעיל, ואת ההרשאה שלו למודול — מההרשאות השמורות, ובלעדיהן מברירת המחדל.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const APP_ID = 'hanhala-ruchanit';
const USERS = 'hr_users';
const PASS_CTX = APP_ID + '/' + USERS + '/v1/';
const PASS_ITER = 100000;
const TOKEN_DAYS = 30;
const FILES_BUCKET = 'hr-enroll';
const URL_TTL = 3600;
// אחת עם DEFAULT_PERMS שב-app/state.js — למודולים שהשער משרת
const DEF: Record<string, Record<string, string>> = {
  enroll: { admin: 'edit', manager: 'edit', junior: 'none' },
  intake: { admin: 'edit', manager: 'edit', junior: 'none' },
};
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => (x + 0x100).toString(16).slice(1)).join('');
const b64u = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

async function passFp(pass: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(PASS_CTX + salt), iterations: PASS_ITER, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}
async function sign(s: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(s)));
}
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function out(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function perms() {
  const r = await db.from('hr_settings').select('value').eq('key', 'perms').maybeSingle();
  try { return r.data ? JSON.parse(r.data.value) : {}; } catch { return {}; }
}
// האסימון — והמשתמש כפי שהוא עכשיו: מושבת או שתפקידו השתנה — לפי המסד, לא לפי האסימון
async function who(token: string) {
  const [p, s] = String(token || '').split('.');
  if (!p || !s || !same(s, await sign(p))) return null;
  let pl: { u: string; exp: number };
  try { pl = JSON.parse(unb64u(p)); } catch { return null; }
  if (!pl.exp || pl.exp < Date.now()) return null;
  const r = await db.from(USERS).select('client_id,role,active,full_name').eq('client_id', pl.u).maybeSingle();
  if (!r.data || r.data.active !== true) return null;
  return r.data as { client_id: string; role: string; full_name: string };
}
async function can(u: { role: string }, mod: string, need: 'view' | 'edit') {
  const p = await perms();
  const lvl = ((p[mod] || DEF[mod] || {})[u.role]) || 'none';
  return need === 'view' ? lvl !== 'none' : lvl === 'edit';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let b: Record<string, any>;
  try { b = await req.json(); } catch { return out({ error: 'bad_request' }, 400); }
  const act = String(b.action || '');

  if (act === 'login') {
    const r = await db.from(USERS).select('client_id,active,pass_salt,pass_fp').eq('username', String(b.username || '')).maybeSingle();
    const u = r.data;
    if (!u || u.active !== true || !u.pass_salt || !u.pass_fp) return out({ error: 'denied' }, 401);
    if (!same(await passFp(String(b.password || ''), u.pass_salt), u.pass_fp)) return out({ error: 'denied' }, 401);
    const exp = Date.now() + TOKEN_DAYS * 864e5;
    const p = b64u(JSON.stringify({ u: u.client_id, exp }));
    return out({ token: p + '.' + (await sign(p)), exp });
  }

  const u = await who(b.token);
  if (!u) return out({ error: 'login' }, 401);
  const mod = b.mod === 'intake' ? 'intake' : 'enroll';

  if (act === 'list') {
    if (!(await can(u, mod, 'view'))) return out({ error: 'perm' }, 403);
    const r = await db.from('hr_enroll').select('client_id,created_at,school_year,data,files,track,updated_at')
      .eq('deleted', false).order('created_at', { ascending: false });
    if (r.error) return out({ error: 'db' }, 500);
    return out({ rows: r.data });
  }
  if (act === 'track') {
    if (!(await can(u, mod, 'edit'))) return out({ error: 'perm' }, 403);
    const cur = await db.from('hr_enroll').select('track').eq('client_id', String(b.id)).maybeSingle();
    if (!cur.data) return out({ error: 'missing' }, 404);
    const track = { ...(cur.data.track || {}), [String(b.key)]: b.value == null ? '' : String(b.value) };
    const r = await db.from('hr_enroll').update({ track, updated_at: Date.now() }).eq('client_id', String(b.id));
    return r.error ? out({ error: 'db' }, 500) : out({ ok: true, track });
  }
  if (act === 'delete') {
    if (!(await can(u, mod, 'edit'))) return out({ error: 'perm' }, 403);
    const r = await db.from('hr_enroll').update({ deleted: true, deleted_at: new Date().toISOString(), deleted_by: u.client_id, updated_at: Date.now() })
      .eq('client_id', String(b.id));
    return r.error ? out({ error: 'db' }, 500) : out({ ok: true });
  }
  if (act === 'file') {
    if (!(await can(u, mod, 'view'))) return out({ error: 'perm' }, 403);
    const r = await db.storage.from(FILES_BUCKET).createSignedUrl(String(b.path || ''), URL_TTL);
    return r.error ? out({ error: 'file' }, 404) : out({ url: r.data.signedUrl });
  }
  return out({ error: 'bad_action' }, 400);
});
