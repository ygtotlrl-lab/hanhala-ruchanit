package com.hanhala.ruchanit;

/**
 * The hanhala-ruchanit shell — identity only.
 *
 * <p>All of the behaviour lives in {@link ShellActivity}, which is byte-for-byte
 * identical in the organisation's four repos; this class supplies the three
 * values that differ. ⛔ אין להוסיף כאן לוגיקה (סבב 41) — התנהגות שנוספת
 * לאפליקציה אחת בלבד מחזירה בדיוק את ארבעת העותקים החופשיים שהחילוץ החליף;
 * מה שנחוץ לכולן נכנס ל-`ShellActivity`, ומה שנחוץ לאחת עובר דרך
 * `installBridge()`/`onShellNavigation()` ונרשם כחריגה מנומקת.
 *
 * <p>אין כאן גשר מקורי: בקוד של הנהלה רוחנית אין `navigator.share`.
 */
public class MainActivity extends ShellActivity {

    @Override
    protected String appUrl() { return "https://ygtotlrl-lab.github.io/hanhala-ruchanit/"; }

    @Override
    protected String offlineLine() { return "הנהלה רוחנית לא הצליחה להתחבר."; }

    @Override
    protected String accentColor() { return "#1a3c6e"; }
}
