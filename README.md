# Study Notes and Resource Sharing Platform

CampusNotes is a Node.js and Express application for sharing and reviewing study materials.

The admin portal provides student and material management, approval and rejection workflows, PDF previews, filters, subject/semester summaries, and responsive light/dark themes. Dashboard reports use SQLite records for registrations, uploads, review outcomes, and student downloads. Download tracking begins with downloads made through the student portal.

The student portal includes account settings for profile information, password changes, notification and appearance preferences, privacy controls, study defaults, download history, support reports, and account deletion. Student settings are scoped to the authenticated student account.

Teacher-submitted notes and lecture materials are published immediately. Student uploads remain pending until an administrator reviews and approves them.

The teacher portal includes assigned-subject coverage, material uploads and management, approval history, download engagement, notifications, profile editing, and account preferences. Revising a teacher's existing material sends it back to the administrator for review. Support reports are stored but are not automatically routed to a support inbox; email delivery, cross-device session listing, and platform announcements are not currently available.

## Requirements

- Node.js 20 or later
- npm

## Run locally

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Set the required secrets in PowerShell. Generate a random JWT secret with Node, then assign it to `JWT_SECRET`:

   ```powershell
   $env:JWT_SECRET = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
   $env:CAMPUSNOTES_ADMIN_PASSWORD = "choose-a-strong-admin-password"
   ```

3. Start the server:

   ```powershell
   npm start
   ```

The app is served at `http://localhost:3001`. The SQLite database and uploaded files are created locally and are intentionally excluded from version control.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `JWT_SECRET` | Yes | Random secret with at least 32 characters, used to sign session tokens. |
| `CAMPUSNOTES_ADMIN_PASSWORD` | Yes | Password used by the admin login. |
| `PORT` | No | HTTP port; defaults to `3001`. |
