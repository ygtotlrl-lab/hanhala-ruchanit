# הנהלה רוחנית — CLAUDE.md

## סביבת עבודה
- **ריפו:** `ygtotlrl-lab/hanhala-ruchanit`
- **Pages:** `https://ygtotlrl-lab.github.io/hanhala-ruchanit/`
- **טוקן:** `TOKEN_IN_MEMORY`
- **קובץ ראשי:** `index.html`
- **Supabase:** `kxbtskqobynewvnckaaz`

## התחלת סשן — חובה
```bash
# שכפל את הריפו
git clone https://TOKEN_IN_MEMORY@github.com/ygtotlrl-lab/hanhala-ruchanit.git /tmp/yeshiva-manager
cd /tmp/yeshiva-manager
git config user.email "dev@yeshiva.com" && git config user.name "Dev"
```

## לפני כל push — חובה
```bash
python3 -c "
import re, subprocess
content = open('/tmp/yeshiva-manager/index.html').read()
scripts = re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>', content, re.DOTALL)
with open('/tmp/test_syntax.js','w') as f: f.write('\n'.join(scripts))
r = subprocess.run(['node','--check','/tmp/test_syntax.js'],capture_output=True,text=True)
print('✅ OK' if r.returncode==0 else '❌ '+r.stderr[:300])
"
```

## Push
```bash
cd /tmp/yeshiva-manager
git add . && git commit -m "תיאור השינוי"
git push https://TOKEN_IN_MEMORY@github.com/ygtotlrl-lab/hanhala-ruchanit.git main
```

## כללים קריטיים
1. **node --check לפני כל push** — חובה מוחלטת
2. **אסור `async\nfunction`** — אסור רווח/שורה בין async לfunction
3. **`H()` גלובלי** — אסור `var X = [H(...)]` גלובלי
4. **`onclick`** — חובה `window.functionName()`
5. **גרשיים בתוך onclick** — `onclick="f(\"x\")"` בלבד

## APK
- Keystore: `/tmp/yeshiva.keystore` | alias=yeshiva | pass=yeshiva123
- אייקון: `בלוי_מיט_ווייסן_הינטערגרונט.png` (כחול על לבן)
- URLs ב-smali: `https://ygtotlrl-lab.github.io/hanhala-ruchanit/`
- cache APK: תמיד `TS=$(date +%s)` בשם הקובץ

## PDF
- ספרייה: **pdfmake** (לא html2pdf — בעיות RTL)
- Scripts:
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>
  ```
- `defaultStyle: { font: 'Roboto', alignment: 'right' }`

## מצב נוכחי
- מצבת תלמידים ✅ (75 תלמידים, שיעורות א/ב/ג)
- PDF נוכחות ✅ (pdfmake)
- הגדרות ✅
- PWA auto-reload ✅
