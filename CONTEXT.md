# CONTEXT — פיתוח אפליקציות ישיבה

> קובץ זה נטען בתחילת כל שיחה חדשה.  
> לאחר כל שיחה — לבקש מהעוזר לעדכן ולדחוף.

---

## סביבה כללית
- פיתוח PWA + APK לניהול ישיבה
- עריכה ישירה על קבצים בלינוקס → git push → GitHub Pages
- יש גישה מלאה ללינוקס
- תוסף Claude in Chrome מותקן ועובד (לניהול דפדפן ו-Supabase)

---

## Supabase — משותף לשתי האפליקציות

| פרט | ערך |
|-----|-----|
| Project name | ygtotlrl-apps (שונה מ-yoman-avoda באפריל 2026) |
| Project ID | kxbtskqobynewvnckaaz |
| URL | https://kxbtskqobynewvnckaaz.supabase.co |
| Anon Key | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YnRza3FvYnluZXd2bmNrYWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDI4NDAsImV4cCI6MjA4ODg3ODg0MH0.WLwPgTJp0Y-p1AuzeXhuHDPWEbWRanVMrvEN4V9Xbeg |
| Region | AWS ap-southeast-2 |

**טבלאות:**
- `kv` — שמירת נתוני שתי האפליקציות | RLS מופעל ✅ | policy: allow_all
- `ys_users` — משתמשי הנהלה רוחנית | RLS מופעל ✅ | policy: allow_all
- prefix יומן עבודה: `tb_data`, `tb_last_changed`
- prefix הנהלה רוחנית: `ys_students`, `ys_attend`, `ys_approvals`, `ys_reasons`, `ys_last_changed`, `ys_perms`

---

## אפליקציה 1 — יומן עבודה

| פרט | ערך |
|-----|-----|
| Repo | https://github.com/ygtotlrl-lab/yoman-avoda |
| Token | ← שאל את המשתמש בתחילת שיחה |
| Pages | https://ygtotlrl-lab.github.io/yoman-avoda/ |
| קובץ | `/tmp/yoman-avoda/index.html` (שונה מ-"יומן עבודה.html" באפריל 2026) |
| SW cache | yoman-avoda-v3 |

**עיצוב Header:**
- רקע כחול gradient עם border-radius:20px
- שמאל: עמודה flex — לוגו → כפתור סנכרן → מספר גרסה
- מרכז: ב"ה | ימות המשיח → כותרת → שם ישיבה → "יחי אדוננו..." (font-weight:800)
- טאבים עגולים: הזנה / יומן / עריכה / ארכיון

**APK שם קובץ:** `yoman-avoda.apk` (ללא עברית — שמות עברית לא עובדים ב-Android)
**keystore:** `/tmp/yoman.keystore` | alias=yoman | storepass/keypass=yoman123
**manifest name:** יומן עבודה (תוקן — היה "טאג בוך - יומן עבודה")

**כפתורים מוסתרים במובייל (≤800px):** class `hide-mobile`

**Enter handlers:**
- `taskInput`, `subInput`, `countInput`, `notesInput` → addEntry()
- `snewtask-ci` → addTask(ci) ✅ (נוסף אפריל 2026)
- `snewsub-ci-ti` → addSub(ci, ti)

**git push:**
```
git push https://TOKEN@github.com/ygtotlrl-lab/yoman-avoda.git main
```

---

## אפליקציה 2 — הנהלה רוחנית

| פרט | ערך |
|-----|-----|
| Repo | https://github.com/ygtotlrl-lab/yeshiva-manager |
| Token | ← שאל את המשתמש בתחילת שיחה |
| Pages | https://ygtotlrl-lab.github.io/yeshiva-manager/ |
| קובץ | `/tmp/yeshiva-manager/index.html` |
| APK | https://github.com/ygtotlrl-lab/yeshiva-manager/raw/main/yeshiva-manager.apk |
| SW cache | yeshiva-v21 |

**עיצוב:**
- דסקטופ (≥1100px): 3 עמודות, nav עליון, ללא bottom-nav
- מובייל (≤800px): עמודה אחת, nav גלילה אופקית, padding:14px
- APK: URL מכיל ?apk=1 | WideViewPort=false | LoadWithOverviewMode=false

**מודולים:** מצבת תלמידים | שמירת סדרים | זמן שינה | מבחנים | תיקים אישיים | גיליונות חודשיים

**מערכת Auth (נוספה אפריל 2026):**
- מסך כניסה: שם משתמש + סיסמה 6 ספרות
- 3 תפקידים: admin / senior / junior
- נעילה אוטומטית: 5 דקות + אזהרה דקה לפני
- פאנל ניהול: ⚙️ → ניהול משתמשים + טבלת הרשאות + שינוי סיסמה
- simpleHash() — hash פשוט לסיסמאות
- משתמש ראשוני: admin / 123456

