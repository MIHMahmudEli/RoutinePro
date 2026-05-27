# AIUB Portal Sync Feature Documentation

## Overview
Added a new sync option that allows users to authenticate with AIUB Portal and automatically scrape offered courses into RoutinePro.

## Components Added

### 1. API Endpoint: `/api/aiub-scraper.js`
**Purpose**: Handles AIUB Portal authentication and course data scraping.

**Functionality**:
- Takes username, password, and CAPTCHA text as input
- Establishes session with AIUB Portal via HTTP
- Navigates to offered courses page
- Parses HTML table to extract course data
- Converts scraped data to RoutinePro format
- Returns formatted courses or error message

**Features**:
- Lightweight implementation (no Puppeteer required)
- Cookie-based session management
- CSRF token extraction (if available)
- Comprehensive error handling with user-friendly messages
- Auto-formats course data matching existing database schema
- Supports admin cloud sync for global updates

### 2. HTML Form in Sync Modal (`index.html`)
Added interactive form with:
- **Input Fields**:
  - Username (AIUB Portal ID)
  - Password (AIUB Portal password)
  - CAPTCHA Text (manual entry)

- **Interactive Elements**:
  - "Open AIUB Portal" button - Opens login page in new tab so user can see CAPTCHA
  - "Login & Scrape" button - Submits credentials and starts scraping
  - Real-time process log showing operation status

- **Safety Features**:
  - Disclaimer about credential handling
  - Clear statement that app is NOT affiliated with AIUB
  - Reminders about compliance with AIUB policies

### 3. Controller Methods (`js/Controller.js`)

#### `handleAIUBLogin()`
- Validates form inputs (username, password, CAPTCHA)
- Shows process log during operation
- Sends request to `/api/aiub-scraper`
- On success:
  - Saves courses locally with timestamp
  - Checks if user is admin for cloud sync
  - Closes modal and reloads UI
  - Tracks event with analytics
- On error:
  - Displays specific error message
  - Logs details to process log

#### `addAIUBLog(message)`
- Helper method to append timestamped messages to process log
- Auto-scrolls log to show latest entries
- Used for real-time status updates

## User Workflow

1. Click "Sync Manager" (cloud icon) in header
2. Click "AIUB Portal Sync" button
3. Enter AIUB Portal username
4. Enter AIUB Portal password
5. Click "Open AIUB Portal" to login in new tab and see CAPTCHA
6. Copy/note the CAPTCHA text from the opened portal
7. Return to app and enter CAPTCHA text
8. Click "Login & Scrape Courses"
9. Watch the process log for real-time status
10. On success:
    - Courses are saved locally
    - If admin: optionally sync to cloud for all users
    - Modal closes and UI updates

## Data Format
Courses are scraped and converted to RoutinePro format:
```json
{
  "code": "CSC101",
  "baseTitle": "Introduction to Programming",
  "dept": "Computer Science",
  "sections": [
    {
      "id": "12345",
      "section": "A",
      "status": "Open",
      "capacity": "40",
      "count": "38",
      "schedules": [
        {
          "day": "MON",
          "start": "09:00 AM",
          "end": "10:30 AM",
          "room": "Lab 101",
          "type": "Theory"
        }
      ]
    }
  ]
}
```

## Error Handling
- Invalid credentials: "Invalid CAPTCHA text" or "Login failed - Invalid credentials or CAPTCHA"
- Network errors: Generic "Server error during scraping"
- No courses found: "No courses found - page structure may have changed"
- Missing fields: "Missing required fields: username, password, or captcha"

## Important Notes

### Security
- Credentials are NOT stored on server or browser beyond the request
- Each login is a new session
- Uses HTTPS for data transmission

### Limitations
- Requires manual CAPTCHA entry (no automatic CAPTCHA solving)
- Depends on AIUB portal structure (may need updates if portal changes)
- Requires user to manually copy CAPTCHA text
- Cannot handle 2FA if AIUB implements it in future

### Future Enhancements
- Integrate with CAPTCHA service (2Captcha, AntiCaptcha) for automatic solving
- Add browser automation service (Browserless.io) for JavaScript rendering
- Cache session tokens to reduce login frequency
- Handle AIUB portal structure changes automatically

## Testing Checklist
- [ ] Form validates all fields are filled
- [ ] "Open AIUB Portal" button opens new tab correctly
- [ ] CAPTCHA text input accepts any text
- [ ] "Login & Scrape" button disables during processing
- [ ] Process log shows real-time status messages
- [ ] On success: courses are saved and UI updates
- [ ] On error: error message displays and form remains available
- [ ] Admin users see cloud sync option
- [ ] Non-admin users skip cloud sync step
