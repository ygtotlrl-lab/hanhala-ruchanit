// app.config.js — תצורת האפליקציה
self.APP = Object.freeze({
  // ממנו נגזרים ה-scope, קידומת המטמון ושם הפרויקט באנדרואיד
  id: 'hanhala-ruchanit',
  name: 'הנהלה רוחנית',
  shortName: 'הנהלה רוחנית',
  description: 'מערכת ניהול הנהלה רוחנית לישיבה',
  prefix: 'hr_',
  colors: { theme: '#1a3c6e', background: '#1a3c6e' },
  // דף האופליין של ה-service worker — הכהה לפי אסימוני הערכה הכהה של האפליקציה
  offline: { light: { bg: '#1a3a6b', ink: '#FFFFFF' }, dark: { bg: '#0d151d', ink: '#e8eef5' }, mark: '📴' },
  // מפתח anon ציבורי ולא מפתח שירות — ההרשאות נאכפות במסד.
  supabase: {
    url: 'https://kxbtskqobynewvnckaaz.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YnRza3FvYnluZXd2bmNrYWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDI4NDAsImV4cCI6MjA4ODg3ODg0MH0.WLwPgTJp0Y-p1AuzeXhuHDPWEbWRanVMrvEN4V9Xbeg'
  },
  android: {
    package: 'com.hanhala.ruchanit',
    // ממנה נגזר המקור היחיד שגשר השיתוף מקבל
    url: 'https://ygtotlrl-lab.github.io/hanhala-ruchanit/',
    // משפט שלם ולא שם בלבד — הפועל מתאים למין השם
    offlineLine: 'הנהלה רוחנית לא הצליחה להתחבר.',
    // צבע כפתור הניסיון החוזר בדף האופליין של המעטפת
    accent: '#1a3c6e',
    // לעולם אינו יורד — בלי קידום המכשיר המותקן אינו מקבל את ה-APK החדש.
    versionCode: 24,
    versionName: '15.0',
    launcherBg: { kind: 'solid', color: '#FFFFFF' },
    // FileProvider ו-androidx — רק באפליקציה שמייצאת קובץ
    share: false
  },
  // sign-apk.sh מסרב לחתום בכל מפתח אחר
  signSha256: '1A:FA:BE:D0:A6:60:EF:F6:FF:40:04:C9:32:F5:A7:E3:28:01:95:4E:FA:24:FF:A4:B5:79:DF:BE:2F:B4:07:4A',
  icon: {
    // המאסטר הוא ציור ולא צורות — תיאור בפרימיטיבים היה מייצר סמל אחר.
    // ולכן הצורה המוצהרת רסטרית, ותואמת את סיומת המאסטר — הצהרה אחרת שולחת את המחולל למסלול שגוי.
    art: 'master',
    master: 'design/icon-master.png',
    // bgKey הוא צבע הנייר של הציור ולא לבן — מפתח אחר גוזר מסכה מרעש הנייר ולא מהסמל
    bgKey: [252, 253, 252],
    keyTol: 40,
    // הדיו נמדד מהמאסטר — החזית והאריח נצבעים שניהם בו, ודיו אחר לחזית מפריד את האריח מהציור.
    // נגזר בסיבוב גוון ל-225.8°, התאמת בהירות ל-94.4 ורוויה ל-0.425.
    ink: [42, 60, 117],
    bg: { kind: 'solid', color: [255, 255, 255] },
    mark: { w: 684, h: 612 },
  }
});