**ys_users שדות:** id, username, password_hash, full_name, role(admin/senior/junior), active
**ys_perms:** מפתח ב-kv | הרשאות לפי תפקיד לכל מודול

**⚠️ Supabase CDN:** חובה `<script src="..." >` סינכרוני — אסור async/fallback! אחרת `supabase is not defined` בשורת `var SB=supabase.createClient`

**⚠️ Auth הנהלה רוחנית:** password_hash מושווה כ-plaintext (123456). simpleHash() קיים בקוד אבל DB מכיל plaintext.

**keystore:** `/tmp/yeshiva_new.keystore` | alias=yeshiva | storepass/keypass=yeshiva123
**cert SHA-256:** 71c5e63b616ebb50e3bf0d40ea17437861ed932a9b21ccfc96515f1aa0c067ac
⚠️ keystore חדש מאפריל 2026 — כל מכשיר צריך הסרה מלאה + התקנה מחדש

**git push:**
```
git push https://TOKEN@github.com/ygtotlrl-lab/yeshiva-manager.git main
```

---

## ⚠️ שיטת בניית APK — יומן עבודה

**שיטה: apktool + zipalign + apksigner (עובד ✅)**
```bash
# 1. פרק
apktool d /tmp/yoman-avoda/yoman-avoda.apk -o /tmp/yw_work -f

# 2. תקן URL (חשוב! הקובץ הוא index.html ולא יומן עבודה.html)
# ב-MainActivity.smali + MainActivity$2.smali:
# החלף: yoman-avoda/%D7%99%D7%95%D7%9E%D7%9F%20%D7%A2%D7%91%D7%95%D7%93%D7%94.html
# ל:    yoman-avoda/index.html

# 3. החלף אייקונים — מהריפו icon-512.png לכל הגדלים:
# res/mipmap-hdpi-v4: 72px | xhdpi: 96px | xxhdpi: 144px | xxxhdpi: 192px
# assets/icons/: icon-192, icon-512, apple-touch-icon, favicon-32, favicon-16
# ⚠️ חשוב: החלף גם build/apk/res/ אם קיים!

# 4. בנה + חתום
apktool b /tmp/yw_work -o /tmp/yw_built.apk
zipalign -f 4 /tmp/yw_built.apk /tmp/yw_aligned.apk
apksigner sign --ks /tmp/yoman.keystore --ks-key-alias yoman \
  --ks-pass pass:yoman123 --key-pass pass:yoman123 \
  --out yoman-avoda.apk /tmp/yw_aligned.apk
rm -f yoman-avoda.apk.idsig
```

**⚠️ אייקון יומן עבודה:** לוגו ירוק של הישיבה על רקע לבן (icon-512.png מהריפו).
אין להשתמש באייקון הישן — הוא כחול עם מסגרת ירוקה.
אם יש תיקיית `build/` ב-yw_work — להחליף גם שם!

---

## ⚠️ באג כפתורים חסומים — פתרון אולטימטיבי

כפתורים לא מגיבים ללחיצה — זהו הבאג הנפוץ ביותר באפליקציה. **שלוש סיבות אפשריות, כולן קריטיות:**

---

### סיבה 1: שגיאת JS שמשתקת את כל הכפתורים
**זו הסיבה הנפוצה ביותר.** אם יש שגיאת JS בטעינה, כל הכפתורים נחסמים.

**איבחון:** פתח DevTools → Console → חפש שגיאה אדומה.

**הגורם הנפוץ ביותר לשגיאה:** שימוש ב-`H()` בתוך `var X = {...}` ברמה הגלובלית, כשה-`H` עדיין לא מוגדרת:
```javascript
// שגוי — H לא קיימת עדיין בשורה 960 כשH מוגדרת בשורה 1571
var DEFAULT_REASONS = { approved: [H(1495,...)] }; // קורס!

// נכון — function נקראת רק בזמן שימוש, H כבר קיימת
function getDefaultReasons() {
  return { approved: ['\u05d7\u05d5\u05e4\u05e9\u05d4', ...] };
}
```
**כלל:** לעולם לא לקרוא ל-`H()` ברמה הגלובלית. תמיד עטוף ב-function.

---

### סיבה 2: חסר `window.` ב-onclick של HTML סטטי
כל `onclick` בHTML סטטי (לא נוצר ב-JS) חייב להשתמש ב-`window.`:
```html
<!-- נכון -->
<button onclick="window.showSettingsModule('students')">...</button>
<!-- שגוי — הפונקציה לא מוכרת בזמן הלחיצה -->
<button onclick="showSettingsModule('students')">...</button>
```

