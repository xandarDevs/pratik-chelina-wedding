# Wedding RSVP System - GitHub Issues Storage

This is a **completely GitHub-native** RSVP system that stores responses as GitHub Issues in your repository. No servers, databases, or external services required!

## How It Works

- **Static Website**: Hosted on GitHub Pages (free)
- **Form Submissions**: Stored as GitHub Issues in your repository
- **Data Access**: View RSVPs directly in GitHub Issues
- **No Maintenance**: Works passively without any running services

## Setup Instructions

### 1. Create a GitHub Personal Access Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click **"Generate new token (classic)"**
3. Give it a name like `"Wedding RSVP Token"`
4. Select scopes: **`public_repo`** (for public repos) or **`repo`** (for private repos)
5. Click **"Generate token"**
6. **Copy the token immediately** (you won't see it again!)

### 2. Update the Website Code

1. Open `index.html` in your editor
2. Find these lines near the top of the `<script>` section:
   ```javascript
   const githubOwner = 'xandarDevs';
   const githubRepo = 'pratik-chelina-wedding';
   const githubToken = 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN';
   ```
3. Replace `'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN'` with your actual token
4. **Important**: Keep this token private! Don't commit it to the repository.

### 3. Enable GitHub Pages

1. Go to your repository settings
2. Scroll to **"Pages"** section
3. Under **Source**, select **"Deploy from a branch"**
4. Choose **"master"** branch and **"/ (root)"** folder
5. Click **"Save"**

### 4. Test the System

1. Visit your GitHub Pages URL (usually `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME`)
2. Fill out and submit the RSVP form
3. Check your repository's **Issues** tab - a new issue should appear with the RSVP data!

## Data Storage

Each RSVP creates a GitHub Issue with:
- **Title**: `RSVP: [Guest Name]`
- **Labels**: `rsvp` + `accepted` or `declined`
- **Body**: Formatted RSVP details including:
  - Name, attendance status
  - Contact info (if attending)
  - Guest details (if bringing guests)
  - Dietary requirements
  - Personal message

## Viewing RSVPs

- Go to your repository → **Issues** tab
- Filter by label `rsvp` to see all responses
- Use GitHub's search: `label:rsvp is:issue`
- Export data using GitHub's issue export features

## Security Notes

- The Personal Access Token has limited permissions (only issues access)
- Token is stored client-side (in browser JavaScript)
- For better security, consider using a GitHub App instead of a PAT
- Never commit the token to your repository

## Troubleshooting

**Form doesn't submit:**
- Check browser console for errors
- Verify the GitHub token is correct and has `repo` or `public_repo` scope
- Make sure repository exists and is accessible

**Issues not created:**
- Check token permissions
- Verify repository name and owner are correct in the code
- Look at browser network tab for API errors

**GitHub Pages not working:**
- Wait a few minutes after enabling Pages
- Check repository settings to ensure Pages is enabled
- Verify the site builds successfully

## Benefits of This Approach

✅ **Completely free** - Uses only GitHub services
✅ **No server maintenance** - Works passively
✅ **Data persistence** - Stored in GitHub's reliable infrastructure
✅ **Easy access** - View RSVPs directly in GitHub Issues
✅ **Version control** - All data is tracked in git history
✅ **Searchable** - Use GitHub's powerful search features
✅ **Exportable** - Download issues data easily