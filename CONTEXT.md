# CONTEXT — פיתוח אפליקציות ישיבה

> קובץ זה נטען בתחילת כל שיחה חדשה.  
> לאחר כל שיחה — לבקש מהעוזר לעדכן ולדחוף.

---

## סביבה כללית
- פיתוח PWA + APK לניהול ישיבה
- עריכה ישירה על קבצים בלינוקס → git push → GitHub Pages
- יש גישה מלאה ללינוקס

---

## אפליקציה 1 — יומן עבודה

| פרט | ערך |
|-----|-----|
| Repo | https://github.com/ygtotlrl-lab/yoman-avoda |
| Token | ← שאל את המשתמש בתחילת שיחה |
| Pages | https://ygtotlrl-lab.github.io/yoman-avoda/ |
| קובץ | `/tmp/yoman-avoda/יומן עבודה.html` (קובץ יחיד) |
| גרסה | v16 |

**עיצוב Header:**
- רקע כחול gradient עם border-radius:20px
- שמאל: עמודה flex — לוגו → כפתור סנכרן → מספר גרסה
- מרכז: ב"ה | ימות המשיח → כותרת → שם ישיבה → "יחי אדוננו..." (font-weight:800)
- אין div נוסף בצד ימין
- טאבים עגולים: הזנה / יומן / עריכה / ארכיון

**Supabase:**
- URL: https://kxbtskqobynewvnckaaz.supabase.co
- KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YnRza3FvYnluZXd2bmNrYWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDI4NDAsImV4cCI6MjA4ODg3ODg0MH0.WLwPgTJp0Y-p1AuzeXhuHDPWEbWRanVMrvEN4V9Xbeg
- טבלה: kv | מפתחות: tb_data, tb_last_changed
- polling כל 3 שניות | סנכרון דו-כיווני

**APK:** `/tmp/yoman-avoda/yoman-avoda.apk` | alias=app | storepass/keypass=pass1234
**keystore:** `/tmp/yoman.keystore` | alias=app | storepass/keypass=pass1234

**אייקון APK:** לוגו ירוק על רקע לבן — קובץ מקור: `גרין_מיט_ווייסן_הינטערגרונט.png`
- מוחלף ישירות ב-mipmap בתוך ה-APK באמצעות zipfile (ללא apktool recompile)
- גדלים: hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192

**כפתורים מוסתרים במובייל (≤800px):**
- טאב יומן: כפתורי "טקסט", "PDF", "JPEG" — class `hide-mobile`
- טאב ארכיון: כפתור "PDF" — class `hide-mobile`
- CSS: `@media(max-width:800px){.hide-mobile{display:none !important;}}`

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

**עיצוב:**
- דסקטופ (≥1100px): 3 עמודות, nav עליון, ללא bottom-nav
- מובייל (≤800px): עמודה אחת, nav גלילה אופקית, padding:14px
- APK: URL מכיל ?apk=1 | WideViewPort=false

**מודולים:** מצבת תלמידים | שמירת סדרים | זמן שינה | מבחנים | תיקים אישיים | גיליונות חודשיים

**Supabase:** אותו project | prefix ys_ | מפתחות: ys_students, ys_attend, ys_approvals, ys_reasons, ys_last_changed
**ys_users:** טבלת משתמשים | שדות: id, username, password_hash, full_name, role(admin/senior/junior), active
**ys_perms:** מפתח ב-kv table | הרשאות לפי תפקיד לכל מודול
**Auth:** מסך כניסה + נעילה אוטומטית 5 דק' + פאנל ניהול ב-⚙️
**simpleHash():** hash פשוט לסיסמאות 6 ספרות

**Service Worker:** `/tmp/yeshiva-manager/sw.js` | cache נוכחי: yeshiva-v19 ← לעדכן בכל שינוי גדול

**APK smali:**
- `/tmp/ys_work/smali/com/yeshiva/manager/MainActivity.smali`
- package: com.yeshiva.manager
- ONLINE_URL = OFFLINE_URL = https://ygtotlrl-lab.github.io/yeshiva-manager/?apk=1
- setUseWideViewPort(false) | setLoadWithOverviewMode(false)

**keystore:** `/tmp/yeshiva_new.keystore` | alias=yeshiva | storepass/keypass=yeshiva123
**cert SHA-256:** 71c5e63b616ebb50e3bf0d40ea17437861ed932a9b21ccfc96515f1aa0c067ac

**אייקון APK:** לוגו כחול על רקע לבן — קובץ מקור: `טונקל_בלוי_מיט_ווייסן_הינטערגרונט.png`
- מוחלף ישירות ב-mipmap בתוך ה-APK באמצעות zipfile (ללא apktool recompile)
- גדלים: hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192

**manifest.json:** מצביע על `icon-192.png` ו-`icon-512.png` (תוקן — היה מצביע על logo.jpg שלא קיים)

**git push:**
```
git push https://TOKEN@github.com/ygtotlrl-lab/yeshiva-manager.git main
```

---


## ⚠️ שיטת בניית APK — ניהול ישיבה (חשוב!)
**הדרך שעובדת:**
1. `apktool d yeshiva-manager.apk -o /tmp/ys_smali -f` — פרוק
2. ערוך `res/values/strings.xml`, החלף אייקונים, עדכן `assets/`
3. מחק `/tmp/ys_smali/original/` — חובה!
4. `apktool b /tmp/ys_smali -o /tmp/ys_built.apk`
5. החלף resources.arsc ו-AndroidManifest.xml בבינארי-patch (לשמירת alignment)
6. `zipalign -f 4` → `apksigner sign --ks /tmp/yeshiva_new.keystore ...`

