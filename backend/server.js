const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3300;
const DB_PATH = path.join(__dirname, 'smartroad.db');
let db;

async function connectDb() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Database connection failed:', err.message || err);
        reject(err);
      } else {
        console.log('✅ Connected to SQLite database');
        resolve();
      }
    });
  });
}

function isCorruptError(err) {
  const message = err?.message || '';
  return message.includes('malformed') || message.includes('SQLITE_CORRUPT') || message.includes('integrity check failed');
}

async function backupCorruptDb() {
  if (db) {
    await new Promise((resolve, reject) => db.close((err) => err ? reject(err) : resolve()));
  }

  if (fs.existsSync(DB_PATH)) {
    const backupPath = `${DB_PATH}.corrupt.${Date.now()}`;
    fs.renameSync(DB_PATH, backupPath);
    console.warn(`⚠️ Corrupt database backed up as ${backupPath}`);
  }
}

async function ensureIntegrity() {
  const integrity = await dbGet('PRAGMA integrity_check');
  const value = integrity ? Object.values(integrity)[0] : null;
  if (value !== 'ok') {
    throw new Error(`integrity check failed: ${value}`);
  }
}

// Utility to promisify database operations
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
});

// ─── Middleware ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'frontend ')));

// ─── Multer ─────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ─── DB Init ─────────────────────────────────────────────────────────
async function initDB() {
  try {
    await connectDb();
    await ensureIntegrity();

    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(20) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(6) NOT NULL,
        dob DATE,
        phone VARCHAR(15),
        photo TEXT,
        gender VARCHAR(10),
        role VARCHAR(10) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(200) NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        username VARCHAR(20),
        email VARCHAR(100),
        latitude REAL,
        longitude REAL,
        address TEXT,
        image_url TEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        upvotes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS community_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(20),
        content TEXT NOT NULL,
        upvotes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS post_upvotes (
        post_id INTEGER,
        username VARCHAR(20),
        PRIMARY KEY (post_id, username)
      )
    `);

    const admin = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@gmail.com']);
    if (!admin) {
      await dbRun(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        ['admin', 'admin@gmail.com', '123456', 'admin']
      );
    }
    console.log('✅ Database initialized');
  } catch (err) {
    if (isCorruptError(err)) {
      console.error('DB init failed due to corrupt database:', err.message);
      await backupCorruptDb();
      return initDB();
    }

    console.error('DB init failed:', err.message);
    throw err;
  }
}

// ─── AUTH ROUTES ─────────────────────────────────────────────────────

// Sign Up
app.post('/api/signup', async (req, res) => {
  const { username, email, password, phone } = req.body;

  // Validate username: letters + numbers, max 20 chars
  if (!username || !/^[A-Za-z0-9]{1,20}$/.test(username)) {
    return res.json({ success: false, message: 'Username: letters/numbers only, max 20 chars' });
  }
  if (email && email.length > 40) {
    return res.json({ success: false, message: 'Email cannot exceed 40 characters' });
  }
  if (!email || (!email.endsWith('@gmail.com') && !email.endsWith('@yahoo.com'))) {
    return res.json({ success: false, message: 'Only @gmail.com or @yahoo.com addresses allowed' });
  }
  if (!password || password.length !== 6) {
    return res.json({ success: false, message: 'Password must be exactly 6 characters' });
  }

  try {
    await dbRun(
      'INSERT INTO users (username, email, password, phone) VALUES (?, ?, ?, ?)',
      [username, email, password, phone || null]
    );
    res.json({ success: true, message: 'Account created successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      res.json({ success: false, message: 'Email or username already exists' });
    } else {
      res.json({ success: false, message: 'Server error: ' + err.message });
    }
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.json({ success: false, message: 'Email and password required' });
  }
  try {
    const user = await dbGet(
      'SELECT * FROM users WHERE email = ? AND password = ?',
      [email, password]
    );
    if (!user) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }
    res.json({ success: true, username: user.username, role: user.role, email: user.email });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});

// ─── PROFILE ROUTES ──────────────────────────────────────────────────

app.get('/api/profile/:username', async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT username, email, phone, photo, gender, dob, role, created_at FROM users WHERE username = ?',
      [req.params.username]
    );
    if (!user) return res.json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile/:username', async (req, res) => {
  const { email, phone, gender, photo, dob } = req.body;
  if (email && (!email.endsWith('@gmail.com') && !email.endsWith('@yahoo.com'))) {
    return res.json({ success: false, message: 'Only @gmail.com or @yahoo.com allowed' });
  }
  try {
    await dbRun(
      'UPDATE users SET email=?, phone=?, gender=?, photo=?, dob=? WHERE username=?',
      [email || null, phone || null, gender || null, photo || null, dob || null, req.params.username]
    );
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});
// ─── ISSUES ROUTES ────────────────────────────────────────────────────

app.post('/api/issues', upload.single('image'), async (req, res) => {
  const { title, type, description, username, email, latitude, longitude, address } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    await dbRun(
      'INSERT INTO issues (title, type, description, username, email, latitude, longitude, address, image_url) VALUES (?,?,?,?,?,?,?,?,?)',
      [title, type, description, username, email, latitude, longitude, address, imageUrl]
    );
    res.json({ success: true, message: 'Issue reported successfully' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.get('/api/issues', async (req, res) => {
  try {
    const issues = await dbAll('SELECT * FROM issues ORDER BY created_at DESC');
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/issues/user/:username', async (req, res) => {
  try {
    const issues = await dbAll(
      'SELECT * FROM issues WHERE username = ? ORDER BY created_at DESC',
      [req.params.username]
    );
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/issues/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    await dbRun('UPDATE issues SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.delete('/api/issues/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM issues WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ─── COMMUNITY ROUTES ─────────────────────────────────────────────────

app.get('/api/community', async (req, res) => {
  try {
    const posts = await dbAll('SELECT * FROM community_posts ORDER BY created_at DESC LIMIT 50');
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/community', async (req, res) => {
  const { username, content } = req.body;
  if (!content || !username) return res.json({ success: false, message: 'Missing fields' });
  try {
    const result = await dbRun(
      'INSERT INTO community_posts (username, content) VALUES (?, ?)',
      [username, content]
    );
    const post = await dbGet('SELECT * FROM community_posts WHERE id = ?', [result.lastID]);
    res.json({ success: true, post });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.post('/api/community/:id/upvote', async (req, res) => {
  const { username } = req.body;
  try {
    await dbRun('INSERT INTO post_upvotes VALUES (?,?)', [req.params.id, username]);
    await dbRun('UPDATE community_posts SET upvotes = upvotes + 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: 'Already upvoted' });
  }
});

// ─── STATS ────────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  try {
    const total = await dbGet('SELECT COUNT(*) as count FROM issues');
    const pending = await dbGet("SELECT COUNT(*) as count FROM issues WHERE status='Pending'");
    const progress = await dbGet("SELECT COUNT(*) as count FROM issues WHERE status='In Progress'");
    const resolved = await dbGet("SELECT COUNT(*) as count FROM issues WHERE status='Resolved'");
    const byType = await dbAll('SELECT type, COUNT(*) as count FROM issues GROUP BY type ORDER BY count DESC');
    res.json({
      total: total.count,
      pending: pending.count,
      progress: progress.count,
      resolved: resolved.count,
      byType: byType
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── START ────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 SmartRoad server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('DB init failed:', err.message);
  process.exit(1);
});
