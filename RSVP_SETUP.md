# RSVP Google Sheets Integration Setup

This guide walks you through setting up Google Sheets to receive RSVP submissions from your wedding website.

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet and name it `"Pratik & Chelina - Wedding RSVPs"`
3. Rename the first sheet tab from "Sheet1" to `"Responses"`
4. In the first row, add these column headers:
   - A1: `Timestamp`
   - B1: `Name`
   - C1: `Attendance`
   - D1: `Email`
   - E1: `Phone`
   - F1: `Has Guests`
   - G1: `Guest Count`
   - H1: `Guests (Details)`
   - I1: `Dietary Requirements`
   - J1: `Message`

## Step 2: Create the Apps Script

1. From your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any existing code in the editor
3. Copy and paste the entire code from the **AppsScript.gs** code block below
4. Save the file (Ctrl+S or Cmd+S)

### AppsScript.gs

```javascript
// RSVP Google Sheets Web App
// This endpoint receives RSVP form submissions and appends them to the sheet

function doPost(e) {
  try {
    // Parse the form data from the request
    const payload = JSON.parse(e.postData.contents);
    
    // Get the active sheet
    const sheet = SpreadsheetApp.getActiveSheet();
    
    // Build the guest details string
    let guestDetails = '';
    if (payload.guests && payload.guests.length > 0) {
      guestDetails = payload.guests.map((g, i) => 
        `${i + 1}. ${g.name} (${g.relationship})`
      ).join('; ');
    }
    
    // Append a new row with the RSVP data
    const newRow = [
      new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }),
      payload.name || '',
      payload.attendance || '',
      payload.email || '',
      payload.phone || '',
      payload.hasGuests || 'No',
      payload.guestCount || '0',
      guestDetails || '',
      payload.dietary || '',
      payload.message || ''
    ];
    
    sheet.appendRow(newRow);
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'RSVP received successfully'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    // Return error response
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Step 3: Deploy the Apps Script as a Web App

1. In the Apps Script editor, click **Deploy** → **New Deployment**
2. Select deployment type: **Web app**
3. Configure:
   - **Execute as:** Your Google account (the sheet owner)
   - **Who has access:** `Anyone` (allows anonymous submissions)
4. Click **Deploy**
5. You'll see a deployment ID and a URL. **Copy this URL** — you'll need it in Step 4
6. The URL will look like: `https://script.google.com/macros/d/{DEPLOYMENT_ID}/userweb`

## Step 4: Update the Website

1. Open `index.html` in your editor
2. Find the `submitRSVP()` function
3. In the `confirmRSVP()` function, replace the `YOUR_APPS_SCRIPT_URL` placeholder with the actual URL from Step 3

**Example:**
```javascript
const appsScriptUrl = 'https://script.google.com/macros/d/YOUR_DEPLOYMENT_ID/userweb';
```

## Step 5: Test the RSVP Form

1. Open your wedding website locally or on your hosting
2. Scroll to the RSVP section
3. Fill out and submit the form
4. You should see a success message
5. Go back to your Google Sheet and refresh — a new row should appear with your submission

## Troubleshooting

**Form submits but no data appears in the sheet:**
- Check the browser console (F12) for error messages
- Verify the Apps Script URL is correct
- Make sure the Apps Script was deployed as "Web app" with "Anyone" access

**CORS or permission errors:**
- The Apps Script deployment must have "Anyone" access selected
- The website must submit valid JSON data

**Data appears in the sheet but with strange formatting:**
- Verify that the column headers match exactly as listed in Step 1
- Check that the Apps Script code is copying all 10 fields in the correct order

## Notes

- All timestamps are recorded in Eastern Time (Toronto, matching the reception location)
- The sheet will automatically grow with each submission
- You can sort, filter, and format the data directly in Google Sheets for easy RSVP tracking
