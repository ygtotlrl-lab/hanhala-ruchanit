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

**git push:**
```
git push https://TOKEN@github.com/ygtotlrl-lab/yoman-avoda.git main
```

---

## אפליקציה 2 — ניהול ישיבה

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

**Service Worker:** `/tmp/yeshiva-manager/sw.js` | cache נוכחי: yeshiva-v15 ← לעדכן בכל שינוי גדול

**APK smali:**
- `/tmp/ys_work/smali/com/yeshiva/manager/MainActivity.smali`
- package: com.yeshiva.manager
- ONLINE_URL = OFFLINE_URL = https://ygtotlrl-lab.github.io/yeshiva-manager/?apk=1
- setUseWideViewPort(false) | setLoadWithOverviewMode(false)

**keystore:** `/tmp/yeshiva.keystore` | alias=yeshiva | storepass/keypass=yeshiva123

**git push:**
```
git push https://TOKEN@github.com/ygtotlrl-lab/yeshiva-manager.git main
```

---

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

## תהליך בניית APK — ניהול ישיבה
```bash
apktool b /tmp/ys_work -o /tmp/ys_built.apk
zipalign -f 4 /tmp/ys_built.apk /tmp/ys_aligned.apk
apksigner sign \
  --ks /tmp/yeshiva.keystore --ks-key-alias yeshiva \
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
