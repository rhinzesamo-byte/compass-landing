/**
 * CLARITY & CONFIDENCE COMPASS — SALES FUNNEL BACKEND
 * Google Sheets = notebook · Apps Script = robot · MailApp = sends access
 *
 * FIRST TIME:
 *   1. Paste this whole file into Extensions → Apps Script → Code.gs
 *   2. Choose "setupCRM" in the function menu → Run → approve permissions
 *   3. Fill the VALUE column in the Settings tab
 *   4. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone
 *   5. Copy the /exec URL into config.js on the landing page
 *
 * Payment rule: the robot NEVER marks anything PAID. You do, after you see
 * the money in your MariBank app. Changing PaymentStatus to PAID sends access.
 */

/* ===================== SHEET LAYOUT ===================== */
var TABS = {
  Settings:    ['Key', 'Value', 'What it is'],
  Leads:       ['CreatedAt', 'LeadId', 'Name', 'Email', 'Source', 'Status'],
  Orders:      ['CreatedAt', 'OrderId', 'Name', 'Email', 'Phone', 'AmountPHP', 'PaymentStatus',
                'PaymentReference', 'PayerName', 'PaymentSubmittedAt', 'PaidAt',
                'EmailStatus', 'EmailSentAt', 'AdminNotes', 'AccessToken'],
  Payments:    ['SubmittedAt', 'OrderId', 'Email', 'Reference', 'PayerName', 'AmountExpectedPHP', 'Check'],
  Fulfillment: ['Time', 'OrderId', 'Email', 'Type', 'Result', 'Detail'],
  Logs:        ['Time', 'Level', 'Action', 'Detail']
};

var PAYMENT_STATUSES = ['AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAID', 'REJECTED', 'REFUNDED', 'CANCELLED'];
var EMAIL_STATUSES = ['NOT_SENT', 'CONFIRMATION_SENT', 'SENT', 'FAILED'];

var DEFAULT_SETTINGS = [
  ['OFFER_NAME', 'Clarity & Confidence Compass', 'Course name used in emails'],
  ['PRICE_PHP', 1500, 'Founders price. The website can NOT change this.'],
  ['MAX_SEATS', 10, 'Founding batch size. Orders close when this many are submitted or paid.'],
  ['ENROLLMENT_OPEN', 'TRUE', 'Set to FALSE to stop new orders'],
  ['COURSE_DATES', 'To be announced', 'Shown in the welcome email, e.g. "Week 1 starts Mon, Jan 5"'],
  ['CLASSROOM_CODE', '', 'Your Google Classroom class code. Until this is filled, PAID buyers get a "payment confirmed, details coming" email.'],
  ['CLASSROOM_URL', '', 'Optional: direct join link to your Classroom'],
  ['QUIZ_URL', '', 'Your web Archetype Quiz link'],
  ['WORKBOOK_URL', '', 'Compass Workbook link (Google Doc with "Make a copy")'],
  ['WELCOME_NOTE', 'Welcome to the founding batch! I’m so glad you’re here.', 'A short personal line at the top of the welcome email'],
  ['SUPPORT_EMAIL', '', 'Where buyers can reply for help'],
  ['FROM_NAME', 'Rhinzes · Clarity & Confidence Compass', 'Sender name on emails'],
  ['ADMIN_EMAIL', '', 'Optional: get an email each time someone submits a payment reference'],
  ['REQUIRE_TURNSTILE', 'FALSE', 'TRUE only after TURNSTILE_SECRET is set in Script Properties']
];

