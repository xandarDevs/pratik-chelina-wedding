const SHEET_NAME = 'RSVPs';

const COUPLE_EMAIL_ADDRESSES = 'pradhan.pratik@hotmail.com,chelina_sharma@outlook.com';
const MANDALA_FILE_ID = '19It10MzbdM5zgUzj1eBd86Kaqq82ljd1';
const MANDALA_CONTENT_ID = 'weddingMandala';
const MAP_IMAGE_FILE_ID = '';
const MAP_CONTENT_ID = 'venueMap';
const GOOGLE_MAPS_URL = 'https://www.google.ca/maps/place/Speranza+Banquet+Hall/@43.7494212,-79.6793255,357m/data=!3m1!1e3!4m6!3m5!1s0x882b3cf16e13928f:0x5e5acc23452f3e69!8m2!3d43.7493559!4d-79.6781781!16s%2Fg%2F11b5wkxfs2?entry=ttu&g_ep=EgoyMDI2MDQyOS4wIKXMDSoASAFQAw%3D%3D';
const EVENT_TITLE = 'Pratik & Chelina Wedding Reception';
const EVENT_LOCATION = 'The King Hall, Speranza Restaurant & Banquet Hall, 510 Deerhurst Dr., Brampton, ON';
const EVENT_START_UTC = '20260703T220000Z';
const EVENT_END_UTC = '20260704T030000Z';
const RSVP_DEADLINE_UTC = new Date('2026-06-16T04:00:00Z'); // June 15, 2026 at 11:59 PM Toronto time.
const EDIT_CODE_TTL_SECONDS = 10 * 60;
const EDIT_TOKEN_TTL_SECONDS = 30 * 60;

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : '';
    const email = e && e.parameter ? e.parameter.email : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      throw new Error('A valid email address is required');
    }

    if (action === 'requestEditCode') {
      enforceRsvpDeadline();

      return jsonResponse(requestEditCode(email));
    }

    if (action === 'verifyEditCode') {
      enforceRsvpDeadline();

      return jsonResponse(verifyEditCode(email, e.parameter.code));
    }

    throw new Error('Unknown RSVP lookup action');
  } catch (error) {
    console.error(error);

    return jsonResponse({
      success: false,
      error: error.message || 'Unable to load RSVP'
    });
  }
}

function requestEditCode(email) {
  const rsvp = getRsvpByEmail(email);

  if (!rsvp) {
    return {
      success: true,
      codeSent: false
    };
  }

  const code = createEditCode();
  CacheService
    .getScriptCache()
    .put(getEditCodeCacheKey(email), code, EDIT_CODE_TTL_SECONDS);
  sendEditCodeEmail(email, code);

  return {
    success: true,
    codeSent: true
  };
}

function verifyEditCode(email, code) {
  const cleanCode = String(code || '').trim();
  const cache = CacheService.getScriptCache();
  const cacheKey = getEditCodeCacheKey(email);
  const savedCode = cache.get(cacheKey);

  if (!savedCode || cleanCode !== savedCode) {
    return {
      success: false,
      error: 'The one-time code is invalid or has expired.'
    };
  }

  cache.remove(cacheKey);
  const editToken = Utilities.getUuid();
  cache.put(getEditTokenCacheKey(email), editToken, EDIT_TOKEN_TTL_SECONDS);

  return {
    success: true,
    editToken: editToken,
    rsvp: getRsvpByEmail(email)
  };
}

function createEditCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getEditCodeCacheKey(email) {
  return 'rsvp-edit-code:' + normalizeEmail(email);
}

function getEditTokenCacheKey(email) {
  return 'rsvp-edit-token:' + normalizeEmail(email);
}

function validateExistingRsvpEditAccess(data) {
  const sheet = getRsvpSheet();

  if (!findExistingRsvpRowByEmail(sheet, data.email)) {
    return;
  }

  const savedToken = CacheService
    .getScriptCache()
    .get(getEditTokenCacheKey(data.email));

  if (!savedToken || String(data.editToken || '') !== savedToken) {
    throw new Error('Please verify the one-time code sent to your email before updating this RSVP.');
  }
}

