# הנהלה רוחנית — CLAUDE.md

## סביבת עבודה
- **ריפו:** `ygtotlrl-lab/hanhala-ruchanit`
- **Pages:** `https://ygtotlrl-lab.github.io/hanhala-ruchanit/`
- **קובץ ראשי:** `index.html`
- **טוקן:** `TOKEN_IN_MEMORY`
- **push:** `git push https://TOKEN@github.com/ygtotlrl-lab/hanhala-ruchanit.git main`

## כללים — חובה לפני כל push
1. `node --check index.html` — חובה מוחלטת
2. אין `async function` עם רווח בין המילים
3. אין `var X = [H(...)]` גלובלי — תמיד `function getX() { return [...] }`
4. `onclick` ב-HTML — תמיד `window.functionName()`
5. גרשיים בתוך onclick — `onclick="f(\"x\")"` ולא `onclick="f('x')"`

## בדיקת syntax
```bash
python3 -c "
import re, subprocess
c = open('index.html').read()
scripts = re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>', c, re.DOTALL)
open('/tmp/check.js','w').write('\n'.join(scripts))
r = subprocess.run(['node','--check','/tmp/check.js'],capture_output=True,text=True)
print('✅ OK' if r.returncode==0 else '❌ '+r.stderr[:300])
"
```

## APK
- **Keystore:** `/tmp/yeshiva.keystore` | alias=`yeshiva` | pass=`yeshiva123`
- **אייקון:** `בלוי_מיט_ווייסן_הינטערגרונט.png` (לוגו כחול על לבן)
- תיקון URLs — תמיד ב-smali, לא binary patch
- מחק `/tmp/hanhala_work/build` לפני בנייה
- cache APK: תמיד שם חדש `hanhala-$(date +%s).apk`

## PDF
- ספרייה: **pdfmake** (לא html2pdf — בעיות RTL)
- Scripts: cdnjs pdfmake 0.2.7
- `defaultStyle: {font: 'Roboto', alignment: 'right'}`
- pageMargins: `[40, 40, 40, 40]`

## ארכיטקטורה
- SPA אחד — `index.html`
- נווט בין מודולים עם `data-pg` attributes
- Supabase: `kxbtskqobynewvnckaaz` — טבלת `kv` (key-value sync)
- polling כל 3 שניות
- localStorage לנתונים מקומיים

## מצב נוכחי
- מצבת תלמידים ✅ (75 תלמידים, שיעורות א/ב/ג)
- PDF נוכחות ✅ (pdfmake)
- הגדרות ✅
- PWA auto-reload ✅
