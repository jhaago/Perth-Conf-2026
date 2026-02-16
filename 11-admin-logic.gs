// ==========================
// FILE: 11-admin-logic.gs  (UPDATED: tolerant headers for Delegates)
// ==========================

// Keep these if already defined elsewhere
var PASTORS_SHEET   = (typeof PASTORS_SHEET   !== 'undefined') ? PASTORS_SHEET   : 'Pastors';
var DELEGATES_SHEET = (typeof DELEGATES_SHEET !== 'undefined') ? DELEGATES_SHEET : 'Delegates';

function getAdminSecret_() {
  return (PropertiesService.getScriptProperties().getProperty('ADMIN_SECRET') || '').trim();
}
function isAdminAuthorized_(e) {
  var supplied = String((e && e.parameter && (e.parameter.key || e.parameter.secret)) || '').trim();
  var secret = getAdminSecret_();
  return secret && supplied && supplied === secret;
}
function buildAdminGateHtml_(baseUrl) {
  var url = baseUrl + '?admin=1&key=YOUR_SECRET';
  var html = ''
  + '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<title>Admin access required</title>'
  + '<style>body{background:#0b1220;color:#e5e7eb;font:16px/1.5 Arial,Helvetica,sans-serif;margin:0;padding:24px}'
  + '.card{max-width:720px;margin:40px auto;background:#111827;border:1px solid #374151;border-radius:12px;padding:20px}'
  + 'code,a{color:#93c5fd} .btn{display:inline-block;margin-top:14px;padding:10px 14px;background:#1f2937;color:#fff;border-radius:8px;text-decoration:none}'
  + '</style></head><body><div class="card">'
  + '<h2>Admin access required</h2>'
  + '<p>Add a Script Property <code>ADMIN_SECRET</code> (you set it to <code>6371992326</code>) and open:</p>'
  + '<p><code>' + url + '</code></p>'
  + '<p><a class="btn" href="' + baseUrl + '">Back to form</a></p>'
  + '</div></body></html>';
  return HtmlService.createHtmlOutput(html);
}

/* Open the correct data spreadsheet (set Script Property DATA_SPREADSHEET_ID) */
function getDataSpreadsheet_() {
  var id = (PropertiesService.getScriptProperties().getProperty('DATA_SPREADSHEET_ID') || '').trim();
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { throw new Error('DATA_SPREADSHEET_ID is invalid.'); }
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Set Script Property DATA_SPREADSHEET_ID to the form’s Google Sheet ID.');
  return ss;
}

