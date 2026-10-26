import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import db, { initDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// In-memory rate limiting map: ip -> { count, resetAt }
const authRateLimits = new Map();
function rateLimitAuth(maxAttempts = (process.env.NODE_ENV === 'test' ? 1000 : 60), windowMs = 60 * 1000) {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const record = authRateLimits.get(ip) || { count: 0, resetAt: now + windowMs };

    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + windowMs;
    }

    record.count++;
    authRateLimits.set(ip, record);

    if (record.count > maxAttempts) {
      return res.status(429).json({
        error: 'too_many_requests',
        message: 'Too many authentication attempts. Please try again in a minute.'
      });
    }

    next();
  };
}

// Periodic cleanup of rate limits every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of authRateLimits.entries()) {
    if (rec.resetAt < now) {
      authRateLimits.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

// In-memory WebAuthn challenges: challengeId -> { challenge, userId, username, expiresAt }
const webauthnChallenges = new Map();

// Periodic cleanup of expired challenges every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, val] of webauthnChallenges.entries()) {
    if (val.expiresAt < now) {
      webauthnChallenges.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

function getWebAuthnConfig(req) {
  const rawOrigin = req.headers.origin || req.headers.referer;
  let clientOrigin = null;
  let clientHostname = null;

  if (rawOrigin) {
    try {
      const parsed = new URL(rawOrigin);
      clientOrigin = `${parsed.protocol}//${parsed.host}`;
      clientHostname = parsed.hostname;
    } catch {
      // ignore
    }
  }

  const hostHeader = req.get('host') || 'localhost:3001';
  const serverHostname = hostHeader.split(':')[0];
  const serverOrigin = `${req.protocol}://${hostHeader}`;

  const rpID = process.env.RP_ID || clientHostname || serverHostname || 'localhost';

  const origins = new Set();
  if (process.env.EXPECTED_ORIGIN) {
    process.env.EXPECTED_ORIGIN.split(',').forEach(o => origins.add(o.trim()));
  }
  if (clientOrigin) origins.add(clientOrigin);
  if (serverOrigin) origins.add(serverOrigin);

  // In local environments, permit both Vite dev server and Express/Docker ports
  origins.add('http://localhost:5173');
  origins.add('http://localhost:3001');
  origins.add('http://localhost:8080');
  origins.add('http://127.0.0.1:5173');
  origins.add('http://127.0.0.1:3001');
  origins.add('http://127.0.0.1:8080');

  const expectedOrigin = Array.from(origins);
  return { rpID, expectedOrigin, rpName: 'Class Attend' };
}

// Initialize SQLite database
initDb();

function getOrCreateJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('jwt_secret');
  if (row?.value) {
    return row.value;
  }

  const generated = crypto.randomBytes(64).toString('hex');
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('jwt_secret', generated);
  return generated;
}

const JWT_SECRET = getOrCreateJwtSecret();

function safeJsonParse(value, fallback = []) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support bulk session sync and avatar upload up to 5MB (Base64)

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
    const user = db.prepare('SELECT id, username, role, first_name, last_name, avatar, token_version FROM users WHERE id = ?').get(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    const currentTokenVersion = user.token_version || 0;
    const payloadTokenVersion = payload.tokenVersion ?? 0;
    if (payloadTokenVersion !== currentTokenVersion) {
      return res.status(401).json({ error: 'Session invalidated due to password change. Please log in again.' });
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
app.post('/api/auth/login', rateLimitAuth(20, 60000), (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
  const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUV0123456789';
  const hashToCompare = user ? user.password_hash : DUMMY_HASH;
  const isPasswordValid = bcrypt.compareSync(password, hashToCompare);

  if (!user || !isPasswordValid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, tokenVersion: user.token_version || 0 },
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

/* --- WebAuthn Passkey Routes --- */

// POST /api/auth/passkey/register-options (Generate registration options for authenticated user)
app.post('/api/auth/passkey/register-options', authenticate, async (req, res) => {
  try {
    const { rpID, rpName } = getWebAuthnConfig(req);
    const existing = db.prepare('SELECT id, transports FROM authenticators WHERE user_id = ?').all(req.user.id);
    const excludeCredentials = existing.map(a => ({
      id: a.id,
      transports: safeJsonParse(a.transports, [])
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(req.user.id)),
      userName: req.user.username,
      userDisplayName: [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.username,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    const challengeId = crypto.randomUUID();
    webauthnChallenges.set(challengeId, {
      challenge: options.challenge,
      userId: req.user.id,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    res.json({ options, challengeId });
  } catch (err) {
    console.error('Error generating passkey registration options:', err);
    res.status(500).json({ error: 'Failed to generate passkey registration options' });
  }
});

// POST /api/auth/passkey/register-verify (Verify registration response and store authenticator)
app.post('/api/auth/passkey/register-verify', authenticate, async (req, res) => {
  try {
    const { response, challengeId, deviceName } = req.body;
    if (!response || !challengeId) {
      return res.status(400).json({ error: 'Missing response or challengeId' });
    }

    const stored = webauthnChallenges.get(challengeId);
    // Delete immediately on retrieval to prevent concurrency races and replay
    webauthnChallenges.delete(challengeId);
    if (!stored || stored.userId !== req.user.id || stored.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Challenge expired or invalid. Please try again.' });
    }

    const { rpID, expectedOrigin } = getWebAuthnConfig(req);
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey verification failed' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const now = new Date().toISOString();

    const existingAuth = db.prepare('SELECT user_id FROM authenticators WHERE id = ?').get(credential.id);
    if (existingAuth && existingAuth.user_id !== req.user.id) {
      return res.status(409).json({ error: 'Passkey already registered to another user' });
    }

    db.prepare(`
      INSERT OR REPLACE INTO authenticators (
        id, user_id, public_key, counter, device_type, backed_up, transports, device_name, created_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      credential.id,
      req.user.id,
      Buffer.from(credential.publicKey),
      credential.counter,
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      JSON.stringify(credential.transports || []),
      deviceName?.trim() || 'Passkey',
      now,
      now
    );

    res.json({
      verified: true,
      passkey: {
        id: credential.id,
        deviceName: deviceName?.trim() || 'Passkey',
        createdAt: now
      }
    });
  } catch (err) {
    console.error('Error verifying passkey registration:', err);
    res.status(400).json({ error: err.message || 'Passkey verification failed' });
  }
});

// POST /api/auth/passkey/login-options (Generate authentication options)
app.post('/api/auth/passkey/login-options', async (req, res) => {
  try {
    const { username } = req.body || {};
    const { rpID } = getWebAuthnConfig(req);
    let allowCredentials = [];

    if (username && typeof username === 'string') {
      const user = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
      if (user) {
        const authenticators = db.prepare('SELECT id, transports FROM authenticators WHERE user_id = ?').all(user.id);
        allowCredentials = authenticators.map(a => ({
          id: a.id,
          transports: safeJsonParse(a.transports, [])
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    const challengeId = crypto.randomUUID();
    webauthnChallenges.set(challengeId, {
      challenge: options.challenge,
      username: username?.trim(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    res.json({ options, challengeId });
  } catch (err) {
    console.error('Error generating passkey login options:', err);
    res.status(500).json({ error: 'Failed to generate passkey login options' });
  }
});

// POST /api/auth/passkey/login-verify (Verify passkey authentication and issue JWT token)
app.post('/api/auth/passkey/login-verify', rateLimitAuth(20, 60000), async (req, res) => {
  try {
    const { response, challengeId } = req.body;
    if (!response || !challengeId) {
      return res.status(400).json({ error: 'Missing response or challengeId' });
    }

    const stored = webauthnChallenges.get(challengeId);
    // Delete immediately on retrieval to prevent concurrency races and replay
    webauthnChallenges.delete(challengeId);
    if (!stored || stored.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Challenge expired or invalid. Please try again.' });
    }

    const authenticator = db.prepare('SELECT * FROM authenticators WHERE id = ?').get(response.id);
    if (!authenticator) {
      return res.status(400).json({ error: 'Passkey not recognized' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(authenticator.user_id);
    if (!user) {
      return res.status(400).json({ error: 'User associated with this passkey not found' });
    }

    const { rpID, expectedOrigin } = getWebAuthnConfig(req);
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: authenticator.id,
        publicKey: new Uint8Array(authenticator.public_key),
        counter: authenticator.counter,
        transports: safeJsonParse(authenticator.transports, []),
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Passkey authentication failed' });
    }

    const { newCounter } = verification.authenticationInfo;
    const now = new Date().toISOString();
    db.prepare('UPDATE authenticators SET counter = ?, last_used_at = ? WHERE id = ?')
      .run(newCounter, now, authenticator.id);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, tokenVersion: user.token_version || 0 },
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
  } catch (err) {
    console.error('Error verifying passkey login:', err);
    res.status(400).json({ error: err.message || 'Passkey authentication failed' });
  }
});

// GET /api/auth/passkeys (List registered passkeys for current user)
app.get('/api/auth/passkeys', authenticate, (req, res) => {
  const passkeys = db.prepare(`
    SELECT id, device_name as deviceName, device_type as deviceType, backed_up as backedUp, created_at as createdAt, last_used_at as lastUsedAt
    FROM authenticators
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id);
  res.json({ passkeys });
});

// DELETE /api/auth/passkeys/:id (Remove a passkey)
app.delete('/api/auth/passkeys/:id', authenticate, (req, res) => {
  db.prepare('DELETE FROM authenticators WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// PATCH /api/auth/passkeys/:id (Rename a passkey)
app.patch('/api/auth/passkeys/:id', authenticate, (req, res) => {
  const { deviceName } = req.body;
  if (!deviceName || !deviceName.trim()) {
    return res.status(400).json({ error: 'Device name is required' });
  }
  db.prepare('UPDATE authenticators SET device_name = ? WHERE id = ? AND user_id = ?').run(deviceName.trim(), req.params.id, req.user.id);
  res.json({ success: true });
});

// GET /api/auth/me
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile
app.put('/api/auth/profile', authenticate, (req, res) => {
  const { firstName, lastName, avatar } = req.body;

  let validatedAvatar = '';
  if (avatar !== undefined && avatar !== null) {
    if (typeof avatar !== 'string') {
      return res.status(400).json({ error: 'avatar_invalid', message: 'Avatar must be a string' });
    }
    if (avatar.trim().length > 0) {
      // 5MB limit (~7MB base64 string)
      if (avatar.length > 7 * 1024 * 1024) {
        return res.status(400).json({ error: 'avatar_too_large', message: 'Avatar image must be under 5MB' });
      }
      // Strict image MIME check (PNG, JPEG, WebP only; rejects SVG to prevent stored XSS)
      const isAllowedImage = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar.trim());
      if (!isAllowedImage) {
        return res.status(400).json({
          error: 'avatar_invalid_format',
          message: 'Avatar must be a valid PNG, JPEG, or WebP base64 image'
        });
      }
      validatedAvatar = avatar.trim();
    }
  } else {
    const existing = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id);
    validatedAvatar = existing?.avatar || '';
  }

  const cleanFirst = typeof firstName === 'string' ? firstName.trim().slice(0, 50) : (req.user.firstName || '');
  const cleanLast = typeof lastName === 'string' ? lastName.trim().slice(0, 50) : (req.user.lastName || '');
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET first_name = ?, last_name = ?, avatar = ?, updated_at = ?
    WHERE id = ?
  `).run(
    cleanFirst,
    cleanLast,
    validatedAvatar,
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

  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?').run(newHash, now, req.user.id);
  res.json({ success: true });
});

/* --- Admin Routes --- */

// GET /api/admin/users
app.get('/api/admin/users', authenticate, requireAdmin, (req, res) => {
  try {
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
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

// POST /api/admin/users
app.post('/api/admin/users', authenticate, requireAdmin, (req, res) => {
  try {
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
      return res.status(409).json({ error: 'username_taken' });
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
  } catch (err) {
    console.error('Failed to create user:', err);
    res.status(500).json({ error: 'create_failed' });
  }
});

// PUT /api/admin/users/:id
app.put('/api/admin/users/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine target role: if role was explicitly provided in req.body, use it; otherwise retain existing role
    let targetRole = user.role;
    if (role !== undefined) {
      targetRole = role === 'admin' ? 'admin' : 'user';
    }

    // Prevent updating default admin role or demoting the sole remaining admin
    const isDefaultAdmin = id === 'admin-default' || user.username.toLowerCase() === 'admin';
    if (isDefaultAdmin && targetRole !== 'admin') {
      return res.status(400).json({ error: 'cannot_demote_default_admin' });
    }

    if (user.role === 'admin' && targetRole === 'user') {
      const adminCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('admin').c;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'cannot_demote_sole_admin' });
      }
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE users
      SET first_name = ?, last_name = ?, role = ?, updated_at = ?
      WHERE id = ?
    `).run(
      firstName !== undefined ? String(firstName).trim() : user.first_name,
      lastName !== undefined ? String(lastName).trim() : user.last_name,
      targetRole,
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
  } catch (err) {
    console.error('Failed to update user:', err);
    res.status(500).json({ error: 'update_failed' });
  }
});

// PUT /api/admin/users/:id/password
app.put('/api/admin/users/:id/password', authenticate, requireAdmin, (req, res) => {
  try {
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

    db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?').run(passwordHash, now, id);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to reset password:', err);
    res.status(500).json({ error: 'password_reset_failed' });
  }
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'cannot_delete_self' });
    }

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin') {
      const adminCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('admin').c;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'cannot_delete_sole_admin' });
      }
    }

    // Handle courses of deleted user to prevent orphans
    const userCourses = db.prepare('SELECT course_id FROM course_users WHERE user_id = ?').all(id);
    for (const { course_id } of userCourses) {
      const memberCount = db.prepare('SELECT COUNT(*) as count FROM course_users WHERE course_id = ?').get(course_id).count;
      if (memberCount <= 1) {
        // Sole member: delete course completely so no orphan course remains
        db.prepare('DELETE FROM courses WHERE id = ?').run(course_id);
      } else {
        // Shared with others: reassign course/session user_id to a remaining member if needed
        const nextMember = db.prepare('SELECT user_id FROM course_users WHERE course_id = ? AND user_id != ? LIMIT 1').get(course_id, id);
        if (nextMember) {
          db.prepare('UPDATE courses SET user_id = ? WHERE id = ?').run(nextMember.user_id, course_id);
          db.prepare('UPDATE sessions SET user_id = ? WHERE course_id = ?').run(nextMember.user_id, course_id);
        }
        db.prepare('DELETE FROM course_users WHERE course_id = ? AND user_id = ?').run(course_id, id);
      }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete user:', err);
    res.status(500).json({ error: 'delete_failed' });
  }
});

/* --- Course Sharing & Members Routes --- */

// GET /api/users (List all users for sharing - safe public profiles)
app.get('/api/users', authenticate, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, first_name, last_name, avatar
      FROM users
      ORDER BY first_name ASC, username ASC
    `).all();

    res.json({
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        avatar: u.avatar || ''
      }))
    });
  } catch (err) {
    console.error('Failed to list users:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// GET /api/courses/:id/members (List members of a course)
app.get('/api/courses/:id/members', authenticate, (req, res) => {
  try {
    const courseId = req.params.id;
    const hasAccess = db.prepare('SELECT 1 FROM course_users WHERE course_id = ? AND user_id = ?').get(courseId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: Access to this course is required' });
    }

    const members = db.prepare(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.avatar
      FROM course_users cu
      JOIN users u ON u.id = cu.user_id
      WHERE cu.course_id = ?
      ORDER BY u.first_name ASC, u.username ASC
    `).all(courseId);

    res.json({
      members: members.map(m => ({
        id: m.id,
        username: m.username,
        firstName: m.first_name || '',
        lastName: m.last_name || '',
        avatar: m.avatar || ''
      }))
    });
  } catch (err) {
    console.error('Failed to list course members:', err);
    res.status(500).json({ error: 'Failed to list course members' });
  }
});

