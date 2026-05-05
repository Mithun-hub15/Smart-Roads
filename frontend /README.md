# 🛣️ SmartRoad — Complete Setup Guide

## Project Structure
```
Smartroad-v2/
├── server.js          ← Node.js + Express backend
├── package.json
├── uploads/           ← Auto-created for uploaded images
├── index.html         ← Login / Sign-up page
├── user.html          ← Citizen dashboard
└── admin.html         ← Admin control panel
```

---

## Prerequisites
- Node.js v18+ → https://nodejs.org
- SQLite (comes with Node.js sqlite3 package)

---

## Step 1 — Backend Setup

```bash
cd Smartroad-v2
npm install
npm start
```

The application uses SQLite database, which will be created automatically in the project directory.

Start the server:
```bash
npm start
# Server runs at http://localhost:3300
```

Tables are auto-created on first run. Default admin credentials:
- **Email:** admin@gmail.com
- **Password:** 123456

---

## Frontend

Open `index.html` in a browser, OR serve with:
```bash
# From the Smartroad-v2/ directory:
npx serve .
```

---

## Features

### Login Page (index.html)
- Username: letters + numbers, max 20 chars (VARCHAR 20)
- Password: exactly 6 characters
- Email: @gmail.com only
- Auto-password from DOB (DDMMYY)
- Admin login redirects to admin.html
- User login redirects to user.html

### User Dashboard (user.html)
- **Report Issue** — pick type, describe, mark on Leaflet map, upload photo
- **My Reports** — personal issue tracker with stats
- **Live Map** — all city issues on interactive map
- **Heatmap** — density visualization with type filters
- **Weather** — 7-day forecast via Open-Meteo API (free)
- **Community** — post & upvote discussions
- **Notifications** — status updates
- **SOS** — one-tap emergency calls (100, 108, 101, 1033)
- **Profile** — edit with email validation, photo upload

### Admin Dashboard (admin.html)
- **All Issues table** — search, filter by status/type, change status, delete
- **Live Map** — color-coded pins (Pending=gold, Progress=blue, Resolved=green)
- **Heatmap** — filterable density map
- **Analytics** — Doughnut + Pie charts via Chart.js
- **AI Insights** — pattern analysis, resolution rate, recommendations
- **Community** — view citizen posts
- **Profile** — manage admin account

---

## Database Schema

```sql
users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(20) UNIQUE,
  email VARCHAR(100) UNIQUE,
  password VARCHAR(6),
  dob DATE,
  phone VARCHAR(15),
  photo TEXT,
  gender VARCHAR(10),
  role VARCHAR(10) DEFAULT 'user',
  created_at TIMESTAMP
)

issues (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200),
  type VARCHAR(50),
  description TEXT,
  username VARCHAR(20),
  email VARCHAR(100),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'Pending',
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP
)

community_posts (...)
post_upvotes (...)
```

---

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | /api/signup | Register new user |
| POST | /api/login | Authenticate user |
| GET | /api/profile/:username | Get profile |
| POST | /api/profile/:username | Update profile |
| POST | /api/issues | Submit issue (multipart) |
| GET | /api/issues | Get all issues |
| GET | /api/issues/user/:username | Get user's issues |
| PUT | /api/issues/:id/status | Update status (admin) |
| DELETE | /api/issues/:id | Delete issue (admin) |
| GET | /api/community | Get posts |
| POST | /api/community | Create post |
| POST | /api/community/:id/upvote | Upvote post |
| GET | /api/stats | Dashboard statistics |

---

## Validation Rules
- **Username:** `/^[A-Za-z0-9]{1,20}$/`
- **Email:** must end with `@gmail.com`
- **Password:** exactly 6 characters
- **Images:** max 20MB, stored in `backend/uploads/`
