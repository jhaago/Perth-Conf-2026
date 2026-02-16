// ===============================
// FILE: 08-utils.gs   (REPLACE / UPDATE)
// ===============================

// ---- Config cells on "Data" sheet ----
function getDataCell_(a1) {
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName('Data');
    if (!sh) return '';
    return String(sh.getRange(a1).getDisplayValue() || '').trim();
  } catch (e) {
    return '';
  }
}
function getBaseUrlOverride_() { return getDataCell_('A1'); }
function getBannerUrl_() {
  var v = getDataCell_('A2');
  if (v) return v;
  try {
    var ps = SpreadsheetApp.getActive().getSheetByName(typeof PASTORS_SHEET !== 'undefined' ? PASTORS_SHEET : 'Pastors');
    return String(ps.getRange('Z2').getDisplayValue() || '').trim();
  } catch (_) { return ''; }
}

function getThankyouUrl_() { return getDataCell_('A4'); }


// ---- Shared helpers used across the app ----
function createShortID_(){ var chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s=""; for (var i=0;i<8;i++) s+=chars.charAt(Math.floor(Math.random()*chars.length)); return s; }
function escapeHtml_(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var Util = { escape: escapeHtml_ };
function togHtml_(name, val, current){ var a=(String(current||'').toLowerCase()===String(val).toLowerCase()); return '<div class="btn '+(a?'active':'')+'" data-val="'+val+'">'+val+'</div>'; }
function normYN_(v){ var s=String(v||'').trim().toLowerCase(); if(s==='yes')return'Yes'; if(s==='no')return'No'; return ''; }
function normDate_(v){
  try{
    if(!v) return '';
    if(Object.prototype.toString.call(v)==='[object Date]'){
      if(isNaN(v.getTime())) return '';
      return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    var s=String(v).trim(); if(!s) return ''; if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var d=new Date(s); if(!isNaN(d.getTime())){
      var yyyy=d.getFullYear(), mm=('0'+(d.getMonth()+1)).slice(-2), dd=('0'+d.getDate()).slice(-2);
      return yyyy+'-'+mm+'-'+dd;
    }
    return '';
  }catch(err){ Logger.log('normDate_ error: '+err); return ''; }
}

// ---- HTML template includes ----
// Usage in .html:  <?!= include('09-countries'); ?>
function include(name){
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

// Cached include: clamps TTL to Apps Script max (21600s).
// Usage: <?!= cacheInclude('09-countries', 21600) ?>
function cacheInclude(name, ttlSeconds){
  var cache = CacheService.getScriptCache();
  var key = 'inc:' + name;
  var html = cache.get(key);
  if (html) return html;
  html = include(name);
  var ttl = Math.max(60, Math.min(+ttlSeconds || 3600, 21600));
  cache.put(key, html, ttl);
  return html;
}
