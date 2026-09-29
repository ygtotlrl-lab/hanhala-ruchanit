// app/screens/attend.js — מסך הסדרים: הזרם attend של מסך הרישום המשותף
// הרישום, הארכיון וההשגחה — domain.reg.js · domain.arc.js · domain.sup.js; מה שנבדל מהשינה — HR_STREAMS.attend.
import { HR_STREAMS } from '../domain.sessions.js';
import { hrRegHTML, hrRegLoad } from '../domain.reg.js';

function screenAttendHTML() { return hrRegHTML(HR_STREAMS.attend); }

function loadAttend() { return hrRegLoad(HR_STREAMS.attend); }

export { loadAttend, screenAttendHTML };