**אסור:** לשנות גודל StringPool בלי padding ל-4 bytes alignment!
**keystore חדש** (מאפריל 2026): `/tmp/yeshiva_new.keystore` — כל המכשירים צריכים הסרה מלאה + התקנה מחדש.

## כלי בנייה
| כלי | נתיב |
|-----|------|
| apktool | /usr/bin/apktool |
| zipalign | /usr/lib/android-sdk/build-tools/debian/zipalign |
| apksigner | /usr/bin/apksigner |
| smali.jar | /usr/share/java/smali.jar |
| java | OpenJDK 21 |
| pip | תמיד עם --break-system-packages |

---

## תהליך עדכון אייקון APK ✅ (שיטה שעובדת)
**לא להשתמש ב-apktool recompile** — משנה את manifest ושובר את ה-APK.
במקום זאת — החלפה ישירה של PNG בתוך ה-ZIP:

```python
from PIL import Image
import zipfile, io

def png_bytes(img, size):
    resized = img.resize((size, size), Image.LANCZOS)
    bg = Image.new("RGB", (size, size), (255, 255, 255))
    bg.paste(resized, mask=resized.split()[3] if resized.mode=="RGBA" else None)
    buf = io.BytesIO()
    bg.save(buf, "PNG")
    return buf.getvalue()

mipmap_sizes = {
    "res/mipmap-hdpi-v4/ic_launcher.png":    72,
    "res/mipmap-xhdpi-v4/ic_launcher.png":   96,
    "res/mipmap-xxhdpi-v4/ic_launcher.png":  144,
    "res/mipmap-xxxhdpi-v4/ic_launcher.png": 192,
}

logo = Image.open("logo.png").convert("RGBA")
with zipfile.ZipFile("original.apk", 'r') as zin:
    with zipfile.ZipFile("patched.apk", 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename in mipmap_sizes:
                data = png_bytes(logo, mipmap_sizes[item.filename])
            zout.writestr(item, data)

# לאחר מכן:
zipalign -f 4 patched.apk aligned.apk
apksigner sign --ks keystore.keystore --ks-key-alias ALIAS \
  --ks-pass pass:PASS --key-pass pass:PASS \
  --out final.apk aligned.apk
rm -f final.apk.idsig
```

**keystores:**
- יומן עבודה: `/tmp/yoman.keystore` | alias=app | pass=pass1234
- הנהלה רוחנית: `/tmp/yeshiva_new.keystore` | alias=yeshiva | pass=yeshiva123

---

## תהליך בניית APK — ניהול ישיבה (smali — לשינויים גדולים)
```bash
apktool b /tmp/ys_work -o /tmp/ys_built.apk
zipalign -f 4 /tmp/ys_built.apk /tmp/ys_aligned.apk
apksigner sign \
  --ks /tmp/yeshiva_new.keystore --ks-key-alias yeshiva \
  --ks-pass pass:yeshiva123 --key-pass pass:yeshiva123 \
  --out /mnt/user-data/outputs/yeshiva-manager.apk \
  /tmp/ys_aligned.apk
rm -f /mnt/user-data/outputs/yeshiva-manager.apk.idsig
```

---

## כללים קריטיים
1. אסור עברית ישירה ב-JS strings — חובה `String.fromCharCode()` או פונקציית `H()`
2. אחרי apksigner — תמיד למחוק `.idsig`
3. לעדכן `yeshiva-vXX` ב-sw.js בכל שינוי גדול
4. PDF עברי — pdfplumber לחילוץ, pypdf לפיצול
5. אחרי כל שינוי HTML — git add + commit + push
6. breakpoint מובייל: ≤800px
7. Samsung Galaxy A9 = 768px → דסקטופ ✓
8. git config: user.email "dev@yeshiva.com" / user.name "Dev"
9. **עדכון אייקון APK — שיטת zipfile בלבד, לא apktool recompile**

---

## מכשירים
| מכשיר | רוחב | גרסה |
|--------|-------|-------|
| Samsung Galaxy A9 (טאבלט) | 768px | דסקטופ |
| Samsung Galaxy F22Pro | 720px | מובייל |
| Qin (סיני) | ~720px | מובייל (נפתר ע"י ?apk=1) |

---

## workflow רגיל

**ניהול ישיבה:**
```bash
cd /tmp/yeshiva-manager
# [ערוך index.html + עדכן sw.js אם שינוי גדול]
git add . && git commit -m "תיאור" && \
git push https://TOKEN_YESHIVA@github.com/ygtotlrl-lab/yeshiva-manager.git main
```

**יומן עבודה:**
```bash
cd /tmp/yoman-avoda
# [ערוך יומן עבודה.html]
git add . && git commit -m "תיאור" && \
git push https://TOKEN_YOMAN@github.com/ygtotlrl-lab/yoman-avoda.git main
```

---

## הוראה לעוזר בתחילת שיחה
קרא קובץ זה, אמת שהבנת, ושאל אם משהו לא ברור לפני שמתחילים.
