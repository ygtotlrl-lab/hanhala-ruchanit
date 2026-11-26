// supabase/functions/hr-gate/index.ts — השער של הנהלה רוחנית (Supabase Edge Function): כל מה שהדפים הציבוריים והאפליקציה עושים מול השרת, חוץ מהכניסה (hr-auth).
// cfg — הגדרה אחת מרשימה סגורה (הטפסים, האסיפה ואנשי הקשר); submit — שורת תגובה חדשה ל-hr_enroll או ל-hr_intake, הוספה בלבד, והתראה (sh-gate).
// מה שהטפסים הציבוריים שולחים (טופס הרישום — hr_enroll; קבלה לישיבה — hr_intake) נקרא רק כאן, במפתח השירות, ואחרי כניסה מקוונת:
// login מאמת שם וסיסמה מול hr_users (אותה גזירה כמו core/auth.js) ומחזיר אסימון חתום ל-30 יום, ו-renew מחליף אסימון תקף בחדש;
// כל פעולה אחרת בודקת את האסימון, שהמשתמש עדיין פעיל, ואת ההרשאה שלו למודול — מההרשאות השמורות, ובלעדיהן מברירת המחדל.
// הקבצים — במאגר הפרטי ygtotlrl-lab/hanhala-ruchanit-files (המפתח בסוד GITHUB_FILES_TOKEN), ורק דרך השער:
//   העלאה — POST ?a=put&p=<נתיב>, והגוף הוא הקובץ עצמו. enroll/ ו-intake/ — מהטפסים הציבוריים, בלי אסימון, רק לנתיב חדש;
//   exams/ ו-files/ — באסימון (בכותרת x-gate-token) ובהרשאת עריכה במודול.
//   פתיחה — הפעולה links מחזירה קישור חתום לשער (GET ?a=raw&p=&e=&s=), שמגיש את הקובץ מהמאגר: לשעה, ובגיליון — בלי תפוגה.
// התחום של כל נתיב נגזר מתחילתו — enroll/ · intake/ · exams/ · files/ — וההרשאה הנדרשת היא של המודול שלו.
// הטיוטות של הטפסים הציבוריים (hr_drafts) — במפתח שנגזר מהטופס וממספר הזהות, בלי אסימון: draft_get · draft_put · draft_del.
// השיבוץ לאסיפת הורים (hr_meeting, ההגדרה meeting_cfg) — בלי אסימון: meet_get (התלמיד מהמצבה, השיבוצים שלו והשעות התפוסות, בלי שמות)
//   ו-meet_book (שיבוץ · החלפה · ביטול: עד שניים מרבני השיעור, ואחריהם אחד מהנהלת הישיבה; בלי שתי פגישות באותה שעה ובלי השעות התפוסות);
//   הרבנים — מאנשי הקשר; התגובות והביטול מהאפליקציה — list · delete עם mod:'meeting'.
// שיבוץ, שינוי וביטול — התראה למי שסומן «מקבל התראות» (sh-gate): שם התלמיד והשיעור בלבד, וגם מייל לבעלים — על כל שינוי.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { encodeBase64 } from 'jsr:@std/encoding@1.0.5/base64';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GH = Deno.env.get('GITHUB_FILES_TOKEN') || '';
const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const APP_ID = 'hanhala-ruchanit';
const USERS = 'hr_users';
const PASS_CTX = APP_ID + '/' + USERS + '/v1/';
const PASS_ITER = 100000;
const TOKEN_DAYS = 30;
const REPO = 'ygtotlrl-lab/hanhala-ruchanit-files';
const LINK_TTL = 3600;               // שעה — פתיחה מתוך האפליקציה
const NEVER = 253402300799000;       // בלי תפוגה (סוף שנת 9999) — הגיליון שנשלח להורים
const MAX_BYTES = 15 * 1024 * 1024;
const TABLES: Record<string, string> = { enroll: 'hr_enroll', intake: 'hr_intake', meeting: 'hr_meeting' };
const DRAFT_FORMS = ['enroll', 'intake'];
const CFG_KEYS = ['enroll_form', 'intake_form', 'meeting_cfg', 'contacts'];
const FORM_NAME: Record<string, string> = { enroll: 'טופס רישום', intake: 'קבלה לישיבה' };
const ROW_MAX = 200000;
const DRAFT_MAX = 200000;
// התחום ⟵ המודול שההרשאה שלו נבדקת; שלושת הטפסים — הרשאה אחת, forms
const AREA_MOD: Record<string, string> = { enroll: 'forms', intake: 'forms', exams: 'exams', files: 'files' };
// אחת עם DEFAULT_PERMS שב-app/state.js — למודולים שהשער משרת
const DEF: Record<string, Record<string, string>> = {
  forms: { admin: 'edit', manager: 'view', junior: 'view' },
  exams: { admin: 'edit', manager: 'edit', junior: 'view' },
  files: { admin: 'edit', manager: 'edit', junior: 'none' },
  reports: { admin: 'edit', manager: 'view', junior: 'none' },
};
// נתיב — אותיות לטיניות, ספרות, מקף וקו תחתון, בתיקיות; והסיומת קצרה
const PATH_RE = /^(enroll|intake|exams|files)\/([A-Za-z0-9_-]+\/){1,4}[A-Za-z0-9_-]+\.[a-z0-9]{1,5}$/;
// מהטפסים הציבוריים — <תחום>/<שנה>/<מזהה תגובה>/<שדה>.<סיומת>
const PUB_RE = /^(enroll|intake)\/\d{4}\/[0-9a-f]{16}\/[A-Za-z0-9_-]{1,40}\.[a-z0-9]{1,5}$/;
const MIME: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', heic: 'image/heic', txt: 'text/plain; charset=utf-8',
};
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-gate-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
const areaOf = (path: string) => path.split('/')[0];

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

