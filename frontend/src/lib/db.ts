import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DB_DIR = path.join(process.cwd(), 'src', 'db');
const DB_PATH = path.join(DB_DIR, 'lecture.db');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize SQLite Database Connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err);
  } else {
    console.log('Connected to the Next.js SQLite database at:', DB_PATH);
    initDatabaseSchema();
  }
});

// Promise wrapper helper utilities
export function dbRun(query: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function dbGet(query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function dbAll(query: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Initialize Tables (users, presentations) and Seed Default Admin User
 */
async function initDatabaseSchema() {
  try {
    // 1. Create users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('presenter', 'student')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create presentations table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS presentations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK(source_type IN ('file', 'ai', 'manual')),
        content_data TEXT NOT NULL,
        file_url TEXT,
        order_index INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Seed default admin user (admin / admin123) if not exists
    const adminUser = await dbGet('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminUser) {
      const sha256 = crypto.createHash('sha256').update('admin123').digest('hex');
      await dbRun(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        ['admin', sha256, 'presenter']
      );
      console.log('Seeded default admin user: admin / admin123');
    }
    console.log('Next.js SQLite database tables initialized and seeded successfully.');
  } catch (err) {
    console.error('Failed to initialize database tables:', err);
  }
}

export default db;
