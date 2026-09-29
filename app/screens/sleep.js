// app/screens/sleep.js — מסך השינה: הזרם sleep של מסך הרישום המשותף
// הרישום, הארכיון וההשגחה — domain.reg.js · domain.arc.js · domain.sup.js; מה שנבדל מהסדרים — HR_STREAMS.sleep.
import { HR_STREAMS } from '../domain.sessions.js';
import { hrRegHTML, hrRegLoad } from '../domain.reg.js';

function screenSleepHTML() { return hrRegHTML(HR_STREAMS.sleep); }

function loadSleep() { return hrRegLoad(HR_STREAMS.sleep); }

export { loadSleep, screenSleepHTML };
