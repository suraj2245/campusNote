import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const uploadsDir = path.join(rootDir, 'uploads');
const dbPath = path.join(rootDir, 'campusnotes.db');

fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD = process.env.CAMPUSNOTES_ADMIN_PASSWORD;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
}
if (!ADMIN_PASSWORD) {
  throw new Error('CAMPUSNOTES_ADMIN_PASSWORD must be set.');
}
const uploadLimit = 25 * 1024 * 1024;
const teacherUploadLimit = 250 * 1024 * 1024;
const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png']);
const allowedTeacherVideoExtensions = new Set(['.mp4', '.webm', '.mov', '.m4v']);
const allowedMaterialTypes = new Set([
  'Subject Notes',
  'Previous Year Question Paper',
  'Manual Lab',
  'Lecture Notes',
  'Assignments',
  'Question Papers',
  'Practical Files',
  'Lab Manuals',
  'Reference Materials',
  'Lecture Video',
]);

const db = new sqlite3.Database(dbPath);

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

function dbExec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

await dbExec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    studentId TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    collegeName TEXT,
    branch TEXT,
    year TEXT,
    semester TEXT,
    profilePicture TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student', 'admin')),
    status TEXT NOT NULL DEFAULT 'active',
    tokenVersion INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    phone TEXT,
    collegeName TEXT,
    department TEXT,
    profilePicture TEXT,
    password TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    tokenVersion INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    subject TEXT NOT NULL,
    branch TEXT,
    year TEXT,
    semester TEXT,
    materialType TEXT NOT NULL,
    fileUrl TEXT NOT NULL,
    uploadedBy INTEGER NOT NULL,
    uploadedByRole TEXT NOT NULL DEFAULT 'student',
    videoUrl TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    rejectionReason TEXT,
    uploadedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewedAt TEXT,
    approvedAt TEXT,
    approvedBy INTEGER,
    FOREIGN KEY(uploadedBy) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS materialRatings (
    materialId INTEGER NOT NULL,
    studentId INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(materialId, studentId),
    FOREIGN KEY(materialId) REFERENCES materials(id),
    FOREIGN KEY(studentId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS materialDownloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    materialId INTEGER NOT NULL,
    userId INTEGER REFERENCES users(id),
    downloadedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS materialSaves (
    materialId INTEGER NOT NULL REFERENCES materials(id),
    studentId INTEGER NOT NULL REFERENCES users(id),
    savedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(materialId, studentId)
  );

  CREATE TABLE IF NOT EXISTS studentSettings (
    studentId INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences TEXT NOT NULL DEFAULT '{}',
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS supportReports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teacherSettings (
    teacherId INTEGER PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
    preferences TEXT NOT NULL DEFAULT '{}',
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teacherNotifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacherId INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    materialId INTEGER REFERENCES materials(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    isRead INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teacherSupportReports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacherId INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS materialReviewHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    materialId INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    feedback TEXT,
    reviewedBy TEXT,
    reviewedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS appSettings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    studentUploadsEnabled INTEGER NOT NULL DEFAULT 1,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedBy TEXT
  );

  CREATE TABLE IF NOT EXISTS activityLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    performedBy TEXT,
    targetId TEXT,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const materialColumns = await dbAll('PRAGMA table_info(materials)');
const downloadColumns = await dbAll('PRAGMA table_info(materialDownloads)');
const userColumns = await dbAll('PRAGMA table_info(users)');
const teacherColumns = await dbAll('PRAGMA table_info(teachers)');
if (!materialColumns.some((column) => column.name === 'uploadedByRole')) {
  await dbRun("ALTER TABLE materials ADD COLUMN uploadedByRole TEXT NOT NULL DEFAULT 'student'");
}
if (!materialColumns.some((column) => column.name === 'videoUrl')) {
  await dbRun('ALTER TABLE materials ADD COLUMN videoUrl TEXT');
}
if (!downloadColumns.some((column) => column.name === 'userId')) {
  await dbRun('ALTER TABLE materialDownloads ADD COLUMN userId INTEGER REFERENCES users(id)');
}
if (!userColumns.some((column) => column.name === 'collegeName')) {
  await dbRun('ALTER TABLE users ADD COLUMN collegeName TEXT');
}
if (!userColumns.some((column) => column.name === 'profilePicture')) {
  await dbRun('ALTER TABLE users ADD COLUMN profilePicture TEXT');
}
if (!userColumns.some((column) => column.name === 'tokenVersion')) {
  await dbRun('ALTER TABLE users ADD COLUMN tokenVersion INTEGER NOT NULL DEFAULT 0');
}
for (const [name, definition] of [
  ['phone', 'TEXT'],
  ['collegeName', 'TEXT'],
  ['department', 'TEXT'],
  ['profilePicture', 'TEXT'],
  ['tokenVersion', 'INTEGER NOT NULL DEFAULT 0'],
]) {
  if (!teacherColumns.some((column) => column.name === name)) {
    await dbRun(`ALTER TABLE teachers ADD COLUMN ${name} ${definition}`);
  }
}
if (!materialColumns.some((column) => column.name === 'reviewedAt')) {
  await dbRun('ALTER TABLE materials ADD COLUMN reviewedAt TEXT');
}

const existingSetting = await dbGet('SELECT * FROM appSettings WHERE id = 1');
if (!existingSetting) {
  await dbRun(
    'INSERT INTO appSettings (id, studentUploadsEnabled, updatedAt, updatedBy) VALUES (1, 1, datetime("now"), "system")'
  );
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(publicDir));

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId || null,
      subject: user.subject || null,
      tokenVersion: Number(user.tokenVersion) || 0,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function sendJsonError(res, status, message) {
  return res.status(status).json({ message });
}

function getTokenFromRequest(req) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return null;
  return authorization.replace('Bearer ', '').trim();
}

async function verifyToken(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return sendJsonError(res, 401, 'Unauthorized. Please log in again.');
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return sendJsonError(res, 401, 'Invalid or expired session.');
  }

  if (payload.role === 'student' || payload.role === 'teacher') {
    try {
      if (payload.role === 'teacher') {
        const account = await dbGet('SELECT status, tokenVersion FROM teachers WHERE id = ?', [payload.id]);
        if (!account || account.status !== 'active' || Number(account.tokenVersion || 0) !== Number(payload.tokenVersion || 0)) {
          return sendJsonError(res, 401, 'Your session is no longer active. Please sign in again.');
        }
      } else {
        const account = await dbGet('SELECT status, tokenVersion FROM users WHERE id = ? AND role = ?', [payload.id, 'student']);
        if (!account || account.status !== 'active' || Number(account.tokenVersion || 0) !== Number(payload.tokenVersion || 0)) {
          return sendJsonError(res, 401, 'Your session is no longer active. Please sign in again.');
        }
      }
    } catch (error) {
      console.error(`Verify ${payload.role} session error:`, error);
      return sendJsonError(res, 500, 'Unable to verify your session.');
    }
  }

  req.user = payload;
  return next();
}

function requireRole(role) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || userRole !== role) {
      return sendJsonError(res, 403, 'You do not have permission to perform this action.');
    }
    return next();
  };
}

async function logAction(action, performedBy, targetId = null) {
  await dbRun(
    'INSERT INTO activityLogs (action, performedBy, targetId, timestamp) VALUES (?, ?, ?, datetime("now"))',
    [action, performedBy, targetId ? String(targetId) : null]
  );
}

const DEFAULT_TEACHER_PREFERENCES = {
  notifications: { approvalUpdates: true, rejectionUpdates: true, announcements: true, email: true },
  appearance: { theme: 'system' },
  privacy: { profileVisibility: 'campus' },
};

function mergeTeacherPreferences(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : value || {};
  return {
    notifications: { ...DEFAULT_TEACHER_PREFERENCES.notifications, ...parsed.notifications },
    appearance: { ...DEFAULT_TEACHER_PREFERENCES.appearance, ...parsed.appearance },
    privacy: { ...DEFAULT_TEACHER_PREFERENCES.privacy, ...parsed.privacy },
  };
}

function validTeacherPreferences(input) {
  return Boolean(input
    && typeof input === 'object'
    && input.notifications
    && Object.keys(DEFAULT_TEACHER_PREFERENCES.notifications).every((key) => typeof input.notifications[key] === 'boolean')
    && input.appearance
    && ['light', 'dark', 'system'].includes(input.appearance.theme)
    && input.privacy
    && ['campus', 'private'].includes(input.privacy.profileVisibility));
}

async function createTeacherNotification(teacherId, materialId, type, message) {
  const row = await dbGet('SELECT preferences FROM teacherSettings WHERE teacherId = ?', [teacherId]);
  const preferences = mergeTeacherPreferences(row?.preferences);
  const preferenceKey = type === 'material_approved'
    ? 'approvalUpdates'
    : type === 'material_rejected'
      ? 'rejectionUpdates'
      : null;
  if (preferenceKey && !preferences.notifications[preferenceKey]) return;

  await dbRun(
    'INSERT INTO teacherNotifications (teacherId, materialId, type, message) VALUES (?, ?, ?, ?)',
    [teacherId, materialId || null, type, message]
  );
}

