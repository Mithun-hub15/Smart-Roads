const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/static', express.static(path.join(__dirname, 'static')));

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

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ==== Reports (Issues) ====
 
// ==== REPORTS API ====
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

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    routes: [
      'GET /api/reports',
      'POST /api/report',
      'PUT /api/reports/:id',
      'DELETE /api/reports/:id'
    ]
  });
});

function saveReports(reports) {
  fs.writeFileSync(REPORTS_PATH, JSON.stringify(reports, null, 2), 'utf-8');
}

let reports = loadReports();

// ✅✅✅ PASTE THIS NEW CODE HERE ✅✅✅
app.get('/api/reports', (req, res) => {
  console.log('✅ GET /api/reports called');
  const reports = loadReports();
  console.log(`📊 Sending ${reports.length} reports`);
  res.json(loadReports());
});

// ... continue with your POST /api/report and other routes ...

// Upload via forapp.post('/api/report-form', upload.single('media'), (req, res) => {

app.post('/api/report-form', upload.single('media'), (req, res) => {

  reports = loadReports();

  let mediaType = "";
  let mediaUrl = "";

  if (req.file) {

    if (req.file.mimetype.startsWith("image")) {
      mediaType = "image";
    }

    else if (req.file.mimetype.startsWith("video")) {
      mediaType = "video";
    }

    mediaUrl = "/uploads/" + req.file.filename;
  }

  let report = {
    id: Date.now(),
    title: req.body.title,
    desc: req.body.desc,
    type: req.body.type || "Other",
    lat: req.body.lat,
    lng: req.body.lng,
    status: "Pending",
    mediaType: mediaType,
    mediaUrl: mediaUrl,
    user: req.body.user || "Anonymous"
  };

  reports.push(report);
  saveReports(reports);

  console.log("Report saved:", report);

  res.json({ success: true, report });
});


