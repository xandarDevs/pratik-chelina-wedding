# Wedding RSVP System - Local Python/Flask + SQLite Database

This is a local RSVP system for the wedding website that stores responses in a SQLite database using Python Flask.

## Setup

1. **Install Python** (if not already installed):
   - Download from: https://python.org
   - Or use: `winget install Python.Python.3.11`

2. **Install dependencies:**
   ```bash
   pip install Flask Flask-CORS
   ```

3. **Start the server:**
   ```bash
   py app.py
   ```

   The server will start and show:
   ```
   Wedding RSVP server starting...
   Website: http://localhost:5000
   View RSVPs: http://localhost:5000/api/rsvps
   ```

## How it works

- RSVPs are stored in a local SQLite database (`rsvp.db`)
- The database is created automatically when you first run the server
- All submissions include timestamps and are stored permanently

## Database Schema

The `rsvps` table contains:
- `id`: Auto-incrementing primary key
- `timestamp`: When the RSVP was submitted
- `name`: Guest's full name
- `attendance`: "Accepted" or "Declined"
- `email`: Guest's email (optional)
- `phone`: Guest's phone (optional)
- `has_guests`: "Yes" or "No"
- `guest_count`: Number of additional guests
- `guest_details`: Formatted string of guest information
- `dietary_requirements`: Any dietary notes
- `message`: Personal message from guest

## Testing the RSVP Form

1. **Open your browser** to: http://localhost:5000
2. **Fill out the RSVP form** and submit it
3. **Check the database** by visiting: http://localhost:5000/api/rsvps

## Viewing RSVPs

You can view all RSVPs by visiting: http://localhost:5000/api/rsvps

This returns JSON data that you can view in your browser.

## Production Deployment

For a live website, you'll need to:
1. Deploy the Flask app to a hosting service (Heroku, DigitalOcean, etc.)
2. Update the `appsScriptUrl` in `index.html` to point to your deployed server
3. Make sure the server has proper security and HTTPS

## Troubleshooting

- Make sure port 5000 is not already in use
- If you get database errors, delete `rsvp.db` and restart the server
- Check the console for error messages