const memoryStorage = multer.memoryStorage();

async function uploadFileToCloud(file, folder = 'files') {
  const extension = path.extname(file.originalname).toLowerCase();
  const uniqueName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
  
  if (supabase) {
    const { data, error } = await supabase.storage
      .from('materials')
      .upload(uniqueName, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true,
      });
    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error('Cloud upload failed: ' + error.message);
    }
    const { data: publicData } = supabase.storage
      .from('materials')
      .getPublicUrl(uniqueName);
    return publicData.publicUrl;
  }

  // Fallback to local storage if Supabase is not configured
  const localFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
  const localFilePath = path.join(uploadsDir, localFileName);
  fs.writeFileSync(localFilePath, file.buffer);
  return `/uploads/${localFileName}`;
}

const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: uploadLimit },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return cb(new Error('Unsupported file type. Allowed formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG.'));
    }
    cb(null, true);
  },
});

const teacherUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: teacherUploadLimit },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension) && !allowedTeacherVideoExtensions.has(extension)) {
      return cb(new Error('Unsupported file type. Upload notes as PDF, DOC, DOCX, PPT, PPTX, JPG, or PNG, or upload videos as MP4, WEBM, MOV, or M4V.'));
    }
    cb(null, true);
  },
});

const profilePictureUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension)
      && ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (!isImage) return cb(new Error('Choose a JPG, PNG, or WebP profile picture.'));
    cb(null, true);
  },
});

const DEFAULT_STUDENT_PREFERENCES = {
  notifications: {
    uploadApproved: true,
    uploadRejected: true,
    newMaterials: true,
    downloadActivity: false,
    announcements: true,
    email: true,
  },
  appearance: { theme: 'system', language: 'en', fontSize: 'medium' },
  privacy: { profileVisibility: 'campus' },
  study: {
    downloadPreference: 'download',
    preferredSubjects: [],
    defaultBranch: '',
    defaultYear: '',
    defaultSemester: '',
    savedNotesFirst: false,
  },
};

function mergeStudentPreferences(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : value || {};
  return {
    notifications: { ...DEFAULT_STUDENT_PREFERENCES.notifications, ...parsed.notifications },
    appearance: { ...DEFAULT_STUDENT_PREFERENCES.appearance, ...parsed.appearance },
    privacy: { ...DEFAULT_STUDENT_PREFERENCES.privacy, ...parsed.privacy },
    study: { ...DEFAULT_STUDENT_PREFERENCES.study, ...parsed.study },
  };
}

function validStudentPreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const { notifications, appearance, privacy, study } = input;
  const validNotifications = notifications && Object.keys(DEFAULT_STUDENT_PREFERENCES.notifications)
    .every((key) => typeof notifications[key] === 'boolean');
  const validAppearance = appearance
    && ['light', 'dark', 'system'].includes(appearance.theme)
    && ['en', 'mr'].includes(appearance.language)
    && ['small', 'medium', 'large'].includes(appearance.fontSize);
  const validPrivacy = privacy && ['campus', 'private'].includes(privacy.profileVisibility);
  const validStudy = study
    && ['download', 'open'].includes(study.downloadPreference)
    && Array.isArray(study.preferredSubjects)
    && study.preferredSubjects.length <= 30
    && study.preferredSubjects.every((subject) => typeof subject === 'string' && subject.length <= 100)
    && ['defaultBranch', 'defaultYear', 'defaultSemester'].every((key) => typeof study[key] === 'string' && study[key].length <= 100)
    && (!study.defaultYear || ['1st Year', '2nd Year', '3rd Year', '4th Year'].includes(study.defaultYear))
    && (!study.defaultSemester || /^Semester [1-8]$/.test(study.defaultSemester))
    && typeof study.savedNotesFirst === 'boolean';
  return Boolean(validNotifications && validAppearance && validPrivacy && validStudy);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'CampusNotes API is running.' });
});

app.get('/api/me', verifyToken, async (req, res) => {
  if (req.user.role === 'teacher') {
    try {
      const user = await dbGet(
        "SELECT id, name, email, subject, phone, collegeName, department, profilePicture, 'teacher' AS role, status FROM teachers WHERE id = ?",
        [req.user.id]
      );
      if (!user || user.status !== 'active') return sendJsonError(res, 401, 'Your teacher account is not available.');
      return res.json({ user });
    } catch (error) {
      console.error('Get current teacher error:', error);
      return sendJsonError(res, 500, 'Unable to load your teacher account.');
    }
  }

  if (req.user.role === 'student') {
    try {
      const user = await dbGet(
        `SELECT id, name, studentId, email, phone, collegeName, branch, year, semester,
                profilePicture, role, status, createdAt
         FROM users WHERE id = ? AND role = 'student'`,
        [req.user.id]
      );
      if (!user || user.status !== 'active') {
        return sendJsonError(res, 401, 'Your student account is not available. Please sign in again.');
      }
      return res.json({ user });
    } catch (error) {
      console.error('Get current student error:', error);
      return sendJsonError(res, 500, 'Unable to load your account.');
    }
  }

  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      studentId: req.user.studentId,
      subject: req.user.subject,
    },
  });
});

app.get('/api/student/settings', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const user = await dbGet(
      `SELECT id, name, studentId, email, phone, collegeName, branch, year, semester,
              profilePicture, status, createdAt
       FROM users WHERE id = ? AND role = 'student'`,
      [req.user.id]
    );
    if (!user || user.status !== 'active') {
      return sendJsonError(res, 401, 'Your student account is not available. Please sign in again.');
    }

    const stored = await dbGet('SELECT preferences FROM studentSettings WHERE studentId = ?', [user.id]);
    const preferences = mergeStudentPreferences(stored?.preferences);
    await dbRun(
      `INSERT INTO studentSettings (studentId, preferences, updatedAt)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(studentId) DO NOTHING`,
      [user.id, JSON.stringify(preferences)]
    );

    res.json({
      user,
      preferences,
      session: {
        expiresAt: req.user.exp ? new Date(req.user.exp * 1000).toISOString() : null,
        sessionTrackingAvailable: false,
      },
    });
  } catch (error) {
    console.error('Get student settings error:', error);
    return sendJsonError(res, 500, 'Unable to load your settings.');
  }
});

