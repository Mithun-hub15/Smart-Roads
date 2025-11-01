const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==== Persistent Users Setup ====
const USERS_PATH = path.join(__dirname, "users.json");

// Helpers for loading and saving users
function loadUsers() {
  if (fs.existsSync(USERS_PATH)) {
    const data = fs.readFileSync(USERS_PATH, 'utf-8');
    return data ? JSON.parse(data) : [];
  } else {
    fs.writeFileSync(USERS_PATH, '[]', 'utf-8');
    return [];
  }
}
function saveUsers(usersArr) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(usersArr, null, 2), 'utf-8');
}
let users = loadUsers(); // Loads users from users.json

// ==== Uploads ====
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath);
}
app.use('/uploads', express.static(uploadsPath));

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/'); },
  filename: (req, file, cb) => { cb(null, Date.now() + "-" + file.originalname); }
});
const upload = multer({ storage });

// ==== Reports (Issues) ====
const REPORTS_PATH = path.join(__dirname, "reports.json");

function loadReports() {
  if (fs.existsSync(REPORTS_PATH)) {
    const data = fs.readFileSync(REPORTS_PATH, 'utf-8');
    if (!data.trim()) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Corrupt reports.json, resetting file. Previous content was:", data);
      fs.writeFileSync(REPORTS_PATH, '[]', 'utf-8');
      return [];
    }
  } else {
    fs.writeFileSync(REPORTS_PATH, '[]', 'utf-8');
    return [];
  }
}
function saveReports(reports) {
  fs.writeFileSync(REPORTS_PATH, JSON.stringify(reports, null, 2), 'utf-8');
}
let reports = loadReports();

// ==== REPORTS API ====

// Upload via form
app.post('/api/report-form', upload.single('media'), (req, res) => {
  reports = loadReports();
  let report = {
    id: Date.now(),
    ...req.body,
    status: 'Pending',
    mediaUrl: req.file ? "/uploads/" + req.file.filename : "",
    type: req.body.type || "Other"
  };
  reports.push(report);
  saveReports(reports);
  res.json({ message: 'uploaded', report });
});

// Upload via API (image base64)
app.post('/api/report', upload.none(), (req, res) => {
  reports = loadReports();
  let { title, desc, type, lat, lng, mediaType, imageData } = req.body;
  let mediaUrl = '';
  if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);
  if (mediaType === "image" && imageData) {
    const base64 = imageData.split(',')[1];
    const fileName = "img_" + Date.now() + ".png";
    fs.writeFileSync(path.join(uploadsPath, fileName), Buffer.from(base64, "base64"));
    mediaUrl = "/uploads/" + fileName;
  }
  let report = {
    id: Date.now(),
    title, desc, type, lat, lng,
    status: 'Pending',
    mediaType, mediaUrl
  };
  reports.push(report);
  saveReports(reports);
  res.json({ message: 'uploaded', report });
});

// Get all reports
app.get('/api/reports', (req, res) => {
  reports = loadReports();
  console.log("GET /api/reports - Loaded reports:", reports.length);
  res.json(reports);
});

// Update report status
app.put('/api/reports/:id', (req, res) => {
  const id = req.params.id;
  reports = loadReports();
  let found = reports.find(r => String(r.id) === String(id));
  if (found) {
    if (found.status === 'Pending') found.status = 'In Progress';
    else if (found.status === 'In Progress') found.status = 'Resolved';
    else found.status = 'Pending';
    saveReports(reports);
    console.log(`Updated report ${id} status to: ${found.status}`);
    res.json({ success: true, report: found });
  } else {
    console.log(`Report ${id} not found`);
    res.status(404).json({ success: false, message: "Report not found." });
  }
});

// Delete report
app.delete('/api/reports/:id', (req, res) => {
  const id = req.params.id;
  reports = loadReports();
  const initialLength = reports.length;
  reports = reports.filter(r => String(r.id) !== String(id));
  if (reports.length < initialLength) {
    saveReports(reports);
    console.log(`Deleted report ${id}`);
    res.json({ success: true, message: "Report deleted." });
  } else {
    console.log(`Report ${id} not found for deletion`);
    res.status(404).json({ success: false, message: "Report not found." });
  }
});

