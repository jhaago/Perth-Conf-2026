// FILE: 03-sheets.gs
// Purpose: sheet creation, lookups, upserts, delegate I/O
// Notes:
// - Uses Data!A1 (optional) to override base URL for edit links.
// - Requires helpers: getBaseUrlOverride_(), normYN_(), normDate_(), createShortID_().
// - Fallbacks for constants if 01-config.gs hasn't loaded yet.

if (typeof PASTORS_SHEET === 'undefined') var PASTORS_SHEET = 'Pastors';
if (typeof DELEGATES_SHEET === 'undefined') var DELEGATES_SHEET = 'Delegates';
if (typeof HEADER_ROW === 'undefined') var HEADER_ROW = 1;

/* ------------ Sheet creation ------------ */
function ensurePastorsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PASTORS_SHEET);
  if (sh) return;

  sh = ss.insertSheet(PASTORS_SHEET);
  sh.getRange(1, 1, 1, 19).setValues([[
    'Unique ID','Edit Link','Pastor First Name','Pastor Last Name','Pastor Email',
    'Church (City)','Country','State','Pastor attending','Wife attending',
    'Pastor Wife First Name','Require accommodation','Check in Date','Check out Date',
    'Bringing infant','Infant DOB','Cot required','Phone Number','Additional Comments'
  ]]);
}

function ensureDelegatesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(DELEGATES_SHEET);
  if (sh) return;

  sh = ss.insertSheet(DELEGATES_SHEET);
  sh.getRange(1, 1, 1, 15).setValues([[
    'Pastor Email','Pastor First Name','Pastor Last Name',
    'Delegate First Name','Delegate Last Name','Status','Wife First Name',
    'Require Accommodation','Check-in Date','Check-out Date',
    'Bringing Infant','Infant DOB','Cot Required','Delegate Phone','Additional Comments'
  ]]);
}

/* ------------ Lookups ------------ */
function findRowByEmail_(emailLower) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PASTORS_SHEET);
  var last = sh.getLastRow();
  if (last <= HEADER_ROW) return null;

  var emails = sh.getRange(HEADER_ROW + 1, 5, last - HEADER_ROW, 1).getValues(); // col E
  for (var i = 0; i < emails.length; i++) {
    var v = String(emails[i][0] || '').trim().toLowerCase();
    if (v === emailLower) return HEADER_ROW + 1 + i;
  }
  return null;
}

/* ------------ Upsert pastor row + edit link ------------ */
function upsertPastorRow_(o) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PASTORS_SHEET);

  var overrideBase = (typeof getBaseUrlOverride_ === 'function') ? getBaseUrlOverride_() : '';
  var baseUrl = overrideBase || ScriptApp.getService().getUrl();

  var emailLower = String(o.email || '').trim().toLowerCase();
  var row = findRowByEmail_(emailLower);
  var isNew = !row;
  if (!row) row = Math.max(sh.getLastRow() + 1, HEADER_ROW + 1);

  var uniqueID = sh.getRange(row, 1).getValue();
  if (!uniqueID) uniqueID = createShortID_();

  var editLink = baseUrl + '?email=' + encodeURIComponent(emailLower);

  var vals = [
    uniqueID, editLink,
    o.firstName || '', o.lastName || '', emailLower,
    o.church || '', o.country || '', o.state || '',
    normYN_(o.attending), normYN_(o.wifeAttending),
    o.wifeFirst || '', normYN_(o.requireAccom),
    normDate_(o.checkIn), normDate_(o.checkOut),
    normYN_(o.bringingInfant), normDate_(o.infantDob),
    normYN_(o.cotRequired), o.phone || '', o.comments || ''
  ];
  sh.getRange(row, 1, 1, vals.length).setValues([vals]);

  // De-dupe older rows with same email (keep newest)
  var last = sh.getLastRow();
  if (last > HEADER_ROW) {
    var emails = sh.getRange(HEADER_ROW + 1, 5, last - HEADER_ROW, 1).getValues();
    for (var i = emails.length - 1; i >= 0; i--) {
      var r = HEADER_ROW + 1 + i;
      if (r === row) continue;
      var v = String(emails[i][0] || '').trim().toLowerCase();
      if (v === emailLower) sh.deleteRow(r);
    }
  }
  return { row: row, isNew: isNew, uniqueID: uniqueID, editLink: editLink };
}

/* ------------ Delegates I/O ------------ */
function replaceDelegatesForEmail_(emailLower, pastorFirst, pastorLast, list) {
  ensureDelegatesSheet_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(DELEGATES_SHEET);

  // Clear existing for this email
  var last = sh.getLastRow();
  if (last > HEADER_ROW) {
    var emails = sh.getRange(HEADER_ROW + 1, 1, last - HEADER_ROW, 1).getValues();
    for (var i = emails.length - 1; i >= 0; i--) {
      var r = HEADER_ROW + 1 + i;
      var v = String(emails[i][0] || '').trim().toLowerCase();
      if (v === emailLower) sh.deleteRow(r);
    }
  }

  // Insert current
  if (list && list.length) {
    var rows = list.map(function(d) {
      return [
        emailLower, pastorFirst || '', pastorLast || '',
        d.firstName || '', d.lastName || '', d.status || '', d.wifeFirst || '',
        normYN_(d.requireAccom), normDate_(d.checkIn), normDate_(d.checkOut),
        normYN_(d.bringingInfant), normDate_(d.infantDob), normYN_(d.cotRequired),
        d.phone || '', d.notes || ''
      ];
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 15).setValues(rows);
  }
}

function loadDelegatesForEmail_(email) {
  if (!email) return [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(DELEGATES_SHEET);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last <= HEADER_ROW) return [];

  var vals = sh.getRange(HEADER_ROW + 1, 1, last - HEADER_ROW, 15).getValues();
  var out = [];
  var target = String(email || '').trim().toLowerCase();

  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var e = String(r[0] || '').trim().toLowerCase();
    if (e !== target) continue;
    out.push({
      firstName: r[3] || '', lastName: r[4] || '', status: r[5] || '', wifeFirst: r[6] || '',
      requireAccom: r[7] || '', checkIn: r[8] || '', checkOut: r[9] || '',
      bringingInfant: r[10] || '', infantDob: r[11] || '', cotRequired: r[12] || '',
      phone: r[13] || '', notes: r[14] || ''
    });
  }
  return out;
}

/* ------------ Self-test (optional) ------------ */
function _sheetsSelfTest() {
  ensurePastorsSheet_();
  ensureDelegatesSheet_();
  return '03-sheets loaded';
}
