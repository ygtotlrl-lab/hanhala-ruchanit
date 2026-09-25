# הנהלה רוחנית — Native WebView APK

A native Android **WebView** shell (not a TWA) that loads the **live site** over the
network:

```
https://ygtotlrl-lab.github.io/hanhala-ruchanit/
```

## מה בפנים

| | |
|---|---|
| **Package ID** | `com.hanhala.ruchanit` |
| **טוען** | `https://ygtotlrl-lab.github.io/hanhala-ruchanit/` — **מהרשת**, לא מנכסים מוטבעים |
| **versionCode** | 19 — ⛔ עולה בכל שינוי תחת `android/`: ⚠️ מכשיר אינו מתקין מעל גרסה שאינה גבוהה ממנה |
| **minSdk / targetSdk** | 21 / 34 |
| **WebView** | JavaScript, DOM storage (localStorage — שם יושבים מפתחות ה-`hr_*` וה-pending), DB. **בלי** גישת `file://` ובלי mixed content פתוח — האתר הוא https בלבד, `usesCleartextTraffic=false` |
| **ניווט** | כל `http`/`https` **נשאר בתוך המעטפת**. שאר הסכימות (`tel:`, `mailto:`, `whatsapp:`, …) נמסרות למערכת |
| **בורר קבצים** | `WebChromeClient.onShowFileChooser` מחובר ל-`<input type=file>` (ייבוא תלמידים מ-Excel) |
| **אופליין** | ה-service worker + העותק המקומי של האתר (`hr_*`). המעטפת מציגה דף שגיאה בעברית **רק** בהפעלה ראשונה בלי רשת |

<!-- SHARED:start id="android-web-update" -->
**עדכוני קוד web לא מצריכים APK חדש.** כל דחיפה ל-`main` מגיעה למכשירים דרך
אותו מנגנון service worker + באנר "גרסה חדשה זמינה" שכבר עובד בדפדפן. APK חדש
נדרש רק כששינוי נוגע במעטפת עצמה.
<!-- SHARED:end -->

<!-- SHARED:start id="android-origin-switch" -->
## ⚠️ מעבר-origin חד-פעמי — ולפני כל הפצת APK

ה-WebView של האפליקציה מחזיק **מחיצת אחסון משלו**, נפרדת מזו של הדפדפן באותו
מכשיר. מי שעבד עד עכשיו בדפדפן ועובר ל-APK מתחיל עם localStorage **ריק**:
כניסה מחדש, והעותק המקומי נטען מהענן — שהוא ממילא מקור האמת.

⛔ **מה שכן יכול ללכת לאיבוד: רשומה שנרשמה במכשיר וטרם עלתה לענן.** לכן —
**לפני כל הפצת APK, ודא בכל מכשיר שההגדרות ← «⏳ ממתין לסנכרון» מציג 0.**
רשומה שמסומנת ⏳ יושבת רק באותה מחיצת אחסון, ומעבר ה-origin ישאיר אותה מאחור.

⚠️ **ואותו מעבר קורה גם בהחלפת חתימה, לא רק בהחלפת origin:** התקנה ראשונה של
בנייה שנחתמה במפתח קבוע חדש מחייבת **הסרה חד-פעמית** של האפליקציה הישנה
(חתימה שונה ⇒ אנדרואיד רואה אפליקציה זרה ⇒ `INSTALL_FAILED_UPDATE_INCOMPATIBLE`),
וההסרה מוחקת את מחיצת האחסון שלה. מאותה נקודה ואילך ההתקנות חלקות.
⛔ **גם כאן «⏳ ממתין לסנכרון» נבדק לפני ההסרה ולא אחריה** — אחריה כבר אין מה
לבדוק.
<!-- SHARED:end -->

⚠️ **וכאן זה קרה בפועל:** ה-APK הראשון נחתם במפתח זמני שישב ב-`/tmp` ואבד,
ולכן המעבר ממנו למעטפת הנוכחית הוא **הסרה + התקנה** חד-פעמית —
וההסרה מוחקת את מחיצת האחסון של האפליקציה הישנה.

<!-- SHARED:start id="android-icons" -->
## אייקונים

אייקוני המעטפת יושבים ב-`android/app/src/main/res/` — **עשרה קובצי `mipmap`**
(`ic_launcher.png` ו-`ic_launcher_foreground.png` בכל אחת מחמש הרזולוציות)
ו**קובץ XML אדפטיבי אחד**, `mipmap-anydpi-v26/ic_launcher.xml`, שהרקע שלו הוא
`res/drawable/ic_launcher_background.xml`.
⭐ **נמדד בכל הריפו — אותו מבנה בדיוק בכולן.**