// ── המאגר ──
function ghUrl(path: string) { return 'https://api.github.com/repos/' + REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/'); }
function ghHeaders(accept = 'application/vnd.github+json') {
  return { Authorization: 'Bearer ' + GH, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'hr-gate' };
}
// נתיב חדש בלבד (בלי sha — GitHub מסרב לדרוס, 422); התנגשות של שתי כתיבות בו-זמנית (409) — עוד ניסיון
async function ghPut(path: string, bytes: Uint8Array, by: string) {
  const body = JSON.stringify({ message: 'העלאה: ' + path + (by ? ' · ' + by : ''), content: encodeBase64(bytes) });
  for (let i = 0; i < 4; i++) {
    const r = await fetch(ghUrl(path), { method: 'PUT', headers: { ...ghHeaders(), 'Content-Type': 'application/json' }, body });
    if (r.status === 200 || r.status === 201) return 'ok';
    if (r.status === 422) return 'exists';
    if (r.status !== 409) { console.error('[gh put]', r.status, await r.text()); return 'fail'; }
    await new Promise((res) => setTimeout(res, 400 * (i + 1)));
  }
  return 'fail';
}
async function link(path: string, e: number) {
  const s = await sign('raw|' + path + '|' + e);
  return URL_ + '/functions/v1/hr-gate?a=raw&p=' + encodeURIComponent(path) + '&e=' + e + '&s=' + s;
}

async function raw(q: URLSearchParams) {
  const path = q.get('p') || '', e = Number(q.get('e') || 0), s = q.get('s') || '';
  if (!PATH_RE.test(path) || !e || e < Date.now() || !same(s, await sign('raw|' + path + '|' + e))) {
    return new Response('הקישור אינו תקף או שפג תוקפו', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const r = await fetch(ghUrl(path), { headers: ghHeaders('application/vnd.github.raw') });
  if (!r.ok || !r.body) return new Response('הקובץ לא נמצא', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const ext = (path.split('.').pop() || '').toLowerCase();
  return new Response(r.body, { headers: { ...CORS,
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Disposition': 'inline; filename="' + path.split('/').pop() + '"',
    'Cache-Control': 'private, max-age=3600',
  } });
}

async function put(req: Request, q: URLSearchParams) {
  const path = q.get('p') || '';
  if (!PATH_RE.test(path)) return out({ error: 'path' }, 400);
  const area = areaOf(path);
  let by = '';
  if (area === 'enroll' || area === 'intake') {
    if (!PUB_RE.test(path)) return out({ error: 'path' }, 400);
  } else {
    const u = await who(req.headers.get('x-gate-token') || '');
    if (!u) return out({ error: 'login' }, 401);
    if (!(await can(u, AREA_MOD[area], 'edit'))) return out({ error: 'perm' }, 403);
    by = u.full_name || u.client_id;
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length) return out({ error: 'empty' }, 400);
  if (bytes.length > MAX_BYTES) return out({ error: 'size' }, 413);
  const r = await ghPut(path, bytes, by);
  if (r === 'exists') return out({ error: 'exists' }, 409);
  return r === 'ok' ? out({ ok: true, path }) : out({ error: 'store' }, 502);
}

// ── הטיוטות ──
async function draftKey(form: string, key: string) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(form + '|' + key)));
}
async function drafts(act: string, b: Record<string, any>) {
  const form = String(b.form || ''), key = String(b.key || '');
  if (DRAFT_FORMS.indexOf(form) < 0 || !/^(id|pp):[0-9A-Z]{5,20}$/.test(key)) return out({ error: 'bad_request' }, 400);
  const k = await draftKey(form, key);
  if (act === 'draft_get') {
    const r = await db.from('hr_drafts').select('draft').eq('form', form).eq('key', k).maybeSingle();
    return out({ draft: r.data ? r.data.draft : null });
  }
  if (act === 'draft_del') {
    await db.from('hr_drafts').delete().eq('form', form).eq('key', k);
    return out({ ok: true });
  }
  const d = b.draft;
  if (!d || typeof d !== 'object' || JSON.stringify(d).length > DRAFT_MAX) return out({ error: 'size' }, 413);
  const r = await db.from('hr_drafts').upsert({ form, key: k, draft: d, updated_at: Date.now() }, { onConflict: 'form,key' });
  return r.error ? out({ error: 'db' }, 500) : out({ ok: true });
}

// ── השיבוץ לאסיפת הורים ──
// הרבנים — תמיד מאנשי הקשר (contacts): רבני השיעור — ר"מ ושני המשפיעים (n3 · n4 · n5) מהקבוצה של השיעור, והנהלת הישיבה —
// ראש הישיבה, המשגיח הראשי ומנהל הלימודים. שם שהוא שם של תפקיד — בעל התפקיד; המזהה — השם, כדי שהשיבוץ יישאר שלו גם כשאנשי הקשר נערכים.
type Staff = { id: string; name: string; roles: Record<string, string>; mgmt?: string };
const MT_CLS = ['a', 'b', 'g'];
const MT_MGMT = [/ראש הישיבה/, /משגיח ראשי/, /מנהל הלימודים/];
async function meetCfg() {
  const r = await db.from('hr_settings').select('value').eq('key', 'meeting_cfg').maybeSingle();
  try { return r.data ? JSON.parse(r.data.value) : null; } catch { return null; }
}
async function meetStaff(): Promise<Staff[]> {
  const r = await db.from('hr_settings').select('value').eq('key', 'contacts').maybeSingle();
  let v: any = null; try { v = r.data ? JSON.parse(r.data.value) : null; } catch { v = null; }
  const groups: any[] = (v && v.groups) || [], byRole: Record<string, string> = {}, all: Staff[] = [];
  groups.forEach((g) => (g.rows || []).forEach((x: any) => { if (x.role && x.name && !byRole[x.role]) byRole[x.role] = x.name; }));
  const real = (n: string) => (byRole[n] && byRole[n] !== n ? byRole[n] : n);
  const get = (name: string) => { let s = all.find((x) => x.name === name); if (!s) { s = { id: name, name, roles: {} }; all.push(s); } return s; };
  groups.forEach((g) => { if (MT_CLS.indexOf(g.cls) < 0) return;
    (g.rows || []).forEach((x: any) => { if (x.name && ['n3', 'n4', 'n5'].indexOf(x.rp) >= 0) { const s = get(real(String(x.name))); if (!s.roles[g.cls]) s.roles[g.cls] = String(x.role || ''); } }); });
  groups.forEach((g) => (g.rows || []).forEach((x: any) => {
    const role = String(x.role || '');
    if (x.name && MT_MGMT.some((re) => re.test(role))) { const s = get(real(String(x.name))); if (!s.mgmt) s.mgmt = role; }
  }));
  return all;
}
// לתלמיד: רבני השיעור (עד שניים) והנהלת הישיבה (אחד, אחרי רב שיעור). מי שבשניהם (בשיעור ב׳ — ראש הישיבה ומנהל הלימודים)
// מופיע בשניהם, והפגישה איתו אחת — מסומנת בשניהם ונספרת ברבני השיעור.
function staffOf(all: Staff[], grp: string) {
  const cls = all.filter((s) => s.roles[grp]).map((s) => ({ id: s.id, name: s.name, role: s.roles[grp] }));
  const mgmt = all.filter((s) => s.mgmt).map((s) => ({ id: s.id, name: s.name, role: s.mgmt as string }));
  return { cls, mgmt };
}
// מצב השיבוץ (מזהי הרבנים) — תקין: עד שניים מרבני השיעור, עד אחד מההנהלה, ומי שרק בהנהלה — רק כשיש רב שיעור
function meetCheck(sf: { cls: { id: string }[]; mgmt: { id: string }[] }, ids: string[]) {
  const C = sf.cls.map((s) => s.id), M = sf.mgmt.map((s) => s.id);
  // מי שבשתי הרשימות נספר ברבני השיעור בלבד — ואפשר עדיין פגישה עם מי שרק בהנהלה
  const nc = ids.filter((i) => C.indexOf(i) >= 0).length, nm = ids.filter((i) => M.indexOf(i) >= 0 && C.indexOf(i) < 0).length;
  if (nc > 2) return 'max';
  if (nm > 1) return 'max_mgmt';
  if (ids.some((i) => C.indexOf(i) < 0) && nc < 1) return 'cls_first';
  return '';
}
const tmin = (t: string) => { const a = String(t || '').split(':'); return (+a[0]) * 60 + (+a[1] || 0); };
// שעות תפוסות (הרצאות וכד׳) — לכל הרבנים
function blockedAt(c: any, t: string) { const m = tmin(t); return ((c.blocked || []) as any[]).some((b) => b && b.from && b.to && m >= tmin(b.from) && m < tmin(b.to)); }
function meetSlots(c: any) {
  const p = (t: string) => { const a = String(t || '').split(':'); return (+a[0]) * 60 + (+a[1] || 0); };
  const out: string[] = [], f = p(c.from), t = p(c.to), n = Math.max(5, +c.slot || 10);
  for (let m = f; m + n <= t; m += n) out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  return out;
}
async function meetStudent(id: string) {
  const v = String(id || '').trim().toUpperCase();
  if (!/^[0-9A-Z]{5,20}$/.test(v)) return null;
  const r = await db.from('hr_students_rows').select('client_id,data').eq('deleted', false).eq('data->>idnum', v).limit(1);
  const row = r.data && r.data[0];
  if (!row || !meetActive(row.data.periods)) return null;
  return { id: String(row.client_id), name: String(row.data.name || ''), cls: String(row.data.cls || '') };
}
// פעיל — כמו «פעילים» במצבה: תקופה פתוחה, או שנגמרת בחודש הנוכחי ואילך, או שעוד לא התחילה.
// המפתח — «שנה-חודש» עברי מתשרי (01–13, אדר א׳ ואדר ב׳ נפרדים), כמו hrMonthKey שבאפליקציה.
function hebKeyNow() {
  const o: Record<string, string> = {};
  new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'long', year: 'numeric', timeZone: 'Asia/Jerusalem' }).formatToParts(new Date()).forEach((p) => { o[p.type] = p.value; });
  const y = +o.year, leap = ((7 * y + 1) % 19) < 7;
  const ms = ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat'].concat(leap ? ['Adar I', 'Adar II'] : ['Adar'], ['Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul']);
  let i = ms.indexOf(o.month); if (i < 0 && o.month === 'Adar') i = 5;
  return y + '-' + String(i + 1).padStart(2, '0');
}
function meetActive(periods: any) {
  const ps: any[] = Array.isArray(periods) ? periods : [];
  if (!ps.length) return false;
  const k = hebKeyNow();
  return ps.some((p) => p && (!p.end || String(p.end) >= k || String(p.start || '') > k));
}
async function meetState(date: string, sid: string) {
  const r = await db.from('hr_meeting').select('client_id,student_client_id,staff_id,staff_name,slot').eq('meet_date', date).eq('deleted', false);
  const rows = r.data || [];
  return {
    mine: rows.filter((x) => x.student_client_id === sid).map((x) => ({ id: x.client_id, staff: x.staff_id, staff_name: x.staff_name, time: x.slot })),
    taken: rows.map((x) => ({ staff: x.staff_id, time: x.slot })),
  };
}
const CLS_NAME: Record<string, string> = { a: 'שיעור א׳', b: 'שיעור ב׳', g: 'שיעור ג׳', s: 'התלמידים השלוחים' };
// ברקע — ההורה אינו ממתין; תגית אחת לתלמיד, כך שהתראה חדשה מחליפה את הקודמת שלו
function meetNotify(kind: 'new' | 'add' | 'change' | 'cancel', st: { id: string; name: string; cls: string }) {
  const title = { new: 'אסיפת הורים — שיבוץ חדש', add: 'אסיפת הורים — שיבוץ נוסף', change: 'אסיפת הורים — שינוי שיבוץ', cancel: 'אסיפת הורים — ביטול שיבוץ' }[kind];
  const p = fetch(URL_ + '/functions/v1/sh-gate', { method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send', app: 'hanhala-ruchanit', mail: true, tag: 'meet-' + st.id,
      title, body: st.name + (CLS_NAME[st.cls] ? ' · ' + CLS_NAME[st.cls] : '') }) }).catch(() => {});
  // @ts-ignore EdgeRuntime
  try { EdgeRuntime.waitUntil(p); } catch (_) { /* */ }
}
async function meeting(act: string, b: Record<string, any>) {
  const c = await meetCfg();
  if (!c || !c.open || !c.date) return out({ error: 'closed' });
  const st = await meetStudent(b.id);
  if (!st) return out({ error: 'nf' });
  const grp = st.cls === 's' ? 'g' : st.cls;
  const sf = staffOf(await meetStaff(), grp);
  if (act === 'meet_get') {
    const s0 = await meetState(c.date, st.id);
    return out({ student: { name: st.name, cls: st.cls }, staff: sf, mine: s0.mine, taken: s0.taken });
  }
  const staff = sf.cls.concat(sf.mgmt).filter((s) => s.id === String(b.staff))[0];
  if (!staff) return out({ error: 'bad_request' }, 400);
  const time = String(b.time || '');
  const cur = await meetState(c.date, st.id);
  const was = cur.mine.filter((m) => m.staff === staff.id)[0];
  const ids = cur.mine.map((m) => m.staff);
  const now = Date.now();
  const drop = async (id: string) => db.from('hr_meeting').update({ deleted: true, deleted_at: new Date().toISOString(), deleted_by: 'parent', updated_at: now }).eq('client_id', id);
  if (!time) {
    // ביטול רב השיעור האחרון כשיש פגישה בהנהלה — קודם את ההנהלה: ההנהלה רק אחרי רב שיעור
    if (was && meetCheck(sf, ids.filter((i) => i !== staff.id))) return out({ error: 'mgmt_first', mine: cur.mine, taken: cur.taken });
    if (was) { await drop(was.id); meetNotify('cancel', st); }
    const s1 = await meetState(c.date, st.id); return out({ mine: s1.mine, taken: s1.taken });
  }
  if (meetSlots(c).indexOf(time) < 0 || blockedAt(c, time)) return out({ error: 'bad_request' }, 400);
  const bad = was ? '' : meetCheck(sf, ids.concat([staff.id]));
  if (bad) return out({ error: bad, taken: cur.taken });
  if (cur.mine.some((m) => m.staff !== staff.id && m.time === time)) return out({ error: 'clash', taken: cur.taken });
  if (was && was.time === time) return out({ mine: cur.mine, taken: cur.taken });
  // השעה נתפסת באינדקס הייחודי (רב · שעה) — שני הורים ברגע אחד: אחד נקלט, והשני מקבל «נתפסה»
  // החלפת שעה אצל אותו רב — עדכון השורה; שיבוץ חדש — שורה חדשה
  const ins = was
    ? await db.from('hr_meeting').update({ slot: time, updated_at: now }).eq('client_id', was.id)
    : await db.from('hr_meeting').insert({ client_id: crypto.randomUUID(), meet_date: c.date, student_client_id: st.id, student_name: st.name, cls: st.cls,
        staff_id: staff.id, staff_name: staff.name, slot: time, updated_at: now, deleted: false });
  if (ins.error) { const s2 = await meetState(c.date, st.id); return out({ error: 'taken', taken: s2.taken }); }
  meetNotify(was ? 'change' : cur.mine.length ? 'add' : 'new', st);
  const s3 = await meetState(c.date, st.id);
  return out({ mine: s3.mine, taken: s3.taken });
}

