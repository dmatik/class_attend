import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import db, { initDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'class-attend-sqlite-jwt-secret-2026';

// Initialize SQLite database
initDb();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support avatar upload

// Cache-Control headers for all API requests
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

/* --- Auth Middleware --- */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, role, first_name, last_name, avatar FROM users WHERE id = ?').get(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      avatar: user.avatar || ''
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

/* --- Auth Routes --- */

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      avatar: user.avatar || ''
    }
  });
});

// GET /api/auth/me
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile
app.put('/api/auth/profile', authenticate, (req, res) => {
  const { firstName, lastName, avatar } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET first_name = ?, last_name = ?, avatar = ?, updated_at = ?
    WHERE id = ?
  `).run(
    firstName?.trim() || '',
    lastName?.trim() || '',
    avatar || '',
    now,
    req.user.id
  );

  const updatedUser = db.prepare('SELECT id, username, role, first_name, last_name, avatar FROM users WHERE id = ?').get(req.user.id);
  res.json({
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      firstName: updatedUser.first_name || '',
      lastName: updatedUser.last_name || '',
      avatar: updatedUser.avatar || ''
    }
  });
});

// PUT /api/auth/password
app.put('/api/auth/password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters long' });
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Incorrect current password' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(newPassword, salt);
  const now = new Date().toISOString();

  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, req.user.id);
  res.json({ success: true });
});

/* --- Admin Routes --- */

// GET /api/admin/users
app.get('/api/admin/users', authenticate, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, first_name, last_name, avatar, role, created_at, updated_at
    FROM users
    ORDER BY created_at ASC
  `).all();

  res.json({
    users: users.map(u => ({
      id: u.id,
      username: u.username,
      firstName: u.first_name || '',
      lastName: u.last_name || '',
      avatar: u.avatar || '',
      role: u.role,
      createdAt: u.created_at,
      updatedAt: u.updated_at
    }))
  });
});

// POST /api/admin/users
app.post('/api/admin/users', authenticate, requireAdmin, (req, res) => {
  const { username, password, firstName, lastName, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUsername = username.trim();
  if (cleanUsername.length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters long' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long' });
  }

  const userRole = role === 'admin' ? 'admin' : 'user';

  // Check unique username
  const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(cleanUsername);
  if (existing) {
    return res.status(409).json({ error: 'A user with this username already exists' });
  }

  const id = crypto.randomUUID();
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, username, password_hash, first_name, last_name, avatar, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    cleanUsername,
    passwordHash,
    firstName?.trim() || '',
    lastName?.trim() || '',
    '',
    userRole,
    now,
    now
  );

  res.status(201).json({
    user: {
      id,
      username: cleanUsername,
      firstName: firstName?.trim() || '',
      lastName: lastName?.trim() || '',
      avatar: '',
      role: userRole,
      createdAt: now
    }
  });
});

// PUT /api/admin/users/:id
app.put('/api/admin/users/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, role } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Prevent demoting self if sole admin
  if (id === req.user.id && role === 'user') {
    const adminCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = "admin"').get().c;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot remove admin role from the only remaining admin' });
    }
  }

  const newRole = role === 'admin' ? 'admin' : 'user';
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET first_name = ?, last_name = ?, role = ?, updated_at = ?
    WHERE id = ?
  `).run(
    firstName !== undefined ? firstName.trim() : user.first_name,
    lastName !== undefined ? lastName.trim() : user.last_name,
    newRole,
    now,
    id
  );

  const updated = db.prepare('SELECT id, username, first_name, last_name, avatar, role, created_at FROM users WHERE id = ?').get(id);
  res.json({
    user: {
      id: updated.id,
      username: updated.username,
      firstName: updated.first_name || '',
      lastName: updated.last_name || '',
      avatar: updated.avatar || '',
      role: updated.role,
      createdAt: updated.created_at
    }
  });
});

// PUT /api/admin/users/:id/password
app.put('/api/admin/users/:id/password', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const now = new Date().toISOString();

  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, id);
  res.json({ success: true });
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

/* --- Scoped Data Routes (Per-User) --- */

// GET /api/data
app.get('/api/data', authenticate, (req, res) => {
  try {
    const userId = req.user.id;

    const courseRows = db.prepare('SELECT * FROM courses WHERE user_id = ? ORDER BY created_at ASC').all(userId);
    const sessionRows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY date ASC').all(userId);

    const courses = courseRows.map(c => ({
      id: c.id,
      name: c.name,
      startDate: c.start_date,
      endDate: c.end_date || undefined,
      daysOfWeek: JSON.parse(c.days_of_week || '[]'),
      totalLessons: c.total_lessons || undefined
    }));

    const sessions = sessionRows.map(s => {
      const sessionObj = {
        id: s.id,
        courseId: s.course_id,
        courseName: s.course_name,
        date: s.date
      };

      if (s.attendance_status) {
        sessionObj.attendance = {
          status: s.attendance_status,
          reason: s.attendance_reason || undefined
        };
      }

      if (s.replacement_session_id) {
        sessionObj.replacementSessionId = s.replacement_session_id;
      }

      if (s.is_replacement) {
        sessionObj.isReplacement = true;
      }

      return sessionObj;
    });

    res.json({ courses, sessions });
  } catch (error) {
    console.error('Failed to read data:', error);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// POST /api/data
app.post('/api/data', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const { courses = [], sessions = [] } = req.body;

    const deleteSessions = db.prepare('DELETE FROM sessions WHERE user_id = ?');
    const deleteCourses = db.prepare('DELETE FROM courses WHERE user_id = ?');

    const insertCourse = db.prepare(`
      INSERT INTO courses (id, user_id, name, start_date, end_date, days_of_week, total_lessons, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSession = db.prepare(`
      INSERT INTO sessions (id, user_id, course_id, course_name, date, attendance_status, attendance_reason, replacement_session_id, is_replacement, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const saveTransaction = db.transaction(() => {
      deleteSessions.run(userId);
      deleteCourses.run(userId);

      const now = new Date().toISOString();

      for (const c of courses) {
        insertCourse.run(
          c.id,
          userId,
          c.name,
          c.startDate,
          c.endDate || null,
          JSON.stringify(c.daysOfWeek || []),
          c.totalLessons || null,
          now
        );
      }

      for (const s of sessions) {
        insertSession.run(
          s.id,
          userId,
          s.courseId,
          s.courseName,
          s.date,
          s.attendance?.status || null,
          s.attendance?.reason || null,
          s.replacementSessionId || null,
          s.isReplacement ? 1 : 0,
          now
        );
      }
    });

    saveTransaction();
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save data:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