app.put('/api/student/settings/profile', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const {
      name, email, phone, collegeName, branch, year, semester,
    } = req.body || {};
    const clean = (value) => typeof value === 'string' ? value.trim() : '';
    const profile = {
      name: clean(name),
      email: clean(email).toLowerCase(),
      phone: clean(phone),
      collegeName: clean(collegeName),
      branch: clean(branch),
      year: clean(year),
      semester: clean(semester),
    };

    if (!profile.name || profile.name.length > 100) {
      return sendJsonError(res, 400, 'Enter a full name of 1 to 100 characters.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) || profile.email.length > 254) {
      return sendJsonError(res, 400, 'Enter a valid email address.');
    }
    if (profile.phone && !/^\+?[0-9\s().-]{7,20}$/.test(profile.phone)) {
      return sendJsonError(res, 400, 'Enter a valid mobile number with 7 to 20 characters.');
    }
    if (!profile.branch || !['1st Year', '2nd Year', '3rd Year', '4th Year'].includes(profile.year)
        || !/^Semester [1-8]$/.test(profile.semester)) {
      return sendJsonError(res, 400, 'Select a valid branch, academic year, and semester.');
    }
    if (['collegeName', 'branch', 'year', 'semester'].some((key) => profile[key].length > 120)) {
      return sendJsonError(res, 400, 'College and academic details must be 120 characters or fewer.');
    }

    const duplicate = await dbGet(
      'SELECT id FROM users WHERE lower(email) = ? AND id != ?',
      [profile.email, req.user.id]
    );
    if (duplicate) return sendJsonError(res, 409, 'That email address is already associated with another account.');

    let updated;
    await dbExec('BEGIN IMMEDIATE');
    try {
      updated = await dbRun(
        `UPDATE users
         SET name = ?, email = ?, phone = ?, collegeName = ?, branch = ?, year = ?, semester = ?
         WHERE id = ? AND role = 'student'`,
        [profile.name, profile.email, profile.phone || null, profile.collegeName || null,
          profile.branch, profile.year, profile.semester, req.user.id]
      );
      if (!updated.changes) {
        await dbExec('ROLLBACK');
        return sendJsonError(res, 404, 'Student account not found.');
      }
      await logAction('Student profile updated', profile.email, req.user.id);
      await dbExec('COMMIT');
    } catch (error) {
      await dbExec('ROLLBACK');
      throw error;
    }
    const user = await dbGet(
      `SELECT id, name, studentId, email, phone, collegeName, branch, year, semester,
              profilePicture, status, createdAt
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    return res.json({ user, message: 'Your profile has been updated.' });
  } catch (error) {
    console.error('Update student profile error:', error);
    return sendJsonError(res, 500, 'Unable to save your profile.');
  }
});

app.post('/api/student/settings/profile-picture', verifyToken, requireRole('student'), (req, res) => {
  profilePictureUpload.single('profilePicture')(req, res, async (uploadError) => {
    if (uploadError) return sendJsonError(res, 400, uploadError.message || 'Unable to upload that profile picture.');
    if (!req.file) return sendJsonError(res, 400, 'Choose a profile picture to upload.');

    try {
      const current = await dbGet(
        'SELECT profilePicture FROM users WHERE id = ? AND role = ?',
        [req.user.id, 'student']
      );
      if (!current) {
        return sendJsonError(res, 404, 'Student account not found.');
      }

      const profilePicture = await uploadFileToCloud(req.file, 'avatars');
      await dbRun('UPDATE users SET profilePicture = ? WHERE id = ?', [profilePicture, req.user.id]);
      return res.json({ profilePicture, message: 'Your profile picture has been updated.' });
    } catch (error) {
      console.error('Update student profile picture error:', error);
      return sendJsonError(res, 500, 'Unable to save your profile picture.');
    }
  });
});

app.put('/api/student/settings/preferences', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const preferences = req.body?.preferences;
    if (!validStudentPreferences(preferences)) {
      return sendJsonError(res, 400, 'One or more preference values are invalid.');
    }

    await dbRun(
      `INSERT INTO studentSettings (studentId, preferences, updatedAt)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(studentId) DO UPDATE
       SET preferences = excluded.preferences, updatedAt = datetime('now')`,
      [req.user.id, JSON.stringify(preferences)]
    );
    return res.json({ preferences, message: 'Your preferences have been saved.' });
  } catch (error) {
    console.error('Save student preferences error:', error);
    return sendJsonError(res, 500, 'Unable to save your preferences.');
  }
});

app.put('/api/student/settings/password', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return sendJsonError(res, 400, 'Enter your current password and a new password.');
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return sendJsonError(res, 400, 'Your new password must be between 8 and 128 characters.');
    }
    if (currentPassword === newPassword) {
      return sendJsonError(res, 400, 'Choose a new password that differs from your current password.');
    }

    const user = await dbGet('SELECT id, email, password FROM users WHERE id = ? AND role = ?', [req.user.id, 'student']);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return sendJsonError(res, 401, 'Your current password is incorrect.');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await dbExec('BEGIN IMMEDIATE');
    try {
      await dbRun('UPDATE users SET password = ?, tokenVersion = tokenVersion + 1 WHERE id = ?', [passwordHash, user.id]);
      await logAction('Student password changed', user.email, user.id);
      await dbExec('COMMIT');
    } catch (error) {
      await dbExec('ROLLBACK');
      throw error;
    }
    return res.json({ message: 'Your password has changed. Sign in again with your new password.' });
  } catch (error) {
    console.error('Change student password error:', error);
    return sendJsonError(res, 500, 'Unable to change your password.');
  }
});

app.post('/api/student/settings/reports', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const { title, description, category } = req.body || {};
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanDescription = typeof description === 'string' ? description.trim() : '';
    const allowedCategories = ['Account', 'Uploads', 'Downloads', 'Technical issue', 'Other'];
    if (!cleanTitle || cleanTitle.length > 120) {
      return sendJsonError(res, 400, 'Enter an issue title of 1 to 120 characters.');
    }
    if (cleanDescription.length < 10 || cleanDescription.length > 5000) {
      return sendJsonError(res, 400, 'Describe the issue in 10 to 5,000 characters.');
    }
    if (!allowedCategories.includes(category)) {
      return sendJsonError(res, 400, 'Choose a valid issue category.');
    }
    await dbExec('BEGIN IMMEDIATE');
    try {
      await dbRun(
        'INSERT INTO supportReports (studentId, title, description, category) VALUES (?, ?, ?, ?)',
        [req.user.id, cleanTitle, cleanDescription, category]
      );
      await logAction('Student support report submitted', req.user.email, req.user.id);
      await dbExec('COMMIT');
    } catch (error) {
      await dbExec('ROLLBACK');
      throw error;
    }
    return res.status(201).json({ message: 'Your report has been submitted to the CampusNotes team.' });
  } catch (error) {
    console.error('Create student support report error:', error);
    return sendJsonError(res, 500, 'Unable to submit your report.');
  }
});

app.delete('/api/student/settings/account', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const { currentPassword, confirmation } = req.body || {};
    if (confirmation !== 'DELETE' || typeof currentPassword !== 'string') {
      return sendJsonError(res, 400, 'Enter your current password and type DELETE to confirm account removal.');
    }
    const user = await dbGet(
      'SELECT id, email, password, profilePicture FROM users WHERE id = ? AND role = ?',
      [req.user.id, 'student']
    );
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return sendJsonError(res, 401, 'Your current password is incorrect.');
    }

    const ownMaterials = await dbAll('SELECT id, fileUrl FROM materials WHERE uploadedBy = ? AND uploadedByRole = ?', [user.id, 'student']);
    await dbExec('BEGIN IMMEDIATE');
    try {
      const ownedMaterialQuery = `SELECT id FROM materials WHERE uploadedBy = ? AND uploadedByRole = ?`;
      await dbRun(`DELETE FROM materialRatings WHERE materialId IN (${ownedMaterialQuery})`, [user.id, 'student']);
      await dbRun(`DELETE FROM materialSaves WHERE materialId IN (${ownedMaterialQuery})`, [user.id, 'student']);
      await dbRun(`DELETE FROM materialDownloads WHERE materialId IN (${ownedMaterialQuery})`, [user.id, 'student']);
      await dbRun('DELETE FROM materials WHERE uploadedBy = ? AND uploadedByRole = ?', [user.id, 'student']);
      await dbRun('DELETE FROM materialRatings WHERE studentId = ?', [user.id]);
      await dbRun('DELETE FROM materialSaves WHERE studentId = ?', [user.id]);
      await dbRun('DELETE FROM materialDownloads WHERE userId = ?', [user.id]);
      await dbRun('DELETE FROM studentSettings WHERE studentId = ?', [user.id]);
      await dbRun('DELETE FROM supportReports WHERE studentId = ?', [user.id]);
      await dbRun('DELETE FROM users WHERE id = ? AND role = ?', [user.id, 'student']);
      await logAction('Student account deleted', user.email, user.id);
      await dbExec('COMMIT');
    } catch (error) {
      await dbExec('ROLLBACK');
      throw error;
    }

    const filesToRemove = [...ownMaterials.map((material) => material.fileUrl), user.profilePicture]
      .filter((fileUrl) => typeof fileUrl === 'string' && fileUrl.startsWith('/uploads/'));
    for (const fileUrl of filesToRemove) {
      const filePath = path.resolve(rootDir, fileUrl.replace(/^\//, ''));
      if (!filePath.startsWith(`${uploadsDir}${path.sep}`)) continue;
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Account deletion file cleanup error:', error);
      }
    }

    return res.json({ message: 'Your account and uploaded materials have been deleted.' });
  } catch (error) {
    console.error('Delete student account error:', error);
    return sendJsonError(res, 500, 'Unable to delete your account.');
  }
});

app.post('/api/auth/teacher-register', async (req, res) => {
  try {
    const { fullName, email, subject, password, confirmPassword } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedSubject = String(subject || '').trim();

    if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100
        || !normalizedEmail || normalizedEmail.length > 254 || !normalizedSubject
        || normalizedSubject.length > 120 || typeof password !== 'string') {
      return sendJsonError(res, 400, 'Please complete all required teacher details.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return sendJsonError(res, 400, 'Please enter a valid email address.');
    }

    if (password !== confirmPassword) {
      return sendJsonError(res, 400, 'Passwords do not match.');
    }

    if (password.length < 8 || password.length > 128) {
      return sendJsonError(res, 400, 'Password must be 8 to 128 characters long.');
    }

    const existingStudent = await dbGet('SELECT id FROM users WHERE lower(email) = ?', [normalizedEmail]);
    const existingTeacher = await dbGet('SELECT id FROM teachers WHERE email = ?', [normalizedEmail]);
    if (existingStudent || existingTeacher) {
      return sendJsonError(res, 409, 'An account with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRun(
      `INSERT INTO teachers (name, email, subject, password, status, createdAt)
       VALUES (?, ?, ?, ?, 'active', datetime('now'))`,
      [String(fullName).trim(), normalizedEmail, normalizedSubject, hashedPassword]
    );
    const teacher = await dbGet('SELECT * FROM teachers WHERE id = ?', [result.lastID]);
    const token = signToken({ ...teacher, role: 'teacher' });

    await logAction('Teacher registered', teacher.email, teacher.id);

    res.status(201).json({
      message: 'Teacher account created successfully.',
      token,
      user: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        role: 'teacher',
        subject: teacher.subject,
      },
    });
  } catch (error) {
    console.error('Teacher register error:', error);
    return sendJsonError(res, 500, 'Unable to create your teacher account right now.');
  }
});

app.post('/api/auth/teacher-login', async (req, res) => {
  try {
    const { email, subject, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedSubject = String(subject || '').trim();

    if (!normalizedEmail || !normalizedSubject || !password) {
      return sendJsonError(res, 400, 'Email, subject, and password are required.');
    }

    const teacher = await dbGet(
      'SELECT * FROM teachers WHERE email = ? AND subject = ?',
      [normalizedEmail, normalizedSubject]
    );

    if (!teacher) {
      return sendJsonError(res, 401, 'Email, subject, or password is incorrect.');
    }

    const isValidPassword = await bcrypt.compare(password, teacher.password);
    if (!isValidPassword) {
      return sendJsonError(res, 401, 'Email, subject, or password is incorrect.');
    }

    if (teacher.status === 'inactive') {
      return sendJsonError(res, 403, 'Your account has been deactivated by the administrator.');
    }

    const user = { ...teacher, role: 'teacher' };
    const token = signToken(user);
    await logAction('Teacher logged in', teacher.email, teacher.id);

    res.json({
      token,
      user: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        role: 'teacher',
        subject: teacher.subject,
      },
    });
  } catch (error) {
    console.error('Teacher login error:', error);
    return sendJsonError(res, 500, 'Unable to log you in at the moment.');
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      fullName,
      studentId,
      email,
      phone,
      branch,
      year,
      semester,
      password,
      confirmPassword,
    } = req.body || {};

    if (!fullName || !studentId || !email || !branch || !year || !semester || !password) {
      return sendJsonError(res, 400, 'Please complete all required student details.');
    }

    if (password !== confirmPassword) {
      return sendJsonError(res, 400, 'Passwords do not match.');
    }

    if (password.length < 6) {
      return sendJsonError(res, 400, 'Password must be at least 6 characters long.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await dbGet(
      'SELECT id FROM users WHERE lower(email) = ? OR studentId = ?',
      [normalizedEmail, studentId.trim()]
    );
    if (existingUser) {
      return sendJsonError(res, 409, 'A student account with this email or student ID already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRun(
      `INSERT INTO users (name, studentId, email, phone, branch, year, semester, password, role, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'student', 'active', datetime('now'))`,
      [fullName.trim(), studentId.trim(), normalizedEmail, phone?.trim() || null, branch.trim(), year.trim(), semester.trim(), hashedPassword]
    );

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [result.lastID]);
    const token = signToken(user);

    await logAction('Student registered', user.email, user.id);

    res.status(201).json({
      message: 'Student account created successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return sendJsonError(res, 500, 'Unable to create your account right now.');
  }
});

app.post('/api/auth/student-login', async (req, res) => {
  try {
    const { emailOrStudentId, password } = req.body || {};
    if (!emailOrStudentId || !password) {
      return sendJsonError(res, 400, 'Email / Student ID and password are required.');
    }

    const user = await dbGet(
      'SELECT * FROM users WHERE (email = ? OR studentId = ?) AND role = "student"',
      [String(emailOrStudentId).trim().toLowerCase(), String(emailOrStudentId).trim()]
    );

    if (!user) {
      return sendJsonError(res, 401, 'No student account found for that email or student ID.');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return sendJsonError(res, 401, 'Incorrect password.');
    }

    if (user.status === 'inactive') {
      return sendJsonError(res, 403, 'Your account has been deactivated by the administrator.');
    }

    const token = signToken(user);
    await logAction('Student logged in', user.email, user.id);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
      },
    });
  } catch (error) {
    console.error('Student login error:', error);
    return sendJsonError(res, 500, 'Unable to log you in at the moment.');
  }
});

app.post('/api/auth/admin-login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!password) {
    return sendJsonError(res, 400, 'Please enter the admin password.');
  }

  if (String(password) !== String(ADMIN_PASSWORD)) {
    return sendJsonError(res, 401, 'Access denied. Incorrect admin password.');
  }

  const adminUser = {
    id: 'admin',
    name: String(username || 'Administrator').trim() || 'Administrator',
    email: 'admin@campusnotes.local',
    role: 'admin',
    studentId: null,
  };

  const token = signToken(adminUser);
  await logAction('Admin logged in', adminUser.name, adminUser.id);

  res.json({
    token,
    user: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      studentId: null,
    },
  });
});

app.get('/api/settings/student-uploads', async (req, res) => {
  const setting = await dbGet('SELECT * FROM appSettings WHERE id = 1');
  res.json({
    enabled: Boolean(setting?.studentUploadsEnabled),
    updatedAt: setting?.updatedAt,
    updatedBy: setting?.updatedBy,
  });
});

app.put('/api/settings/student-uploads', verifyToken, requireRole('admin'), async (req, res) => {
  const { enabled } = req.body || {};
  const nextValue = enabled === true || enabled === 'true' || enabled === 1 ? 1 : 0;

  await dbRun(
    'UPDATE appSettings SET studentUploadsEnabled = ?, updatedAt = datetime("now"), updatedBy = ? WHERE id = 1',
    [nextValue, req.user.name || 'admin']
  );

  await logAction(nextValue ? 'Student uploads enabled' : 'Student uploads disabled', req.user.name || 'admin', 'appSettings');

  res.json({
    enabled: Boolean(nextValue),
    message: nextValue ? 'Student uploads have been enabled.' : 'Student uploads have been disabled.',
  });
});

app.get('/api/materials', verifyToken, async (req, res) => {
  try {
    const { status, branch, year, semester, subject, type } = req.query;
    const userRole = req.user.role;

    let query = `
      SELECT m.*,
        CASE
          WHEN m.uploadedByRole = 'student' AND EXISTS (
            SELECT 1 FROM studentSettings visibility
            WHERE visibility.studentId = m.uploadedBy
              AND json_extract(visibility.preferences, '$.privacy.profileVisibility') = 'private'
          ) THEN 'Student'
          WHEN m.uploadedByRole = 'teacher' AND EXISTS (
            SELECT 1 FROM teacherSettings visibility
            WHERE visibility.teacherId = m.uploadedBy
              AND json_extract(visibility.preferences, '$.privacy.profileVisibility') = 'private'
          ) THEN 'Teacher'
          ELSE COALESCE(t.name, u.name)
        END AS uploadedByName,
        COALESCE(ratingSummary.averageRating, 0) AS averageRating,
        COALESCE(ratingSummary.ratingCount, 0) AS ratingCount,
        COALESCE(myRating.rating, 0) AS myRating
      FROM materials m
      LEFT JOIN users u ON u.id = m.uploadedBy
      LEFT JOIN teachers t ON t.id = m.uploadedBy AND m.uploadedByRole = 'teacher'
      LEFT JOIN (
        SELECT materialId, AVG(rating) AS averageRating, COUNT(*) AS ratingCount
        FROM materialRatings
        GROUP BY materialId
      ) ratingSummary ON ratingSummary.materialId = m.id
      LEFT JOIN materialRatings myRating ON myRating.materialId = m.id AND myRating.studentId = ?
    `;
    const clauses = [];
    const values = [req.user.id];

    if (userRole === 'student') {
      clauses.push('m.status = ?');
      values.push('Approved');
    } else if (userRole === 'teacher') {
      clauses.push('m.status = ?');
      values.push('Approved');
      clauses.push('m.subject = ?');
      values.push(req.user.subject);
    } else if (status && status !== 'all') {
      clauses.push('m.status = ?');
      values.push(status);
    }

    if (branch) {
      clauses.push('m.branch = ?');
      values.push(branch);
    }
    if (year) {
      clauses.push('m.year = ?');
      values.push(year);
    }
    if (semester) {
      clauses.push('m.semester = ?');
      values.push(semester);
    }
    if (subject) {
      clauses.push('m.subject LIKE ?');
      values.push(`%${subject}%`);
    }
    if (type) {
      clauses.push('m.materialType = ?');
      values.push(type);
    }

    if (clauses.length) {
      query += ` WHERE ${clauses.join(' AND ')}`;
    }

    query += ' ORDER BY m.uploadedAt DESC';

    const rows = await dbAll(query, values);
    res.json(rows);
  } catch (error) {
    console.error('Get materials error:', error);
    sendJsonError(res, 500, 'Unable to load materials.');
  }
});

app.get('/api/materials/:id/download', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId < 1) {
      return sendJsonError(res, 400, 'Invalid material.');
    }

    const material = await dbGet(
      'SELECT id, title, fileUrl, status FROM materials WHERE id = ?',
      [materialId]
    );
    if (!material || material.status !== 'Approved' || !material.fileUrl) {
      return sendJsonError(res, 404, 'Approved study material not found.');
    }

    await dbRun(
      'INSERT INTO materialDownloads (materialId, userId, downloadedAt) VALUES (?, ?, datetime("now"))',
      [materialId, req.user.id]
    );

    if (material.fileUrl.startsWith('http://') || material.fileUrl.startsWith('https://')) {
      return res.redirect(material.fileUrl);
    }

    const filePath = path.resolve(rootDir, material.fileUrl.replace(/^\//, ''));
    if (!filePath.startsWith(`${uploadsDir}${path.sep}`) || !fs.existsSync(filePath)) {
      return sendJsonError(res, 404, 'The study material file is unavailable.');
    }

    return res.download(filePath, path.basename(filePath));
  } catch (error) {
    console.error('Download material error:', error);
    return sendJsonError(res, 500, 'Unable to download this study material.');
  }
});

app.get('/api/my-downloads', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const downloads = await dbAll(
      `SELECT d.id, d.materialId, d.downloadedAt, m.title, m.subject, m.branch,
              m.semester, m.materialType, m.fileUrl
       FROM materialDownloads d
       INNER JOIN materials m ON m.id = d.materialId
       WHERE d.userId = ?
       ORDER BY d.downloadedAt DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json(downloads);
  } catch (error) {
    console.error('Get student download history error:', error);
    sendJsonError(res, 500, 'Unable to load your download history.');
  }
});

