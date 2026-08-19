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

**Do not rebuild this as a TWA, and do not use PWABuilder** (it only produces
TWAs). A TWA is not a standalone component — it runs the site *inside Chrome*
and merely hides the address bar. The content filtering installed on the users'
devices blocks Chrome, so a TWA build never opens at all. A WebView renders
in-process and never goes through Chrome, so the filter does not touch it.

This is measured, not theoretical: gius shipped a PWABuilder TWA and did not
open on the users' devices, while yoman and the old hanhala APK — both WebView — work.

## מה בפנים

| | |
|---|---|
| **Package ID** | `com.hanhala.ruchanit` |
| **טוען** | `https://ygtotlrl-lab.github.io/hanhala-ruchanit/` — **מהרשת**, לא מנכסים מוטבעים |
| **versionCode** | 2 — קודם בסבב 41 (חילוץ המעטפת). 1 = המעטפת הראשונה בריפו הזה, טוענת מהרשת. (ה-APK הישן `yeshiva-manager.apk` נבנה מחוץ לריפו במפתח זמני — הוא איננו אב של המעטפת הזו, ר' CLAUDE.md) |
| **minSdk / targetSdk** | 21 / 34 |
| **WebView** | JavaScript, DOM storage (localStorage — שם יושבים מפתחות ה-`ys_*` וה-pending), DB. **בלי** גישת `file://` ובלי mixed content פתוח — האתר הוא https בלבד, `usesCleartextTraffic=false` |
| **ניווט** | כל `http`/`https` **נשאר בתוך המעטפת**. שאר הסכימות (`tel:`, `mailto:`, `whatsapp:`, …) נמסרות למערכת |
| **בורר קבצים** | `WebChromeClient.onShowFileChooser` מחובר ל-`<input type=file>` (ייבוא תלמידים מ-Excel) |
| **אופליין** | ה-service worker + העותק המקומי של האתר (`ys_*`). המעטפת מציגה דף שגיאה בעברית **רק** בהפעלה ראשונה בלי רשת |

**עדכוני קוד web לא מצריכים APK חדש.** כל דחיפה ל-`main` מגיעה למכשירים דרך
אותו מנגנון service worker + באנר "גרסה חדשה זמינה" שכבר עובד בדפדפן. APK חדש
נדרש רק כששינוי נוגע במעטפת עצמה.

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

### ⚠️ מעבר-origin חד-פעמי: דפדפן / APK ישן ← APK חדש
ה-WebView של האפליקציה מחזיק **מחיצת אחסון משלו**, נפרדת מזו של הדפדפן באותו
מכשיר. מי שעבד עד עכשיו בדפדפן ועובר ל-APK מתחיל עם localStorage **ריק**: כניסה
מחדש, והעותק המקומי נטען מהענן — שהוא ממילא מקור האמת.

⛔ **מה שכן יכול ללכת לאיבוד: רשומה שנרשמה בדפדפן וטרם עלתה לענן.** לכן —
**לפני מעבר מכשיר ל-APK, ודא בדפדפן שההגדרות ← «⏳ ממתין לסנכרון» מציג 0.**
רשומה שמסומנת ⏳ יושבת רק באותה מחיצת אחסון, ומעבר ה-origin ישאיר אותה מאחור.
(אותו כלל חל גם במעבר מה-APK הישן `yeshiva-manager.apk`: חתימה שונה ⇒ הסרה
והתקנה ⇒ המחיצה של האפליקציה הישנה נמחקת עם ההסרה.)

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
`tools/test_round40_shell.mjs` אוכף את שתי החתימות, ו⛔ **נכשל אם נמצא גשר
בליבה** — גשר שם היה מגיע לארבע האפליקציות בבת אחת.

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

או ידנית — ר' הפרק "חתימת APK" ב-CLAUDE.md (מפתח `signing/hanhala.keystore`,
alias `hanhala`). אחרי חתימה מאמתים שה-SHA256 תואם לטבלה שם.
