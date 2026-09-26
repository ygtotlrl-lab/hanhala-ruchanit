/* ═══ app.config.js — תצורת האפליקציה ════════════════════════════════════
   ⛔ המקום היחיד של ערכי האפליקציה — ⚠️ הדפדפן טוען אותו בתג, ה-service
      worker ב-`importScripts`, והכלים ב-`tools/gen-app.mjs`: ⭐ ערך שכתוב
      במקום שני הוא שני מקורות שמתיישנים זה מול זה.
   ⛔ קובצי הפלטפורמה נוצרים מכאן — ⚠️ `node tools/gen-app.mjs`, ⭐ ומי שעורך
      אותם ביד נדרס בהרצה הבאה.
   ════════════════════════════════════════════════════════════════════ */
self.APP = Object.freeze({
  /*  ⛔ שם הריפו — ⚠️ ממנו נגזרים ה-scope, קידומת המטמון ושם הפרויקט באנדרואיד. */
  id: 'hanhala-ruchanit',
  name: 'הנהלה רוחנית',
  shortName: 'הנהלה רוחנית',
  description: 'מערכת ניהול הנהלה רוחנית לישיבה',
  /*  ⛔ תחילית הטבלאות והאחסון — ⚠️ כל אות בה פותחת מילה בשם הריפו, בסדר. */
  prefix: 'hr_',
  colors: { theme: '#1a3c6e', background: '#1a3c6e' },
  /*  ⚠️ דף האופליין של ה-service worker — ⭐ רקע ודיו לכל מצב, והסמל:
      ⛔ הכהה הוא אסימוני הערכה הכהה של האפליקציה. */
  offline: { light: { bg: '#1a3a6b', ink: '#FFFFFF' }, dark: { bg: '#0d151d', ink: '#e8eef5' }, mark: '📴' },
  /*  ⚠️ המפתח הוא מפתח `anon` ציבורי — ⛔ ולא מפתח שירות: ההרשאות במסד. */
  supabase: {
    url: 'https://kxbtskqobynewvnckaaz.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YnRza3FvYnluZXd2bmNrYWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDI4NDAsImV4cCI6MjA4ODg3ODg0MH0.WLwPgTJp0Y-p1AuzeXhuHDPWEbWRanVMrvEN4V9Xbeg'
  },
  android: {
    package: 'com.hanhala.ruchanit',
    /*  ⛔ הכתובת שהמעטפת טוענת — ⚠️ וממנה נגזר המקור היחיד שגשר השיתוף מקבל. */
    url: 'https://ygtotlrl-lab.github.io/hanhala-ruchanit/',
    /*  ⚠️ המשפט שלם ⛔ ולא שם בלבד — ⭐ הפועל מתאים למין השם. */
    offlineLine: 'הנהלה רוחנית לא הצליחה להתחבר.',
    /*  ⚠️ צבע כפתור הניסיון החוזר בדף האופליין של המעטפת. */
    accent: '#1a3c6e',
    /*  ⛔ `versionCode` לעולם אינו יורד, ⚠️ ומקודם בכל שינוי בקובץ שנכנס ל-APK —
        ⭐ בלי קידום המכשיר המותקן אינו מקבל את ה-APK החדש. */
    versionCode: 23,
    versionName: '15.0',
    launcherBg: { kind: 'solid', color: '#FFFFFF' },
    /*  ⚠️ גשר השיתוף — ⭐ `FileProvider` ו-`androidx`, רק באפליקציה שמייצאת קובץ. */
    share: false
  },
  /*  ⛔ טביעת מפתח החתימה הקבוע — ⚠️ `sign-apk.sh` מסרב לחתום בכל מפתח אחר. */
  signSha256: '1A:FA:BE:D0:A6:60:EF:F6:FF:40:04:C9:32:F5:A7:E3:28:01:95:4E:FA:24:FF:A4:B5:79:DF:BE:2F:B4:07:4A',
  /*  ⛔ נכסי האייקון — ⚠️ `tools/gen-icons.mjs` קורא אותם. */
  icon: {
    /*  ⛔ המאסטר כאן הוא **ציור** ולא צורות — ⚠️ כל ניסיון לתאר
        אותו בפרימיטיבים היה מייצר סמל אחר, ⛔ ולא את זה שעל המכשירים.
        ⛔ **ולכן הצורה המוצהרת רסטרית** — ⚠️ והיא תואמת את סיומת
        המאסטר: ⭐ הצהרה שאינה תואמת שולחת את המחולל למסלול שאינו של הקובץ. */
    art: 'master',
    master: 'design/icon-master.png',
    /*  ⛔ `bgKey` הוא צבע הנייר של הציור ⛔ ואינו לבן — ⚠️ מפתח שאינו הנייר
        שבמאסטר גוזר מסכה מרעש הנייר במקום מהסמל. */
    bgKey: [252, 253, 252],
    keyTol: 40,
    /*  ⛔ הדיו נמדד מהמאסטר ⛔ ואינו מוקלד — ⚠️ והחזית והאריח נצבעים בו
        שניהם: ⭐ דיו אחר לחזית בלבד מפריד את האריח מהציור.
        ⚠️ הערך נגזר מהמאסטר בסיבוב גוון ל-225.8° ובהתאמת טון לבהירות 94.4
        ולרוויה 0.425. */
    ink: [42, 60, 117],
    bg: { kind: 'solid', color: [255, 255, 255] },
    mark: { w: 684, h: 612 },
  }
});
