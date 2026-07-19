const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'lecture.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Helper functions to use async/await with sqlite3
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize tables and Seed admin
const initDatabase = async () => {
  try {
    // Enable Foreign Keys
    await dbRun('PRAGMA foreign_keys = ON');

    // Create users table (Keep role check, default to presenter for admin)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('presenter', 'student')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create presentations table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS presentations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK(source_type IN ('file', 'ai', 'manual')),
        content_data TEXT NOT NULL, -- JSON string representing array of slide contents
        file_url TEXT,              -- Public URL of original uploaded document (PDF/PPTX)
        order_index INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default admin user if not exists
    const adminUser = await dbGet('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await dbRun(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        ['admin', hashedPassword, 'presenter']
      );
      console.log('Seeded default admin user: admin / admin123');
    }

    console.log('Database tables initialized and seeded successfully.');
  } catch (error) {
    console.error('Error initializing database tables:', error);
  }
};

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDatabase
};