/* ===================== SETUP ===================== */
function setupCRM() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = TABS[name];
    var existing = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    if (existing.join('') === '') {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      headers.forEach(function (h) { // add any missing columns at the end
        if (existing.indexOf(h) === -1) sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
      });
    }
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#0F3B2C').setFontColor('#FFFFFF');
  });

  // Settings defaults (never overwrites values you already filled)
  var st = ss.getSheetByName('Settings');
  var keys = st.getLastRow() > 1 ? st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; }) : [];
  DEFAULT_SETTINGS.forEach(function (row) {
    if (keys.indexOf(row[0]) === -1) st.appendRow(row);
  });
  st.setColumnWidth(1, 180); st.setColumnWidth(2, 320); st.setColumnWidth(3, 460);
  st.getRange('B:B').setBackground('#FCF3DC');

  // Orders dropdowns + hide token
  var orders = ss.getSheetByName('Orders');
  var ps = col_(orders, 'PaymentStatus'), es = col_(orders, 'EmailStatus'), tk = col_(orders, 'AccessToken');
  orders.getRange(2, ps, orders.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(PAYMENT_STATUSES, true).setAllowInvalid(false).build());
  orders.getRange(2, es, orders.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(EMAIL_STATUSES, true).setAllowInvalid(false).build());
  orders.hideColumns(tk);

  // Status colours
  var rng = orders.getRange(2, ps, orders.getMaxRows() - 1, 1);
  var rules = orders.getConditionalFormatRules().filter(function (r) {
    return r.getRanges().every(function (x) { return x.getColumn() !== ps; });
  });
  [['PAID', '#D3E5D9'], ['PAYMENT_SUBMITTED', '#FCF3DC'], ['REJECTED', '#F6D5CF'], ['REFUNDED', '#E5E5E5'], ['CANCELLED', '#E5E5E5']]
    .forEach(function (p) {
      rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(p[0]).setBackground(p[1]).setRanges([rng]).build());
    });
  orders.setConditionalFormatRules(rules);

  // Install the "PAID → send access" trigger (once)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'handleEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('handleEdit').forSpreadsheet(ss).onEdit().create();

  log_('INFO', 'setupCRM', 'Setup complete');
  try { SpreadsheetApp.getUi().alert('Setup complete ✅\n\nNext: fill the VALUE column in the Settings tab, then Deploy → New deployment → Web app.'); } catch (e) {}
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Sales Funnel')
    .addItem('Resend Access for Selected Order', 'menuResendAccess')
    .addItem('Send Access to Everyone Waiting', 'menuSendAccessAll')
    .addItem('Check email quota left today', 'menuQuota')
    .addSeparator()
    .addItem('Run setup again (safe)', 'setupCRM')
    .addToUi();
}

/* ===================== WEB APP ===================== */
function doGet() {
  return json_({ ok: true, service: 'Clarity & Confidence Compass backend' });
}

function doPost(e) {
  var data;
  try { data = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'Invalid request.' }); }

  var action = String(data.action || '');
  try {
    if (data.website) { log_('WARN', action, 'Honeypot filled — ignored'); return json_({ ok: true, message: 'Salamat!' }); }
    if (!rateOk_('global', 'all', 120, 60)) return json_({ ok: false, error: 'Busy right now. Please try again in a minute.' });

    var S = settings_();
    if (isTrue_(S.REQUIRE_TURNSTILE) && !verifyTurnstile_(data.turnstileToken)) {
      return json_({ ok: false, error: 'Security check failed. Please refresh the page and try again.' });
    }

    switch (action) {
      case 'createLead':             return json_(createLead_(data));
      case 'createOrder':            return json_(createOrder_(data, S));
      case 'submitPaymentReference': return json_(submitPaymentReference_(data, S));
      case 'resendAccess':           return json_(resendAccessPublic_(data));
      default:                       return json_({ ok: false, error: 'Unknown action.' });
    }
  } catch (err) {
    log_('ERROR', action, String(err && err.stack || err));
    return json_({ ok: false, error: 'Something went wrong on our side. Please try again.' });
  }
}

/* ===================== ACTIONS ===================== */
function createLead_(d) {
  var name = clean_(d.name, 80), email = cleanEmail_(d.email);
  if (name.length < 2 || !email) return { ok: false, error: 'Please enter your name and a valid email.' };
  if (!rateOk_('lead', email, 3, 600)) return { ok: false, error: 'Too many tries. Please wait a few minutes.' };

  withLock_(function () {
    var sh = sheet_('Leads');
    var emails = colValues_(sh, 'Email');
    if (emails.indexOf(email) === -1) {
      appendObj_(sh, { CreatedAt: new Date(), LeadId: 'L-' + shortId_(), Name: safe_(name), Email: email,
                       Source: safe_(clean_(d.source, 40) || 'landing'), Status: 'NEW' });
    }
  });
  log_('INFO', 'createLead', email);
  return { ok: true, message: 'Salamat! I’ll email you when the course dates are set.' };
}

