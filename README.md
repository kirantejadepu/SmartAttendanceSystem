# Smart Attendance System

A modern, full-stack web application designed to streamline student attendance tracking using time-sensitive QR codes. Built with Node.js, Express, and MongoDB, this system ensures a secure, proxy-proof way for teachers to manage classroom attendance.

## 🚀 Features

- **Role-Based Access Control:** Distinct interfaces and permissions for `Teacher` and `Student` accounts.
- **Dynamic QR Code Sessions:** Teachers can generate a secure, 30-second expiring QR code for students to scan.
- **Anti-Spoofing (Device Binding):** Students' accounts are permanently bound to their specific mobile device upon first login. They cannot log in on a friend's phone to fake attendance.
- **Real-Time Live Dashboard:** Teachers can see students marking their attendance in real-time.
- **Reporting & Exporting:** Teachers can fetch attendance logs by date and export them directly to a CSV file.

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (using Mongoose ODM)
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Authentication:** `express-session` for stateful cookie sessions, `bcryptjs` for password hashing.
- **QR Code Handling:** `qrcode` (backend generation) and `html5-qrcode` (frontend camera scanning).

## 📂 Project Architecture

The application follows a modular MVC-like structure. For simplicity, route handlers also act as controllers.

```text
├── models/
│   ├── Attendance.js  # Schema for recording who attended which session
│   ├── Session.js     # Schema for the time-limited QR sessions
│   └── User.js        # Schema for Students/Teachers (handles deviceId)
├── public/
│   ├── css/           # Styling (glassmorphism UI)
│   └── js/
│       └── main.js    # Core frontend logic (API calls, QR scanning)
├── routes/
│   ├── attendance.js  # Logic for QR generation, scanning, and reports
│   └── auth.js        # Registration, login, logout, session checking
├── views/
│   ├── dashboard.html # The main application interface
│   └── login.html     # Auth interface
└── server.js          # Entry point, DB connection, middleware config
```

## 🔄 Core Application Flow

### 1. Authentication & Device Binding
- Users log in via `/api/auth/login`.
- If the user is a `student`, the system checks their `deviceId` against the database. If it doesn't match, access is denied. 
- Successful logins are tracked using `express-session` in memory.

### 2. Conducting Class (The QR Flow)
- **Generation:** A teacher creates a session (`/api/attendance/session/create`). The backend generates a random 13-character string, saves it to MongoDB with a 30-second expiry, converts it to a Base64 QR Image, and sends it to the frontend.
- **Scanning:** A student opens their dashboard, which initializes the device camera using `html5-qrcode`. They scan the teacher's screen.
- **Verification:** The scanned string is sent to `/api/attendance/mark`. The server verifies that the session exists, is still active (under 30s), and the student's device is authorized. If successful, the attendance is logged.

### 3. Management
- Teachers can view live attendance by polling `/api/attendance/session/:sessionId`.
- Teachers can view a daily report and download the records as a CSV file.
- Teachers can end sessions manually or reset a student's bound device if they get a new phone (`/api/attendance/reset-device/:studentId`).

## 🚀 Future Roadmap
- **GPS Location Verification:** Ensure students are physically in the classroom by comparing their device's coordinates to the teacher's expected coordinates (logic stubbed out in codebase).