---

### סיבה 3: event listeners שרצים לפני שה-DOM מוכן
`querySelectorAll('[data-pg]')` שרץ לפני שכפתורי bottom-nav נוצרו בDOM — הכפתורים לא מקבלים listeners.

**פתרון:** כפתורי bottom-nav חייבים `onclick` ישיר עם `window.`:
```html
<button class="bn" onclick="window.showPage('students');...">
```

---

### איבחון מהיר
1. פתח DevTools → Console — אם יש שגיאה אדומה, טפל בה קודם
2. הרץ: `typeof window.FUNCTION_NAME` — אם `undefined`, הפונקציה לא הוגדרה
3. אם הכל נראה תקין אבל עדיין לא עובד — בעיית SW cache (ראה למטה)

### SW Cache
מעכשיו ה-SW הוא **network-only** (ללא cache). אם עדיין יש בעיה, הרץ בconsole:
```javascript
caches.keys().then(k=>Promise.all(k.map(c=>caches.delete(c)))).then(()=>navigator.serviceWorker.getRegistrations()).then(r=>Promise.all(r.map(x=>x.unregister()))).then(()=>location.reload(true))
```

---

**הדרך שעובדת (zipfile — ללא data descriptor flag):**
```python
import zipfile, io
out = io.BytesIO()
with zipfile.ZipFile(src, 'r') as zin, zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_STORED) as zout:
    for item in zin.infolist():
        if item.filename.startswith('META-INF/'): continue
        # החלף קבצים רלוונטיים
        ni = zipfile.ZipInfo(item.filename)
        ni.compress_type = zipfile.ZIP_STORED  # לא מכווצים: resources.arsc, PNG
        # או ZIP_DEFLATED: AndroidManifest.xml, classes.dex, html, js, json
        zout.writestr(ni, data, compress_type=compress)
```
⚠️ **אסור data descriptor flag (0x808)** — גורם לשגיאת "ניתוח חבילה"
⚠️ **שינוי strings ב-resources.arsc / AndroidManifest.xml** — חייב 4-byte alignment ב-StringPool
⚠️ מחק `/tmp/ys_smali/original/` לפני apktool build

**smali:** `/tmp/ys_smali/smali/com/yeshiva/manager/MainActivity.smali`
- setUseWideViewPort(v3=false) | setLoadWithOverviewMode(v3=false)

**zipalign + sign:**
```bash
zipalign -f 4 input.apk aligned.apk
apksigner sign --ks /tmp/yeshiva_new.keystore --ks-key-alias yeshiva \
  --ks-pass pass:yeshiva123 --key-pass pass:yeshiva123 \
  --out final.apk aligned.apk
rm -f final.apk.idsig
```

---

## כלי בנייה
| כלי | נתיב |
|-----|------|
| apktool | /usr/bin/apktool |
| zipalign | /usr/bin/zipalign |
| apksigner | /usr/bin/apksigner |
| jarsigner | /usr/bin/jarsigner |
| java | OpenJDK 21 |
| pip | תמיד עם --break-system-packages |

---

## מכשירים
| מכשיר | רוחב | סוג |
|--------|-------|-----|
| Samsung Galaxy A9 (טאבלט) | 768px | דסקטופ |
| Samsung Galaxy F22Pro | 720px | מובייל |
| Qin (סיני) | ~720px | מובייל |

---

## כללים קריטיים
1. **אסור עברית ישירה ב-JS strings** — חובה `String.fromCharCode()` או `H()`
2. אחרי apksigner — תמיד למחוק `.idsig`
3. לעדכן SW cache version בכל שינוי גדול
4. PDF עברי — pdfplumber לחילוץ, pypdf לפיצול
5. breakpoint מובייל: ≤800px
6. `git config user.email "dev@yeshiva.com" / user.name "Dev"`
7. **APK בנייה — zipfile בלבד, ללא data descriptor (0x808)**
8. `<title>` חייב לפני כל `<script>` ב-HTML

---

## workflow רגיל

**הנהלה רוחנית:**
```bash
cd /tmp/yeshiva-manager
# ערוך index.html + עדכן SW cache אם שינוי גדול
git add . && git commit -m "תיאור" && \
git push https://TOKEN_YESHIVA@github.com/ygtotlrl-lab/yeshiva-manager.git main
```

**יומן עבודה:**
```bash
cd /tmp/yoman-avoda
# ערוך index.html
git add . && git commit -m "תיאור" && \
git push https://TOKEN_YOMAN@github.com/ygtotlrl-lab/yoman-avoda.git main
```

---

## הוראה לעוזר בתחילת שיחה
קרא קובץ זה, אמת שהבנת, ושאל אם משהו לא ברור לפני שמתחילים.