function createOrder_(d, S) {
  var name = clean_(d.name, 80), email = cleanEmail_(d.email), phone = clean_(d.phone, 20);
  if (name.length < 2) return { ok: false, error: 'Please enter your full name.' };
  if (!email) return { ok: false, error: 'Please enter a valid email.' };
  if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) return { ok: false, error: 'Please check your mobile number.' };
  if (!isTrue_(S.ENROLLMENT_OPEN)) return { ok: false, error: 'Enrollment is closed right now. Leave your email below to hear about the next batch.' };
  if (!rateOk_('order', email, 5, 600)) return { ok: false, error: 'Too many tries. Please wait a few minutes.' };

  var price = Number(S.PRICE_PHP);
  if (!(price > 0)) { log_('ERROR', 'createOrder', 'PRICE_PHP missing in Settings'); return { ok: false, error: 'Checkout is not ready yet. Please try again later.' }; }

  return withLock_(function () {
    var sh = sheet_('Orders');
    var statuses = colValues_(sh, 'PaymentStatus');
    var taken = statuses.filter(function (s) { return s === 'PAYMENT_SUBMITTED' || s === 'PAID'; }).length;
    if (taken >= Number(S.MAX_SEATS || 10)) {
      return { ok: false, error: 'The founding batch is full. Leave your email below and I’ll tell you about the next batch.' };
    }
    var orderId = 'CCC-' + Utilities.formatDate(new Date(), 'Asia/Manila', 'yyMMdd') + '-' + shortId_();
    var token = Utilities.getUuid().replace(/-/g, '');
    appendObj_(sh, {
      CreatedAt: new Date(), OrderId: orderId, Name: safe_(name), Email: email, Phone: safe_(phone),
      AmountPHP: price, PaymentStatus: 'AWAITING_PAYMENT', EmailStatus: 'NOT_SENT', AccessToken: token
    });
    log_('INFO', 'createOrder', orderId + ' ' + email);
    return { ok: true, orderId: orderId, token: token, amount: price, currency: 'PHP' };
  });
}