// ==== LOGIN & PROFILE API ====

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  users = loadUsers();

  // Admin
  const adminUser = users.find(u => u.type === "admin" && u.username === username && u.password === password);
  if (adminUser) return res.json({ success: true, type: adminUser.type, username: adminUser.username });

  // User: password is year (YYYY) of DOB
  const user = users.find(u =>
    u.type === "user" &&
    u.username === username &&
    u.dob &&
    u.dob.substr(0, 4) === password
  );
  if (user) return res.json({ success: true, type: user.type, username: user.username });

  res.json({ success: false, message: 'Invalid credentials' });
});

const PROFILE_PATH = path.join(__dirname, "profile.json");

// Load/save helpers for profiles
function loadProfiles() {
  if (fs.existsSync(PROFILE_PATH)) {
    const data = fs.readFileSync(PROFILE_PATH, 'utf-8');
    return data ? JSON.parse(data) : [];
  } else {
    fs.writeFileSync(PROFILE_PATH, '[]', 'utf-8');
    return [];
  }
}
function saveProfiles(profilesArr) {
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profilesArr, null, 2), 'utf-8');
}

// GET profile by username
app.get('/api/profile/:username', (req, res) => {
  const profiles = loadProfiles();
  const profile = profiles.find(p => p.username === req.params.username);
  profile ? res.json(profile) : res.status(404).json({});
});

// POST profile update/save
app.post('/api/profile/:username', (req, res) => {
  let profiles = loadProfiles();
  let idx = profiles.findIndex(p => p.username === req.params.username);

  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx], ...req.body };
  } else {
    profiles.push({ username: req.params.username, ...req.body });
  }
  saveProfiles(profiles);
  res.json(profiles[idx] || profiles[profiles.length-1]);
});

 
// ==== COMMUNITY API ====

const COMMUNITY_PATH = path.join(__dirname, "community.json");

// Helper functions
function loadCommunity() {
  if (!fs.existsSync(COMMUNITY_PATH)) fs.writeFileSync(COMMUNITY_PATH, '[]', 'utf-8');
  const data = fs.readFileSync(COMMUNITY_PATH, 'utf-8');
  return data ? JSON.parse(data) : [];
}
function saveCommunity(arr) {
  fs.writeFileSync(COMMUNITY_PATH, JSON.stringify(arr, null, 2), 'utf-8');
}

// --- Trending tab (type==='trending') ---
app.get("/api/community/trending", (req, res) => {
  const data = loadCommunity();
  res.json(data.filter(item => item.type === "trending"));
});

// --- Posts tab (type==='post', sorted newest first) ---
app.get("/api/community/posts", (req, res) => {
  const data = loadCommunity();
  let posts = data.filter(item => item.type === "post");
  posts = posts.sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(posts);
});

// --- Leaderboard tab (type==='leaderboard', sorted best first) ---
app.get("/api/community/leaderboard", (req, res) => {
  const data = loadCommunity();
  let leaderboard = data.filter(item => item.type === "leaderboard")
    .sort((a, b) => (b.score||0) - (a.score||0));
  res.json(leaderboard);
});

// --- MyPosts (user's own) tab ---
app.get("/api/community/myposts/:username", (req, res) => {
  const data = loadCommunity();
  let posts = data.filter(item => item.type === "post" && item.user === req.params.username);
  posts = posts.sort((a, b) => new Date(b.time) - new Date(a.time)); // Newest first
  res.json(posts);
});

// --- Add new item (posting, demo, leaderboard) ---
app.post("/api/community/add", (req, res) => {
  let arr = loadCommunity();
  arr.push(req.body); // Body must include e.g. {type, title, user, userPhoto, ...}
  saveCommunity(arr);
  res.json({success:true});
});



// ==== START SERVER ====
app.listen(3300, () => {
  console.log("✅ Server running at http://localhost:3300");
  console.log("✅ Reports file:", REPORTS_PATH);
  console.log("✅ Loaded reports:", loadReports().length);
});