// Upload via API (image base64)
// Upload via API (image base64) - WITH USER INFO
app.post('/api/report', upload.none(), (req, res) => {
  reports = loadReports();
  let { title, desc, type, lat, lng, mediaType, imageData, user } = req.body;
  let mediaUrl = '';

if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);

/* IMAGE */
let MediaUrl = '';

if (mediaType === "image" && imageData) {

  const base64 = imageData.split(',')[1];
  const fileName = "img_" + Date.now() + ".png";

  fs.writeFileSync(
    path.join(uploadsPath, fileName),
    Buffer.from(base64, "base64")
  );

  mediaUrl = "/uploads/" + fileName;
}

else if (MediaType === "video" && req.body.videoData) {

  const base64 = req.body.videoData.split(',')[1];
  const fileName = "video_" + Date.now() + ".webm";

  fs.writeFileSync(
    path.join(uploadsPath, fileName),
    Buffer.from(base64, "base64")
  );

  mediaUrl = "/uploads/" + fileName;
}
  
  // Get user profile details
  let userName = user || 'Anonymous';
  let userEmail = '';
  
  if (user && user !== 'Anonymous') {
    const profiles = loadProfiles();
    const profile = profiles.find(p => p.username === user);
    if (profile) {
      userName = profile.name || user;
      userEmail = profile.email || '';
    }
  }
  
  let report = {
    id: Date.now(),
    title, 
    desc, 
    type, 
    lat, 
    lng,
    status: 'Pending',
    mediaType, 
    mediaUrl,
    user: user || 'Anonymous',           // Username (from login)
    userName: userName,                   // Full name (from profile)
    userEmail: userEmail                  // Email (from profile)
  };
  
  reports.push(report);
  saveReports(reports);
  
  console.log(`✅ Report submitted by ${userName} (${userEmail}): "${title}"`);
  
  res.json({ message: 'uploaded', report });
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
 

// Helper: Load users from users.json
function loadUsers() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Helper: Save users to users.json
function saveUsers(users) {
  try {
    fs.writeFileSync(
      path.join(__dirname, 'users.json'), 
      JSON.stringify(users, null, 2), 
      'utf8'
    );
    return true;
  } catch (error) {
    console.error('❌ Error saving users:', error);
    return false;
  }
}

// ============================================
// LOGIN API - SUPPORTS AUTO-REGISTRATION
// ============================================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.json({ success: false, message: 'Username and password required' });
  }
  
  const users = loadUsers();

  // ✅ 1. ADMIN LOGIN CHECK
  const adminUser = users.find(u => 
    u.type === "admin" && 
    u.username === username && 
    u.password === password
  );
  
  if (adminUser) {
    console.log(`✅ Admin logged in: ${adminUser.username}`);
    return res.json({ 
      success: true, 
      type: 'admin',
      username: adminUser.username,
      user: {
        username: adminUser.username,
        email: adminUser.email || 'admin@smartroad.com',
        name: adminUser.name || 'Admin'
      }
    });
  }

  // ✅ 2. USER LOGIN CHECK (Existing Users)
  // Password can be: 
  // - Direct password field
  // - Year from DOB (DD-MM-YYYY format extracts YYYY from [2])
  // - Year from DOB (YYYY-MM-DD format extracts first 4 chars)
  const user = users.find(u =>
    u.type === "user" &&
    u.username.toLowerCase() === username.toLowerCase() &&
    (
      (u.password && u.password === password) ||                               // Direct password
      (u.dob && u.dob.split('-')[2] === password) ||                           // DD-MM-YYYY
      (u.dob && u.dob.split('-')[0].length === 4 && u.dob.substr(0, 4) === password)  // YYYY-MM-DD
    )
  );
  
  if (user) {
    console.log(`✅ User logged in: ${user.username} (${user.name || 'No name'})`);
    return res.json({ 
      success: true, 
      type: 'user',
      username: user.username,
      user: {
        username: user.username,
        email: user.email || `${user.username}@smartroad.com`,
        name: user.name || user.username,
        dob: user.dob || ''
      }
    });
  }

  // ✅ 3. AUTO-REGISTER NEW USER
  // If username not found, create new account automatically
  console.log(`🆕 Creating new user: ${username}`);
  
  const newUser = {
    type: "user",
    username: username,
    password: password,  // Store password directly
    name: username,      // Use username as display name
    email: `${username.toLowerCase()}@smartroad.com`,
    dob: `${password}-01-01`,  // Store as YYYY-MM-DD
    photo: "https://via.placeholder.com/150",
    createdAt: new Date().toISOString()
  };
  
  users.push(newUser);
  
  // Save to users.json
  if (!saveUsers(users)) {
    return res.json({ 
      success: false, 
      message: 'Error creating account. Please try again.' 
    });
  }
  
  console.log(`✅ New user registered: ${username} (password: ${password})`);
  
  // Return success
  return res.json({ 
    success: true, 
    type: 'user',
    username: newUser.username,
    isNewUser: true,
    user: {
      username: newUser.username,
      email: newUser.email,
      name: newUser.name,
      dob: newUser.dob
    }
  });
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
  
  if (profile) {
    res.json(profile);
  } else {
    const users = loadUsers();
    const user = users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
    if (user) {
      res.json({
        username: user.username,
        name: user.name || user.username,
        email: user.email || '',
        dob: user.dob || '',
        photo: user.photo || ''
      });
    } else {
      res.status(404).json({});
    }
  }
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

// ===== COMMUNITY ROUTES WITH IMAGE SUPPORT =====

// Add community.json path
const COMMUNITY_PATH = path.join(__dirname, "community.json");

