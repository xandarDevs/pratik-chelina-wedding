# RSVP Backend Setup

This guide walks you through setting up the backend to receive RSVP submissions.

## Overview

Your wedding website uses a secure backend server that:
1. Receives RSVP submissions from the website
2. Creates GitHub Issues for each RSVP (visible in your repository's Issues tab)
3. Stores all RSVP data securely on the server side

## Configuration

### 1. Set up your backend environment

1. Copy `.env.example` to `.env` (if not already done)
2. Open `.env` and configure:
   ```
   GITHUB_TOKEN=github_pat_xxx
   GITHUB_OWNER=xandarDevs
   GITHUB_REPO=pratik-chelina-wedding
   PORT=3000
   ```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the backend server

```bash
npm start
```

The server will start listening on `http://localhost:3000`.

### 4. Configure the frontend

In `index.html`, find the `apiEndpoint` variable (around line 566) and set it to your backend URL:

```javascript
const apiEndpoint = 'http://localhost:3000/api/rsvp';  // For local testing
// or
const apiEndpoint = 'https://your-deployed-server.com/api/rsvp';  // For production
```

## How It Works

When a guest submits an RSVP:
1. The form data is sent to your backend
2. The backend creates a GitHub Issue with all RSVP details
3. The issue is labeled with `rsvp` and the attendance status (`accepted` or `declined`)
4. All issues are visible in your repository's **Issues** tab

## Data Storage

All RSVP data is stored as GitHub Issues in your repository: `xandarDevs/pratik-chelina-wedding`

View all RSVPs by checking the Issues tab of your repository.

## Testing

1. Run the backend: `npm start`
2. Make sure `apiEndpoint` in `index.html` points to your running server
3. Open the website and submit a test RSVP
4. Check your GitHub repository's Issues tab — the RSVP should appear as a new issue