app.get('/api/my-saved-materials', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const savedMaterials = await dbAll(
      `SELECT m.*, s.savedAt,
              CASE
                WHEN m.uploadedByRole = 'student' AND EXISTS (
                  SELECT 1 FROM studentSettings visibility
                  WHERE visibility.studentId = m.uploadedBy
                    AND json_extract(visibility.preferences, '$.privacy.profileVisibility') = 'private'
                ) THEN 'Student'
                WHEN m.uploadedByRole = 'teacher' AND EXISTS (
                  SELECT 1 FROM teacherSettings visibility
                  WHERE visibility.teacherId = m.uploadedBy
                    AND json_extract(visibility.preferences, '$.privacy.profileVisibility') = 'private'
                ) THEN 'Teacher'
                ELSE COALESCE(t.name, u.name)
              END AS uploadedByName
       FROM materialSaves s
       INNER JOIN materials m ON m.id = s.materialId AND m.status = 'Approved'
       LEFT JOIN users u ON u.id = m.uploadedBy
       LEFT JOIN teachers t ON t.id = m.uploadedBy AND m.uploadedByRole = 'teacher'
       WHERE s.studentId = ?
       ORDER BY s.savedAt DESC`,
      [req.user.id]
    );
    res.json(savedMaterials);
  } catch (error) {
    console.error('Get saved student materials error:', error);
    sendJsonError(res, 500, 'Unable to load your saved study materials.');
  }
});

