# Quick Start: Connect RSVP to Google Sheets

Your `index.html` is now ready to send RSVP data to Google Sheets. Follow these steps to complete the setup:

## 1. Create a Google Sheet and Apps Script

See **RSVP_SETUP.md** in this folder for detailed step-by-step instructions.

TL;DR:
- Create a Google Sheet named "Pratik & Chelina - Wedding RSVPs"
- Add the specified columns (A-J) with headers
- Create an Apps Script from the sheet
- Paste the code from **AppsScript.gs** (or the code block in RSVP_SETUP.md)
- Deploy as a Web App with "Anyone" access
- **Copy the deployed URL**

## 2. Update index.html with Your Apps Script URL

Once you have the deployed URL from step 1, edit `index.html`:

1. Open `index.html` in your editor
2. Go to line ~689 (top of the `<script>` section)
3. Find this line:
   ```javascript
   const appsScriptUrl = 'YOUR_APPS_SCRIPT_URL_HERE';
   ```
4. Replace `'YOUR_APPS_SCRIPT_URL_HERE'` with your actual URL, e.g.:
   ```javascript
   const appsScriptUrl = 'https://script.google.com/macros/d/YOUR_DEPLOYMENT_ID/userweb';
   ```
5. Save the file

## 3. Test It

1. Open your wedding website
2. Scroll to **RSVP** section
3. Fill out the form with test data
4. Click **Send RSVP**
5. Click **Confirm** in the modal
6. You should see a success message, and the data should appear in your Google Sheet

## Files

- **index.html** — Updated with Google Sheets integration (form now sends data on confirmation)
- **RSVP_SETUP.md** — Full detailed setup guide
- **QUICK_START.md** — This file

## Need Help?

See **RSVP_SETUP.md** troubleshooting section if:
- Form submits but no data appears in the sheet
- You get CORS or permission errors
- Data formatting looks wrong in the sheet