function submitPaymentReference_(d, S) {
  var orderId = clean_(d.orderId, 40), token = clean_(d.token, 64);
  var ref = clean_(d.reference, 40), payer = clean_(d.payerName, 80);
  if (!/^[A-Za-z0-9\- ]{6,40}$/.test(ref)) return { ok: false, error: 'Please paste the reference number from your receipt.' };
  if (!orderId || !token) return { ok: false, error: 'Your order was not found. Please start again.' };
  if (!rateOk_('ref', orderId, 5, 600)) return { ok: false, error: 'Too many tries. Please wait a few minutes.' };

  return withLock_(function () {
    var sh = sheet_('Orders');
    var row = findRow_(sh, 'OrderId', orderId);
    if (!row) return { ok: false, error: 'Your order was not found. Please start again.' };
    var o = rowObj_(sh, row);
    if (!safeEqual_(String(o.AccessToken), token)) {
      log_('WARN', 'submitPaymentReference', 'Bad token for ' + orderId);
      return { ok: false, error: 'Your order was not found. Please start again.' };
    }
    if (o.PaymentStatus === 'PAID') return { ok: true, status: 'PAID' };
    if (['AWAITING_PAYMENT', 'PAYMENT_SUBMITTED'].indexOf(o.PaymentStatus) === -1) {
      return { ok: false, error: 'This order can no longer take payments. Please contact support.' };
    }

    // Flag reused reference numbers for the admin (never auto-reject, never auto-approve)
    var pay = sheet_('Payments');
    var normalized = ref.replace(/\s|-/g, '').toUpperCase();
    var refs = colValues_(pay, 'Reference').map(function (r) { return String(r).replace(/^'/, '').replace(/\s|-/g, '').toUpperCase(); });
    var orderIds = colValues_(pay, 'OrderId');
    var dupe = refs.some(function (r, i) { return r === normalized && orderIds[i] !== orderId; });

    appendObj_(pay, { SubmittedAt: new Date(), OrderId: orderId, Email: o.Email, Reference: safe_(ref),
                      PayerName: safe_(payer), AmountExpectedPHP: o.AmountPHP,
                      Check: dupe ? '⚠ SAME REFERENCE USED ON ANOTHER ORDER' : 'Verify in MariBank' });
    setCells_(sh, row, {
      PaymentStatus: 'PAYMENT_SUBMITTED', PaymentReference: safe_(ref), PayerName: safe_(payer),
      PaymentSubmittedAt: new Date(),
      AdminNotes: dupe ? '⚠ Duplicate reference — check carefully' : o.AdminNotes
    });
    log_('INFO', 'submitPaymentReference', orderId + ' ref ' + ref + (dupe ? ' (DUPLICATE)' : ''));

    if (S.ADMIN_EMAIL && cleanEmail_(S.ADMIN_EMAIL)) {
      try {
        MailApp.sendEmail({
          to: cleanEmail_(S.ADMIN_EMAIL),
          subject: 'Payment to verify: ' + orderId + ' · ₱' + o.AmountPHP,
          body: 'Name: ' + o.Name + '\nEmail: ' + o.Email + '\nAmount expected: ₱' + o.AmountPHP +
                '\nReference: ' + ref + '\nPayer name: ' + (payer || '(same)') +
                (dupe ? '\n\n⚠ This reference was already used on another order.' : '') +
                '\n\nCheck your MariBank app. If the money is really there, set PaymentStatus to PAID in the Orders tab.',
          name: S.FROM_NAME || 'Sales Funnel'
        });
      } catch (err) { log_('WARN', 'adminNotify', String(err)); }
    }
    return { ok: true, status: 'PAYMENT_SUBMITTED' };
  });
}

function resendAccessPublic_(d) {
  var email = cleanEmail_(d.email);
  var generic = { ok: true, message: 'If that email has a confirmed order, your access email is on its way. Check Spam too.' };
  if (!email) return { ok: false, error: 'Please enter a valid email.' };
  if (!rateOk_('resend', email, 3, 3600)) return generic; // stay quiet

  var sh = sheet_('Orders');
  var emails = colValues_(sh, 'Email'), statuses = colValues_(sh, 'PaymentStatus');
  for (var i = emails.length - 1; i >= 0; i--) {
    if (emails[i] === email && statuses[i] === 'PAID') {
      sendAccess_(i + 2, 'RESEND'); // goes only to the email on the paid order
      break;
    }
  }
  return generic;
}

/* ===================== PAID → SEND ACCESS ===================== */
function handleEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== 'Orders') return;
  var psCol = col_(sh, 'PaymentStatus');
  if (psCol < e.range.getColumn() || psCol > e.range.getLastColumn()) return;

  for (var r = e.range.getRow(); r <= e.range.getLastRow(); r++) {
    if (r < 2) continue;
    var o = rowObj_(sh, r);
    if (o.PaymentStatus !== 'PAID') continue;
    if (!o.PaidAt) setCells_(sh, r, { PaidAt: new Date() });
    if (o.EmailStatus !== 'SENT') sendAccess_(r, 'ACCESS');
  }
}

function sendAccess_(row, type) {
  var sh = sheet_('Orders'), S = settings_();
  var o = rowObj_(sh, row);
  if (o.PaymentStatus !== 'PAID') return fulfil_(o, type, 'SKIPPED', 'Order is not PAID');

  var ready = accessReady_(S);
  // Details not final yet: send a "payment confirmed" email once, then wait.
  if (!ready && type === 'ACCESS' && o.EmailStatus === 'CONFIRMATION_SENT') return;
  if (MailApp.getRemainingDailyQuota() < 1) {
    setCells_(sh, row, { EmailStatus: 'FAILED' });
    return fulfil_(o, type, 'FAILED', 'Daily email quota used up — resend tomorrow');
  }

  try {
    var mail = ready ? accessEmail_(o, S) : confirmationEmail_(o, S);
    var opts = { to: o.Email, subject: mail.subject, htmlBody: mail.html, body: mail.text, name: S.FROM_NAME || 'Clarity & Confidence Compass' };
    if (cleanEmail_(S.SUPPORT_EMAIL)) opts.replyTo = cleanEmail_(S.SUPPORT_EMAIL);
    MailApp.sendEmail(opts);
    if (ready) {
      setCells_(sh, row, { EmailStatus: 'SENT', EmailSentAt: new Date() });
      fulfil_(o, type, 'SENT', '');
    } else {
      setCells_(sh, row, { EmailStatus: 'CONFIRMATION_SENT' });
      fulfil_(o, type, 'CONFIRMATION_SENT', 'Access details not in Settings yet. When ready: Sales Funnel → Send Access to Everyone Waiting');
    }
  } catch (err) {
    // PaymentStatus stays PAID. Only the email failed.
    setCells_(sh, row, { EmailStatus: 'FAILED' });
    fulfil_(o, type, 'FAILED', String(err));
  }
}

function accessReady_(S) { return !!(S.CLASSROOM_CODE || S.CLASSROOM_URL); }

function confirmationEmail_(o, S) {
  var first = String(o.Name).replace(/^'/, '').split(' ')[0];
  var offer = S.OFFER_NAME || 'Clarity & Confidence Compass';
  var html =
    '<div style="background:#EEF5EF;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0F3B2C">' +
    '<div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:28px">' +
    '<p style="font-size:12px;letter-spacing:2px;color:#217047;font-weight:bold;margin:0">PAYMENT CONFIRMED · FOUNDING BATCH</p>' +
    '<h1 style="font-size:26px;margin:8px 0 12px">Salamat, ' + esc_(first) + '! You’re in.</h1>' +
    '<p style="font-size:16px;line-height:1.6">' + esc_(S.WELCOME_NOTE || '') + '</p>' +
    '<p style="font-size:15px;line-height:1.6">Your payment for order <b>' + esc_(o.OrderId) + '</b> is confirmed, and your seat in ' + esc_(offer) + ' is saved.</p>' +
    '<p style="font-size:15px;line-height:1.6">I’m finalizing the course dates and our Google Classroom. You’ll get a second email with your Classroom code, the Archetype Quiz and your Compass Workbook before Week 1. Wala ka pang kailangang gawin.</p>' +
    '<p style="font-size:13px;color:#3E6B58;line-height:1.6;margin-top:18px">This is coaching, not therapy. If you’re in crisis, reach the NCMH Crisis Hotline: 1553 · 0917-899-8727 · 0919-057-1553 (24/7), or call 911.</p>' +
    '</div></div>';
  var text = 'Salamat, ' + first + '! You’re in.\n\n' + (S.WELCOME_NOTE || '') +
    '\n\nYour payment for order ' + o.OrderId + ' is confirmed, and your seat in ' + offer + ' is saved.' +
    '\n\nI’m finalizing the course dates and our Google Classroom. You’ll get a second email with your Classroom code, the Archetype Quiz and your Compass Workbook before Week 1.' +
    '\n\nThis is coaching, not therapy. NCMH Crisis Hotline: 1553 · 0917-899-8727 · 0919-057-1553 (24/7), or 911.';
  return { subject: 'Payment confirmed: your ' + offer + ' seat is saved', html: html, text: text };
}

function accessEmail_(o, S) {
  var first = String(o.Name).replace(/^'/, '').split(' ')[0];
  var offer = S.OFFER_NAME || 'Clarity & Confidence Compass';
  var items = [];
  if (S.CLASSROOM_CODE) items.push(['Google Classroom code', '<b style="font-size:20px;letter-spacing:2px">' + esc_(S.CLASSROOM_CODE) + '</b>', 'Google Classroom code: ' + S.CLASSROOM_CODE]);
  if (S.CLASSROOM_URL) items.push(['Join Classroom', link_(S.CLASSROOM_URL, 'Open Google Classroom'), 'Join Classroom: ' + S.CLASSROOM_URL]);
  if (S.QUIZ_URL) items.push(['Week 0: Archetype Quiz', link_(S.QUIZ_URL, 'Take the quiz'), 'Archetype Quiz: ' + S.QUIZ_URL]);
  if (S.WORKBOOK_URL) items.push(['Compass Workbook', link_(S.WORKBOOK_URL, 'Make your copy'), 'Compass Workbook: ' + S.WORKBOOK_URL]);

  var rows = items.map(function (i) {
    return '<tr><td style="padding:10px 0;color:#3E6B58;font-size:14px;width:44%">' + i[0] + '</td><td style="padding:10px 0">' + i[1] + '</td></tr>';
  }).join('');

  var html =
    '<div style="background:#EEF5EF;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0F3B2C">' +
    '<div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:28px">' +
    '<p style="font-size:12px;letter-spacing:2px;color:#217047;font-weight:bold;margin:0">YOU’RE IN · FOUNDING BATCH</p>' +
    '<h1 style="font-size:26px;margin:8px 0 12px">Hi ' + esc_(first) + ', welcome to ' + esc_(offer) + '!</h1>' +
    '<p style="font-size:16px;line-height:1.6">' + esc_(S.WELCOME_NOTE || '') + '</p>' +
    '<p style="font-size:15px;line-height:1.6">Your payment for order <b>' + esc_(o.OrderId) + '</b> is confirmed. Here’s how to start:</p>' +
    '<table style="width:100%;border-collapse:collapse;border-top:1px solid #D3E5D9;border-bottom:1px solid #D3E5D9">' + rows + '</table>' +
    '<p style="font-size:15px;line-height:1.6;margin-top:18px"><b>Course dates:</b> ' + esc_(S.COURSE_DATES || 'To be announced') + '</p>' +
    '<div style="background:#FCF3DC;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.6">' +
    '<b>Your weekly rhythm</b><br>Mon: lesson + activity, due Wednesday<br>Wed: lesson + activity, due Friday<br>' +
    'Fri: live call on Google Meet, 8:00–8:55 PM (recorded)<br>Weekends: wala kang gagawin.</div>' +
    '<p style="font-size:13px;color:#3E6B58;line-height:1.6;margin-top:18px">This is coaching, not therapy. If you’re in crisis, reach the NCMH Crisis Hotline: 1553 · 0917-899-8727 · 0919-057-1553 (24/7), or call 911.</p>' +
    (S.SUPPORT_EMAIL ? '<p style="font-size:13px;color:#3E6B58">Questions? Just reply to this email.</p>' : '') +
    '</div></div>';

  var text = 'Hi ' + first + ', welcome to ' + offer + '!\n\n' + (S.WELCOME_NOTE || '') +
    '\n\nYour payment for order ' + o.OrderId + ' is confirmed.\n\n' +
    items.map(function (i) { return i[2]; }).join('\n') +
    '\n\nCourse dates: ' + (S.COURSE_DATES || 'To be announced') +
    '\n\nMon: lesson + activity, due Wednesday\nWed: lesson + activity, due Friday\nFri: live call, 8:00–8:55 PM\n' +
    '\nThis is coaching, not therapy. NCMH Crisis Hotline: 1553 · 0917-899-8727 · 0919-057-1553 (24/7), or 911.';

  return { subject: 'You’re in! Your ' + offer + ' access', html: html, text: text };
}

/* ===================== MENU ===================== */
function menuResendAccess() {
  var ui = SpreadsheetApp.getUi();
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== 'Orders') return ui.alert('Open the Orders tab and click a buyer’s row first.');
  var row = sh.getActiveRange().getRow();
  if (row < 2) return ui.alert('Click a buyer’s row (not the header).');
  var o = rowObj_(sh, row);
  if (o.PaymentStatus !== 'PAID') return ui.alert('Only PAID orders can get access. This order is ' + o.PaymentStatus + '.');
  sendAccess_(row, 'RESEND');
  ui.alert('Done. EmailStatus is now: ' + rowObj_(sh, row).EmailStatus + '\n(See the Fulfillment tab for details.)');
}

function menuSendAccessAll() {
  var ui = SpreadsheetApp.getUi(), S = settings_();
  if (!accessReady_(S)) return ui.alert('Fill CLASSROOM_CODE in the Settings tab first. (Also update COURSE_DATES, QUIZ_URL and WORKBOOK_URL if you have them.)');
  var sh = sheet_('Orders');
  var statuses = colValues_(sh, 'PaymentStatus'), emailStatuses = colValues_(sh, 'EmailStatus');
  var waiting = [];
  statuses.forEach(function (s, i) { if (s === 'PAID' && emailStatuses[i] !== 'SENT') waiting.push(i + 2); });
  if (!waiting.length) return ui.alert('Everyone who is PAID already has their access email.');
  if (ui.alert('Send the full access email to ' + waiting.length + ' paid buyer(s)?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var sent = 0;
  waiting.forEach(function (r) { sendAccess_(r, 'ACCESS'); if (rowObj_(sh, r).EmailStatus === 'SENT') sent++; });
  ui.alert('Sent: ' + sent + ' of ' + waiting.length + '. See the Fulfillment tab for details.');
}

function menuQuota() {
  SpreadsheetApp.getUi().alert('Emails you can still send today: ' + MailApp.getRemainingDailyQuota());
}

/* ===================== SECURITY HELPERS ===================== */
function verifyTurnstile_(token) {
  var secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  if (!secret) { log_('ERROR', 'turnstile', 'REQUIRE_TURNSTILE is TRUE but TURNSTILE_SECRET is missing'); return false; }
  if (!token) return false;
  try {
    var res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post', payload: { secret: secret, response: String(token) }, muteHttpExceptions: true
    });
    return JSON.parse(res.getContentText()).success === true;
  } catch (err) { log_('WARN', 'turnstile', String(err)); return false; }
}

/** Simple counter in CacheService: max `limit` calls per `seconds` per key. */
function rateOk_(bucket, key, limit, seconds) {
  var cache = CacheService.getScriptCache();
  var windowId = Math.floor(Date.now() / 1000 / seconds);
  var k = 'rl:' + bucket + ':' + Utilities.base64EncodeWebSafe(String(key)).slice(0, 180) + ':' + windowId;
  var n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), seconds + 5);
  if (n > limit) { log_('WARN', 'rateLimit', bucket + ' ' + key); return false; }
  return true;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Could not get lock');
  try { return fn(); } finally { lock.releaseLock(); }
}

