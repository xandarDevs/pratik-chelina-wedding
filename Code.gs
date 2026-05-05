const SHEET_NAME = 'RSVPs';

// Twilio credentials — store these in Apps Script > Project Settings > Script properties:
//   TWILIO_ACCOUNT_SID   your Twilio Account SID
//   TWILIO_AUTH_TOKEN    your Twilio Auth Token
//   TWILIO_FROM_NUMBER   your Twilio phone number in E.164 format (e.g. +14155550100)
const MANDALA_FILE_ID = '19It10MzbdM5zgUzj1eBd86Kaqq82ljd1';
const MANDALA_CONTENT_ID = 'weddingMandala';
const MAP_IMAGE_FILE_ID = '';
const MAP_CONTENT_ID = 'venueMap';
const GOOGLE_MAPS_URL = 'https://www.google.ca/maps/place/Speranza+Banquet+Hall/@43.7494212,-79.6793255,357m/data=!3m1!1e3!4m6!3m5!1s0x882b3cf16e13928f:0x5e5acc23452f3e69!8m2!3d43.7493559!4d-79.6781781!16s%2Fg%2F11b5wkxfs2?entry=ttu&g_ep=EgoyMDI2MDQyOS4wIKXMDSoASAFQAw%3D%3D';
const EVENT_TITLE = 'Pratik & Chelina Wedding Reception';
const EVENT_LOCATION = 'The King Hall, Speranza Restaurant & Banquet Hall, 510 Deerhurst Dr., Brampton, ON';
const EVENT_START_UTC = '20260703T220000Z';
const EVENT_END_UTC = '20260704T030000Z';

