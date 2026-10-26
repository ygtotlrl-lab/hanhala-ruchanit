// app/icons.js — סט האייקונים של הממשק: קו אחד, פינות מעוגלות, בצבע הטקסט
// כולם באותה רשת (24) ובאותו עובי קו — אמוג׳י מתחלף בין מערכות ההפעלה ואינו נשמע לצבע.
var PATHS = {
  home:     '<path d="M4 11l8-7 8 7"/><path d="M7 10v10h10V10"/>',
  students: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M15.5 5.2a3 3 0 0 1 0 5.6"/><path d="M17.5 14.4c1.7.6 2.7 2.2 3 4.6"/>',
  attend:   '<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M8.8 12.8l2.2 2.2 4.2-4.4"/>',
  sleep:    '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  exams:    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 14.5l2 2 4-4"/>',
  files:    '<path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  reports:  '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  settings: '<path d="M4 6h8.5M16.5 6H20M4 12h2.5M10.5 12H20M4 18h6.5M14.5 18H20"/><circle cx="14.5" cy="6" r="2"/><circle cx="8.5" cy="12" r="2"/><circle cx="12.5" cy="18" r="2"/>',
  logout:   '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  user:     '<circle cx="12" cy="8.5" r="3.8"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
  key:      '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5"/><path d="M16.5 6.5l2.5 2.5M14.5 8.5l2 2"/>',
  back:     '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  prev:     '<path d="M9 6l6 6-6 6"/>',
  next:     '<path d="M15 6l-6 6 6 6"/>',
  down:     '<path d="M6 9l6 6 6-6"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  minus:    '<path d="M5 12h14"/>',
  close:    '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check:    '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  edit:     '<path d="M16.5 4.5l3 3L8 19l-4 1 1-4z"/><path d="M14 7l3 3"/>',
  del:      '<path d="M4.5 6.5h15"/><path d="M9.5 6.5v-2h5v2"/><path d="M6.5 6.5l1 13h9l1-13"/><path d="M10.5 10.5v6M13.5 10.5v6"/>',
  save:     '<path d="M5 4h11.5L20 7.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 4v5h7V4"/><path d="M8 20v-6h8v6"/>',
  table:    '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  pdf:      '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 16.5h4"/>',
  entry:    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11.5v6M9 14.5h6"/>',
  archive:  '<path d="M3.5 4.5h17v4h-17z"/><path d="M5 8.5v10a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-10"/><path d="M10 12.5h4"/>',
  watch:    '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  play:     '<path d="M8 5.5v13l10-6.5z"/>',
  search:   '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.6 15.6l4.6 4.6"/>',
  history:  '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4h4"/><path d="M12 8v4.5l3 1.8"/>',
  undo:     '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  download: '<path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M5 19.5h14"/>',
  upload:   '<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 19.5h14"/>',
  retry:    '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4h-4"/>',
  print:    '<path d="M7 8V3.5h10V8"/><rect x="3.5" y="8" width="17" height="8.5" rx="1.5"/><path d="M7 14h10v6.5H7z"/>',
  details:  '<path d="M5 7h14M5 12h14M5 17h9"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  clock:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  power:    '<path d="M12 3.5v8"/><path d="M7 6.5a7 7 0 1 0 10 0"/>',
  approved: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  suspended:'<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  left:     '<path d="M6 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15"/><path d="M4 20h16"/><path d="M14.5 12v.01"/>'
};

function icon(name) {
  return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round">' + (PATHS[name] || '') + '</svg>';
}

export { icon };
