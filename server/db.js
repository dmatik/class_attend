import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'class_attend.db');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Open SQLite database
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

// Initialize schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      first_name TEXT DEFAULT '',
      last_name TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      token_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      days_of_week TEXT NOT NULL,
      total_lessons INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      course_name TEXT NOT NULL,
      date TEXT NOT NULL,
      attendance_status TEXT,
      attendance_reason TEXT,
      attendance_details TEXT,
      replacement_session_id TEXT,
      replacement_for_session_id TEXT,
      is_replacement INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_course ON sessions(course_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, date ASC);

    CREATE TABLE IF NOT EXISTS authenticators (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      public_key BLOB NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      device_type TEXT DEFAULT 'singleDevice',
      backed_up INTEGER DEFAULT 0,
      transports TEXT DEFAULT '[]',
      device_name TEXT DEFAULT 'Passkey',
      created_at TEXT NOT NULL,
      last_used_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_authenticators_user ON authenticators(user_id);

    CREATE TABLE IF NOT EXISTS course_users (
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (course_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_course_users_user ON course_users(user_id);
    CREATE INDEX IF NOT EXISTS idx_course_users_course ON course_users(course_id);
  `);

  // Migrate missing columns on existing databases if needed
  try {
    const userCols = db.prepare("PRAGMA table_info(users)").all();
    const userColNames = userCols.map(c => c.name);
    if (!userColNames.includes('token_version')) {
      db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;');
    }

    const sessionCols = db.prepare("PRAGMA table_info(sessions)").all();
    const colNames = sessionCols.map(c => c.name);
    if (!colNames.includes('attendance_details')) {
      db.exec('ALTER TABLE sessions ADD COLUMN attendance_details TEXT;');
    }
    if (!colNames.includes('replacement_for_session_id')) {
      db.exec('ALTER TABLE sessions ADD COLUMN replacement_for_session_id TEXT;');
    }

    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, date ASC);');

    // Backfill course_users for existing courses if empty
    const courseUsersCount = db.prepare('SELECT COUNT(*) as count FROM course_users').get().count;
    if (courseUsersCount === 0) {
      db.exec(`
        INSERT OR IGNORE INTO course_users (course_id, user_id, created_at)
        SELECT id, user_id, created_at FROM courses WHERE user_id IS NOT NULL;
      `);
    }
  } catch (err) {
    console.error('Migration error for columns:', err);
  }

  // 1. Seed default admin if no users exist
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const userCount = countStmt.get().count;

  let adminUserId = 'admin-default';

  if (userCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('admin', salt);
    const now = new Date().toISOString();

    const insertAdmin = db.prepare(`
      INSERT INTO users (id, username, password_hash, first_name, last_name, avatar, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAdmin.run(
      adminUserId,
      'admin',
      passwordHash,
      'מנהל',
      'מערכת',
      '',
      'admin',
      now,
      now
    );
    console.log('Seeded default admin user: "admin"');
  } else {
    // Find existing admin id if available
    const adminUser = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
    if (adminUser) {
      adminUserId = adminUser.id;
    }
  }

  // 2. Migrate existing db.json data if present
  if (fs.existsSync(LEGACY_JSON_FILE)) {
    try {
      const raw = fs.readFileSync(LEGACY_JSON_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const courses = data.courses || [];
      const sessions = data.sessions || [];

      // Check if admin already has courses to prevent duplicate migration
      const existingCoursesCount = db.prepare('SELECT COUNT(*) as count FROM courses WHERE user_id = ?').get(adminUserId).count;

      if (existingCoursesCount === 0 && (courses.length > 0 || sessions.length > 0)) {
        console.log(`Migrating ${courses.length} courses and ${sessions.length} sessions from db.json to SQLite...`);

        const insertCourse = db.prepare(`
          INSERT OR REPLACE INTO courses (id, user_id, name, start_date, end_date, days_of_week, total_lessons, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertSession = db.prepare(`
          INSERT OR REPLACE INTO sessions (
            id, user_id, course_id, course_name, date,
            attendance_status, attendance_reason, attendance_details,
            replacement_session_id, replacement_for_session_id, is_replacement, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const migrationTx = db.transaction(() => {
          const now = new Date().toISOString();
          for (const c of courses) {
            insertCourse.run(
              c.id,
              adminUserId,
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
              adminUserId,
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

        migrationTx();
        console.log('Migration completed successfully.');

        // Rename legacy file to db.json.migrated
        const backupFile = path.join(DATA_DIR, 'db.json.migrated');
        fs.renameSync(LEGACY_JSON_FILE, backupFile);
        console.log(`Renamed legacy db.json to ${backupFile}`);
      }
    } catch (err) {
      console.error('Error migrating data from db.json:', err);
    }
  }
}

export default db;

