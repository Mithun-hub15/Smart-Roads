const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File paths
const USERS_PATH = path.join(__dirname, "users.json");
const REPORTS_PATH = path.join(__dirname, "reports.json");
const PROFILE_PATH = path.join(__dirname, "profile.json");
const COMMUNITY_PATH = path.join(__dirname, "community.json");
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Static files
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/static', express.static(path.join(__dirname, 'static')));

// Helper functions for JSON storage
function readJsonFile(filePath, defaultValue = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return data.trim() ? JSON.parse(data) : defaultValue;
    }
  } catch (e) {
    console.error(`❌ Error reading ${filePath}:`, e);
  }
  return defaultValue;
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error(`❌ Error writing ${filePath}:`, e);
    return false;
  }
}

// ==== Reports API ====
app.get('/api/reports', (req, res) => {
  res.json(readJsonFile(REPORTS_PATH));
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, UPLOADS_DIR); },
  filename: (req, file, cb) => { cb(null, Date.now() + "-" + file.originalname); }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/api/report', upload.none(), (req, res) => {
  const reports = readJsonFile(REPORTS_PATH);
  const { title, desc, type, lat, lng, mediaType, imageData, user } = req.body;
  let mediaUrl = '';

  if (mediaType === "image" && imageData) {
    try {
      const base64 = imageData.split(',')[1];
      const fileName = `img_${Date.now()}.png`;
      fs.writeFileSync(path.join(UPLOADS_DIR, fileName), Buffer.from(base64, "base64"));
      mediaUrl = `/js/uploads/${fileName}`;
    } catch (e) {
      console.error("❌ Error saving base64 image:", e);
    }
  }

  // Get user profile details
  let userName = user || 'Anonymous';
  let userEmail = '';
  const profiles = readJsonFile(PROFILE_PATH);
  const profile = profiles.find(p => p.username === user);
  if (profile) {
    userName = profile.name || user;
    userEmail = profile.email || '';
  }

  const report = {
    id: Date.now(),
    title, desc, type, lat, lng,
    status: 'Pending',
    mediaType, mediaUrl,
    user: user || 'Anonymous',
    userName, userEmail,
    time: new Date().toLocaleString()
  };

  reports.push(report);
  writeJsonFile(REPORTS_PATH, reports);
  res.json({ message: 'uploaded', report });
});

app.put('/api/reports/:id', (req, res) => {
  const reports = readJsonFile(REPORTS_PATH);
  const idx = reports.findIndex(r => String(r.id) === String(req.params.id));
  if (idx >= 0) {
    const r = reports[idx];
    if (r.status === 'Pending') r.status = 'In Progress';
    else if (r.status === 'In Progress') r.status = 'Resolved';
    else r.status = 'Pending';
    writeJsonFile(REPORTS_PATH, reports);
    res.json({ success: true, report: r });
  } else {
    res.status(404).json({ success: false });
  }
});

app.delete('/api/reports/:id', (req, res) => {
  let reports = readJsonFile(REPORTS_PATH);
  const filtered = reports.filter(r => String(r.id) !== String(req.params.id));
  if (filtered.length < reports.length) {
    writeJsonFile(REPORTS_PATH, filtered);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false });
  }
});

// ==== Auth & Profile API ====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: 'Missing credentials' });

  const users = readJsonFile(USERS_PATH);
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && (u.password === password || u.type === 'admin'));

  if (user) {
    return res.json({ success: true, type: user.type, username: user.username, user });
  }

  // Auto-register
  const newUser = {
    type: "user", username, password, name: username,
    email: `${username}@smartroad.com`, dob: `${password}-01-01`
  };
  users.push(newUser);
  writeJsonFile(USERS_PATH, users);
  res.json({ success: true, type: 'user', username, user: newUser });
});

app.get('/api/profile/:username', (req, res) => {
  const profiles = readJsonFile(PROFILE_PATH);
  const profile = profiles.find(p => p.username === req.params.username);
  res.json(profile || {});
});

app.post('/api/profile/:username', (req, res) => {
  let profiles = readJsonFile(PROFILE_PATH);
  const idx = profiles.findIndex(p => p.username === req.params.username);
  if (idx >= 0) profiles[idx] = { ...profiles[idx], ...req.body };
  else profiles.push({ username: req.params.username, ...req.body });
  writeJsonFile(PROFILE_PATH, profiles);
  res.json({ success: true });
});

// ==== Community API ====
app.get("/api/community/:tab", (req, res) => {
  const tab = req.params.tab;
  const data = readJsonFile(COMMUNITY_PATH);
  if (tab === "trending") {
    res.json(data.filter(i => i.type === "post" && i.title?.includes("#")).sort((a,b) => new Date(b.time) - new Date(a.time)));
  } else if (tab === "posts") {
    res.json(data.filter(i => i.type === "post").sort((a,b) => new Date(b.time) - new Date(a.time)));
  } else if (tab === "leaderboard") {
    const reports = readJsonFile(REPORTS_PATH);
    const stats = {};
    reports.filter(r => r.status === 'Resolved').forEach(r => {
      const key = r.user || 'Anonymous';
      if (!stats[key]) stats[key] = { user: key, solved: 0, score: 0 };
      stats[key].solved++;
      stats[key].score += 10;
    });
    res.json(Object.values(stats).sort((a,b) => b.score - a.score));
  } else {
    res.json(data.filter(i => i.type === "post" && i.user === tab));
  }
});

app.post("/api/community/post", (req, res) => {
  const data = readJsonFile(COMMUNITY_PATH);
  const newPost = { type: "post", id: Date.now(), ...req.body, time: new Date().toISOString() };
  data.push(newPost);
  writeJsonFile(COMMUNITY_PATH, data);
  res.json({ success: true });
});

// Frontend Serving
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 3300;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
});