// ── הדפים הציבוריים: ההגדרה והתגובה ──
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
    body: JSON.stringify({ action: 'send', app: APP_ID, mail: true, tag: form,
      title: FORM_NAME[form] + ' — תגובה חדשה', body: name + (cls ? ' · ' + cls : '') }) }).catch(() => {});
}
// באותה צורה שהמסד מחזיר — מערך של { value } — כדי שהדף יקרא אותה כמו תמיד
async function pubCfg(b: Record<string, any>) {
  const key = String(b.key || '');
  if (CFG_KEYS.indexOf(key) < 0) return out({ error: 'bad_request' }, 400);
  const r = await db.from('hr_settings').select('value').eq('key', key).maybeSingle();
  if (r.error) return out({ error: 'db' }, 500);
  return out(r.data ? [{ value: r.data.value }] : []);
}
async function pubSubmit(b: Record<string, any>) {
  const form = String(b.form || ''), table = DRAFT_FORMS.indexOf(form) >= 0 ? TABLES[form] : '', row = b.row;
  if (!table || !isObj(row)) return out({ error: 'bad_request' }, 400);
  const id = String(row.client_id || ''), year = Number(row.school_year);
  if (!/^[0-9a-f]{16}$/.test(id) || !(year > 5700 && year < 6000) || !isObj(row.data) || !isObj(row.files || {})) return out({ error: 'bad_request' }, 400);
  if (JSON.stringify(row).length > ROW_MAX) return out({ error: 'size' }, 413);
  const r = await db.from(table).insert({ client_id: id, school_year: year, data: row.data, files: row.files || {}, updated_at: Date.now() });
  if (r.error) { console.error('[hr-gate submit]', r.error); return out({ error: r.error.code === '23505' ? 'exists' : 'db' }, r.error.code === '23505' ? 409 : 500); }
  // ברקע — ההורה אינו ממתין לשליחה
  // @ts-ignore EdgeRuntime
  try { EdgeRuntime.waitUntil(notifyNew(form, row.data)); } catch (_) { /* */ }
  return out({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const q = new URL(req.url).searchParams;
  if (req.method === 'GET' && q.get('a') === 'raw') return raw(q);
  if (req.method === 'POST' && q.get('a') === 'put') return put(req, q);
  let b: Record<string, any>;
  try { b = await req.json(); } catch { return out({ error: 'bad_request' }, 400); }
  const act = String(b.action || '');

  if (act === 'draft_get' || act === 'draft_put' || act === 'draft_del') return drafts(act, b);
  if (act === 'meet_get' || act === 'meet_book') return meeting(act, b);
  if (act === 'cfg') return pubCfg(b);
  if (act === 'submit') return pubSubmit(b);

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

  // חידוש — אסימון תקף מחליף את עצמו בחדש ל-30 יום, בלי סיסמה: הצפייה בתגובות נשארת פתוחה כל עוד האפליקציה בשימוש
  if (act === 'renew') {
    const exp = Date.now() + TOKEN_DAYS * 864e5;
    const p = b64u(JSON.stringify({ u: u.client_id, exp }));
    return out({ token: p + '.' + (await sign(p)), exp });
  }

  // קישורים חתומים לקבצים — הרשאת צפייה במודול של כל נתיב; ובלי תפוגה — רק לסריקות המבחנים, בהרשאת הדוחות (הגיליון)
  if (act === 'links') {
    const paths: string[] = Array.isArray(b.paths) ? b.paths.map(String) : [String(b.path || '')];
    const long = b.ttl === 'forever';
    const urls: Record<string, string> = {};
    for (const path of paths) {
      if (!PATH_RE.test(path)) continue;
      const area = areaOf(path);
      if (long ? !(area === 'exams' && await can(u, 'reports', 'view')) : !(await can(u, AREA_MOD[area], 'view'))) continue;
      urls[path] = await link(path, long ? NEVER : Date.now() + LINK_TTL * 1000);
    }
    if (!Object.keys(urls).length && paths.length) return out({ error: 'perm' }, 403);
    return out({ urls });
  }

  const mod = b.mod === 'intake' ? 'intake' : b.mod === 'meeting' ? 'meeting' : 'enroll';
  const table = TABLES[mod];

  if (act === 'list') {
    if (!(await can(u, 'forms', 'view'))) return out({ error: 'perm' }, 403);
    const cols = mod === 'meeting' ? 'client_id,created_at,meet_date,student_client_id,student_name,cls,staff_id,staff_name,slot,updated_at'
      : 'client_id,created_at,school_year,data,files,track,updated_at';
    const r = await db.from(table).select(cols).eq('deleted', false).order('created_at', { ascending: false });
    if (r.error) return out({ error: 'db' }, 500);
    return out({ rows: r.data });
  }
  if (act === 'track') {
    if (!(await can(u, 'forms', 'edit'))) return out({ error: 'perm' }, 403);
    const cur = await db.from(table).select('track').eq('client_id', String(b.id)).maybeSingle();
    if (!cur.data) return out({ error: 'missing' }, 404);
    const track = { ...(cur.data.track || {}), [String(b.key)]: b.value == null ? '' : String(b.value) };
    const r = await db.from(table).update({ track, updated_at: Date.now() }).eq('client_id', String(b.id));
    return r.error ? out({ error: 'db' }, 500) : out({ ok: true, track });
  }
  if (act === 'delete') {
    if (!(await can(u, 'forms', 'edit'))) return out({ error: 'perm' }, 403);
    const r = await db.from(table).update({ deleted: true, deleted_at: new Date().toISOString(), deleted_by: u.client_id, updated_at: Date.now() })
      .eq('client_id', String(b.id));
    return r.error ? out({ error: 'db' }, 500) : out({ ok: true });
  }
  return out({ error: 'bad_action' }, 400);
});
