#  Smart Roads System

##  Overview

Smart Roads is a web-based application designed to report, monitor, and manage road-related issues such as accidents, traffic congestion, and public infrastructure problems.

The system provides a simple interface for users and administrators to interact with real-time reports and community data.

---

##  Key Features

*  Report road issues with location (latitude, longitude)
*  Upload images for incidents
*  User profile and community data handling
*  Admin dashboard for monitoring reports
*  JSON-based data storage (no external database)
*  REST API built with Express.js

---

##  Tech Stack

* Frontend: HTML, CSS, JavaScript
* Backend: Node.js with Express
* File Uploads: Multer
* Data Storage: Local JSON files

---

## 📁 Project Structure

```
Smart-Roads-dev/
│
├── index.html           # Main user interface
├── admin.html           # Admin dashboard
├── user.html            # User profile page
├── cleanup.js           # Utility script
├── package.json         # Project dependencies & scripts
│
├── icons/               # UI images/icons
│
├── js/
│   ├── server.js        # Backend server (main logic)
│   ├── main.js          # Frontend logic
│   ├── config.js        # Configuration settings
│   │
│   ├── users.json       # User data
│   ├── user.json        # Single user info
│   ├── profile.json     # Profile data
│   ├── reports.json     # Road reports
│   ├── community.json   # Community posts/data
│   │
│   ├── uploads/         # Uploaded images
│   └── static/          # Default assets
│
└── node_modules/        # Dependencies
```

---

## ⚙️ How It Works

1. User opens the web interface (`index.html`)
2. Frontend sends requests to backend APIs
3. Backend (`server.js`) processes requests
4. Data is stored in local JSON files
5. Uploaded images are saved in `/uploads`
6. UI updates dynamically with fetched data

---

##  API Endpoints (Core)

### Reports

* `GET /api/reports` → Fetch all reports
* `POST /api/report` → Submit a new report

### Static Access

* `/uploads` → Access uploaded images
* `/static` → Access default assets

---

##  Database

This project does **not use a traditional database**.

Instead, it stores data in:

* `users.json`
* `reports.json`
* `profile.json`
* `community.json`

These act as a lightweight local database using the file system.

---

##  Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run the server

```bash
npm start
```

### 3. Open in browser

http://localhost:3000