// Helper functions for community data
function loadCommunity() {
  if (!fs.existsSync(COMMUNITY_PATH)) {
    // Initialize with sample leaderboard data
    const initialData = [
      { 
        type: "leaderboard", 
        user: "Nandan", 
        userPhoto: "https://via.placeholder.com/50", 
        score: 150, 
        badge: "Top Contributor" 
      },
      { 
        type: "leaderboard", 
        user: "Rahul", 
        userPhoto: "https://via.placeholder.com/50", 
        score: 120, 
        badge: "Active" 
      },
      { 
        type: "leaderboard", 
        user: "Priya", 
        userPhoto: "https://via.placeholder.com/50", 
        score: 95, 
        badge: "" 
      }
    ];
    fs.writeFileSync(COMMUNITY_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
  }
  const data = fs.readFileSync(COMMUNITY_PATH, 'utf-8');
  return data ? JSON.parse(data) : [];
}

function saveCommunity(arr) {
  fs.writeFileSync(COMMUNITY_PATH, JSON.stringify(arr, null, 2), 'utf-8');
}

// GET Trending (posts with # in title)
app.get("/api/community/trending", (req, res) => {
  const data = loadCommunity();
  const trending = data
    .filter(item => item.type === "post" && item.title && item.title.includes("#"))
    .sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(trending);
});

// GET All Posts
app.get("/api/community/posts", (req, res) => {
  const data = loadCommunity();
  const posts = data
    .filter(item => item.type === "post")
    .sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(posts);
});

// GET LeaderBoard
// Example in Express.js
// Leaderboard endpoint for community tab
app.get('/api/community/leaderboard', (req, res) => {
  const reports = JSON.parse(fs.readFileSync(path.join(__dirname, 'reports.json'), 'utf-8'));
  let profiles = [];
  try {
    profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'profile.json'), 'utf-8'));
  } catch { profiles = []; }

  const pointsPerReport = 10;

  const userStats = {};
  reports.forEach(entry => {
    if (entry.status === 'Resolved') {
      const key = entry.userName || entry.user || 'Anonymous';
      const profile = profiles.find(p => p.username === key);

      if (!userStats[key]) {
        userStats[key] = {
          user: key,
          userPhoto: (profile && profile.photo) || entry.userPhoto || "https://via.placeholder.com/50",
          solved: 0,
          score: 0
        };
      }
      userStats[key].solved += 1;
      userStats[key].score += pointsPerReport;
    }
  });

  let leaderboard = Object.values(userStats).sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.map((entry, idx) => ({
    ...entry,
    badge: idx === 0 ? 'Gold' : idx === 1 ? 'Silver' : idx === 2 ? 'Bronze' : ''
  }));

  res.json(leaderboard);
});

// GET MyPosts (specific user's posts)
app.get("/api/community/myposts/:username", (req, res) => {
  const data = loadCommunity();
  const posts = data
    .filter(item => item.type === "post" && item.user === req.params.username)
    .sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(posts);
});

// POST New Post (with image support)
app.post("/api/community/post", (req, res) => {
  const arr = loadCommunity();
  
  const { title, desc, user, userPhoto, userName, image } = req.body;
  
  if (!title || !title.trim()) {
    return res.json({ success: false, message: "Title is required" });
  }
  
  const newPost = {
    type: "post",
    id: Date.now(), // Unique ID for each post
    title: title.trim(),
    desc: desc ? desc.trim() : "",
    user: user || "Anonymous",
    userPhoto: userPhoto || "https://via.placeholder.com/50",
    userName: userName || user || "Anonymous",
    image: image || null, // Base64 image data
    time: new Date().toISOString()
  };
  
  arr.push(newPost);
  saveCommunity(arr);
  
  console.log(`✅ New post created by ${user}: "${title}"`);
  
  res.json({ success: true, post: newPost });
});

// Pseudocode for your admin's "mark as solved" backend route:
app.post('/api/issues/mark-solved', (req, res) => {
  try {
    console.log('Route triggered with body:', req.body);

    const solvedBy = req.body.user;
    if (!solvedBy) {
      console.log('No solvedBy user!');
      return res.status(400).json({ success: false, message: "User is required in request body." });
    }

    const arr = loadCommunity();
    let found = arr.find(x => x.type === "leaderboard" && x.user === solvedBy);

    if (found) {
      found.score += 1;
      console.log("Incremented score for:", solvedBy, found.score);
    } else {
      arr.push({ type: "leaderboard", user: solvedBy, userPhoto: "https://via.placeholder.com/38", score: 1, badge: "" });
      console.log("Added new leaderboard entry for:", solvedBy);
    }
    saveCommunity(arr);
    console.log('Leaderboard array after save:', arr);

    res.json({ success: true, message: "Issue marked solved and leaderboard updated." });
  } catch (error) {
    console.error('Error in mark-solved:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Serve your frontend files (admin.html, user.html, uploads, etc.)
app.use(express.static(__dirname));

// ==== START SERVER ====
app.listen(3300, () => {
  console.log("✅ Server running at http://localhost:3300");
  console.log("✅ Reports file:", REPORTS_PATH);
  console.log("✅ Loaded reports:", loadReports().length);
});