app.put('/api/materials/:id/save', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    const { saved } = req.body || {};
    if (!Number.isInteger(materialId) || materialId < 1 || typeof saved !== 'boolean') {
      return sendJsonError(res, 400, 'Invalid saved material request.');
    }

    if (saved) {
      const material = await dbGet(
        'SELECT id FROM materials WHERE id = ? AND status = ?',
        [materialId, 'Approved']
      );
      if (!material) return sendJsonError(res, 404, 'Approved study material not found.');

      await dbRun(
        `INSERT INTO materialSaves (materialId, studentId, savedAt)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(materialId, studentId) DO NOTHING`,
        [materialId, req.user.id]
      );
    } else {
      await dbRun(
        'DELETE FROM materialSaves WHERE materialId = ? AND studentId = ?',
        [materialId, req.user.id]
      );
    }

    return res.json({
      saved,
      message: saved ? 'Note saved to your bookmarks.' : 'Note removed from your saved list.',
    });
  } catch (error) {
    console.error('Save student material error:', error);
    return sendJsonError(res, 500, 'Unable to update your saved study materials.');
  }
});

app.put('/api/materials/:id/rating', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(materialId) || materialId < 1) {
      return sendJsonError(res, 400, 'Invalid material.');
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return sendJsonError(res, 400, 'Choose a rating from 1 to 5 stars.');
    }

    const material = await dbGet(
      'SELECT id, materialType, status, uploadedBy, uploadedByRole FROM materials WHERE id = ?',
      [materialId]
    );
    if (!material || material.status !== 'Approved' || material.materialType !== 'Subject Notes') {
      return sendJsonError(res, 404, 'Approved notes not found.');
    }
    if (material.uploadedByRole === 'student' && Number(material.uploadedBy) === Number(req.user.id)) {
      return sendJsonError(res, 403, 'You cannot rate your own notes.');
    }

    await dbRun(
      `INSERT INTO materialRatings (materialId, studentId, rating, updatedAt)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(materialId, studentId)
       DO UPDATE SET rating = excluded.rating, updatedAt = datetime('now')`,
      [materialId, req.user.id, rating]
    );
    res.json({ message: 'Your rating has been saved.' });
  } catch (error) {
    console.error('Save material rating error:', error);
    sendJsonError(res, 500, 'Unable to save your rating.');
  }
});

app.get('/api/teacher/materials', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT m.*, t.name AS uploadedByName,
              COALESCE(
                (SELECT h.feedback FROM materialReviewHistory h
                 WHERE h.materialId = m.id AND h.feedback IS NOT NULL
                   AND COALESCE(h.reviewedBy, '') <> 'teacher-edit'
                 ORDER BY h.id DESC LIMIT 1),
                m.rejectionReason
              ) AS lastAdminFeedback,
              COALESCE(
                (SELECT h.reviewedAt FROM materialReviewHistory h
                 WHERE h.materialId = m.id
                   AND COALESCE(h.reviewedBy, '') <> 'teacher-edit'
                 ORDER BY h.id DESC LIMIT 1),
                m.reviewedAt
              ) AS lastReviewedAt
       FROM materials m
       LEFT JOIN teachers t ON t.id = m.uploadedBy AND m.uploadedByRole = 'teacher'
       WHERE m.uploadedBy = ? AND m.uploadedByRole = 'teacher'
       ORDER BY m.uploadedAt DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get teacher materials error:', error);
    sendJsonError(res, 500, 'Unable to load your teaching materials.');
  }
});

app.patch('/api/teacher/materials/:id', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId < 1) return sendJsonError(res, 400, 'Invalid teaching material.');
    const material = await dbGet(
      'SELECT * FROM materials WHERE id = ? AND uploadedBy = ? AND uploadedByRole = ?',
      [materialId, req.user.id, 'teacher']
    );
    if (!material) return sendJsonError(res, 404, 'Teaching material not found.');

    const clean = (value) => typeof value === 'string' ? value.trim() : '';
    const title = clean(req.body?.title);
    const description = clean(req.body?.description);
    const branch = clean(req.body?.branch);
    const year = clean(req.body?.year);
    const semester = clean(req.body?.semester);
    const materialType = clean(req.body?.materialType);
    if (!title || title.length > 160 || description.length > 2000 || !branch || !year || !semester || !allowedMaterialTypes.has(materialType)) {
      return sendJsonError(res, 400, 'Enter a valid title, material type, branch, academic year, and semester.');
    }
    const fileExtension = path.extname(material.fileUrl || '').toLowerCase();
    if (materialType === 'Lecture Video'
        && !allowedTeacherVideoExtensions.has(fileExtension)
        && !material.videoUrl) {
      return sendJsonError(res, 400, 'Changing this material to a lecture video requires a video file or URL. Upload a new video material instead.');
    }
    if (materialType !== 'Lecture Video'
        && (allowedTeacherVideoExtensions.has(fileExtension) || material.videoUrl)) {
      return sendJsonError(res, 400, 'A video resource cannot be changed to a document material type.');
    }

    await dbExec('BEGIN IMMEDIATE');
    try {
      await dbRun(
        `INSERT INTO materialReviewHistory (materialId, status, feedback, reviewedBy)
         VALUES (?, ?, ?, ?)`,
        [materialId, material.status, material.rejectionReason || null, 'teacher-edit']
      );
      await dbRun(
        `UPDATE materials
         SET title = ?, description = ?, branch = ?, year = ?, semester = ?, materialType = ?,
             status = 'Pending', rejectionReason = NULL, reviewedAt = NULL, approvedAt = NULL, approvedBy = NULL
         WHERE id = ? AND uploadedBy = ? AND uploadedByRole = 'teacher'`,
        [title, description, branch, year, semester, materialType, materialId, req.user.id]
      );
      await createTeacherNotification(req.user.id, materialId, 'material_resubmitted', `${title} was updated and sent for administrator review.`);
      await logAction('Teacher material edited and resubmitted', req.user.name, materialId);
      await dbExec('COMMIT');
    } catch (error) {
      await dbExec('ROLLBACK');
      throw error;
    }
    return res.json({ message: 'Changes saved. The revised material is pending administrator review.' });
  } catch (error) {
    console.error('Update teacher material error:', error);
    return sendJsonError(res, 500, 'Unable to update your teaching material.');
  }
});

