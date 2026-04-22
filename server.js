const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Database setup
const db = new sqlite3.Database('./rsvp.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    createTable();
  }
});

// Create RSVP table
function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS rsvps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      name TEXT NOT NULL,
      attendance TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      has_guests TEXT DEFAULT 'No',
      guest_count INTEGER DEFAULT 0,
      guest_details TEXT,
      dietary_requirements TEXT,
      message TEXT
    )
  `;

  db.run(sql, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('RSVP table ready.');
    }
  });
}

// RSVP submission endpoint
app.post('/api/rsvp', (req, res) => {
  const data = req.body;

  // Build guest details string
  let guestDetails = '';
  if (data.guests && data.guests.length > 0) {
    guestDetails = data.guests.map((g, i) =>
      `${i + 1}. ${g.name} (${g.relationship})`
    ).join('; ');
  }

  const sql = `
    INSERT INTO rsvps (name, attendance, email, phone, has_guests, guest_count, guest_details, dietary_requirements, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    data.name,
    data.attendance,
    data.email,
    data.phone,
    data.hasGuests,
    data.guestCount,
    guestDetails,
    data.dietary,
    data.message
  ];

  db.run(sql, values, function(err) {
    if (err) {
      console.error('Error saving RSVP:', err.message);
      res.status(500).json({ success: false, error: err.message });
    } else {
      console.log(`RSVP saved with ID: ${this.lastID}`);
      res.json({ success: true, message: 'RSVP received successfully', id: this.lastID });
    }
  });
});

// Get all RSVPs (for admin viewing)
app.get('/api/rsvps', (req, res) => {
  const sql = 'SELECT * FROM rsvps ORDER BY timestamp DESC';

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching RSVPs:', err.message);
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, rsvps: rows });
    }
  });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Wedding RSVP server running at http://localhost:${PORT}`);
  console.log(`View RSVPs at: http://localhost:${PORT}/api/rsvps`);
});</content>
<parameter name="filePath">i:\My Drive\Wedding Plans\WeddingCard\Website\server.js