function safeEqual_(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function clean_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max); }
function cleanEmail_(v) {
  var e = clean_(v, 120).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : '';
}
/** Stops spreadsheet formula injection (=, +, -, @ at the start). */
function safe_(v) { v = String(v || ''); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function esc_(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function link_(url, label) {
  url = String(url);
  if (!/^https:\/\//i.test(url)) return esc_(url);
  return '<a href="' + esc_(url) + '" style="color:#217047;font-weight:bold">' + esc_(label) + '</a>';
}
function isTrue_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function shortId_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase(); }

/* ===================== SHEET HELPERS ===================== */
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '". Run setupCRM().');
  return sh;
}
function headers_(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]; }
function col_(sh, name) {
  var i = headers_(sh).indexOf(name);
  if (i === -1) throw new Error('Missing column "' + name + '" in ' + sh.getName() + '. Run setupCRM().');
  return i + 1;
}
function colValues_(sh, name) {
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, col_(sh, name), sh.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; });
}
function findRow_(sh, name, value) {
  var vals = colValues_(sh, name);
  var i = vals.indexOf(value);
  return i === -1 ? 0 : i + 2;
}
function rowObj_(sh, row) {
  var h = headers_(sh), v = sh.getRange(row, 1, 1, h.length).getValues()[0], o = {};
  h.forEach(function (k, i) { o[k] = v[i]; });
  return o;
}
function appendObj_(sh, obj) {
  sh.appendRow(headers_(sh).map(function (h) { return obj[h] !== undefined ? obj[h] : ''; }));
}
function setCells_(sh, row, obj) {
  var h = headers_(sh);
  Object.keys(obj).forEach(function (k) {
    var i = h.indexOf(k);
    if (i > -1) sh.getRange(row, i + 1).setValue(obj[k]);
  });
}
function settings_() {
  var sh = sheet_('Settings'), out = {};
  if (sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { if (r[0]) out[String(r[0]).trim()] = r[1]; });
  return out;
}
function fulfil_(o, type, result, detail) {
  try {
    appendObj_(sheet_('Fulfillment'), { Time: new Date(), OrderId: o.OrderId, Email: o.Email, Type: type, Result: result, Detail: safe_(detail) });
  } catch (e) {}
}
function log_(level, action, detail) {
  try {
    appendObj_(sheet_('Logs'), { Time: new Date(), Level: level, Action: safe_(action), Detail: safe_(String(detail).slice(0, 500)) });
  } catch (e) {}
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
