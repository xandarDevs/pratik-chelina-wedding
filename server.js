const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'xandarDevs';
const GITHUB_REPO = process.env.GITHUB_REPO || 'pratik-chelina-wedding';

if (!GITHUB_TOKEN) {
  console.error('Missing GITHUB_TOKEN. Add it to your .env file.');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.post('/api/rsvp', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.name || !data.attendance) {
      return res.status(400).json({ success: false, error: 'Missing required RSVP fields' });
    }

    const issueTitle = `RSVP: ${data.name}`;
    let issueBody = `## RSVP Details\n\n`;
    issueBody += `**Name:** ${data.name}\n`;
    issueBody += `**Attendance:** ${data.attendance}\n`;

    if (data.attendance === 'Accepted') {
      if (data.email) issueBody += `**Email:** ${data.email}\n`;
      if (data.phone) issueBody += `**Phone:** ${data.phone}\n`;
      issueBody += `**Has Guests:** ${data.hasGuests || 'No'}\n`;

      if (data.hasGuests === 'Yes' && Array.isArray(data.guests) && data.guests.length > 0) {
        issueBody += `\n### Guests\n`;
        data.guests.forEach((guest, index) => {
          issueBody += `${index + 1}. ${guest.name} (${guest.relationship})\n`;
        });
      }

      if (data.dietary) issueBody += `\n**Dietary Requirements:** ${data.dietary}\n`;
    }

    if (data.message) issueBody += `\n**Message:** ${data.message}\n`;
    issueBody += `\n---\n*Submitted via the wedding RSVP website*`;

    const response = await axios.post(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
      {
        title: issueTitle,
        body: issueBody,
        labels: ['rsvp', data.attendance.toLowerCase()]
      },
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json'
        }
      }
    );

    res.json({ success: true, issue: response.data });
  } catch (error) {
    console.error('Failed to create GitHub issue:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Unable to save RSVP at this time.' });
  }
});

app.listen(PORT, () => {
  console.log(`Secure RSVP backend listening on http://localhost:${PORT}`);
});
