# Wedding RSVP System - Secure Backend Proxy

This repository now uses a secure backend proxy to create GitHub Issues for RSVP submissions.

## Why this is safer

- **No GitHub token in browser code**
- **Credentials stay server-side**
- **The website remains static** and can still be hosted on GitHub Pages
- **GitHub Issues are created securely** by the backend

## How it works

- The static site sends RSVP data to a backend endpoint
- The backend uses a GitHub token stored in a secure environment variable
- The backend creates a GitHub Issue for each RSVP
- The issue is visible in the repository's Issues tab

## Setup Instructions

### 1. Configure the backend

1. Copy `.env.example` to `.env`
2. Open `.env` and set:
   ```text
   GITHUB_TOKEN=github_pat_xxx
   GITHUB_OWNER=xandarDevs
   GITHUB_REPO=pratik-chelina-wedding
   PORT=3000
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the backend:
   ```bash
   npm start
   ```

### 2. Configure the static site

1. Open `index.html`
2. Set `apiEndpoint` to the URL where your backend is hosted:
   ```javascript
   const apiEndpoint = 'https://your-backend.example.com/api/rsvp';
   ```
3. Do not put a GitHub token in `index.html`.

### 3. Deploy the backend

You can deploy the backend to any hosting service that supports Node.js, such as:
- Render
- Railway
- Fly.io
- Heroku
- DigitalOcean App Platform

### 4. Host the website

The static site can still be hosted on GitHub Pages.

## Viewing RSVPs

- Go to your repository → **Issues** tab
- Filter by label `rsvp`

## Notes

- `rsvp.db` is no longer required and has been removed from tracking
- The backend uses `GITHUB_TOKEN` from `.env`; do not commit `.env`
- If you want, I can also help deploy the backend to a hosted service

## Files added

- `server.js` — secure backend proxy
- `package.json` — Node.js backend dependencies and start script
- `.env.example` — environment variable template
- `.gitignore` updated to ignore `.env`, `node_modules`, and `rsvp.db`