app.delete('/api/teacher/materials/:id', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId < 1) return sendJsonError(res, 400, 'Invalid teaching material.');
    const material = await dbGet(
      'SELECT id, title, fileUrl FROM materials WHERE id = ? AND uploadedBy = ? AND uploadedByRole = ?',
      [materialId, req.user.id, 'teacher']
    );
    if (!material) return sendJsonError(res, 404, 'Teaching material not found.');

    await dbExec('BEGIN IMMEDIATE');
    try {
      await dbRun('DELETE FROM materialRatings WHERE materialId = ?', [materialId]);
      await dbRun('DELETE FROM materialSaves WHERE materialId = ?', [materialId]);
      await dbRun('DELETE FROM materialDownloads WHERE materialId = ?', [materialId]);
      await dbRun('DELETE FROM materialReviewHistory WHERE materialId = ?', [materialId]);
      await dbRun('DELETE FROM teacherNotifications WHERE materialId = ? AND teacherId = ?', [materialId, req.user.id]);
      await dbRun('DELETE FROM materials WHERE id = ? AND uploadedBy = ? AND uploadedByRole = ?', [materialId, req.user.id, 'teacher']);
      await logAction('Teacher material deleted', req.user.name, materialId);
      await dbExec('COMMIT');
    } catch (error) {
      await dbExec('ROLLBACK');
      throw error;
    }

    if (material.fileUrl?.startsWith('/uploads/')) {
      const filePath = path.resolve(rootDir, material.fileUrl.replace(/^\//, ''));
      if (filePath.startsWith(`${uploadsDir}${path.sep}`) && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (error) { console.error('Teacher material file cleanup error:', error); }
      }
    }
    return res.json({ message: 'Teaching material deleted.' });
  } catch (error) {
    console.error('Delete teacher material error:', error);
    return sendJsonError(res, 500, 'Unable to delete your teaching material.');
  }
});

app.get('/api/teacher/profile', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const user = await dbGet(
      `SELECT id, name, email, phone, collegeName, department, subject, profilePicture, status, createdAt
       FROM teachers WHERE id = ?`,
      [req.user.id]
    );
    if (!user || user.status !== 'active') return sendJsonError(res, 401, 'Your teacher account is not available.');
    return res.json({
      user,
      session: { expiresAt: req.user.exp ? new Date(req.user.exp * 1000).toISOString() : null },
    });
  } catch (error) {
    console.error('Get teacher profile error:', error);
    return sendJsonError(res, 500, 'Unable to load your teacher profile.');
  }
});

app.put('/api/teacher/profile', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const clean = (value) => typeof value === 'string' ? value.trim() : '';
    const profile = {
      name: clean(req.body?.name),
      email: clean(req.body?.email).toLowerCase(),
      phone: clean(req.body?.phone),
      collegeName: clean(req.body?.collegeName),
      department: clean(req.body?.department),
    };
    if (!profile.name || profile.name.length > 100) return sendJsonError(res, 400, 'Enter a name of 1 to 100 characters.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) || profile.email.length > 254) {
      return sendJsonError(res, 400, 'Enter a valid email address.');
    }
    if (profile.phone && !/^\+?[0-9\s().-]{7,20}$/.test(profile.phone)) {
      return sendJsonError(res, 400, 'Enter a valid mobile number.');
    }
    if ([profile.collegeName, profile.department].some((value) => value.length > 120)) {
      return sendJsonError(res, 400, 'College and department must be 120 characters or fewer.');
    }
    const duplicateTeacher = await dbGet('SELECT id FROM teachers WHERE lower(email) = ? AND id != ?', [profile.email, req.user.id]);
    const duplicateStudent = await dbGet('SELECT id FROM users WHERE lower(email) = ?', [profile.email]);
    if (duplicateTeacher || duplicateStudent) return sendJsonError(res, 409, 'That email address is already associated with another account.');

    await dbExec('BEGIN IMMEDIATE');
    try {
      await dbRun(
        'UPDATE teachers SET name = ?, email = ?, phone = ?, collegeName = ?, department = ? WHERE id = ?',
        [profile.name, profile.email, profile.phone || null, profile.collegeName || null, profile.department || null, req.user.id]
      );
      await logAction('Teacher profile updated', profile.email, req.user.id);
      await dbExec('COMMIT');
    } catch (error) {
      await dbExec('ROLLBACK');
      throw error;
    }
    const user = await dbGet(
      `SELECT id, name, email, phone, collegeName, department, subject, profilePicture, status, createdAt
       FROM teachers WHERE id = ?`,
      [req.user.id]
    );
    return res.json({ user, message: 'Your teacher profile has been updated.' });
  } catch (error) {
    console.error('Update teacher profile error:', error);
    return sendJsonError(res, 500, 'Unable to save your profile.');
  }
});

app.post('/api/teacher/profile-picture', verifyToken, requireRole('teacher'), (req, res) => {
  profilePictureUpload.single('profilePicture')(req, res, async (uploadError) => {
    if (uploadError) return sendJsonError(res, 400, uploadError.message || 'Unable to upload that profile picture.');
    if (!req.file) return sendJsonError(res, 400, 'Choose a profile picture to upload.');
    try {
      const current = await dbGet('SELECT profilePicture FROM teachers WHERE id = ?', [req.user.id]);
      if (!current) {
        return sendJsonError(res, 404, 'Teacher account not found.');
      }
      const profilePicture = await uploadFileToCloud(req.file, 'avatars');
      await dbRun('UPDATE teachers SET profilePicture = ? WHERE id = ?', [profilePicture, req.user.id]);
      return res.json({ profilePicture, message: 'Your profile picture has been updated.' });
    } catch (error) {
      console.error('Update teacher profile picture error:', error);
      return sendJsonError(res, 500, 'Unable to save your profile picture.');
    }
  });
});

app.put('/api/teacher/password', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return sendJsonError(res, 400, 'Enter your current password and a new password of 8 to 128 characters.');
    }
    const teacher = await dbGet('SELECT id, email, password FROM teachers WHERE id = ?', [req.user.id]);
    if (!teacher || !(await bcrypt.compare(currentPassword, teacher.password))) {
      return sendJsonError(res, 401, 'Your current password is incorrect.');
    }
    if (currentPassword === newPassword) return sendJsonError(res, 400, 'Choose a new password that differs from your current password.');
    await dbExec('BEGIN IMMEDIATE');
    try {
      await dbRun('UPDATE teachers SET password = ?, tokenVersion = tokenVersion + 1 WHERE id = ?', [await bcrypt.hash(newPassword, 10), teacher.id]);
      await logAction('Teacher password changed', teacher.email, teacher.id);
      await dbExec('COMMIT');
    } catch (error) {
      await dbExec('ROLLBACK');
      throw error;
    }
    return res.json({ message: 'Your password has changed. Sign in again with your new password.' });
  } catch (error) {
    console.error('Change teacher password error:', error);
    return sendJsonError(res, 500, 'Unable to change your password.');
  }
});

app.get('/api/teacher/settings', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const row = await dbGet('SELECT preferences FROM teacherSettings WHERE teacherId = ?', [req.user.id]);
    const preferences = mergeTeacherPreferences(row?.preferences);
    await dbRun(
      `INSERT INTO teacherSettings (teacherId, preferences) VALUES (?, ?)
       ON CONFLICT(teacherId) DO NOTHING`,
      [req.user.id, JSON.stringify(preferences)]
    );
    return res.json({ preferences });
  } catch (error) {
    console.error('Get teacher settings error:', error);
    return sendJsonError(res, 500, 'Unable to load teacher settings.');
  }
});

app.put('/api/teacher/settings', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const preferences = req.body?.preferences;
    if (!validTeacherPreferences(preferences)) return sendJsonError(res, 400, 'One or more teacher preference values are invalid.');
    await dbRun(
      `INSERT INTO teacherSettings (teacherId, preferences, updatedAt) VALUES (?, ?, datetime('now'))
       ON CONFLICT(teacherId) DO UPDATE SET preferences = excluded.preferences, updatedAt = datetime('now')`,
      [req.user.id, JSON.stringify(preferences)]
    );
    return res.json({ preferences, message: 'Teacher settings saved.' });
  } catch (error) {
    console.error('Save teacher settings error:', error);
    return sendJsonError(res, 500, 'Unable to save teacher settings.');
  }
});

