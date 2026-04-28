# יומן עבודה — קונטקסט פיתוח

## פרטי ריפו
- **ריפו:** `ygtotlrl-lab/yoman-avoda`
- **GitHub Pages:** `https://ygtotlrl-lab.github.io/yoman-avoda/`
- **קובץ ראשי:** `index.html`
- **טוקן:** `TOKEN_IN_MEMORY`
- **Supabase project:** `kxbtskqobynewvnckaaz`

---

## בניית APK — שיטה עובדת

### כלים
```
apktool, zipalign, apksigner
keystore: /tmp/yoman.keystore | alias=yoman | pass=yoman123
```

### תהליך נכון אחת ולתמיד

```python
# 1. פרוק את ה-APK המקורי
apktool d yoman-avoda.apk -o /tmp/yw_work -f

# 2. תקן URL ב-smali (לא binary patch!)
# קבצים: MainActivity.smali, MainActivity$2.smali
# החלף: יומן%20עבודה.html → index.html
old = 'https://ygtotlrl-lab.github.io/yoman-avoda/%D7%99%D7%95%D7%9E%D7%9F%20%D7%A2%D7%91%D7%95%D7%93%D7%94.html'
new = 'https://ygtotlrl-lab.github.io/yoman-avoda/index.html'

# 3. החלף אייקון בכל מיקום (חובה!)
# res/mipmap-hdpi-v4/ic_launcher.png      → 72px
# res/mipmap-xhdpi-v4/ic_launcher.png     → 96px
# res/mipmap-xxhdpi-v4/ic_launcher.png    → 144px
# res/mipmap-xxxhdpi-v4/ic_launcher.png   → 192px
# assets/icons/icon-192.png               → 192px
# assets/icons/icon-512.png               → 512px
# assets/icons/apple-touch-icon.png       → 180px
# assets/icons/favicon-32.png             → 32px
# assets/icons/favicon-16.png             → 16px

# 4. עדכן assets
# assets/index.html ← גרסה עדכנית מהריפו
# assets/manifest.json ← מהריפו
# assets/sw.js ← מהריפו

# 5. מחק תיקיית build לפני בנייה!
rm -rf /tmp/yw_work/build

# 6. בנה, zipalign, חתום
apktool b /tmp/yw_work -o built.apk
zipalign -f 4 built.apk aligned.apk
apksigner sign --ks /tmp/yoman.keystore --ks-key-alias yoman \
  --ks-pass pass:yoman123 --key-pass pass:yoman123 \
  --out output.apk aligned.apk
```

---

## ⚠️ בעיית Cache של APK — פתרון מחייב

### הבעיה
Claude.ai שומר cache על קבצי output לפי **שם הקובץ**. אם `yoman-avoda.apk` כבר הוצג בסשן — הקובץ הישן יוצג שוב גם אחרי בנייה חדשה.

### סימן לזיהוי הבעיה
גודל הקובץ המוצג שונה מהגודל האמיתי (למשל 296KB במקום 454KB).

### הפתרון המחייב
**תמיד לחתום ל-output path חדש שלא היה בשימוש בסשן הנוכחי.**

```bash
# שלב 1: חתום לשם חדש לגמרי
apksigner sign ... --out /mnt/user-data/outputs/yoman-avoda.apk aligned.apk

# שלב 2: אם הגודל המוצג ישן — השתמש בשם אחר
# דוגמאות שעבדו: yoman-ok.apk, yoman.apk, diary.apk
```

### כלל זהב
אם הקובץ שמוצג למשתמש הוא בגודל ישן — **אל תנסה לשנות שם של קובץ קיים, אלא צור output חדש לגמרי עם שם שלא היה בשימוש.**

### פתרון timestamp — מחייב כשכל השמות תפוסים
אם כל השמות הסבירים תפוסים ב-cache, הוסף timestamp לשם:
```bash
TS=$(date +%H%M%S)
apksigner sign ... --out /mnt/user-data/outputs/yoman-${TS}.apk aligned.apk
```
זה מבטיח שם ייחודי שאף פעם לא היה ב-cache.

---

## אייקון נכון
- **קובץ:** `גרין_מיט_ווייסן_הינטערגרונט.png` (לוגו ירוק על רקע לבן)
- **מיקום בסשן:** `/mnt/user-data/uploads/גרין_מיט_ווייסן_הינטערגרונט.png`
- **לא להשתמש ב:** `choice-icon-512.png` (מכיל רקע ירוק עם מסגרת — שגוי!)

### בדיקת אייקון (חובה לפני שחרור)
```python
import zipfile, io, numpy as np
from PIL import Image
with zipfile.ZipFile('output.apk', 'r') as z:
    for p in [f for f in z.namelist() if f.endswith('.png')]:
        arr = np.array(Image.open(io.BytesIO(z.read(p))).convert('RGBA'))
        corner = arr[0,0][:3]
        ok = all(c > 200 for c in corner)  # פינה לבנה = נכון
        print('✅' if ok else '❌', p, corner)
```

---

## URLs בתוך ה-APK
- **ONLINE_URL:** `https://ygtotlrl-lab.github.io/yoman-avoda/index.html`
- **OFFLINE_URL:** `file:///android_asset/index.html`
- APK טוען ONLINE קודם, ואם נכשל — OFFLINE מ-assets

## שגיאת 404
אם האפליקציה מציגה 404 — ה-URL עדיין ישן. **לתקן תמיד ב-smali, לא ב-binary patch.**