// POST /api/courses/:id/members (Add a member to course)
app.post('/api/courses/:id/members', authenticate, (req, res) => {
  try {
    const courseId = req.params.id;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const hasAccess = db.prepare('SELECT 1 FROM course_users WHERE course_id = ? AND user_id = ?').get(courseId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: Access to this course is required' });
    }

    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = new Date().toISOString();
    db.prepare('INSERT OR IGNORE INTO course_users (course_id, user_id, created_at) VALUES (?, ?, ?)').run(courseId, userId, now);

    const members = db.prepare(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.avatar
      FROM course_users cu
      JOIN users u ON u.id = cu.user_id
      WHERE cu.course_id = ?
      ORDER BY u.first_name ASC, u.username ASC
    `).all(courseId);

    res.json({
      success: true,
      members: members.map(m => ({
        id: m.id,
        username: m.username,
        firstName: m.first_name || '',
        lastName: m.last_name || '',
        avatar: m.avatar || ''
      }))
    });
  } catch (err) {
    console.error('Failed to add course member:', err);
    res.status(500).json({ error: 'Failed to add course member' });
  }
});

// DELETE /api/courses/:id/members/:userId (Remove member from course - orphan guard)
app.delete('/api/courses/:id/members/:userId', authenticate, (req, res) => {
  try {
    const courseId = req.params.id;
    const targetUserId = req.params.userId;

    const hasAccess = db.prepare('SELECT 1 FROM course_users WHERE course_id = ? AND user_id = ?').get(courseId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: Access to this course is required' });
    }

    // Only allow removing other members if user is the course creator or admin; members can always remove themselves (leave)
    const course = db.prepare('SELECT user_id FROM courses WHERE id = ?').get(courseId);
    const isCreatorOrAdmin = (course && course.user_id === req.user.id) || req.user.role === 'admin';
    if (!isCreatorOrAdmin && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'forbidden', message: 'Only the course creator or an admin can remove other members' });
    }

    const removeTransaction = db.transaction(() => {
      // Verify target user is indeed a member
      const isMember = db.prepare('SELECT 1 FROM course_users WHERE course_id = ? AND user_id = ?').get(courseId, targetUserId);
      if (!isMember) {
        return { notFound: true };
      }

      // Orphan prevention check: At least one user must remain!
      const memberCount = db.prepare('SELECT COUNT(*) as count FROM course_users WHERE course_id = ?').get(courseId).count;
      if (memberCount <= 1) {
        return { cannotRemoveLast: true };
      }

      // Remove user from course_users
      db.prepare('DELETE FROM course_users WHERE course_id = ? AND user_id = ?').run(courseId, targetUserId);

      // If target user was courses.user_id, reassign to a remaining member
      if (course && course.user_id === targetUserId) {
        const nextMember = db.prepare('SELECT user_id FROM course_users WHERE course_id = ? LIMIT 1').get(courseId);
        if (nextMember) {
          db.prepare('UPDATE courses SET user_id = ? WHERE id = ?').run(nextMember.user_id, courseId);
          db.prepare('UPDATE sessions SET user_id = ? WHERE course_id = ?').run(nextMember.user_id, courseId);
        }
      }

      return { success: true };
    });

    const result = removeTransaction();
    if (result.notFound) {
      return res.status(404).json({ error: 'Member not found on this course' });
    }
    if (result.cannotRemoveLast) {
      return res.status(400).json({
        error: 'cannot_remove_last_member',
        message: 'A course must have at least one user with access.'
      });
    }

    const remainingMembers = db.prepare(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.avatar
      FROM course_users cu
      JOIN users u ON u.id = cu.user_id
      WHERE cu.course_id = ?
      ORDER BY u.first_name ASC, u.username ASC
    `).all(courseId);

    res.json({
      success: true,
      members: remainingMembers.map(m => ({
        id: m.id,
        username: m.username,
        firstName: m.first_name || '',
        lastName: m.last_name || '',
        avatar: m.avatar || ''
      }))
    });
  } catch (err) {
    console.error('Failed to remove course member:', err);
    res.status(500).json({ error: 'Failed to remove course member' });
  }
});

