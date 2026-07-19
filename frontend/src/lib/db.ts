import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const isVercel = process.env.VERCEL === '1';

// Base read-only database location inside packaging
const PACKAGED_DB_DIR = path.join(process.cwd(), 'src', 'db');
const PACKAGED_DB_PATH = path.join(PACKAGED_DB_DIR, 'lecture.db');

let DB_PATH = PACKAGED_PATH_resolver();

function PACKAGED_PATH_resolver() {
  if (isVercel) {
    // Vercel serverless environment is Read-Only. 
    // We must clone the packaged DB file to /tmp/ which has write permissions!
    const tmpDbDir = '/tmp';
    const tmpDbPath = path.join(tmpDbDir, 'lecture.db');
    
    try {
      if (!fs.existsSync(tmpDbPath)) {
        console.log('Cloning read-only SQLite database from packaged source to writable /tmp/ ...');
        // If the database directory inside package doesn't exist, create it to ensure copy works
        if (!fs.existsSync(PACKAGED_DB_DIR)) {
          fs.mkdirSync(PACKAGED_DB_DIR, { recursive: true });
        }
        
        // Copy database if exists, or initialize new
        if (fs.existsSync(PACKAGED_DB_PATH)) {
          fs.copyFileSync(PACKAGED_DB_PATH, tmpDbPath);
          console.log('Cloned successfully.');
        } else {
          console.log('Packaged database not found. It will be initialized dynamically.');
        }
      }
      return tmpDbPath;
    } catch (copyErr) {
      console.error('Failed cloning database to /tmp/:', copyErr);
      return PACKAGED_DB_PATH;
    }
  } else {
    // For local dev server, write directly to src/db/lecture.db so git staging changes can be committed
    if (!fs.existsSync(PACKAGED_DB_DIR)) {
      fs.mkdirSync(PACKAGED_DB_DIR, { recursive: true });
    }
    return PACKAGED_DB_PATH;
  }
}

// Convert absolute filepath to file:// URL scheme for LibSQL client compatibility
const dbUrl = `file:${DB_PATH.replace(/\\/g, '/')}`;

console.log('Initializing LibSQL client at database file:', dbUrl);
const client = createClient({
  url: dbUrl,
});

// Row mapper helper to match sqlite3 object formatting
function rowToObject(row: any, columns: string[]): any {
  const obj: any = {};
  columns.forEach((col, idx) => {
    if (Array.isArray(row)) {
      obj[col] = row[idx];
    } else {
      obj[col] = row[col];
    }
  });
  return obj;
}

// Promise wrapper helper utilities (libsql implementation)
export async function dbRun(query: string, params: any[] = []): Promise<void> {
  await client.execute({ sql: query, args: params });
}

export async function dbGet(query: string, params: any[] = []): Promise<any> {
  const res = await client.execute({ sql: query, args: params });
  if (res.rows.length === 0) return null;
  return rowToObject(res.rows[0], res.columns);
}

export async function dbAll(query: string, params: any[] = []): Promise<any[]> {
  const res = await client.execute({ sql: query, args: params });
  return res.rows.map(row => rowToObject(row, res.columns));
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
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create presentations table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS presentations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        source_type TEXT NOT NULL,
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
    console.log('Next.js LibSQL database initialized and seeded successfully.');
  } catch (err) {
    console.error('Failed to initialize database tables:', err);
  }
}

// Automatically trigger initialization
initDatabaseSchema();

export default client;
