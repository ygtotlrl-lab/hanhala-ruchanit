# הנהלה רוחנית — קונטקסט פיתוח

## פרטי ריפו
- **ריפו:** `ygtotlrl-lab/hanhala-ruchanit` (שונה מ-`yeshiva-manager`)
- **GitHub Pages:** `https://ygtotlrl-lab.github.io/hanhala-ruchanit/`
- **טוקן:** TOKEN_IN_MEMORY
- **קובץ ראשי:** `index.html`

---

## APK — שיטה עובדת

### Keystore
- `/tmp/yeshiva.keystore` | alias=yeshiva | pass=yeshiva123

### תהליך
```bash
# 1. פרוק
apktool d hanhala-ruchanit.apk -o /tmp/hanhala_work -f

# 2. תקן URLs ב-smali (לא binary!)
# קבצים: MainActivity.smali, MainActivity$2.smali
old = 'https://ygtotlrl-lab.github.io/yeshiva-manager/'
new = 'https://ygtotlrl-lab.github.io/hanhala-ruchanit/'

# 3. החלף אייקון - הקובץ הנכון: בלוי_מיט_ווייסן_הינטערגרונט.png
# res/mipmap-*/ic_launcher.png + assets/icons/*.png

# 4. מחק build לפני בנייה!
rm -rf /tmp/hanhala_work/build

# 5. בנה וחתום
apktool b /tmp/hanhala_work -o built.apk
zipalign -f 4 built.apk aligned.apk
apksigner sign --ks /tmp/yeshiva.keystore --ks-key-alias yeshiva \
  --ks-pass pass:yeshiva123 --key-pass pass:yeshiva123 \
  --out output.apk aligned.apk
```

### ⚠️ Cache APK
Claude.ai שומר cache לפי שם קובץ. אם גודל לא תואם — השתמש בשם חדש:
```bash
TS=$(date +%s) && apksigner sign ... --out /mnt/user-data/outputs/hanhala-${TS}.apk
```

---

## כללים קריטיים לפיתוח

1. **node --check לפני כל push** — חובה מוחלטת
2. **`async\nfunction`** — אסור רווח בין async לfunction
3. **`H()` גלובלי** — אסור `var X = [H(...)]` גלובלי
4. **`onclick` בHTML** — חובה `window.functionName()`
5. **גרשיים בתוך onclick** — השתמש ב-`onclick="f(\"x\")"` 

```python
import re, subprocess
content = open('/tmp/yeshiva-manager/index.html').read()
scripts = re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>', content, re.DOTALL)
with open('/tmp/test_syntax.js','w') as f: f.write('\n'.join(scripts))
r = subprocess.run(['node','--check','/tmp/test_syntax.js'],capture_output=True,text=True)
print("✅ OK" if r.returncode==0 else "❌ "+r.stderr[:300])
```

---

## מודול PDF נוכחות

### ספרייה
**pdfmake** (הוחלפה מ-html2pdf בגלל בעיות מירכוז RTL)
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>
```

### מבנה PDF
- כותרת: ישיבת תומכי תמימים ראשל"צ
- תאריך: `DD.M.YYYY — דוח נוכחות` (direction:ltr)
- קו מפריד כחול
- שורת סיכום: `סה"כ: X | נוכחים: Y | נעדרים: Z` (canvas image)
- טבלת נוכחים (כחול) + טבלת נעדרים (אדום)

### שורת סיכום — canvas
נצוייר כתמונה כדי לעקוף בעיות RTL. סדר ציור: סה"כ → נעדרים → נוכחים (html2pdf הופך).
עם pdfmake — columns ישירות, אין צורך בcanvas.

---

## מצב נוכחי
- מודול מצבת תלמידים ✅ (75 תלמידים, 3 שיעורות א/ב/ג)
- PDF נוכחות ✅ (pdfmake)
- הגדרות ✅
- PWA auto-reload ✅
- APK מעודכן ✅

## פרטי מערכת
- localStorage: `ys_students`, `ys_admin`
- סיסמת admin: `yeshiva2024`
- לוגו: `logo.jpg` בריפו עם `border-radius:14px`
