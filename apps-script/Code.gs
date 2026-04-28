/**
 * Crystal Core — Google Apps Script web app.
 *
 * Deploy this script as a Web App ("Anyone, even anonymous" execute access)
 * and put the resulting /exec URL in Next.js as APPS_SCRIPT_URL.
 *
 * SECURITY:
 *   • The script verifies a shared secret (Script Property: SCRIPT_SHARED_SECRET)
 *     that ALSO lives in Next.js as APPS_SCRIPT_SHARED_SECRET.
 *   • Requests without a matching secret are rejected.
 *   • Always serve over HTTPS (Apps Script web apps already are).
 *
 * SHEET LAYOUT — sheet name "USERS", row 1 must be the headers:
 *   user_id | email | name | Phone | is_active | created_at | updated_at
 *   | last_login_at | Password | Access | Role | Status
 *
 * SETUP:
 *   1. Open the spreadsheet → Extensions → Apps Script.
 *   2. Paste this file in as Code.gs.
 *   3. Project Settings → Script properties → add:
 *        SCRIPT_SHARED_SECRET = <same value as APPS_SCRIPT_SHARED_SECRET>
 *   4. Deploy → New deployment → Web app:
 *        Execute as: Me      Who has access: Anyone
 *   5. Copy the /exec URL into APPS_SCRIPT_URL.
 */

const SHEET_NAME = 'USERS';

const HEADERS = [
  'user_id', 'email', 'name', 'Phone', 'is_active', 'created_at', 'updated_at',
  'last_login_at', 'Password', 'Access', 'Role', 'Status'
];

// ─── HTTP entry points ──────────────────────────────────────────────────────

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('SCRIPT_SHARED_SECRET');
    if (!expected || body.secret !== expected) {
      return _json({ ok: false, error: 'Unauthorized' });
    }

    var action = String(body.action || '');
    var payload = body.payload || {};
    var data = dispatch(action, payload);
    return _json({ ok: true, data: data });
  } catch (err) {
    return _json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

// Block GETs — there's no public read surface.
function doGet() {
  return _json({ ok: false, error: 'Use POST' });
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Action dispatcher ──────────────────────────────────────────────────────

function dispatch(action, p) {
  switch (action) {
    case 'users.list':         return listUsers();
    case 'users.findByEmail':  return findUserByEmail(String(p.email || ''));
    case 'users.findById':     return findUserById(String(p.userId || ''));
    case 'users.create':       return createUser(p.row || {});
    case 'users.update':       return updateUser(String(p.userId || ''), p.fields || {});
    default: throw new Error('Unknown action: ' + action);
  }
}

// ─── Sheet helpers ──────────────────────────────────────────────────────────

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Sheet "' + SHEET_NAME + '" not found.');
  return sh;
}

function _readAll() {
  var sh = _sheet();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { headers: HEADERS.slice(), rows: [], sheet: sh };
  var headers = values[0].map(String);
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j] === null || values[i][j] === undefined ? '' : String(values[i][j]);
    }
    row.__rowIndex = i + 1; // 1-based sheet row, useful for in-place updates
    rows.push(row);
  }
  return { headers: headers, rows: rows, sheet: sh };
}

function _stripIndex(row) {
  var out = {};
  for (var k in row) if (k !== '__rowIndex') out[k] = row[k];
  return out;
}

// ─── Read actions ───────────────────────────────────────────────────────────

function listUsers() {
  var all = _readAll();
  return all.rows.map(_stripIndex);
}

function findUserByEmail(email) {
  if (!email) return null;
  var needle = email.toLowerCase().trim();
  var all = _readAll();
  for (var i = 0; i < all.rows.length; i++) {
    if (String(all.rows[i].email || '').toLowerCase().trim() === needle) {
      return _stripIndex(all.rows[i]);
    }
  }
  return null;
}

function findUserById(userId) {
  if (!userId) return null;
  var all = _readAll();
  for (var i = 0; i < all.rows.length; i++) {
    if (String(all.rows[i].user_id || '') === userId) return _stripIndex(all.rows[i]);
  }
  return null;
}

// ─── Write actions ──────────────────────────────────────────────────────────

function createUser(row) {
  // Prevent duplicate emails at the data layer too — defence in depth.
  if (row.email) {
    var existing = findUserByEmail(String(row.email));
    if (existing) throw new Error('Email already exists.');
  }
  var all = _readAll();
  var line = all.headers.map(function (h) {
    return row[h] === undefined || row[h] === null ? '' : row[h];
  });
  all.sheet.appendRow(line);
  return row;
}

function updateUser(userId, fields) {
  if (!userId) throw new Error('userId required');
  var all = _readAll();
  for (var i = 0; i < all.rows.length; i++) {
    if (String(all.rows[i].user_id || '') === userId) {
      var rowIndex = all.rows[i].__rowIndex;
      // Build a single row write rather than per-cell — fewer Sheets calls.
      var current = all.sheet
        .getRange(rowIndex, 1, 1, all.headers.length)
        .getValues()[0];
      var next = current.slice();
      for (var j = 0; j < all.headers.length; j++) {
        var h = all.headers[j];
        if (fields[h] !== undefined) next[j] = fields[h];
      }
      all.sheet.getRange(rowIndex, 1, 1, all.headers.length).setValues([next]);
      var out = {};
      for (var k = 0; k < all.headers.length; k++) {
        out[all.headers[k]] = next[k] === null || next[k] === undefined ? '' : String(next[k]);
      }
      return out;
    }
  }
  throw new Error('User not found: ' + userId);
}