⛔ **אין לערוך את קובצי ה-`mipmap` ידנית** — כולם נגזרים ממקור גרפי אחד, וכל
עריכה ידנית היא גרסה שנייה שתידרס בגזירה הבאה בלי שאיש יידע.
⚠️ **המקור עצמו נבדל פר-אפליקציה**, והוא מתועד בשורה שמתחת.
<!-- SHARED:end -->

### הסט כאן
- **המקור הגרפי היחיד** — ⚠️ **המאסטר הוא `design/icon-master.png`** (1024×1024, דיו `#18335c`
  על לבן). ⛔ **נכס עיצוב שאינו נטען בדף** — 850KB לשום צורך;
  הלוגו במסך הכניסה ובכותרת מוגש מאייקון ה-512 שב-`icons/`, שממילא ב-`CORE`.
  הסט נגזר ממנו ב-LANCZOS, ולצידו אייקון המסכה — הלוגו ב-72%
  במרכז קנבס לבן.
- **mipmap במעטפת:** `ic_launcher` (מלא על לבן) + `ic_launcher_foreground`
  (דיו שטוח על שקוף, הלוגו ב-66% מהקנבס) בכל חמש הרזולוציות, ואדפטיבי
  ב-`mipmap-anydpi-v26` עם רקע לבן.
- **אותה גיאומטריה משמשת גם סט ירוק** (דיו `#307535`;
  אומתה התאמה מבנית ≥99.9% בין הסטים בכל גודל).

<!-- SHARED:start id="android-shell-split" -->
## המעטפת — ליבה משותפת ומעטפת פר-אפליקציה

⛔ **שני קובצי ה-Java נוצרים מהתצורה** — `node tools/gen-app.mjs`, מהתבניות
שב-`tools/java/`: ⚠️ ואין עורכים אותם ביד, ⭐ ו-`--check` מפיל כשהעץ נבדל.

| קובץ | מה יש בו |
|---|---|
| `ShellActivity.java` | **הליבה המשותפת** — הגדרות ה-WebView, בורר הקבצים, `shouldOverrideUrlLoading`, דף האופליין, כפתור החזרה ושמירת המצב. ⭐ תבנית אחת, ושורת ה-`package` היא ההבדל היחיד. |
| `MainActivity.java` | **זהות בלבד** — הכתובת, משפט האופליין וצבע הכפתור, מ-`android` שבתצורה, דרך שלוש מתודות. |

⛔ **אין להוסיף לוגיקה ל-`MainActivity`** — התנהגות שנוספת לאפליקציה אחת
בלבד היא עותק חופשי של המעטפת. מה שנחוץ לכולן נכנס לתבנית של
`ShellActivity`; מה שנחוץ לאחת עובר דרך שתי הווים שהליבה חושפת —
`installBridge()` ו-`onShellNavigation(String)` — ומוצהר בתצורה.

⚠️ **גשר השיתוף נוצר רק כש-`android.share` מוצהר בתצורה** — קטע `//@@share`
בתבנית, ⭐ שיורד כולו כשאינו מוצהר. ⛔ **ואין גשר בליבה** — גשר שם היה מגיע
לכל האפליקציות בבת אחת.
<!-- SHARED:end -->

## Build

### הדרך המומלצת — GitHub Actions (לא צריך שום דבר מותקן)

`.github/workflows/build-apk.yml`: Actions → **Build APK** → **Run workflow**.
ה-APK **החתום** יורד כ-artifact בשם `hanhala-ruchanit-apk`.

### בנייה מקומית (דורשת Android SDK + Gradle)

```bash
cd android
gradle :app:assembleRelease        # או: ./gradlew :app:assembleRelease
# Unsigned APK output:
#   android/app/build/outputs/apk/release/app-release-unsigned.apk
```

## Sign with the PERMANENT key (required so it installs over previous builds)

```bash
../signing/sign-apk.sh app/build/outputs/apk/release/app-release-unsigned.apk hanhala-ruchanit.apk
```

### פרטי המפתח הקבוע