/* === read-only stats === */
function collectAdminStats_() {
  var ss = getDataSpreadsheet_();
  var pastors   = ss.getSheetByName(PASTORS_SHEET);
  var delegates = ss.getSheetByName(DELEGATES_SHEET);

  var CONF_START = '2026-03-02'; // for nursery age check

  function readAll(sh) {
    if (!sh) return { headers: [], rows: [] };
    var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow <= 1 || lastCol < 1) return { headers: [], rows: [] };
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var rows    = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    return { headers: headers, rows: rows };
  }
  function norm(s) { return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,''); }
  function hIdxAny(headers, candidates) {
    if (!headers || !headers.length) return -1;
    var Hn = headers.map(norm);
    for (var i=0;i<candidates.length;i++){
      var n = norm(candidates[i]);
      var j = Hn.indexOf(n);
      if (j >= 0) return j;
    }
    return -1;
  }
  function asISO(v) {
    try {
      if (!v) return '';
      if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
        return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      var s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      var d = new Date(s);
      if (!isNaN(d.getTime())) {
        var yyyy = d.getFullYear(), mm = ('0'+(d.getMonth()+1)).slice(-2), dd=('0'+d.getDate()).slice(-2);
        return yyyy+'-'+mm+'-'+dd;
      }
      return '';
    } catch(_) { return ''; }
  }
  function nights(a,b) {
    if (!a || !b) return 0;
    var A = new Date(a), B = new Date(b);
    if (isNaN(A) || isNaN(B)) return 0;
    return Math.max(0, Math.round((B - A) / 86400000));
  }
  function isUnderOne(dobIso, confStartIso) {
    if (!dobIso) return false;
    var d = new Date(dobIso), s = new Date(confStartIso);
    if (isNaN(d) || isNaN(s)) return false;
    var diffDays = Math.round((s - d) / 86400000);
    return diffDays >= 0 && diffDays < 365;
  }

  // ---- Pastors (tolerant header lookups)
  var P = readAll(pastors);
  var pi = {
    attending:     hIdxAny(P.headers, ['Pastor attending']),
    wifeAttending: hIdxAny(P.headers, ['Wife attending']),
    infant:        hIdxAny(P.headers, ['Bringing infant','Bringing Infant?']),
    infantDob:     hIdxAny(P.headers, ['Infant DOB']),
    requireAccom:  hIdxAny(P.headers, ['Require accommodation']),
    checkIn:       hIdxAny(P.headers, ['Check in Date','Check-in Date']),
    checkOut:      hIdxAny(P.headers, ['Check out Date','Check-out Date']),
    email:         hIdxAny(P.headers, ['Pastor Email'])
  };

  var totalPastors = P.rows.length;
  var attendingYes = 0, wifeYes = 0, accomYes = 0, nightsPastors = 0;
  var infantsPastorsU1 = 0;
  var respondedEmails = new Set();

  P.rows.forEach(function(r){
    if (pi.email >= 0 && r[pi.email]) respondedEmails.add(String(r[pi.email]).trim().toLowerCase());
    if (pi.attending     >= 0 && String(r[pi.attending])     === 'Yes') attendingYes++;
    if (pi.wifeAttending >= 0 && String(r[pi.wifeAttending]) === 'Yes') wifeYes++;

    if (pi.requireAccom >= 0 && String(r[pi.requireAccom]) === 'Yes') {
      accomYes++;
      var ci = asISO(pi.checkIn  >= 0 ? r[pi.checkIn]  : '');
      var co = asISO(pi.checkOut >= 0 ? r[pi.checkOut] : '');
      nightsPastors += nights(ci, co);
    }
    if (pi.infant >= 0 && String(r[pi.infant]) === 'Yes') {
      var dob = asISO(pi.infantDob >= 0 ? r[pi.infantDob] : '');
      if (isUnderOne(dob, CONF_START)) infantsPastorsU1++;
    }
  });

  // ---- Delegates (tolerant header lookups to match your tab)
  var D = readAll(delegates);
  var di = {
    status:        hIdxAny(D.headers, ['Status','Single/Couple']),
    infant:        hIdxAny(D.headers, ['Bringing Infant','Bringing Infant?']),
    infantDob:     hIdxAny(D.headers, ['Infant DOB']),
    requireAccom:  hIdxAny(D.headers, ['Require Accommodation','Require Accommodation?']),
    checkIn:       hIdxAny(D.headers, ['Check-in Date']),
    checkOut:      hIdxAny(D.headers, ['Check-out Date'])
  };

  var totalDelegates = D.rows.length;
  var singles = 0, couples = 0, delAccom = 0, nightsDelegates = 0, infantsDelegatesU1 = 0;

  D.rows.forEach(function(r){
    if (di.status >= 0) {
      var s = String(r[di.status] || '').trim();
      if (s === 'Single') singles++;
      else if (s === 'Couple') couples++;
    }
    if (di.infant >= 0 && String(r[di.infant]) === 'Yes') {
      var dob = asISO(di.infantDob >= 0 ? r[di.infantDob] : '');
      if (isUnderOne(dob, CONF_START)) infantsDelegatesU1++;
    }
    if (di.requireAccom >= 0 && String(r[di.requireAccom]) === 'Yes') {
      delAccom++;
      var ci = asISO(di.checkIn  >= 0 ? r[di.checkIn]  : '');
      var co = asISO(di.checkOut >= 0 ? r[di.checkOut] : '');
      nightsDelegates += nights(ci, co);
    }
  });

// ---- Response rate (optional sheet Invites/Invitees, col A emails)
// Count only responses whose email appears on the Invites list.
var invitesSheet = ss.getSheetByName('Invites') || ss.getSheetByName('Invitees');
var totalInvites = 0, responseRate = null, respondedOnList = 0;
if (invitesSheet) {
  var lastInv = invitesSheet.getLastRow();
  if (lastInv > 1) {
    // Read & normalize invites (trim + lowercase), drop blanks, dedupe
    var invited = invitesSheet.getRange(2, 1, lastInv - 1, 1).getValues()
      .map(function(a){ return String(a[0] || '').trim().toLowerCase(); })
      .filter(function(x){ return x; });
    var invitedSet = new Set(invited);
    totalInvites = invitedSet.size;

    // Intersect with responded emails from Pastors sheet
    respondedEmails.forEach(function(e){
      if (invitedSet.has(e)) respondedOnList++;
    });

    if (totalInvites > 0) {
      responseRate = Math.round((respondedOnList / totalInvites) * 1000) / 10; // 1 dp
    }
  }
}


  var infantsUnder1  = infantsPastorsU1 + infantsDelegatesU1;
  var totalAttendees = attendingYes + wifeYes + singles + (couples * 2);

  return {
    sheetUrl: ss.getUrl(),
    totals: {
      pastors: totalPastors,
      attendingYes: attendingYes,
      wifeYes: wifeYes,
      delegates: totalDelegates,
      singles: singles,
      couples: couples,
      accomYes: accomYes,
      delAccom: delAccom,
      nightsPastors: nightsPastors,
      nightsDelegates: nightsDelegates,
      infantsUnder1: infantsUnder1,
      totalAttendees: totalAttendees
    },
   invites: {
  enabled: !!invitesSheet,
  totalInvites: totalInvites,
  responded: respondedOnList,          // <-- on-list responses
  respondedAll: respondedEmails.size,  // (optional) all responses seen
  responseRate: responseRate
}

  };
}

function buildAdminHtml_(stats, baseUrl) {
  var t = HtmlService.createTemplateFromFile('12-admin-ui');
  t.stats = stats;
  t.baseUrl = baseUrl;
  return t.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
