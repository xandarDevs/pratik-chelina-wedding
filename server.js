const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';
const ROOT_DIR = __dirname;
const DATABASE_PATH = path.join(ROOT_DIR, 'rsvp.db');
const SQLITE_BIN = process.env.SQLITE_BIN || 'sqlite3';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function escapeSqlValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function runSql(sql) {
  return new Promise((resolve, reject) => {
    execFile(SQLITE_BIN, [DATABASE_PATH, sql], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }

      resolve(stdout.trim());
    });
  });
}

function initializeDatabase() {
  try {
    execFileSync(SQLITE_BIN, [
      DATABASE_PATH,
      `
        CREATE TABLE IF NOT EXISTS rsvps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          attendance TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          has_guests INTEGER NOT NULL DEFAULT 0,
          guest_count INTEGER NOT NULL DEFAULT 0,
          guests_json TEXT,
          dietary TEXT,
          message TEXT,
          submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `
    ]);
  } catch (error) {
    console.error('Failed to initialize SQLite database:', error.message);
    process.exit(1);
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function getSafeFilePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const relativePath = decodedPath === '/' ? '/index.html' : decodedPath;
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const absolutePath = path.join(ROOT_DIR, normalizedPath);

  if (!absolutePath.startsWith(ROOT_DIR)) {
    return null;
  }

  return absolutePath;
}

function serveStaticFile(req, res) {
  const filePath = getSafeFilePath(req.url);
  if (!filePath) {
    sendJson(res, 403, { success: false, error: 'Forbidden' });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendJson(res, 404, { success: false, error: 'Not found' });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleRsvp(req, res) {
  try {
    const data = await readRequestBody(req);

    if (!data || !data.name || !data.attendance) {
      sendJson(res, 400, { success: false, error: 'Missing required RSVP fields' });
      return;
    }

    const isAccepting = data.attendance === 'Accepted';
    const hasGuests = isAccepting && data.hasGuests === 'Yes' ? 1 : 0;
    const guestCount = hasGuests ? Number.parseInt(data.guestCount, 10) || 0 : 0;
    const guests = hasGuests && Array.isArray(data.guests) ? data.guests : [];

    const insertSql = `
      INSERT INTO rsvps (
        name,
        attendance,
        email,
        phone,
        has_guests,
        guest_count,
        guests_json,
        dietary,
        message
      ) VALUES (
        ${escapeSqlValue(data.name.trim())},
        ${escapeSqlValue(data.attendance)},
        ${escapeSqlValue(isAccepting ? data.email || null : null)},
        ${escapeSqlValue(isAccepting ? data.phone || null : null)},
        ${hasGuests},
        ${guestCount},
        ${escapeSqlValue(JSON.stringify(guests))},
        ${escapeSqlValue(isAccepting ? data.dietary || null : null)},
        ${escapeSqlValue(data.message || null)}
      );
      SELECT last_insert_rowid();
    `;

    const output = await runSql(insertSql);
    const insertedId = Number.parseInt(output.split(/\r?\n/).pop(), 10);

    sendJson(res, 200, {
      success: true,
      rsvp: {
        id: insertedId,
        name: data.name.trim(),
        attendance: data.attendance
      }
    });
  } catch (error) {
    const statusCode = error.message === 'Invalid JSON body' ? 400 : 500;
    console.error('Failed to save RSVP to SQLite:', error.message);
    sendJson(res, statusCode, { success: false, error: 'Unable to save RSVP at this time.' });
  }
}

initializeDatabase();

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { success: true, status: 'ok' });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/rsvp') {
    handleRsvp(req, res);
    return;
  }

  if (req.method === 'GET') {
    serveStaticFile(req, res);
    return;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed' });
});

server.listen(PORT, HOST, () => {
  console.log(`RSVP server listening on http://localhost:${PORT}`);
  console.log(`SQLite database ready at ${DATABASE_PATH}`);
});