| | |
|---|---|
| **קובץ** | ⛔ אינו בריפו — GitHub Secret `KEYSTORE_B64`, מפוענח לקובץ זמני בזמן בנייה ונמחק אחריה (PKCS12, RSA 4096) |
| **alias** | ⛔ אינו מוקלד — `sign-apk.sh` גוזר אותו מהמפתח עצמו |
| **storepass / keypass** | ⛔ אינה בריפו — GitHub Secret `KEYSTORE_PASS` |
| **תוקף** | 10,000 יום — 2026-09-15 עד 2054-01-31 |
| **SHA256** | `1A:FA:BE:D0:A6:60:EF:F6:FF:40:04:C9:32:F5:A7:E3:28:01:95:4E:FA:24:FF:A4:B5:79:DF:BE:2F:B4:07:4A` |
| **SHA1** | `D6:9E:A6:1A:17:F4:B7:3D:57:90:7E:B7:66:FC:0C:04:67:96:97:9D` |
| **DN** | `CN=hanhala, OU=Yeshiva, O=Yeshiva, L=Rishon LeZion, ST=Israel, C=IL` |

אימות: `keytool -list -v -keystore <עותק מקומי> -storepass <הערך שב-KEYSTORE_PASS>`,
ואחרי חתימה — ש-`apksigner verify --print-certs` מחזיר את אותו SHA256.

⚠️ **ה-APK הראשון נבנה מחוץ לריפו במפתח זמני שאבד**,
ולכן מעבר ממנו הוא **הסרה + התקנה** חד-פעמית. לפני המעבר לוודא באפליקציה
הישנה ש«⏳ ממתין לסנכרון» מציג **0**.

⚠️ **בסביבת הענן אין Android SDK ו-`dl.google.com` חסום** — הדרך המעשית
היא ה-workflow. ⛔ ולא PWABuilder: הוא יודע לייצר TWA בלבד.

### פרטי המעטפת
package `com.hanhala.ruchanit`, versionCode 3, minSdk 21 / targetSdk 34,
`usesCleartextTraffic=false`; ה-artifact הוא `hanhala-ruchanit-apk`.

<!-- SHARED:start id="android-smali-scope" -->
## תיקון URL ב-APK קיים ובנוי (בלי מקור) — smali בלבד

⚠️ **הפרק הזה רלוונטי רק ל-APK ישן שנבנה לפני `android/`.** בנייה רגילה היום
היא מ-`android/` דרך `.github/workflows/build-apk.yml`, והמעטפת טוענת מהרשת —
ולכן אין בה URL שצריך לתקן.
⛔ **smali בלבד — לא binary patch.** עריכה בינארית של ה-APK שוברת את החתימה
ואינה ניתנת לאימות, ⛔ והחתימה מחדש היא במפתח הקבוע של הריפו בלבד — ר' הפרק
«Sign with the PERMANENT key» שלמעלה.
⭐ **שני הקבצים שנושאים את ה-URL הם `MainActivity.smali` ו-`MainActivity$2.smali`**
— ⛔ וההוראה זהה בכל הריפו; הכתובת עצמה, שם תיקיית העבודה והמפתח הם
פר-אפליקציה, ⛔ ויושבים בבלוק שמתחת.
<!-- SHARED:end -->

```bash
apktool d <app>.apk -o /tmp/hanhala_work -f
rm -rf /tmp/hanhala_work/build          # חובה לפני בנייה חוזרת
apktool b /tmp/hanhala_work -o built.apk
zipalign -f 4 built.apk aligned.apk
SIGN_KEYSTORE=<עותק מקומי של המפתח> SIGN_PASS=<הערך שב-KEYSTORE_PASS> \
  signing/sign-apk.sh aligned.apk output.apk
```

⚠️ **המפתח הישן שישב ב-`/tmp` אבד**, והמפתח הקבוע הוא
`signing/hanhala.keystore` — ⛔ הקובץ אינו בריפו, ⚠️ והוא נמשך
מ-GitHub Secrets בזמן הבנייה; לכן מעבר מה-APK הישן הוא **הסרה + התקנה**
חד-פעמית.

<!-- SHARED:start id="android-cache-apk" -->
### ⚠️ Cache APK — כלל זהב

שם קובץ חוזר נתפס במטמון — של הדפדפן, של מנהל ההורדות ושל המכשיר — והמשתמש
מתקין שוב את הבנייה **הקודמת** בלי לדעת. ⛔ **תמיד שם חדש בכל בנייה**, עם
חותמת זמן:
<!-- SHARED:end -->

```bash
TS=$(date +%s) && apksigner sign ... --out hanhala-${TS}.apk
```
