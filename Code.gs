const SHEET_NAME = 'RSVPs';

function doPost(e) {
  try {
    const data = parseRsvpPayload(e);
    validateRsvp(data);
    appendRsvpToSheet(data);
    sendThankYouEmail(data);

    return jsonResponse({
      success: true
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

function appendRsvpToSheet(data) {
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
    data.message || ''
  ]);
}

function getRsvpSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Submitted At',
      'Name',
      'Attendance',
      'Email',
      'Phone',
      'Has Guests',
      'Guest Count',
      'Guests',
      'Dietary Requirements',
      'Message'
    ]);
  }

  return sheet;
}

function sendThankYouEmail(data) {
  if (!data.email) {
    return;
  }

  const accepting = data.attendance === 'Accepted';
  const subject = accepting
    ? 'Thank You for Your RSVP'
    : 'Thank You for Letting Us Know';

  const body = accepting
    ? buildAcceptedEmail(data)
    : buildDeclinedEmail(data);

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    body: body
  });
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