function consumeEditToken(email) {
  CacheService
    .getScriptCache()
    .remove(getEditTokenCacheKey(email));
}

function sendEditCodeEmail(email, code) {
  try {
    MailApp.sendEmail({
      to: email,
      subject: 'Your RSVP Edit Code',
      body: [
        'Your one-time code to edit your RSVP is:',
        '',
        code,
        '',
        'This code expires in 10 minutes.',
        '',
        'If you did not request this code, you can ignore this email.',
        '',
        'With love,',
        'The families of Pratik & Chelina'
      ].join('\n'),
      name: 'Pratik & Chelina Wedding'
    });
  } catch (error) {
    console.error('Failed to send RSVP edit code:', error);
    throw new Error('Unable to send the one-time code. Please try again.');
  }
}

function doPost(e) {
  try {
    const data = parseRsvpPayload(e);
    enforceRsvpDeadline();
    validateRsvp(data);
    validateExistingRsvpEditAccess(data);
    const emailResult = sendThankYouEmail(data);
    const saveResult = saveRsvpToSheet(data, emailResult);

    return jsonResponse({
      success: true,
      updated: saveResult.updated,
      email: emailResult
    });
  } catch (error) {
    console.error(error);

    return jsonResponse({
      success: false,
      error: error.message || 'Unable to submit RSVP'
    });
  }
}

function parseRsvpPayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Missing request body');
  }

  return JSON.parse(e.postData.contents);
}

function enforceRsvpDeadline() {
  if (new Date() >= RSVP_DEADLINE_UTC) {
    throw new Error('RSVPs are now closed due to limited seating.');
  }
}

function validateRsvp(data) {
  if (!data.name || !data.attendance) {
    throw new Error('Missing required RSVP fields');
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) {
    throw new Error('A valid email address is required');
  }
}

function saveRsvpToSheet(data, emailResult) {
  const sheet = getRsvpSheet();
  const row = buildRsvpRow(data, emailResult);
  const existingRow = findExistingRsvpRowByEmail(sheet, data.email);

  if (existingRow) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    consumeEditToken(data.email);

    return {
      updated: true
    };
  }

  sheet.appendRow(row);

  return {
    updated: false
  };
}

function buildRsvpRow(data, emailResult) {
  const guests = Array.isArray(data.guests) ? data.guests : [];

  return [
    new Date(),
    data.name || '',
    data.attendance || '',
    data.email || '',
    data.phone || '',
    data.hasGuests || 'No',
    data.guestCount || '0',
    formatGuestList(guests),
    data.dietary || '',
    data.message || '',
    emailResult.status,
    emailResult.error || ''
  ];
}

