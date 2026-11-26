// hr-auth — החשבון האישי במסד להנהלה רוחנית: שם משתמש וסיסמה נבדקים כאן, בשרת, מול הטביעה שב-hr_users
// (אותה גזירה כמו באפליקציה — PBKDF2, 100,000 סבבים, הקשר «hanhala-ruchanit/hr_users/v1/»),
// ובהצלחה — סשן Supabase אמיתי לאותו משתמש, ושורת המשתמש. הסיסמה אינה נשמרת בשום מקום.
// החשבון במסד — כתובת פנימית לכל משתמש (hr-<client_id>@…), נוצר בכניסה הראשונה, ובלי מייל אמיתי.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINS = ["https://ygtotlrl-lab.github.io"];
const CTX = "hanhala-ruchanit/hr_users/v1/";
const ITER = 100000;
const DOMAIN = "users.hanhala-ruchanit.ygtotlrl-lab.github.io";
const COLS = "client_id,username,full_name,role,active,created_at,updated_at,pass_salt,pass_fp,sort,notify";
const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) || o.startsWith("http://localhost") || o.startsWith("http://127.0.0.1") ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "content-type, authorization, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
function out(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}
function hex(b: Uint8Array) { return Array.from(b, (x) => (x + 0x100).toString(16).slice(1)).join(""); }
async function fp(pass: string, salt: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(CTX + salt), iterations: ITER, hash: "SHA-256" }, key, 256);
  return hex(new Uint8Array(bits));
}
// כניסה שנכשלה נרשמת כאן, מיד — ללקוח שלא נכנס אין סשן, והיומן סגור בפניו
async function logFail(branch: string, typed: string, device: string) {
  const { error } = await admin.from("sh_sync_log").insert({ device_id: device || null, user_name: null, action: "login_fail",
    key: branch, record_count: 0, details: { typed_username: typed, online: true } });
  if (error) { console.error("[hr-auth] log", error); return false; }
  return true;
}
function emailOf(id: string) { return "hr-" + String(id).toLowerCase().replace(/[^a-z0-9-]/g, "") + "@" + DOMAIN; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return out(req, { ok: false, why: "method" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return out(req, { ok: false, why: "body" }, 400); }
  // לפי שם המשתמש (כניסה), או לפי המזהה (החלפת משתמש)
  const username = typeof b.username === "string" ? b.username.trim() : "", id = typeof b.id === "string" ? b.id.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const device = typeof b.device === "string" ? b.device.slice(0, 80) : "";
  const pre = id ? "switch_" : "", typed = id || username;
  if ((!username && !id) || !password || username.length > 100 || id.length > 80 || password.length > 200) return out(req, { ok: false, why: "args" }, 400);
  try {
    const q = admin.from("hr_users").select(COLS);
    const { data: u, error } = await (id ? q.eq("client_id", id) : q.eq("username", username)).maybeSingle();
    if (error) throw error;
    // תשובות סמכותיות, נבדלות: אין משתמש פעיל כזה · אין לו טביעה · הסיסמה אינה תואמת
    if (!u || u.active !== true) return out(req, { ok: false, why: "nouser", logged: await logFail(pre + "wrong_credentials_online", typed, device) }, 401);
    if (!u.pass_salt || !u.pass_fp) return out(req, { ok: false, why: "nofp", logged: await logFail(pre + "no_fp_online", typed, device) }, 401);
    if ((await fp(password, u.pass_salt)) !== u.pass_fp) return out(req, { ok: false, why: "bad", logged: await logFail(pre + "wrong_credentials_online", typed, device) }, 401);
    const email = emailOf(u.client_id);
    const made = await admin.auth.admin.createUser({ email, email_confirm: true, app_metadata: { hr_uid: u.client_id } });
    if (made.error && !/already|registered|exists/i.test(made.error.message)) throw made.error;
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    const pub = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
    const v = await pub.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
    if (v.error || !v.data.session) throw v.error || new Error("no session");
    const s = v.data.session;
    return out(req, { ok: true, user: u, session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at } });
  } catch (e) {
    console.error("[hr-auth]", e);
    return out(req, { ok: false, why: "server" }, 500);
  }
});
