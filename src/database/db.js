const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db;

const initializeDatabase = () => {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/drafts.db');

  // Ensure data directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Connect to SQLite database
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Database connection error:', err);
      return;
    }
    console.log('Connected to SQLite database');

    // Create tables if they don't exist
    createTables();
  });
};

const createTables = () => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        syntax TEXT DEFAULT 'Plain Text',
        flagged INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        created_device TEXT DEFAULT 'Web',
        created_longitude REAL DEFAULT 0.0,
        created_latitude REAL DEFAULT 0.0,
        source_url TEXT
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts(created_at)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_drafts_updated_at ON drafts(updated_at)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_drafts_source_url ON drafts(source_url)
    `);
  });
};

const createDraft = (draftData) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO drafts 
      (uuid, content, tags, syntax, flagged, created_at, updated_at, created_device, created_longitude, created_latitude, source_url) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      draftData.uuid,
      draftData.content,
      draftData.tags,
      draftData.syntax,
      draftData.flagged,
      draftData.created_at,
      draftData.updated_at,
      draftData.created_device,
      draftData.created_longitude,
      draftData.created_latitude,
      draftData.source_url
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, ...draftData });
      }
    });

    stmt.finalize();
  });
};

const getAllDrafts = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM drafts ORDER BY created_at DESC', [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const closeDatabase = () => {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
  }
};

// Handle process termination
process.on('SIGINT', () => {
  closeDatabase();
  process.exit();
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit();
});

module.exports = {
  initializeDatabase,
  createDraft,
  getAllDrafts,
  closeDatabase
};