app.get('/api/teacher/engagement', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const periods = { '7': 7, '30': 30, '90': 90, all: null };
    const period = periods[String(req.query.period || '30')];
    if (period === undefined) return sendJsonError(res, 400, 'Choose a supported engagement period.');
    const dateClause = period ? 'AND d.downloadedAt >= datetime(\'now\', ?)' : '';
    const dateJoinClause = period ? "AND d.downloadedAt >= datetime('now', ?)" : '';
    const dateValue = period ? `-${period} days` : null;
    const total = await dbGet(
      `SELECT COUNT(d.id) AS downloads, COUNT(DISTINCT d.userId) AS uniqueStudents
       FROM materialDownloads d JOIN materials m ON m.id = d.materialId
       WHERE m.uploadedBy = ? AND m.uploadedByRole = 'teacher' AND m.status = 'Approved' ${dateClause}`,
      period ? [req.user.id, dateValue] : [req.user.id]
    );
    const popular = await dbAll(
      `SELECT m.id, m.title, m.subject, COUNT(d.id) AS downloads
       FROM materials m LEFT JOIN materialDownloads d ON d.materialId = m.id ${dateJoinClause}
       WHERE m.uploadedBy = ? AND m.uploadedByRole = 'teacher' AND m.status = 'Approved'
       GROUP BY m.id ORDER BY downloads DESC, m.title COLLATE NOCASE LIMIT 10`,
      period ? [dateValue, req.user.id] : [req.user.id]
    );
    const bySubject = await dbAll(
      `SELECT m.subject, COUNT(d.id) AS downloads
       FROM materials m LEFT JOIN materialDownloads d ON d.materialId = m.id ${dateJoinClause}
       WHERE m.uploadedBy = ? AND m.uploadedByRole = 'teacher' AND m.status = 'Approved'
       GROUP BY m.subject ORDER BY downloads DESC, m.subject`,
      period ? [dateValue, req.user.id] : [req.user.id]
    );
    const recent = await dbAll(
      `SELECT m.title, m.subject, d.downloadedAt
       FROM materialDownloads d JOIN materials m ON m.id = d.materialId
       WHERE m.uploadedBy = ? AND m.uploadedByRole = 'teacher' AND m.status = 'Approved' ${dateClause}
       ORDER BY d.downloadedAt DESC LIMIT 20`,
      period ? [req.user.id, dateValue] : [req.user.id]
    );
    return res.json({
      downloads: Number(total?.downloads || 0),
      uniqueStudents: Number(total?.uniqueStudents || 0),
      views: null,
      viewTrackingAvailable: false,
      popular,
      bySubject,
      recent,
    });
  } catch (error) {
    console.error('Get teacher engagement error:', error);
    return sendJsonError(res, 500, 'Unable to load student engagement.');
  }
});

app.get('/api/teacher/notifications', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const rows = await dbAll(
      'SELECT id, materialId, type, message, isRead, createdAt FROM teacherNotifications WHERE teacherId = ? ORDER BY createdAt DESC LIMIT 100',
      [req.user.id]
    );
    return res.json(rows);
  } catch (error) {
    console.error('Get teacher notifications error:', error);
    return sendJsonError(res, 500, 'Unable to load notifications.');
  }
});

app.patch('/api/teacher/notifications/:id/read', verifyToken, requireRole('teacher'), async (req, res) => {
  const result = await dbRun('UPDATE teacherNotifications SET isRead = 1 WHERE id = ? AND teacherId = ?', [req.params.id, req.user.id]);
  return result.changes ? res.json({ message: 'Notification marked as read.' }) : sendJsonError(res, 404, 'Notification not found.');
});

app.patch('/api/teacher/notifications/read-all', verifyToken, requireRole('teacher'), async (req, res) => {
  await dbRun('UPDATE teacherNotifications SET isRead = 1 WHERE teacherId = ?', [req.user.id]);
  return res.json({ message: 'All notifications marked as read.' });
});

app.delete('/api/teacher/notifications/:id', verifyToken, requireRole('teacher'), async (req, res) => {
  const result = await dbRun('DELETE FROM teacherNotifications WHERE id = ? AND teacherId = ?', [req.params.id, req.user.id]);
  return result.changes ? res.json({ message: 'Notification deleted.' }) : sendJsonError(res, 404, 'Notification not found.');
});

app.post('/api/teacher/support-reports', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const category = String(req.body?.category || '');
    if (!title || title.length > 120 || description.length < 10 || description.length > 5000
        || !['Account', 'Materials', 'Engagement', 'Technical issue', 'Other'].includes(category)) {
      return sendJsonError(res, 400, 'Enter a valid title, a 10 to 5,000 character description, and a valid category.');
    }
    await dbRun('INSERT INTO teacherSupportReports (teacherId, title, description, category) VALUES (?, ?, ?, ?)', [req.user.id, title, description, category]);
    await logAction('Teacher support report submitted', req.user.email, req.user.id);
    return res.status(201).json({ message: 'Your report was saved. The current app does not route reports to support staff automatically.' });
  } catch (error) {
    console.error('Create teacher support report error:', error);
    return sendJsonError(res, 500, 'Unable to submit your report.');
  }
});

app.get('/api/my-materials', verifyToken, requireRole('student'), async (req, res) => {
  const rows = await dbAll(
    `SELECT m.*, u.name AS uploadedByName
     FROM materials m
     LEFT JOIN users u ON u.id = m.uploadedBy
     WHERE m.uploadedBy = ?
     ORDER BY m.uploadedAt DESC`,
    [req.user.id]
  );
  res.json(rows);
});

app.post('/api/teacher/materials', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      teacherUpload.single('file')(req, res, (error) => (error ? reject(error) : resolve()));
    });

    const {
      title,
      description,
      branch,
      year,
      semester,
      materialType,
      videoUrl,
    } = req.body || {};
    const normalizedType = String(materialType || '').trim();
    const normalizedTitle = String(title || '').trim();
    const normalizedVideoUrl = String(videoUrl || '').trim();
    const uploadedExtension = req.file ? path.extname(req.file.originalname).toLowerCase() : '';
    const uploadedVideo = allowedTeacherVideoExtensions.has(uploadedExtension);

    if (!normalizedTitle || !branch || !year || !semester || !normalizedType) {
      return sendJsonError(res, 400, 'Please fill in all required material details.');
    }

    if (!allowedMaterialTypes.has(normalizedType)) {
      return sendJsonError(res, 400, 'Choose a supported teaching material type.');
    }

    let validatedVideoUrl = null;
    if (normalizedType === 'Lecture Video' && normalizedVideoUrl) {
      try {
        const parsedUrl = new URL(normalizedVideoUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol');
        validatedVideoUrl = parsedUrl.href;
      } catch {
        return sendJsonError(res, 400, 'Enter a valid HTTP or HTTPS lecture video URL.');
      }
    }

    if (normalizedType !== 'Lecture Video' && (!req.file || uploadedVideo || normalizedVideoUrl)) {
      return sendJsonError(res, 400, 'Please upload a supported notes or document file.');
    }
    if (normalizedType !== 'Lecture Video' && req.file.size > uploadLimit) {
      return sendJsonError(res, 400, 'Notes uploads are limited to 25 MB.');
    }

    if (normalizedType === 'Lecture Video') {
      if (req.file && (!uploadedVideo || validatedVideoUrl)) {
        return sendJsonError(res, 400, 'Upload a supported video file or provide a video link, not both.');
      }
      if (!req.file && !validatedVideoUrl) {
        return sendJsonError(res, 400, 'Upload a lecture video file or provide a video link.');
      }
    }

    const fileUrl = req.file ? await uploadFileToCloud(req.file, 'materials') : '';
    const result = await dbRun(
      `INSERT INTO materials
        (title, description, subject, branch, year, semester, materialType, fileUrl, uploadedBy, uploadedByRole, videoUrl, status, uploadedAt, approvedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'teacher', ?, 'Approved', datetime('now'), datetime('now'))`,
      [
        normalizedTitle,
        String(description || '').trim(),
        req.user.subject,
        String(branch).trim(),
        String(year).trim(),
        String(semester).trim(),
        normalizedType,
        fileUrl,
        req.user.id,
        validatedVideoUrl,
      ]
    );

    await logAction('Teacher material published automatically', req.user.name, result.lastID);
    await createTeacherNotification(req.user.id, result.lastID, 'material_published', `${normalizedTitle} was published to students.`);
    res.status(201).json({
      message: 'Your teaching material has been published and is now available to students.',
      id: result.lastID,
    });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      return sendJsonError(res, 400, error.code === 'LIMIT_FILE_SIZE'
        ? 'Uploads are limited to 25 MB for notes and 250 MB for videos.'
        : error.message);
    }
    if (error.message && error.message.startsWith('Unsupported file type.')) {
      return sendJsonError(res, 400, error.message);
    }
    console.error('Teacher material upload error:', error);
    return sendJsonError(res, 500, 'Unable to upload your teaching material.');
  }
});

