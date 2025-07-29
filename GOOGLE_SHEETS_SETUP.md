# Google Sheets Database Setup Guide

This guide will help you configure your Company Contract Tracker to use Google Sheets as a shared database, allowing multiple team members to access and update the same data.

## Prerequisites

- A Google account
- Access to Google Cloud Console
- Your Google Sheet created and ready

## Step-by-Step Setup

### 1. Create Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Give it a meaningful name (e.g., "Company Contract Tracker Database")
4. Copy the **Sheet ID** from the URL
   - URL format: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - The Sheet ID is the long string between `/d/` and `/edit`

### 2. Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Give your project a name (e.g., "Contract Tracker")

### 3. Enable Google Sheets API

1. In the Google Cloud Console, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google Sheets API"**
3. Click on it and press **"Enable"**

### 4. Create Service Account

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"Service Account"**
3. Enter a name (e.g., "Contract Tracker Service")
4. Click **"Create and Continue"**
5. Skip the optional steps and click **"Done"**

### 5. Generate Service Account Key

1. Click on the service account you just created
2. Go to the **"Keys"** tab
3. Click **"Add Key"** → **"Create New Key"**
4. Select **"JSON"** format
5. Click **"Create"** - this will download a JSON file

### 6. Share Your Google Sheet

1. Open the JSON file you downloaded
2. Find the `"client_email"` field and copy the email address
3. Go back to your Google Sheet
4. Click **"Share"** in the top right
5. Paste the service account email
6. Set permission to **"Editor"**
7. Click **"Send"**

### 7. Configure the Application

1. Open your Company Contract Tracker application
2. You'll see a yellow alert at the top about database configuration
3. Click **"Configure Google Sheets"**
4. Paste your **Sheet ID** in the first field
5. Open the JSON credentials file in a text editor and copy all the content
6. Paste the entire JSON content in the credentials field
7. Click **"Connect to Google Sheets"**

## What Happens Next

- Your existing data (if any) will be migrated to Google Sheets
- The app will create column headers for all the milestone data
- Multiple users can now use the app simultaneously
- All changes are automatically synced to Google Sheets
- You can view and edit data directly in Google Sheets if needed

## Data Structure in Google Sheets

Your data will be organized as follows:

| Column | Description |
|--------|-------------|
| A | Company ID |
| B | Created Date |
| C | Address |
| D | Contact Name |
| E | Contact Email |
| F-G | Keys (Completed/Date) |
| H-I | Power (Completed/Date) |
| ... | Additional milestones |

Each milestone gets two columns:
- One for completion status (TRUE/FALSE)
- One for completion date

## Troubleshooting

### "Failed to connect" Error
- Verify the Sheet ID is correct (no extra characters)
- Ensure the JSON credentials are valid
- Check that you shared the sheet with the service account email
- Make sure the Google Sheets API is enabled

### "Permission denied" Error
- The service account email must have Editor access to the sheet
- Check the sharing settings in Google Sheets

### Data Not Syncing
- Check your internet connection
- Close and reopen the application
- Verify the sheet wasn't moved or deleted

## Security Notes

- Keep your credentials file secure and don't share it
- The service account only has access to sheets you explicitly share with it
- You can revoke access by removing the service account from sheet sharing

## Benefits of Using Google Sheets

✅ **Multi-user access** - Team members can use the app simultaneously  
✅ **Real-time sync** - Changes are saved automatically  
✅ **Data backup** - Google handles backups and version history  
✅ **Direct access** - View/edit data directly in Google Sheets  
✅ **No server costs** - Uses Google's infrastructure  
✅ **Familiar interface** - Team can understand the data structure  

## Switching Back to Local Storage

If you want to switch back to local storage:
1. Click "Reset Configuration" in the configuration modal
2. Your data will be saved locally again
3. Note: This won't affect the Google Sheet, but new changes won't sync

---

**Need Help?** If you encounter any issues, make sure to:
1. Double-check all the setup steps
2. Verify your internet connection
3. Ensure the Google Sheet is shared with the correct service account email
