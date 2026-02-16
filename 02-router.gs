// FILE: 02-router.gs  (UPDATED: admin branch only)
function doGet(e) {
  // Admin route
  var isAdmin = e && e.parameter && String(e.parameter.admin || "") === "1";
  if (isAdmin) {
    // Use Data!A1 for base URL if present
    var baseUrl = getBaseUrlOverride_() || ScriptApp.getService().getUrl();
    if (!isAdminAuthorized_(e)) {
      return buildAdminGateHtml_(baseUrl);
    }
    var stats = collectAdminStats_();
    return buildAdminHtml_(stats, baseUrl);
  }

// Thank-you route
var isThanks = e && e.parameter && String(e.parameter.thanks || "") === "1";
if (isThanks) {
  return HtmlService
    .createHtmlOutputFromFile('13-thankyou')   // <-- NO ".html"
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}



  // --- existing form route (unchanged) ---
  ensurePastorsSheet_();
  ensureDelegatesSheet_();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PASTORS_SHEET);

  var emailParam = String((e && e.parameter && e.parameter.email) ? e.parameter.email : "")
    .trim()
    .toLowerCase();

  var lastCol = sh.getLastColumn();
  var headers = (lastCol ? sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0] : []) || [];
  var rowVals = new Array(headers.length).fill("");

  if (emailParam) {
    var r = findRowByEmail_(emailParam);
    if (r) rowVals = sh.getRange(r, 1, 1, lastCol).getValues()[0];
  }

  var h   = function(name) { return headers.indexOf(name); };
  var get = function(name) { return (h(name) >= 0 ? rowVals[h(name)] : "") || ""; };
  var iso = function(v)    { return normDate_(v); };

  var payload = {
    isNew:          !emailParam || !get("Pastor Email"),
    uniqueID:       get("Unique ID"),
    editLink:       get("Edit Link"),
    firstName:      get("Pastor First Name"),
    lastName:       get("Pastor Last Name"),
    email:          get("Pastor Email"),
    church:         get("Church (City)"),
    country:        get("Country"),
    attending:      get("Pastor attending"),
    wifeAttending:  get("Wife attending"),
    wifeFirst:      get("Pastor Wife First Name"),
    requireAccom:   get("Require accommodation"),
    checkIn:        iso(get("Check in Date")),
    checkOut:       iso(get("Check out Date")),
    bringingInfant: get("Bringing infant"),
    infantDob:      iso(get("Infant DOB")),
    cotRequired:    get("Cot required"),
    phone:          get("Phone Number"),
    comments:       get("Additional Comments"),
    bannerUrl:      getBannerUrl_(),
    thankyouUrl:   getThankyouUrl_()
  };

  var delegates = loadDelegatesForEmail_(payload.email);

  var t = HtmlService.createTemplateFromFile('06-form-ui');
  t.p = payload;
  t.delegates = delegates || [];
  t.conf = { start: CONFIG.CONF_START, end: CONFIG.CONF_END, nights: CONFIG.CONF_NIGHTS };

  return t.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