function findExistingRsvpRowByEmail(sheet, email) {
  const normalizedEmail = normalizeEmail(email);
  const lastRow = sheet.getLastRow();

  if (!normalizedEmail || lastRow < 2) {
    return 0;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const emailColumn = headers.indexOf('Email') + 1;

  if (!emailColumn) {
    return 0;
  }

  const emails = sheet.getRange(2, emailColumn, lastRow - 1, 1).getValues();

  for (let i = emails.length - 1; i >= 0; i--) {
    if (normalizeEmail(emails[i][0]) === normalizedEmail) {
      return i + 2;
    }
  }

  return 0;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getRsvpByEmail(email) {
  const sheet = getRsvpSheet();
  const rowNumber = findExistingRsvpRowByEmail(sheet, email);

  if (!rowNumber) {
    return null;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const valueByHeader = {};

  headers.forEach(function(header, index) {
    valueByHeader[header] = row[index];
  });

  return {
    name: valueByHeader['Name'] || '',
    attendance: valueByHeader['Attendance'] || '',
    email: valueByHeader['Email'] || '',
    phone: valueByHeader['Phone'] || '',
    hasGuests: valueByHeader['Has Guests'] || 'No',
    guestCount: String(valueByHeader['Guest Count'] || '0'),
    guests: parseGuestList(valueByHeader['Guests']),
    dietary: valueByHeader['Dietary Requirements'] || '',
    message: valueByHeader['Message'] || ''
  };
}

function parseGuestList(guestList) {
  return String(guestList || '')
    .split(/\r?\n/)
    .map(function(line) {
      const match = line.match(/^\d+\.\s*(.*?)(?:\s*\((.*)\))?$/);

      if (!match) {
        return null;
      }

      return {
        name: match[1] || '',
        relationship: match[2] || ''
      };
    })
    .filter(function(guest) {
      return guest && guest.name;
    });
}

function getRsvpSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const headers = [
    'Submitted At',
    'Name',
    'Attendance',
    'Email',
    'Phone',
    'Has Guests',
    'Guest Count',
    'Guests',
    'Dietary Requirements',
    'Message',
    'Email Status',
    'Email Error'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    const existingHeaders = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const missingHeaders = headers.filter(function(header) {
      return existingHeaders.indexOf(header) === -1;
    });

    if (missingHeaders.length) {
      sheet
        .getRange(1, existingHeaders.length + 1, 1, missingHeaders.length)
        .setValues([missingHeaders]);
    }
  }

  return sheet;
}

function sendThankYouEmail(data) {
  if (!data.email) {
    return {
      status: 'Skipped - no email address',
      error: ''
    };
  }

  const accepting = data.attendance === 'Accepted';
  const subject = accepting
    ? 'Thank You for Your RSVP'
    : 'Thank You for Letting Us Know';

  const body = accepting
    ? buildAcceptedEmail(data)
    : buildDeclinedEmail(data);
  const mandalaBlob = getMandalaBlob();
  const mapBlob = getMapBlob();
  const htmlBody = accepting
    ? buildAcceptedEmailHtml(data, Boolean(mandalaBlob), Boolean(mapBlob))
    : buildDeclinedEmailHtml(data, Boolean(mandalaBlob));

  try {
    const emailOptions = {
      to: data.email,
      bcc: COUPLE_EMAIL_ADDRESSES,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      name: 'Pratik & Chelina Wedding'
    };

    if (mandalaBlob) {
      emailOptions.inlineImages = {};
      emailOptions.inlineImages[MANDALA_CONTENT_ID] = mandalaBlob;
    }

    if (mapBlob) {
      if (!emailOptions.inlineImages) {
        emailOptions.inlineImages = {};
      }
      emailOptions.inlineImages[MAP_CONTENT_ID] = mapBlob;
    }

    if (accepting) {
      emailOptions.attachments = [buildCalendarInvite()];
    }

    MailApp.sendEmail(emailOptions);

    return {
      status: 'Sent',
      error: ''
    };
  } catch (error) {
    console.error('Failed to send thank-you email:', error);

    return {
      status: 'Failed',
      error: error.message || String(error)
    };
  }
}

function testThankYouEmail() {
  const testEmail = Session.getEffectiveUser().getEmail();

  if (!testEmail) {
    throw new Error('Could not detect your email address. Replace testEmail with your email address and run again.');
  }

  const result = sendThankYouEmail({
    name: 'Test Guest',
    attendance: 'Accepted',
    email: testEmail,
    hasGuests: 'Yes',
    guestCount: '2',
    guests: [
      {
        name: 'Guest One',
        relationship: 'Friend'
      },
      {
        name: 'Guest Two',
        relationship: 'Family'
      }
    ],
    dietary: '',
    message: ''
  });

  console.log(result);
}

function addMissingEmailColumns() {
  getRsvpSheet();
}

function getMandalaBlob() {
  if (!MANDALA_FILE_ID) {
    return null;
  }

  try {
    return DriveApp
      .getFileById(MANDALA_FILE_ID)
      .getBlob()
      .setName('wedding-mandala.png');
  } catch (error) {
    console.error('Failed to load email mandala:', error);
    return null;
  }
}

function getMapBlob() {
  if (!MAP_IMAGE_FILE_ID) {
    return null;
  }

  try {
    return DriveApp
      .getFileById(MAP_IMAGE_FILE_ID)
      .getBlob()
      .setName('venue-map.png');
  } catch (error) {
    console.error('Failed to load venue map image:', error);
    return null;
  }
}

function buildCalendarInvite() {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pratik and Chelina Wedding//RSVP//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:pratik-chelina-wedding-reception-20260703@speranza',
    'DTSTAMP:' + Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'"),
    'DTSTART:' + EVENT_START_UTC,
    'DTEND:' + EVENT_END_UTC,
    'SUMMARY:' + escapeIcsText(EVENT_TITLE),
    'LOCATION:' + escapeIcsText(EVENT_LOCATION),
    'DESCRIPTION:' + escapeIcsText('Wedding reception for Pratik and Chelina. Open in Google Maps: ' + GOOGLE_MAPS_URL),
    'URL:' + GOOGLE_MAPS_URL,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:' + escapeIcsText('Reminder: ' + EVENT_TITLE),
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return Utilities
    .newBlob(ics, 'text/calendar', 'pratik-chelina-wedding-reception.ics');
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function buildAcceptedEmail(data) {
  const guests = Array.isArray(data.guests) ? data.guests : [];
  const guestList = guests.length
    ? formatGuestList(guests)
    : 'No additional guests listed.';

  return [
    'Dear ' + data.name + ',',
    '',
    'Thank you for your RSVP. We are so happy that you will be joining us to celebrate the wedding of Pratik and Chelina.',
    '',
    'The wedding reception will be held on:',
    '',
    'Friday, July 3rd, 2026',
    'From 6:00 PM to 11:00 PM',
    'The King Hall',
    'Speranza Restaurant & Banquet Hall',
    '510 Deerhurst Dr., Brampton, ON',
    '',
    'We have noted that you will be attending with the following guest(s):',
    '',
    guestList,
    '',
  ].concat(formatGuestMessageText(data.message), [
    'If you need to make any changes before the RSVP deadline, please use the same email address and one-time code on the RSVP form.',
    '',
    'As a gentle reminder, your presence and blessings are the greatest gift; the newlyweds kindly request no boxed gifts.',
    '',
    'With love,',
    'The families of Pratik & Chelina'
  ]).join('\n');
}

function buildDeclinedEmail(data) {
  return [
    'Dear ' + data.name + ',',
    '',
    'Thank you for your RSVP. We are sorry that you will not be able to join us, but we truly appreciate you letting us know.',
    '',
    'Your love, blessings, and good wishes mean so much to Pratik and Chelina as they begin this new chapter together.',
    '',
  ].concat(formatGuestMessageText(data.message), [
    'With love,',
    'The families of Pratik & Chelina'
  ]).join('\n');
}

function buildAcceptedEmailHtml(data, hasMandala, hasMapImage) {
  const guests = Array.isArray(data.guests) ? data.guests : [];
  const guestList = guests.length
    ? formatGuestListHtml(guests)
    : '<p style="margin:0;color:#fdf8f0;">No additional guests listed.</p>';
  const guestMessageHtml = formatGuestMessageHtml(data.message);
  const mapImageHtml = hasMapImage
    ? '<a href="' + GOOGLE_MAPS_URL + '" target="_blank" style="display:block;margin:18px auto 0;text-decoration:none;"><img src="cid:' + MAP_CONTENT_ID + '" alt="Map to Speranza Restaurant and Banquet Hall" width="420" style="display:block;width:100%;max-width:420px;height:auto;margin:0 auto;border:1px solid rgba(238,194,25,.45);border-radius:4px;"></a>'
    : '';

  return emailShell([
    '<p style="margin:0 0 18px;color:#fdf8f0;font-size:18px;">Dear ' + escapeHtml(data.name) + ',</p>',
    '<p style="margin:0 0 22px;line-height:1.7;color:#fdf8f0;font-size:18px;">Thank you for your RSVP. We are so happy that you will be joining us to celebrate the wedding of Pratik and Chelina.</p>',
    '<div style="margin:24px 0;padding:22px 18px;border-top:1px solid rgba(238,194,25,.45);border-bottom:1px solid rgba(238,194,25,.45);text-align:center;">',
    '<p style="margin:0 0 10px;color:#EEC219;font-size:14px;letter-spacing:3px;text-transform:uppercase;">Wedding Reception</p>',
    '<p style="margin:0 0 8px;color:#f5d567;font-size:26px;font-family:Georgia,serif;">Friday, July 3rd, 2026</p>',
    '<p style="margin:0 0 14px;color:#fdf8f0;font-size:18px;">From 6:00 PM to 11:00 PM</p>',
    '<p style="margin:0;color:#fdf8f0;line-height:1.6;font-size:18px;">The King Hall<br>Speranza Restaurant &amp; Banquet Hall<br>510 Deerhurst Dr., Brampton, ON</p>',
    '<a href="' + GOOGLE_MAPS_URL + '" target="_blank" style="display:inline-block;margin-top:18px;padding:11px 18px;background:#EEC219;color:#5a0d0f;text-decoration:none;border-radius:3px;font-size:14px;letter-spacing:2px;text-transform:uppercase;">Open in Google Maps</a>',
    mapImageHtml,
    '</div>',
    '<p style="margin:0 0 12px;line-height:1.7;color:#fdf8f0;font-size:18px;">We have noted that you will be attending with the following guest(s):</p>',
    '<div style="margin:0 0 22px;padding:16px 18px;background:#651014;background-color:#651014;border:1px solid #8b6518;">' + guestList + '</div>',
    guestMessageHtml,
    '<p style="margin:0 0 18px;line-height:1.7;color:#fdf8f0;font-size:18px;">If you need to make any changes before the RSVP deadline, please use the same email address and one-time code on the RSVP form.</p>',
    '<p style="margin:0;line-height:1.7;color:#fdf8f0;font-size:18px;">As a gentle reminder, your presence and blessings are the greatest gift; the newlyweds kindly request no boxed gifts.</p>'
  ].join(''), hasMandala);
}

function buildDeclinedEmailHtml(data, hasMandala) {
  const guestMessageHtml = formatGuestMessageHtml(data.message);

  return emailShell([
    '<p style="margin:0 0 18px;color:#fdf8f0;font-size:18px;">Dear ' + escapeHtml(data.name) + ',</p>',
    '<p style="margin:0 0 18px;line-height:1.7;color:#fdf8f0;font-size:18px;">Thank you for your RSVP. We are sorry that you will not be able to join us, but we truly appreciate you letting us know.</p>',
    '<p style="margin:0 0 18px;line-height:1.7;color:#fdf8f0;font-size:18px;">Your love, blessings, and good wishes mean so much to Pratik and Chelina as they begin this new chapter together.</p>',
    guestMessageHtml
  ].join(''), hasMandala);
}

function emailShell(content, hasMandala) {
  const topMandalaHtml = hasMandala
    ? '<img src="cid:' + MANDALA_CONTENT_ID + '" alt="" width="160" style="display:block;width:160px;max-width:160px;height:auto;margin:0 auto 14px;">'
    : '<div style="color:#EEC219;font-size:24px;line-height:1;margin-bottom:12px;">&#10087;</div>';
  const bottomMandalaHtml = hasMandala
    ? '<img src="cid:' + MANDALA_CONTENT_ID + '" alt="" width="160" style="display:block;width:160px;max-width:160px;height:auto;margin:0 auto;">'
    : '<div style="color:#EEC219;font-size:24px;line-height:1;">&#10087;</div>';

  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="color-scheme" content="only light">',
    '<meta name="supported-color-schemes" content="only light">',
    '<style>:root{color-scheme:only light;supported-color-schemes:only light;} body, table, td, div, p, a{-webkit-text-size-adjust:100%;}</style>',
    '</head>',
    '<body style="margin:0;padding:0;background:#7E1215;background-color:#7E1215;color:#fdf8f0;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#7E1215" style="width:100%;background:#7E1215;background-color:#7E1215;margin:0;padding:0;">',
    '<tr>',
    '<td bgcolor="#7E1215" style="background:#7E1215;background-color:#7E1215;padding:28px 16px;color:#fdf8f0;font-family:Arial,Helvetica,sans-serif;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" bgcolor="#5a0d0f" style="max-width:640px;margin:0 auto;background:#5a0d0f;background-color:#5a0d0f;border:1px solid #EEC219;border-radius:6px;">',
    '<tr>',
    '<td bgcolor="#5a0d0f" style="background:#5a0d0f;background-color:#5a0d0f;padding:10px;">',
    '<div style="border:1px solid #997b22;border-radius:4px;padding:28px 22px;background:#5a0d0f;background-color:#5a0d0f;">',
    '<div style="text-align:center;margin:0 0 26px;">',
    topMandalaHtml,
    '<div style="color:#EEC219;font-family:\'Playfair Display\',Georgia,serif;font-size:48px;line-height:1.1;">Pratik &amp; Chelina</div>',
    '<div style="margin:16px auto 0;text-align:center;color:#EEC219;font-size:16px;letter-spacing:5px;">&#10022; &nbsp; &#10022; &nbsp; &#10022;</div>',
    '<div style="width:150px;height:1px;background:#EEC219;background-color:#EEC219;margin:16px auto 0;"></div>',
    '</div>',
    content,
    '<div style="width:150px;height:1px;background:#EEC219;background-color:#EEC219;margin:28px auto 0;"></div>',
    '<p style="margin:30px 0 0;line-height:1.7;color:#fdf8f0;font-size:18px;">With love,<br>The families of Pratik &amp; Chelina</p>',
    '<div style="text-align:center;margin-top:22px;">' + bottomMandalaHtml + '</div>',
    '</div>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '</body>',
    '</html>'
  ].join('');
}

function formatGuestListHtml(guests) {
  const items = guests.map(function(guest) {
    const name = escapeHtml(guest.name || 'Guest');
    const relationship = guest.relationship ? ' <span style="color:#f5d567;">(' + escapeHtml(guest.relationship) + ')</span>' : '';

    return '<li style="margin:0 0 8px;color:#fdf8f0;font-size:18px;">' + name + relationship + '</li>';
  });

  return '<ol style="margin:0;padding-left:22px;">' + items.join('') + '</ol>';
}

function formatGuestMessageHtml(message) {
  const guestMessage = String(message || '').trim();

  if (!guestMessage) {
    return '';
  }

  return [
    '<div style="margin:0 0 22px;padding:16px 18px;background:#651014;background-color:#651014;border:1px solid #8b6518;">',
    '<p style="margin:0 0 8px;color:#EEC219;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Your message to the couple</p>',
    '<p style="margin:0;line-height:1.7;color:#fdf8f0;font-size:18px;">' + escapeHtml(guestMessage).replace(/\r?\n/g, '<br>') + '</p>',
    '</div>'
  ].join('');
}

function formatGuestMessageText(message) {
  const guestMessage = String(message || '').trim();

  if (!guestMessage) {
    return [];
  }

  return [
    'Your message to the couple:',
    guestMessage,
    ''
  ];
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatGuestList(guests) {
  return guests
    .map(function(guest, index) {
      const name = guest.name || 'Guest';
      const relationship = guest.relationship ? ' (' + guest.relationship + ')' : '';

      return (index + 1) + '. ' + name + relationship;
    })
    .join('\n');
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
