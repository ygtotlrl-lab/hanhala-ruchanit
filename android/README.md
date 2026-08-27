# hanhala-ruchanit — Native WebView APK

A native Android **WebView** shell (not a TWA) that loads the **live site** over the
network:

```
https://ygtotlrl-lab.github.io/hanhala-ruchanit/
```

Built in the exact pattern of yoman-avoda's round-13 shell (the network-loading one),
with one deliberate difference — see "אין גשר שיתוף" below. Identical to schar-limud's
shell except for the identity (package, label, URL, colors, key).

## Why WebView and never a TWA

<!-- SHARED:start id="android-why-twa" -->
**Do not rebuild this as a TWA, and do not use PWABuilder** (it only produces
TWAs). A TWA is not a standalone component — it runs the site *inside Chrome*
and merely hides the address bar. The content filtering installed on the users'
devices blocks Chrome, so a TWA build never opens at all. A WebView renders
in-process and never goes through Chrome, so the filter does not touch it.
<!-- SHARED:end -->

This is measured, not theoretical: gius shipped a PWABuilder TWA and did not
open on the users' devices, while yoman and the old hanhala APK — both WebView — work.

## מה בפנים

| | |
|---|---|
| **Package ID** | `com.hanhala.ruchanit` |
| **טוען** | `https://ygtotlrl-lab.github.io/hanhala-ruchanit/` — **מהרשת**, לא מנכסים מוטבעים |
| **versionCode** | 7 — קודם בסבב 66 (עשרת קובצי ה-mipmap הוחלפו; חמישה קובצי `ic_launcher_foreground` שנדחפו בטעות אל `src/main/github.com/…` נמחקו אחרי מדידה של אפס קוראים). 6 — קודם בתיקון שאחרי סבב 60 (קיצור ההערה המשותפת ב-`ShellActivity`, שנעשה בסבב 60 בלי קידום). 5 — קודם בסבב 58 (הסרת `FLAG_ACTIVITY_NEW_TASK` ממסירת יעד חיצוני ל-`ACTION_VIEW`). 4 = סבב 46ב (היפוך ברירת המחדל בקובצי התצורה). 3 = סבב 45, 2 = סבב 41 (חילוץ המעטפת), 1 = המעטפת הראשונה בריפו הזה, טוענת מהרשת. (ה-APK הישן `yeshiva-manager.apk` נבנה מחוץ לריפו במפתח זמני — הוא איננו אב של המעטפת הזו, ר' CLAUDE.md) |
| **minSdk / targetSdk** | 21 / 34 |
| **WebView** | JavaScript, DOM storage (localStorage — שם יושבים מפתחות ה-`ys_*` וה-pending), DB. **בלי** גישת `file://` ובלי mixed content פתוח — האתר הוא https בלבד, `usesCleartextTraffic=false` |
| **ניווט** | כל `http`/`https` **נשאר בתוך המעטפת**. שאר הסכימות (`tel:`, `mailto:`, `whatsapp:`, …) נמסרות למערכת |
| **בורר קבצים** | `WebChromeClient.onShowFileChooser` מחובר ל-`<input type=file>` (ייבוא תלמידים מ-Excel) |
| **אופליין** | ה-service worker + העותק המקומי של האתר (`ys_*`). המעטפת מציגה דף שגיאה בעברית **רק** בהפעלה ראשונה בלי רשת |

<!-- SHARED:start id="android-web-update" -->
**עדכוני קוד web לא מצריכים APK חדש.** כל דחיפה ל-`main` מגיעה למכשירים דרך
אותו מנגנון service worker + באנר "גרסה חדשה זמינה" שכבר עובד בדפדפן. APK חדש
נדרש רק כששינוי נוגע במעטפת עצמה.
<!-- SHARED:end -->

## ⛔ אין גשר שיתוף — וזה ההבדל היחיד מהתבנית של יומן

למעטפת של yoman-avoda יש `AndroidShareBridge` (מוגבל-origin, בשני מנעולים) כי הדף
שלה קורא ל-`navigator.share` עם תמונת דו"ח. **בקוד של הנהלה רוחנית אין
`navigator.share` בכלל**, ולכן הגשר הושמט כליל — לא בצד Java, לא בצד הדף, לא
ב-manifest (אין `FileProvider`, אין `<queries>`) ולא בתלויות (אין androidx).

גשר מקורי על דף שנטען מהרשת הוא כוח שנמסר למי שמגיש את הדף. אם אי-פעם יידרש כאן
גשר — מעתיקים את הדפוס הכפול-נעילה של יומן (`WebViewCompat.addWebMessageListener`
עם `ALLOWED_ORIGINS`, ונפילה-חזרה שמחוברת רק על ה-origin שלנו). **לעולם לא
`addJavascriptInterface` חשוף.**

## למה אין נכסים מוטבעים

- ⛔ **`file://` הוא origin אחסון אחר.** ה-localStorage של `file://` ושל
  `https://ygtotlrl-lab.github.io` הן שתי מחיצות נפרדות לחלוטין. רישום נוכחות
  שנכתב לעותק מוטבע בעלייה ראשונה **לא נראה לאפליקציה האמיתית לעולם** — והוא גם
  לא יסונכרן, כי הסנכרון רץ בדף השני.
- **זה מקור אמת שני** — בדיוק מה שכלל קריטי 6 של הריפו אוסר. הוא מתיישן בכל שחרור.
- **מה שהוא אמור לפתור כבר פתור**: אחרי עלייה מוצלחת אחת, ה-service worker מגיש
  הכול אופליין והעותק המקומי (`ys_*` + מנוע המיזוג) עובד בלי רשת. המקרה היחיד
  שנשאר הוא **התקנה + הפעלה ראשונה בלי רשת בכלל** — ולהתקנת APK ממילא צריך רשת.
  במקרה הזה המעטפת מציגה דף שגיאה בעברית עם כפתור "נסה שוב".

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

⚠️ **וכאן זה קרה בפועל:** ה-APK הישן (`yeshiva-manager.apk`) נחתם במפתח זמני
שישב ב-`/tmp` ואבד, ולכן המעבר ממנו למעטפת הנוכחית הוא **הסרה + התקנה**
חד-פעמית — וההסרה מוחקת את מחיצת האחסון של האפליקציה הישנה.

<!-- SHARED:start id="android-icons" -->
## אייקונים

אייקוני המעטפת יושבים ב-`android/app/src/main/res/` — **עשרה קובצי `mipmap`**
(`ic_launcher.png` ו-`ic_launcher_foreground.png` בכל אחת מחמש הרזולוציות)
ו**קובץ XML אדפטיבי אחד**, `mipmap-anydpi-v26/ic_launcher.xml`, שהרקע שלו הוא
`res/drawable/ic_launcher_background.xml`.
⭐ **נמדד בארבעת הריפו — אותו מבנה בדיוק בכולן.**

⛔ **אין לערוך את קובצי ה-`mipmap` ידנית** — כולם נגזרים ממקור גרפי אחד, וכל
עריכה ידנית היא גרסה שנייה שתידרס בגזירה הבאה בלי שאיש יידע.
⚠️ **המקור עצמו נבדל פר-אפליקציה**, והוא מתועד בשורה שמתחת.
<!-- SHARED:end -->

### הסט כאן
- **המקור הגרפי היחיד = `design/icon-master.png`** (1024×1024, דיו `#18335c`
  על לבן). ⛔ **נכס עיצוב שאינו נטען בדף** (סבב 50) — 850KB לשום צורך;
  הלוגו במסך הכניסה ובכותרת מוגש מ-`icons/icon-512.png` שממילא ב-`CORE`.
  הסט נגזר ממנו ב-LANCZOS, ולצידו `icon-maskable-512.png` — הלוגו ב-72%
  במרכז קנבס לבן.
- **mipmap במעטפת:** `ic_launcher` (מלא על לבן) + `ic_launcher_foreground`
  (דיו שטוח על שקוף, הלוגו ב-66% מהקנבס) בכל חמש הרזולוציות, ואדפטיבי
  ב-`mipmap-anydpi-v26` עם רקע לבן.
- **אותה גיאומטריה משמשת את הסט הירוק של schar-limud** (דיו `#307535`;
  אומתה התאמה מבנית ≥99.9% בין הסטים בכל גודל).

<!-- SHARED:start id="android-shell-split" -->
## המעטפת — ליבה משותפת ומעטפת פר-אפליקציה (סבב 41)

`MainActivity.java` היה עד סבב 41 **ארבעה עותקים חופשיים** של אותה מעטפת:
hanhala ו-schar כמעט זהות בית-לבית, gius נבדלת בניסוח, ו-yoman כפולה בגלל
גשר השיתוף. שער החתימה של סבב 40 הקפיא את המצב, ⛔ אך לא איחד אותו.

מעכשיו הקוד מפוצל לשניים:

| קובץ | מה יש בו |
|---|---|
| `ShellActivity.java` | **הליבה המשותפת** — הגדרות ה-WebView, בורר הקבצים, `shouldOverrideUrlLoading`, דף האופליין, כפתור החזרה ושמירת המצב. ⭐ **זהה בית-לבית בארבעת הריפו** פרט לשורת ה-`package`. |
| `MainActivity.java` | **זהות בלבד** — הכתובת, משפט האופליין וצבע הכפתור, דרך שלוש מתודות. |

⛔ **אין להוסיף לוגיקה ל-`MainActivity`** (סבב 41) — התנהגות שנוספת
לאפליקציה אחת בלבד מחזירה בדיוק את ארבעת העותקים שהחילוץ החליף. מה שנחוץ
לכולן נכנס ל-`ShellActivity`; מה שנחוץ לאחת עובר דרך שתי הווים שהליבה
חושפת — `installBridge()` ו-`onShellNavigation(String)` — ונרשם כחריגה
מנומקת.

⚠️ **החריגה היחידה היום היא גשר השיתוף של yoman-avoda**, והיא מדודה: הליבה
נושאת חתימה אחת בארבעתן (`d8efd10bc6d47354`), ורק המעטפת של yoman נבדלת.
`tools/test_shell.mjs` אוכף את שתי החתימות, ו⛔ **נכשל אם נמצא גשר
בליבה** — גשר שם היה מגיע לארבע האפליקציות בבת אחת.
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

### המפתח הקבוע — ⛔ לעולם לא להחליף

| | |
|---|---|
| **קובץ** | `signing/hanhala.keystore` (PKCS12, RSA 2048) |
| **alias** | `hanhala` |
| **storepass / keypass** | `hanhala123` (זהה לשניהם) |
| **תוקף** | 10,000 יום — 10.08.2026 עד 26.12.2053 |
| **SHA256** | `9F:68:B5:A0:0E:FA:D1:2F:19:C6:FF:E7:05:8E:D0:61:79:92:E6:99:9F:34:74:12:66:B0:93:93:E4:E1:6D:BF` |
| **SHA1** | `D7:E5:DC:42:32:EC:4A:04:B0:64:40:3F:48:EA:2B:2F:C8:67:1E:59` |
| **DN** | `CN=hanhala, OU=Yeshiva, O=Yeshiva, L=Rishon LeZion, ST=Israel, C=IL` |

אימות: `keytool -list -v -keystore signing/hanhala.keystore -storepass hanhala123`,
ואחרי חתימה — ש-`apksigner verify --print-certs` מחזיר את אותו SHA256.

⚠️ **ה-APK הישן (`yeshiva-manager.apk`) נבנה מחוץ לריפו במפתח זמני שאבד**,
ולכן מעבר ממנו הוא **הסרה + התקנה** חד-פעמית. לפני המעבר לוודא באפליקציה
הישנה ש«⏳ ממתין לסנכרון» מציג **0**.

⚠️ **בסביבת הענן אין Android SDK ו-`dl.google.com` חסום** — הדרך המעשית היא
ה-workflow שלמעלה. ⛔ ולא PWABuilder: הוא יודע לייצר TWA בלבד.

### פרטי המעטפת
package `com.hanhala.ruchanit`, versionCode 3, minSdk 21 / targetSdk 34,
`usesCleartextTraffic=false`; ה-artifact הוא `hanhala-ruchanit-apk`.

<!-- SHARED:start id="context-smali-scope" -->
## תיקון URL ב-APK קיים ובנוי (בלי מקור) — smali בלבד

⚠️ **הפרק הזה רלוונטי רק ל-APK ישן שנבנה לפני `android/`.** בנייה רגילה היום
היא מ-`android/` דרך `.github/workflows/build-apk.yml`, והמעטפת טוענת מהרשת —
ולכן אין בה URL שצריך לתקן.
⛔ **smali בלבד — לא binary patch.** עריכה בינארית של ה-APK שוברת את החתימה
ואינה ניתנת לאימות, ⛔ והחתימה מחדש היא במפתח הקבוע של הריפו בלבד — ר' הפרק
«חתימת APK» ב-CLAUDE.md.
<!-- SHARED:end -->

```bash
apktool d <app>.apk -o /tmp/hanhala_work -f
# תקן את ה-URL ב-MainActivity.smali ו-MainActivity$2.smali
rm -rf /tmp/hanhala_work/build          # חובה לפני בנייה חוזרת
apktool b /tmp/hanhala_work -o built.apk
zipalign -f 4 built.apk aligned.apk
apksigner sign --ks signing/hanhala.keystore --ks-key-alias hanhala \
  --ks-pass pass:hanhala123 --key-pass pass:hanhala123 --out output.apk aligned.apk
```

⚠️ **המפתח הישן שישב ב-`/tmp` אבד**, והמפתח הקבוע הוא
`signing/hanhala.keystore`; לכן מעבר מה-APK הישן הוא **הסרה + התקנה**
חד-פעמית.

<!-- SHARED:start id="context-cache-apk" -->
### ⚠️ Cache APK — כלל זהב

שם קובץ חוזר נתפס במטמון — של הדפדפן, של מנהל ההורדות ושל המכשיר — והמשתמש
מתקין שוב את הבנייה **הקודמת** בלי לדעת. ⛔ **תמיד שם חדש בכל בנייה**, עם
חותמת זמן:
<!-- SHARED:end -->

```bash
TS=$(date +%s) && apksigner sign ... --out hanhala-${TS}.apk
```