/* --- Scoped Data Routes (Per-User) --- */

// GET /api/data
app.get('/api/data', authenticate, (req, res) => {
  try {
    const userId = req.user.id;

    const courseRows = db.prepare(`
      SELECT c.*
      FROM courses c
      JOIN course_users cu ON cu.course_id = c.id
      WHERE cu.user_id = ?
      ORDER BY c.created_at ASC
    `).all(userId);

    const sessionRows = db.prepare(`
      SELECT s.*
      FROM sessions s
      JOIN course_users cu ON cu.course_id = s.course_id
      WHERE cu.user_id = ?
      ORDER BY s.date ASC
    `).all(userId);

    const courseIds = courseRows.map(c => c.id);
    const membersByCourse = new Map();
    if (courseIds.length > 0) {
      const placeholders = courseIds.map(() => '?').join(',');
      const allMembers = db.prepare(`
        SELECT cu.course_id, u.id, u.username, u.first_name, u.last_name, u.avatar
        FROM course_users cu
        JOIN users u ON u.id = cu.user_id
        WHERE cu.course_id IN (${placeholders})
        ORDER BY u.first_name ASC, u.username ASC
      `).all(...courseIds);

      for (const m of allMembers) {
        if (!membersByCourse.has(m.course_id)) {
          membersByCourse.set(m.course_id, []);
        }
        membersByCourse.get(m.course_id).push({
          id: m.id,
          username: m.username,
          firstName: m.first_name || '',
          lastName: m.last_name || '',
          avatar: m.avatar || ''
        });
      }
    }

    const courses = courseRows.map(c => {
      const daysOfWeek = safeJsonParse(c.days_of_week, []);
      const members = membersByCourse.get(c.id) || [];

      return {
        id: c.id,
        name: c.name,
        startDate: c.start_date,
        endDate: c.end_date || undefined,
        daysOfWeek,
        totalLessons: c.total_lessons || undefined,
        sharedWith: members
      };
    });

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
          reason: s.attendance_reason || undefined,
          details: s.attendance_details || undefined
        };
      }

      if (s.replacement_session_id) {
        sessionObj.replacementSessionId = s.replacement_session_id;
      }

      if (s.replacement_for_session_id) {
        sessionObj.replacementForSessionId = s.replacement_for_session_id;
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
    const { courses = [], sessions = [], confirmEmpty = false } = req.body;

    if (!Array.isArray(courses) || !Array.isArray(sessions)) {
      return res.status(400).json({ error: 'courses and sessions must be arrays' });
    }

    // Safety guard against accidental full-data wipe (P0-5)
    if (courses.length === 0) {
      const existingCoursesCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM course_users
        WHERE user_id = ?
      `).get(userId).count;
      if (existingCoursesCount > 0 && !confirmEmpty) {
        return res.status(400).json({
          error: 'wipe_prevented',
          message: 'Cannot wipe all courses without explicit confirmEmpty: true'
        });
      }
    }

    // Validate course ownership scoping for submitted sessions
    const submittedCourseIds = new Set(courses.map(c => c.id));
    for (const s of sessions) {
      if (!submittedCourseIds.has(s.courseId)) {
        return res.status(400).json({
          error: `Session references unauthorized or non-existent course ${s.courseId}`
        });
      }
    }

    const existingAccessibleCourses = db.prepare('SELECT course_id FROM course_users WHERE user_id = ?').all(userId);
    const existingAccessibleCourseIds = new Set(existingAccessibleCourses.map(r => r.course_id));

    const checkCourseStmt = db.prepare('SELECT id, user_id FROM courses WHERE id = ?');

    // SEC-01: Multi-tenant IDOR defense - verify all submitted existing courses are accessible to user
    for (const c of courses) {
      const existing = checkCourseStmt.get(c.id);
      if (existing && !existingAccessibleCourseIds.has(c.id)) {
        return res.status(403).json({
          error: 'forbidden_course_access',
          message: `Cannot modify or access course ${c.id}`
        });
      }
    }

    const insertCourseStmt = db.prepare(`
      INSERT INTO courses (id, user_id, name, start_date, end_date, days_of_week, total_lessons, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateCourseStmt = db.prepare(`
      UPDATE courses
      SET name = ?, start_date = ?, end_date = ?, days_of_week = ?, total_lessons = ?
      WHERE id = ?
    `);
    const insertCourseUserStmt = db.prepare(`
      INSERT OR IGNORE INTO course_users (course_id, user_id, created_at)
      VALUES (?, ?, ?)
    `);
    const deleteCourseStmt = db.prepare('DELETE FROM courses WHERE id = ?');

    const upsertSessionStmt = db.prepare(`
      INSERT INTO sessions (
        id, user_id, course_id, course_name, date,
        attendance_status, attendance_reason, attendance_details,
        replacement_session_id, replacement_for_session_id, is_replacement, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_name = excluded.course_name,
        date = excluded.date,
        attendance_status = excluded.attendance_status,
        attendance_reason = excluded.attendance_reason,
        attendance_details = excluded.attendance_details,
        replacement_session_id = excluded.replacement_session_id,
        replacement_for_session_id = excluded.replacement_for_session_id,
        is_replacement = excluded.is_replacement
    `);
    const deleteSessionStmt = db.prepare('DELETE FROM sessions WHERE id = ?');

    const saveTransaction = db.transaction(() => {
      const now = new Date().toISOString();

      // 1. DATA-01: Handle courses missing from submitted payload
      for (const courseId of existingAccessibleCourseIds) {
        if (!submittedCourseIds.has(courseId)) {
          const memberCount = db.prepare('SELECT COUNT(*) as count FROM course_users WHERE course_id = ?').get(courseId).count;
          if (memberCount <= 1) {
            // Sole member: course was genuinely deleted by sole owner, hard delete
            deleteCourseStmt.run(courseId);
          } else {
            // Shared course with other members: stale client auto-save or individual removal!
            // Only unlink current user from course_users, do NOT delete course for collaborators
            db.prepare('DELETE FROM course_users WHERE course_id = ? AND user_id = ?').run(courseId, userId);
            const course = checkCourseStmt.get(courseId);
            if (course && course.user_id === userId) {
              const nextMember = db.prepare('SELECT user_id FROM course_users WHERE course_id = ? LIMIT 1').get(courseId);
              if (nextMember) {
                db.prepare('UPDATE courses SET user_id = ? WHERE id = ?').run(nextMember.user_id, courseId);
                db.prepare('UPDATE sessions SET user_id = ? WHERE course_id = ?').run(nextMember.user_id, courseId);
              }
            }
          }
        }
      }

      // 2. Insert or update courses
      for (const c of courses) {
        const existing = checkCourseStmt.get(c.id);
        if (!existing) {
          insertCourseStmt.run(
            c.id,
            userId,
            c.name,
            c.startDate,
            c.endDate || null,
            JSON.stringify(c.daysOfWeek || []),
            c.totalLessons || null,
            now
          );
          insertCourseUserStmt.run(c.id, userId, now);
        } else {
          if (existingAccessibleCourseIds.has(c.id)) {
            updateCourseStmt.run(
              c.name,
              c.startDate,
              c.endDate || null,
              JSON.stringify(c.daysOfWeek || []),
              c.totalLessons || null,
              c.id
            );
          }
        }
      }

      // 3. Sync sessions
      const submittedSessionIds = new Set(sessions.map(s => s.id));

      for (const courseId of submittedCourseIds) {
        const existingSessions = db.prepare('SELECT id FROM sessions WHERE course_id = ?').all(courseId);
        for (const s of existingSessions) {
          if (!submittedSessionIds.has(s.id)) {
            deleteSessionStmt.run(s.id);
          }
        }
      }

      for (const s of sessions) {
        upsertSessionStmt.run(
          s.id,
          userId,
          s.courseId,
          s.courseName,
          s.date,
          s.attendance?.status || null,
          s.attendance?.reason || null,
          s.attendance?.details || null,
          s.replacementSessionId || null,
          s.replacementForSessionId || null,
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

// 404 handler for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global API error handler
app.use((err, req, res, next) => {
  // Handle payload / body size errors gracefully
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    return res.status(413).json({
      error: 'payload_too_large',
      message: 'Request payload is too large. Maximum size is 5MB.'
    });
  }

  console.error('Unhandled server error:', err);
  if (req.path.startsWith('/api') || req.originalUrl?.startsWith('/api')) {
    const isProd = process.env.NODE_ENV === 'production';
    const message = isProd ? 'Internal server error' : (err.message || 'Internal server error');
    return res.status(500).json({ error: message });
  }
  next(err);
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