app.post('/api/materials', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const setting = await dbGet('SELECT studentUploadsEnabled FROM appSettings WHERE id = 1');
    if (!setting || Number(setting.studentUploadsEnabled) !== 1) {
      return sendJsonError(res, 403, 'Student uploads are currently disabled by the administrator. Please try again later.');
    }

    const uploadMiddleware = upload.single('file');
    uploadMiddleware(req, res, async (error) => {
      if (error) {
        return sendJsonError(res, 400, error.message || 'File upload failed.');
      }

      if (!req.file) {
        return sendJsonError(res, 400, 'Please choose a valid file to upload.');
      }

      const {
        title,
        subject,
        description,
        branch,
        year,
        semester,
        materialType,
      } = req.body || {};

      if (!title || !subject || !branch || !year || !semester || !materialType) {
        return sendJsonError(res, 400, 'Please fill in all required material details.');
      }

      const normalizedMaterialType = String(materialType).trim();
      if (!allowedMaterialTypes.has(normalizedMaterialType)) {
        return sendJsonError(res, 400, 'Material type must be one of: Subject Notes, Previous Year Question Paper, Manual Lab.');
      }

      const uploadedFileUrl = await uploadFileToCloud(req.file, 'materials');

      const materialRecord = {
        title: String(title).trim(),
        subject: String(subject).trim(),
        description: String(description || '').trim(),
        branch: String(branch).trim(),
        year: String(year).trim(),
        semester: String(semester).trim(),
        materialType: normalizedMaterialType,
        fileUrl: uploadedFileUrl,
      };

      const result = await dbRun(
        `INSERT INTO materials (title, description, subject, branch, year, semester, materialType, fileUrl, uploadedBy, status, uploadedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', datetime('now'))`,
        [materialRecord.title, materialRecord.description, materialRecord.subject, materialRecord.branch, materialRecord.year, materialRecord.semester, materialRecord.materialType, materialRecord.fileUrl, req.user.id]
      );

      await logAction('Material submitted for approval', req.user.name, result.lastID);

      res.status(201).json({
        message: 'Your material has been submitted successfully and is waiting for administrator approval.',
        id: result.lastID,
      });
    });
  } catch (error) {
    console.error('Material upload error:', error);
    return sendJsonError(res, 500, 'Unable to upload your study material.');
  }
});

app.patch('/api/materials/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const material = await dbGet('SELECT * FROM materials WHERE id = ?', [id]);

  if (!material) {
    return sendJsonError(res, 404, 'Material not found.');
  }

  await dbRun(
    'UPDATE materials SET status = "Approved", reviewedAt = datetime("now"), approvedAt = datetime("now"), approvedBy = ?, rejectionReason = NULL WHERE id = ?',
    [req.user.id, id]
  );
  await dbRun(
    'INSERT INTO materialReviewHistory (materialId, status, feedback, reviewedBy) VALUES (?, ?, ?, ?)',
    [id, 'Approved', null, req.user.name]
  );
  if (material.uploadedByRole === 'teacher') {
    await createTeacherNotification(material.uploadedBy, material.id, 'material_approved', `${material.title} was approved by an administrator.`);
  }

  await logAction('Material approved', req.user.name, id);

  res.json({ message: 'Material approved and published to students.' });
});

app.patch('/api/materials/:id/reject', verifyToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body || {};
  const material = await dbGet('SELECT * FROM materials WHERE id = ?', [id]);

  if (!material) {
    return sendJsonError(res, 404, 'Material not found.');
  }

  const feedback = rejectionReason ? String(rejectionReason).trim().slice(0, 1000) : 'No reason provided';
  await dbRun(
    'UPDATE materials SET status = "Rejected", rejectionReason = ?, reviewedAt = datetime("now"), approvedAt = NULL, approvedBy = NULL WHERE id = ?',
    [feedback, id]
  );
  await dbRun(
    'INSERT INTO materialReviewHistory (materialId, status, feedback, reviewedBy) VALUES (?, ?, ?, ?)',
    [id, 'Rejected', feedback, req.user.name]
  );
  if (material.uploadedByRole === 'teacher') {
    await createTeacherNotification(material.uploadedBy, material.id, 'material_rejected', `${material.title} was rejected: ${feedback}`);
  }

  await logAction('Material rejected', req.user.name, id);

  res.json({ message: 'Material rejected and hidden from students.' });
});

app.delete('/api/materials/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const material = await dbGet('SELECT * FROM materials WHERE id = ?', [id]);

  if (!material) {
    return sendJsonError(res, 404, 'Material not found.');
  }

  if (material.fileUrl && material.fileUrl.startsWith('/uploads/')) {
    const fullPath = path.join(rootDir, material.fileUrl.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  await dbRun('DELETE FROM materials WHERE id = ?', [id]);
  await logAction('Material deleted', req.user.name, id);

  res.json({ message: 'Material deleted successfully.' });
});

app.get('/api/students', verifyToken, requireRole('admin'), async (req, res) => {
  const students = await dbAll(
    'SELECT id, name, studentId, email, phone, branch, year, semester, status, createdAt FROM users WHERE role = "student" ORDER BY createdAt DESC'
  );
  res.json(students);
});

app.patch('/api/students/:id/status', verifyToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const nextStatus = status === 'active' || status === 'inactive' ? status : 'active';

  const user = await dbGet('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) {
    return sendJsonError(res, 404, 'Student not found.');
  }

  await dbRun('UPDATE users SET status = ? WHERE id = ?', [nextStatus, id]);
  await logAction(nextStatus === 'active' ? 'Student activated' : 'Student deactivated', req.user.name, id);

  res.json({
    message: nextStatus === 'active' ? 'Student account activated.' : 'Student account deactivated.',
    status: nextStatus,
  });
});

app.get('/api/dashboard/stats', verifyToken, requireRole('admin'), async (req, res) => {
  const totalStudents = await dbGet('SELECT COUNT(*) AS count FROM users WHERE role = "student"');
  const totalMaterials = await dbGet('SELECT COUNT(*) AS count FROM materials');
  const pendingMaterials = await dbGet('SELECT COUNT(*) AS count FROM materials WHERE status = "Pending"');
  const approvedMaterials = await dbGet('SELECT COUNT(*) AS count FROM materials WHERE status = "Approved"');
  const rejectedMaterials = await dbGet('SELECT COUNT(*) AS count FROM materials WHERE status = "Rejected"');
  const downloads = await dbGet('SELECT COUNT(*) AS count FROM materialDownloads');

  const setting = await dbGet('SELECT studentUploadsEnabled FROM appSettings WHERE id = 1');

  res.json({
    totalStudents: totalStudents?.count || 0,
    totalMaterials: totalMaterials?.count || 0,
    pendingMaterials: pendingMaterials?.count || 0,
    approvedMaterials: approvedMaterials?.count || 0,
    rejectedMaterials: rejectedMaterials?.count || 0,
    totalDownloads: downloads?.count || 0,
    studentUploadStatus: Number(setting?.studentUploadsEnabled ?? 0) === 1 ? 'Enabled' : 'Disabled',
  });
});

app.get('/api/dashboard/analytics', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const registrations = await dbAll(
      `SELECT date(createdAt) AS date, COUNT(*) AS count
       FROM users
       WHERE role = 'student' AND date(createdAt) >= date('now', '-6 days')
       GROUP BY date(createdAt)
       ORDER BY date(createdAt)`
    );
    const uploads = await dbAll(
      `SELECT date(uploadedAt) AS date, COUNT(*) AS count
       FROM materials
       WHERE date(uploadedAt) >= date('now', '-6 days')
       GROUP BY date(uploadedAt)
       ORDER BY date(uploadedAt)`
    );
    const statusCounts = await dbAll(
      'SELECT status, COUNT(*) AS count FROM materials GROUP BY status'
    );
    const topDownloads = await dbAll(
      `SELECT m.id, m.title, m.subject, COUNT(d.id) AS downloads
       FROM materialDownloads d
       JOIN materials m ON m.id = d.materialId
       GROUP BY m.id
       ORDER BY downloads DESC, m.title COLLATE NOCASE
       LIMIT 5`
    );

    res.json({ registrations, uploads, statusCounts, topDownloads });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    sendJsonError(res, 500, 'Unable to load dashboard analytics.');
  }
});

app.get('/api/activity-logs', verifyToken, requireRole('admin'), async (req, res) => {
  const logs = await dbAll(
    'SELECT * FROM activityLogs ORDER BY timestamp DESC LIMIT 50'
  );
  res.json(logs);
});

app.get('/api/health-check', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', (req, res) => {
  return sendJsonError(res, 404, 'API endpoint not found.');
});

app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CampusNotes server listening on port ${PORT} on all network interfaces.`);
  console.log(`On this computer: http://localhost:${PORT}`);
  console.log(`On another device: http://<this-computer-LAN-IP>:${PORT}`);
});