function doPost(e) {
  try {
    const data = parseRsvpPayload(e);
    validateRsvp(data);
    const emailResult = sendThankYouEmail(data);
    const smsResult = sendThankYouSms(data);
    appendRsvpToSheet(data, emailResult, smsResult);

    return jsonResponse({
      success: true,
      email: emailResult,
      sms: smsResult
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

function validateRsvp(data) {
  if (!data.name || !data.attendance) {
    throw new Error('Missing required RSVP fields');
  }
}

function appendRsvpToSheet(data, emailResult, smsResult) {
  const sheet = getRsvpSheet();
  const guests = Array.isArray(data.guests) ? data.guests : [];

  sheet.appendRow([
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
    emailResult.error || '',
    smsResult.status,
    smsResult.error || ''
  ]);
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
    'Email Error',
    'SMS Status',
    'SMS Error'
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

function sendThankYouSms(data) {
  if (!data.phone) {
    return {
      status: 'Skipped - no phone number',
      error: ''
    };
  }

  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    const accountSid = scriptProperties.getProperty('TWILIO_ACCOUNT_SID');
    const authToken = scriptProperties.getProperty('TWILIO_AUTH_TOKEN');
    const fromNumber = scriptProperties.getProperty('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      return {
        status: 'Skipped - Twilio not configured',
        error: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in Script Properties'
      };
    }

    const accepting = data.attendance === 'Accepted';
    const body = accepting ? buildAcceptedSms(data) : buildDeclinedSms(data);
    const toNumber = normalizePhone(data.phone);

    const url = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Messages.json';

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      payload: {
        To: toNumber,
        From: fromNumber,
        Body: body
      },
      headers: {
        Authorization: 'Basic ' + Utilities.base64Encode(accountSid + ':' + authToken)
      },
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();

    if (status === 201) {
      return {
        status: 'Sent',
        error: ''
      };
    }

    const responseBody = response.getContentText();
    console.error('Twilio returned HTTP ' + status + ': ' + responseBody);

    return {
      status: 'Failed',
      error: 'HTTP ' + status + ': ' + responseBody
    };
  } catch (error) {
    console.error('Failed to send thank-you SMS:', error);

    return {
      status: 'Failed',
      error: error.message || String(error)
    };
  }
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');

  if (digits.startsWith('+')) {
    return digits;
  }

  if (digits.length === 10) {
    return '+1' + digits;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits;
  }

  return digits;
}

function buildAcceptedSms(data) {
  return (
    'Hi ' + data.name + '! Thank you for your RSVP. ' +
    'We are so happy you will be joining us to celebrate the wedding of Pratik & Chelina. ' +
    'The reception is on Friday, July 3rd 2026 from 6–11 PM at ' +
    'Speranza Restaurant & Banquet Hall, 510 Deerhurst Dr., Brampton, ON. ' +
    'We can\'t wait to celebrate with you!'
  );
}

function buildDeclinedSms(data) {
  return (
    'Hi ' + data.name + '! Thank you for letting us know. ' +
    'We are sorry you won\'t be able to join us, but your love and good wishes mean so much to Pratik & Chelina.'
  );
}

function testThankYouSms() {
  const testPhone = PropertiesService.getScriptProperties().getProperty('TEST_PHONE_NUMBER');

  if (!testPhone) {
    throw new Error('Set TEST_PHONE_NUMBER in Script Properties and run again.');
  }

  const result = sendThankYouSms({
    name: 'Test Guest',
    attendance: 'Accepted',
    phone: testPhone
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
    'As seating is limited, please contact the family of the bride or groom if you need to make any changes to the guests listed above.',
    '',
    'As a gentle reminder, your presence and blessings are the greatest gift; the newlyweds kindly request no boxed gifts.',
    '',
    'With love,',
    'The families of Pratik & Chelina'
  ].join('\n');
}

function buildDeclinedEmail(data) {
  return [
    'Dear ' + data.name + ',',
    '',
    'Thank you for your RSVP. We are sorry that you will not be able to join us, but we truly appreciate you letting us know.',
    '',
    'Your love, blessings, and good wishes mean so much to Pratik and Chelina as they begin this new chapter together.',
    '',
    'With love,',
    'The families of Pratik & Chelina'
  ].join('\n');
}

function buildAcceptedEmailHtml(data, hasMandala, hasMapImage) {
  const guests = Array.isArray(data.guests) ? data.guests : [];
  const guestList = guests.length
    ? formatGuestListHtml(guests)
    : '<p style="margin:0;color:#fdf8f0;">No additional guests listed.</p>';
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
    '<div style="margin:0 0 22px;padding:16px 18px;background:rgba(253,248,240,.06);border:1px solid rgba(238,194,25,.22);">' + guestList + '</div>',
    '<p style="margin:0 0 18px;line-height:1.7;color:#fdf8f0;font-size:18px;">As seating is limited, please contact the family of the bride or groom if you need to make any changes to the guests listed above.</p>',
    '<p style="margin:0;line-height:1.7;color:#fdf8f0;font-size:18px;">As a gentle reminder, your presence and blessings are the greatest gift; the newlyweds kindly request no boxed gifts.</p>'
  ].join(''), hasMandala);
}

function buildDeclinedEmailHtml(data, hasMandala) {
  return emailShell([
    '<p style="margin:0 0 18px;color:#fdf8f0;font-size:18px;">Dear ' + escapeHtml(data.name) + ',</p>',
    '<p style="margin:0 0 18px;line-height:1.7;color:#fdf8f0;font-size:18px;">Thank you for your RSVP. We are sorry that you will not be able to join us, but we truly appreciate you letting us know.</p>',
    '<p style="margin:0;line-height:1.7;color:#fdf8f0;font-size:18px;">Your love, blessings, and good wishes mean so much to Pratik and Chelina as they begin this new chapter together.</p>'
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
    '<div style="margin:0;padding:28px 16px;background:#7E1215;color:#fdf8f0;font-family:Arial,Helvetica,sans-serif;">',
    '<div style="max-width:640px;margin:0 auto;background:#5a0d0f;border:1px solid #EEC219;border-radius:6px;padding:10px;">',
    '<div style="border:1px solid rgba(238,194,25,.38);border-radius:4px;padding:28px 22px;">',
    '<div style="text-align:center;margin:0 0 26px;">',
    topMandalaHtml,
    '<div style="color:#EEC219;font-family:\'Playfair Display\',Georgia,serif;font-size:48px;line-height:1.1;">Pratik &amp; Chelina</div>',
    '<div style="margin:16px auto 0;text-align:center;color:#EEC219;font-size:16px;letter-spacing:5px;">&#10022; &nbsp; &#10022; &nbsp; &#10022;</div>',
    '<div style="width:150px;height:1px;background:linear-gradient(90deg,transparent,#EEC219,transparent);margin:16px auto 0;"></div>',
    '</div>',
    content,
    '<div style="width:150px;height:1px;background:linear-gradient(90deg,transparent,#EEC219,transparent);margin:28px auto 0;"></div>',
    '<p style="margin:30px 0 0;line-height:1.7;color:#fdf8f0;font-size:18px;">With love,<br>The families of Pratik &amp; Chelina</p>',
    '<div style="text-align:center;margin-top:22px;">' + bottomMandalaHtml + '</div>',
    '</div>',
    '</div>',
    '</div>'
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
