const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Partials,
  PresenceUpdateStatus,
  ActivityType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

function detectPublicUrl() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  if (process.env.HEROKU_APP_NAME) return `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
  if (process.env.FLY_APP_NAME) return `https://${process.env.FLY_APP_NAME}.fly.dev`;
  const port = process.env.PORT || 10000;
  return `http://localhost:${port}`;
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
const CLIENT_ID = process.env.CLIENT_ID || '';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '';
const GUILD_ID = process.env.GUILD_ID || '';
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data.sqlite');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const PUBLIC_BASE_URL = detectPublicUrl();
const OWNER_ID = process.env.OWNER_ID || '1207803375807373415';
const BRAND_COLOR = 0x22c3ff;
const DEFAULT_MAX_SCRIPTS = Number(process.env.DEFAULT_MAX_SCRIPTS || 100);
const DEFAULT_MAX_PANELS = Number(process.env.DEFAULT_MAX_PANELS || 50);
const OBF_API_URL = process.env.OBF_API_URL || 'https://kers0ne-0bf.lovable.app/api/public/obfuscate';
const OBF_API_KEY = process.env.OBF_API_KEY || 'kers0neontop123';
const UPLOADS_DIR = path.join(__dirname, 'uploads');

console.log('LuaObfuscationHub starting');
console.log('Domain:', PUBLIC_BASE_URL);
console.log('Owner ID:', OWNER_ID);

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

ensureUploadsDir();

const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  discord_id TEXT UNIQUE,
  username TEXT,
  email TEXT,
  avatar TEXT,
  access_token TEXT,
  provider TEXT,
  api_key TEXT UNIQUE,
  is_owner INTEGER DEFAULT 0,
  max_scripts INTEGER DEFAULT ${DEFAULT_MAX_SCRIPTS},
  max_panels INTEGER DEFAULT ${DEFAULT_MAX_PANELS},
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  FOREIGN KEY(owner_id) REFERENCES users(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  obfuscated_code TEXT,
  version TEXT DEFAULT '1.0.0',
  status TEXT DEFAULT 'active',
  ffa_mode INTEGER DEFAULT 0,
  compress_mode INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS license_keys (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL,
  panel_id TEXT,
  user_id TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,
  hwid TEXT,
  note TEXT,
  expires_at TEXT,
  claimed_by TEXT,
  claimed_tag TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  FOREIGN KEY(script_id) REFERENCES scripts(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS banned_hwids (
  hwid TEXT PRIMARY KEY,
  reason TEXT,
  banned_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS panels (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  channel_id TEXT NOT NULL,
  script_id TEXT NOT NULL,
  hwid_cooldown INTEGER DEFAULT 180,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(script_id) REFERENCES scripts(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expire INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key);
CREATE INDEX IF NOT EXISTS idx_license_keys_script_id ON license_keys(script_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_user_id ON license_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_panels_user_id ON panels(user_id);
`);

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function randomString(length, chars) {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateApiKey() {
  return randomString(24, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
}

function generateLicenseKey() {
  return randomString(16, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
}

function publicBaseUrl() {
  return PUBLIC_BASE_URL.replace(/\/$/, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeSerialize(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function isExpired(isoString) {
  return Boolean(isoString) && new Date(isoString).getTime() < Date.now();
}

function normalizeUserSession(userRow, oauthUser) {
  return {
    id: userRow.id,
    discord_id: oauthUser?.id || userRow.discord_id || null,
    username: oauthUser?.username || userRow.username || 'User',
    global_name: oauthUser?.global_name || userRow.username || 'User',
    avatar: oauthUser?.avatar || userRow.avatar || '',
    is_owner: userRow.is_owner === 1 || userRow.discord_id === OWNER_ID,
    maxScripts: userRow.max_scripts || DEFAULT_MAX_SCRIPTS,
    maxPanels: userRow.max_panels || DEFAULT_MAX_PANELS,
  };
}

function buildAvatarUrl(user) {
  if (user.avatar && user.discord_id) {
    return `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png?size=128`;
  }
  return 'https://cdn.discordapp.com/embed/avatars/0.png';
}

function getSessionUser(req) {
  return req.session.user || null;
}

function wantsJson(req) {
  return req.path.startsWith('/api/') || (req.get('accept') || '').includes('application/json');
}

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  if (wantsJson(req)) return res.status(401).json({ error: 'Unauthorized' });
  return res.redirect('/');
}

function requireOwner(req, res, next) {
  if (req.session.user && req.session.user.is_owner) return next();
  if (wantsJson(req)) return res.status(403).json({ error: 'Access denied. Owner only.' });
  return res.status(403).send('Access denied');
}

function getUserLimits(userId) {
  const user = db.prepare('SELECT max_scripts, max_panels FROM users WHERE id = ?').get(userId);
  return user || { max_scripts: DEFAULT_MAX_SCRIPTS, max_panels: DEFAULT_MAX_PANELS };
}

function getScriptCount(userId) {
  const result = db.prepare('SELECT COUNT(*) AS count FROM scripts WHERE user_id = ?').get(userId);
  return result ? result.count : 0;
}

function getPanelCount(userId) {
  const result = db.prepare('SELECT COUNT(*) AS count FROM panels WHERE user_id = ?').get(userId);
  return result ? result.count : 0;
}

function getRemainingLimits(userId) {
  const limits = getUserLimits(userId);
  const currentScripts = getScriptCount(userId);
  const currentPanels = getPanelCount(userId);
  return {
    maxScripts: limits.max_scripts,
    currentScripts,
    remainingScripts: Math.max(0, limits.max_scripts - currentScripts),
    maxPanels: limits.max_panels,
    currentPanels,
    remainingPanels: Math.max(0, limits.max_panels - currentPanels),
  };
}

function canCreateScript(userId) {
  const limits = getUserLimits(userId);
  return getScriptCount(userId) < limits.max_scripts;
}

function canCreatePanel(userId) {
  const limits = getUserLimits(userId);
  return getPanelCount(userId) < limits.max_panels;
}

async function obfuscateScript(code) {
  ensureUploadsDir();
  const tempFile = path.join(UPLOADS_DIR, `temp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.lua`);
  fs.writeFileSync(tempFile, code, 'utf8');

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(tempFile));
    form.append('anti_env_logger', 'true');

    const response = await fetch(OBF_API_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': OBF_API_KEY,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Obfuscation request failed');
    }

    return await response.text();
  } catch (error) {
    console.error('Obfuscation error:', error);
    throw error;
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key || req.body.api_key;
  if (!apiKey) return res.status(401).json({ error: 'API key required' });

  const keyRecord = db.prepare('SELECT * FROM api_keys WHERE key = ? AND is_active = 1').get(apiKey);
  if (!keyRecord) return res.status(401).json({ error: 'Invalid or inactive API key' });
  if (isExpired(keyRecord.expires_at)) return res.status(401).json({ error: 'API key expired' });

  db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?').run(apiKey);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(keyRecord.owner_id);
  if (!user) return res.status(401).json({ error: 'User not found' });

  req.apiUser = user;
  req.apiKey = keyRecord;
  return next();
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============ HOME ROUTE ============
app.get('/', (req, res) => {
  // If user is logged in, redirect to dashboard
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  
  // Otherwise show a simple homepage or login page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>LuaObfuscationHub</title>
      <style>
        body { background: #0a0a0f; color: #e2e8f0; font-family: 'Inter', -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; flex-direction: column; }
        .container { text-align: center; max-width: 500px; padding: 40px; }
        h1 { color: #22c3ff; font-size: 3.5rem; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
        .subtitle { color: #94a3b8; font-size: 1.1rem; margin-bottom: 2rem; }
        .btn { background: linear-gradient(135deg, #22c3ff, #0891b2); color: #0a0a0f; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 1rem; display: inline-block; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 20px rgba(34, 195, 255, 0.25); }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 30px rgba(34, 195, 255, 0.35); }
        .btn-secondary { background: rgba(34, 195, 255, 0.08); color: #22c3ff; border: 1px solid rgba(34, 195, 255, 0.15); box-shadow: none; margin-left: 12px; }
        .btn-secondary:hover { background: rgba(34, 195, 255, 0.14); box-shadow: none; }
        .links { margin-top: 2rem; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .status { margin-top: 1.5rem; font-size: 0.8rem; color: #475569; }
        .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22c3ff; animation: pulse 2s infinite; margin-right: 6px; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .features { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 2rem; text-align: left; }
        .feature { background: rgba(18, 18, 24, 0.5); border: 1px solid rgba(34, 195, 255, 0.06); border-radius: 8px; padding: 12px 16px; }
        .feature .icon { font-size: 1.2rem; margin-right: 6px; }
        .feature .label { color: #94a3b8; font-size: 0.8rem; }
        @media (max-width: 600px) { h1 { font-size: 2.5rem; } .features { grid-template-columns: 1fr; } }
      </style>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="container">
        <h1>🔷 LuaObfuscationHub</h1>
        <p class="subtitle">Cyberpunk Lua protection system</p>
        
        <div class="links">
          <a href="/auth/discord" class="btn">Login with Discord</a>
          <a href="/api/login" class="btn btn-secondary">API Key Login</a>
        </div>
        
        <div class="features">
          <div class="feature"><span class="icon">📜</span> <span class="label">Script Protection</span></div>
          <div class="feature"><span class="icon">🔑</span> <span class="label">License Keys</span></div>
          <div class="feature"><span class="icon">📋</span> <span class="label">Discord Panels</span></div>
          <div class="feature"><span class="icon">🚫</span> <span class="label">HWID Bans</span></div>
        </div>
        
        <div class="status">
          <span class="status-dot"></span> System online
        </div>
      </div>
    </body>
    </html>
  `);
});

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

class SQLiteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.db = database;
  }

  get(sid, callback) {
    try {
      const row = this.db
        .prepare('SELECT sess FROM sessions WHERE sid = ? AND expire > ?')
        .get(sid, Date.now());
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sess, callback) {
    try {
      const expire = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 86400000;
      this.db
        .prepare('INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)')
        .run(sid, JSON.stringify(sess), expire);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sess, callback) {
    try {
      const expire = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 86400000;
      this.db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?').run(expire, sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

app.use(
  session({
    store: new SQLiteSessionStore(db),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: PUBLIC_BASE_URL.startsWith('https'),
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: PUBLIC_BASE_URL.startsWith('https') ? 'none' : 'lax',
      httpOnly: true,
    },
  })
);

app.get('/auth/discord', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send('Discord OAuth is not configured');
  }

  const state = crypto.randomBytes(18).toString('hex');
  req.session.oauth_state = state;

  req.session.save((error) => {
    if (error) console.error('Session save error:', error);

    const redirectUri = `${publicBaseUrl()}/auth/discord/callback`;
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });
});

app.get('/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state');
  if (state !== req.session.oauth_state) return res.status(403).send('Invalid state parameter');

  try {
    const redirectUri = `${publicBaseUrl()}/auth/discord/callback`;

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.error_description || 'Failed to get token');

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const oauthUser = await userResponse.json();
    if (!userResponse.ok) throw new Error('Failed to fetch Discord user');

    let dbUser = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(oauthUser.id);

    if (!dbUser) {
      const id = makeId('user');
      db.prepare(
        `INSERT INTO users (id, discord_id, username, avatar, access_token, provider, is_owner)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        oauthUser.id,
        oauthUser.username,
        oauthUser.avatar || '',
        tokenData.access_token,
        'discord',
        oauthUser.id === OWNER_ID ? 1 : 0
      );

      if (oauthUser.id === OWNER_ID) {
        const ownerApiKey = generateApiKey();
        const keyId = makeId('apikey');
        db.prepare(
          `INSERT INTO api_keys (id, key, owner_id, created_by, notes)
           VALUES (?, ?, ?, ?, ?)`
        ).run(keyId, ownerApiKey, id, id, 'Owner auto-generated');
        db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(ownerApiKey, id);
      }

      dbUser = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(oauthUser.id);
    } else {
      db.prepare(
        `UPDATE users
         SET username = ?, avatar = ?, access_token = ?, is_owner = ?, updated_at = CURRENT_TIMESTAMP
         WHERE discord_id = ?`
      ).run(
        oauthUser.username,
        oauthUser.avatar || '',
        tokenData.access_token,
        oauthUser.id === OWNER_ID ? 1 : dbUser.is_owner,
        oauthUser.id
      );
      dbUser = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(oauthUser.id);
    }

    req.session.user = normalizeUserSession(dbUser, oauthUser);
    delete req.session.oauth_state;

    req.session.save((error) => {
      if (error) console.error('Session save error:', error);
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/api/limits', requireAuth, (req, res) => {
  res.json(getRemainingLimits(req.session.user.id));
});

app.post('/api/admin/set-limits', requireOwner, (req, res) => {
  const { userId, maxScripts, maxPanels } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ? OR discord_id = ?').get(userId, userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const nextMaxScripts = maxScripts !== undefined ? Math.max(0, Number(maxScripts) || 0) : user.max_scripts;
  const nextMaxPanels = maxPanels !== undefined ? Math.max(0, Number(maxPanels) || 0) : user.max_panels;

  db.prepare(
    'UPDATE users SET max_scripts = ?, max_panels = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(nextMaxScripts, nextMaxPanels, user.id);

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({
    success: true,
    user: {
      id: updatedUser.id,
      discord_id: updatedUser.discord_id,
      username: updatedUser.username,
      maxScripts: updatedUser.max_scripts,
      maxPanels: updatedUser.max_panels,
    },
  });
});

app.post('/api/admin/generate-key', requireOwner, (req, res) => {
  const { userId, expiresInDays, notes, maxScripts, maxPanels } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  let user = db.prepare('SELECT * FROM users WHERE id = ? OR discord_id = ?').get(userId, userId);
  if (!user) {
    const id = makeId('user');
    db.prepare(
      `INSERT INTO users (id, discord_id, username, provider, max_scripts, max_panels)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      `User_${String(userId).slice(0, 8)}`,
      'api',
      Number(maxScripts) || DEFAULT_MAX_SCRIPTS,
      Number(maxPanels) || DEFAULT_MAX_PANELS
    );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  const apiKey = generateApiKey();
  const keyId = makeId('apikey');
  const expiresAt = Number(expiresInDays) > 0
    ? new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString()
    : null;

  db.prepare(
    `INSERT INTO api_keys (id, key, owner_id, created_by, expires_at, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(keyId, apiKey, user.id, req.session.user.id, expiresAt, notes || '');

  const nextMaxScripts = maxScripts !== undefined ? Math.max(0, Number(maxScripts) || 0) : user.max_scripts;
  const nextMaxPanels = maxPanels !== undefined ? Math.max(0, Number(maxPanels) || 0) : user.max_panels;

  db.prepare(
    `UPDATE users
     SET api_key = ?, max_scripts = ?, max_panels = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(apiKey, nextMaxScripts, nextMaxPanels, user.id);

  const finalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);

  res.json({
    success: true,
    apiKey,
    userId: finalUser.id,
    discordId: finalUser.discord_id,
    username: finalUser.username,
    maxScripts: finalUser.max_scripts,
    maxPanels: finalUser.max_panels,
    expiresAt: expiresAt || 'Never',
  });
});

app.get('/api/admin/api-keys', requireOwner, (req, res) => {
  const keys = db
    .prepare(
      `SELECT ak.*, u.username AS owner_username, u.discord_id AS owner_discord, u.max_scripts, u.max_panels
       FROM api_keys ak
       LEFT JOIN users u ON ak.owner_id = u.id
       ORDER BY ak.created_at DESC`
    )
    .all();
  res.json(keys);
});

app.post('/api/admin/revoke-key', requireOwner, (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  db.prepare('UPDATE api_keys SET is_active = 0 WHERE key = ?').run(key);
  res.json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API key required' });

  const keyRecord = db.prepare('SELECT * FROM api_keys WHERE key = ? AND is_active = 1').get(apiKey);
  if (!keyRecord) return res.status(401).json({ error: 'Invalid API key' });
  if (isExpired(keyRecord.expires_at)) return res.status(401).json({ error: 'API key expired' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(keyRecord.owner_id);
  if (!user) return res.status(401).json({ error: 'User not found' });

  db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?').run(apiKey);
  req.session.user = normalizeUserSession(user);

  req.session.save((error) => {
    if (error) console.error('Session save error:', error);
    res.json({ success: true, user: req.session.user, redirect: '/dashboard' });
  });
});

app.get('/api/check-owner', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.json({ isOwner: false });
  const isOwner = user.discord_id === OWNER_ID || user.is_owner === true;
  return res.json({ isOwner, discordId: user.discord_id });
});

app.post('/api/create-script', requireAuth, (req, res) => {
  const user = req.session.user;

  if (!canCreateScript(user.id)) {
    const limits = getRemainingLimits(user.id);
    return res.status(403).json({
      error: 'Script limit reached',
      maxScripts: limits.maxScripts,
      currentScripts: limits.currentScripts,
    });
  }

  const name = String(req.body.name || '').trim();
  const code = String(req.body.code || '');
  const compressMode = Boolean(req.body.compressMode);
  const ffaMode = Boolean(req.body.ffaMode);

  if (!name || !code.trim()) {
    return res.status(400).json({ error: 'Missing name or code' });
  }

  const id = makeId('script');
  db.prepare(
    `INSERT INTO scripts (id, user_id, name, code, obfuscated_code, ffa_mode, compress_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, user.id, name, code, null, ffaMode ? 1 : 0, compressMode ? 1 : 0);

  res.json({
    success: true,
    id,
    remaining: getRemainingLimits(user.id),
  });
});

app.post('/api/obfuscate-script', requireAuth, async (req, res) => {
  const { scriptId } = req.body;
  if (!scriptId) return res.status(400).json({ error: 'Script ID required' });

  const user = req.session.user;
  const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(scriptId, user.id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  try {
    const obfuscatedCode = await obfuscateScript(script.code || '');
    db.prepare(
      'UPDATE scripts SET obfuscated_code = ?, compress_mode = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(obfuscatedCode, scriptId);
    res.json({ success: true, obfuscatedCode });
  } catch (error) {
    res.status(500).json({ error: `Obfuscation failed: ${error.message}` });
  }
});

app.post('/api/delete-script', requireAuth, (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Script ID required' });

  db.prepare('DELETE FROM scripts WHERE id = ? AND user_id = ?').run(id, req.session.user.id);
  db.prepare('DELETE FROM panels WHERE script_id = ? AND user_id = ?').run(id, req.session.user.id);
  db.prepare('DELETE FROM license_keys WHERE script_id = ? AND user_id = ?').run(id, req.session.user.id);

  res.json({ success: true });
});

app.put('/api/scripts/:id/toggle', requireAuth, (req, res) => {
  const { id } = req.params;
  const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(id, req.session.user.id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  const nextStatus = script.status === 'active' ? 'disabled' : 'active';
  db.prepare('UPDATE scripts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextStatus, id);
  res.json({ success: true, status: nextStatus });
});

app.put('/api/scripts/:id/ffa', requireAuth, (req, res) => {
  const { id } = req.params;
  const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(id, req.session.user.id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  const nextFfa = script.ffa_mode ? 0 : 1;
  db.prepare('UPDATE scripts SET ffa_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextFfa, id);
  res.json({ success: true, ffa_mode: nextFfa });
});

app.post('/api/create-panel', requireAuth, (req, res) => {
  const user = req.session.user;

  if (!canCreatePanel(user.id)) {
    const limits = getRemainingLimits(user.id);
    return res.status(403).json({
      error: 'Panel limit reached',
      maxPanels: limits.maxPanels,
      currentPanels: limits.currentPanels,
    });
  }

  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const channelId = String(req.body.channelId || '').trim();
  const scriptId = String(req.body.scriptId || '').trim();
  const hwidCooldown = Math.max(0, Number(req.body.hwidCooldown) || 180);

  if (!name || !channelId || !scriptId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(scriptId, user.id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  const id = makeId('panel');
  db.prepare(
    `INSERT INTO panels (id, user_id, name, description, channel_id, script_id, hwid_cooldown)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, user.id, name, description, channelId, scriptId, hwidCooldown);

  res.json({ success: true, id, remaining: getRemainingLimits(user.id) });
});

app.post('/api/delete-panel', requireAuth, (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Panel ID required' });

  db.prepare('DELETE FROM panels WHERE id = ? AND user_id = ?').run(id, req.session.user.id);
  db.prepare('DELETE FROM license_keys WHERE panel_id = ? AND user_id = ?').run(id, req.session.user.id);

  res.json({ success: true });
});

app.post('/api/send-panel', requireAuth, async (req, res) => {
  const { panelId } = req.body;
  if (!panelId) return res.status(400).json({ error: 'Panel ID required' });

  const user = req.session.user;
  const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(panel.script_id);
  if (!script) return res.status(404).json({ error: 'Script not found' });
  if (!client.isReady()) return res.status(503).json({ error: 'Discord bot is not connected' });

  try {
    let channel;
    try {
      channel = await client.channels.fetch(panel.channel_id);
    } catch {
      channel = null;
    }

    if (!channel) return res.status(404).json({ error: 'Discord channel not found or inaccessible' });
    if (!channel.isTextBased()) return res.status(400).json({ error: 'Selected channel is not a text channel' });

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(panel.name)
      .setDescription(panel.description || 'Lua script access panel')
      .addFields(
        { name: 'Script', value: script.name, inline: true },
        { name: 'Status', value: script.status === 'active' ? 'Active' : 'Disabled', inline: true },
        { name: 'HWID Cooldown', value: `${panel.hwid_cooldown}s`, inline: true },
        { name: 'Access', value: script.ffa_mode ? 'Open' : 'Key required', inline: true }
      )
      .setFooter({ text: 'LuaObfuscationHub' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`view_${script.id}`).setLabel('View script').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`redeem_${script.id}`).setLabel('Redeem key').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`loader_${script.id}`).setLabel('Loader').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`keys_${script.id}`).setLabel('Keys').setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ embeds: [embed], components: [row1, row2] });
    res.json({ success: true });
  } catch (error) {
    console.error('Send panel error:', error);
    res.status(500).json({ error: 'Failed to send panel' });
  }
});

app.post('/api/generate-key', requireAuth, (req, res) => {
  const { panelId, durationHours, note } = req.body;
  if (!panelId) return res.status(400).json({ error: 'Panel ID required' });

  const user = req.session.user;
  const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const key = generateLicenseKey();
  const expiresAt = Number(durationHours) > 0
    ? new Date(Date.now() + Number(durationHours) * 3600000).toISOString()
    : null;
  const id = makeId('key');

  db.prepare(
    `INSERT INTO license_keys (id, script_id, panel_id, user_id, key, note, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, panel.script_id, panel.id, user.id, key, note || '', expiresAt);

  res.json({ success: true, key, expiresAt });
});

app.post('/api/delete-key', requireAuth, (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });

  db.prepare('DELETE FROM license_keys WHERE key = ? AND user_id = ?').run(key, req.session.user.id);
  res.json({ success: true });
});

app.post('/api/ban-hwid', requireAuth, (req, res) => {
  const { hwid, reason } = req.body;
  if (!hwid) return res.status(400).json({ error: 'HWID required' });

  db.prepare('INSERT OR REPLACE INTO banned_hwids (hwid, reason, banned_by) VALUES (?, ?, ?)').run(
    hwid,
    reason || '',
    req.session.user.id
  );
  res.json({ success: true });
});

app.post('/api/unban-hwid', requireAuth, (req, res) => {
  const { hwid } = req.body;
  if (!hwid) return res.status(400).json({ error: 'HWID required' });

  db.prepare('DELETE FROM banned_hwids WHERE hwid = ?').run(hwid);
  res.json({ success: true });
});

app.get('/api/data', requireAuth, (req, res) => {
  const user = req.session.user;
  const scripts = db.prepare('SELECT * FROM scripts WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  const panels = db.prepare('SELECT * FROM panels WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  const keys = db.prepare('SELECT * FROM license_keys WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  const bannedHWIDs = user.is_owner
    ? db.prepare('SELECT * FROM banned_hwids ORDER BY created_at DESC').all()
    : db.prepare('SELECT * FROM banned_hwids WHERE banned_by = ? ORDER BY created_at DESC').all(user.id);
  const limits = getRemainingLimits(user.id);

  res.json({
    scripts,
    panels,
    keys,
    bannedHWIDs,
    limits,
    serverTime: Date.now(),
  });
});

app.get('/script/:scriptId', (req, res) => {
  const { scriptId } = req.params;
  const { key, hwid } = req.query;

  const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);
  if (!script) return res.status(404).type('text/plain').send('-- Script not found');
  if (script.status === 'disabled') return res.status(403).type('text/plain').send('-- Script disabled');

  if (script.ffa_mode) {
    return res.type('text/plain').send(script.obfuscated_code || script.code || '-- Empty');
  }

  if (!key) return res.status(403).type('text/plain').send('-- Missing key');

  const keyRecord = db.prepare('SELECT * FROM license_keys WHERE key = ? AND script_id = ?').get(key, scriptId);
  if (!keyRecord) return res.status(403).type('text/plain').send('-- Invalid key');
  if (isExpired(keyRecord.expires_at)) return res.status(403).type('text/plain').send('-- Key expired');

  if (hwid) {
    const banned = db.prepare('SELECT * FROM banned_hwids WHERE hwid = ?').get(hwid);
    if (banned) return res.status(403).type('text/plain').send('-- HWID banned');
  }

  if (hwid && keyRecord.hwid && keyRecord.hwid !== hwid) {
    return res.status(403).type('text/plain').send('-- HWID mismatch');
  }

  if (hwid && !keyRecord.hwid) {
    db.prepare('UPDATE license_keys SET hwid = ?, last_used_at = CURRENT_TIMESTAMP WHERE key = ?').run(hwid, key);
  } else {
    db.prepare('UPDATE license_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?').run(key);
  }

  return res.type('text/plain').send(script.obfuscated_code || script.code || '-- Empty');
});

app.get('/loader/:scriptId', (req, res) => {
  const { scriptId } = req.params;
  const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);

  if (!script) return res.status(404).type('text/plain').send('-- Script not found');
  if (script.status === 'disabled') return res.status(403).type('text/plain').send('-- Script disabled');

  const baseUrl = publicBaseUrl();
  if (script.ffa_mode) {
    return res.type('text/plain').send(`loadstring(game:HttpGet("${baseUrl}/script/${scriptId}"))()`);
  }

  return res.type('text/plain').send([
    '-- This script requires a key',
    `script_key = "YOUR_KEY_HERE"`,
    `loadstring(game:HttpGet("${baseUrl}/script/${scriptId}?key=" .. script_key .. "&hwid=" .. game:GetService("HttpService"):GenerateGUID(false)))()`,
  ].join('\n'));
});

// ============ DASHBOARD ROUTE ============
app.get('/dashboard', requireAuth, (req, res) => {
  const user = req.session.user;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>LuaObfuscationHub - Dashboard</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, sans-serif; background: #0a0a0f; color: #e2e8f0; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
        h1 { color: #22c3ff; font-size: 2.5rem; margin-bottom: 0.5rem; }
        .card { background: rgba(18, 18, 24, 0.85); backdrop-filter: blur(16px); border: 1px solid rgba(34, 195, 255, 0.08); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .stat { background: rgba(18, 18, 24, 0.85); border: 1px solid rgba(34, 195, 255, 0.06); border-radius: 10px; padding: 16px 20px; }
        .stat-value { font-size: 2rem; font-weight: 800; color: #22c3ff; }
        .stat-label { font-size: 0.8rem; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }
        .btn { background: linear-gradient(135deg, #22c3ff, #0891b2); color: #0a0a0f; padding: 10px 20px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(34, 195, 255, 0.25); }
        .btn-danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.15); }
        .btn-danger:hover { background: rgba(239, 68, 68, 0.18); }
        .btn-secondary { background: rgba(34, 195, 255, 0.08); color: #22c3ff; border: 1px solid rgba(34, 195, 255, 0.15); }
        .btn-secondary:hover { background: rgba(34, 195, 255, 0.14); }
        .logout { color: #ef4444; text-decoration: none; font-weight: 600; }
        input, textarea, select { width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(34, 195, 255, 0.12); border-radius: 8px; padding: 10px 14px; color: #e2e8f0; font-size: 14px; margin-bottom: 12px; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: #22c3ff; }
        .flex { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .flex-between { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        .mt-4 { margin-top: 16px; }
        .mb-4 { margin-bottom: 16px; }
        .text-muted { color: #475569; font-size: 0.9rem; }
        .badge { font-size: 11px; padding: 2px 10px; border-radius: 12px; display: inline-block; }
        .badge-active { background: rgba(34, 195, 255, 0.12); color: #22c3ff; }
        .badge-disabled { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
        .badge-ffa { background: rgba(251, 191, 36, 0.12); color: #fbbf24; }
        .badge-obfuscated { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; }
        .loader-box { background: rgba(0,0,0,0.4); border: 1px solid rgba(34, 195, 255, 0.06); border-radius: 6px; padding: 10px 12px; font-family: monospace; font-size: 11px; color: #22c3ff; overflow-x: auto; white-space: pre-wrap; word-break: break-all; cursor: pointer; margin: 8px 0; }
        .loader-box:hover { border-color: #22c3ff; }
        .script-card { background: rgba(18, 18, 24, 0.85); border: 1px solid rgba(34, 195, 255, 0.06); border-radius: 10px; padding: 16px 18px; }
        .script-card:hover { border-color: rgba(34, 195, 255, 0.12); }
        @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } .container { padding: 20px 16px; } }
      </style>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="container">
        <div class="flex-between mb-4">
          <div>
            <h1>🔷 LuaObfuscationHub</h1>
            <p class="text-muted">Welcome back, ${escapeHtml(user.username)} ${user.is_owner ? '👑' : ''}</p>
          </div>
          <div class="flex">
            <a href="/logout" class="logout">Logout</a>
          </div>
        </div>
        
        <div class="grid mb-4" id="stats">
          <div class="stat"><div class="stat-label">Scripts</div><div class="stat-value" id="statScripts">0</div></div>
          <div class="stat"><div class="stat-label">Panels</div><div class="stat-value" id="statPanels">0</div></div>
          <div class="stat"><div class="stat-label">Keys</div><div class="stat-value" id="statKeys">0</div></div>
          <div class="stat"><div class="stat-label">HWID Bans</div><div class="stat-value" id="statHwids">0</div></div>
        </div>
        
        <div class="card">
          <h2>📜 Upload Script</h2>
          <input id="scriptName" type="text" placeholder="Script name">
          <textarea id="scriptCode" rows="8" placeholder="-- Paste your Lua code here"></textarea>
          <div class="flex">
            <label><input type="checkbox" id="ffaModeCheck"> Open Access (FFA)</label>
            <label><input type="checkbox" id="compressModeCheck"> Auto-Obfuscate</label>
            <button class="btn" onclick="submitScript()">Host Script</button>
          </div>
        </div>
        
        <div id="scriptsList" class="grid"></div>
      </div>
      
      <script>
        let currentData = { scripts: [], panels: [], keys: [], bannedHWIDs: [] };
        let serverTime = Date.now();
        
        async function loadData() {
          try {
            const res = await fetch('/api/data');
            const data = await res.json();
            if (data.error) return;
            currentData = data;
            serverTime = data.serverTime || Date.now();
            renderAll();
          } catch(e) { console.error(e); }
        }
        
        function renderAll() {
          renderScripts();
          updateStats();
        }
        
        function renderScripts() {
          const container = document.getElementById('scriptsList');
          const scripts = currentData.scripts || [];
          
          if (!scripts.length) {
            container.innerHTML = '<p class="text-muted">No scripts yet. Upload one above.</p>';
            return;
          }
          
          container.innerHTML = scripts.map(s => {
            const isObfuscated = s.obfuscated_code && s.obfuscated_code.length > 0;
            const baseUrl = window.location.origin;
            const loader = s.ffa_mode
              ? \`loadstring(game:HttpGet("\${baseUrl}/loader/\${s.id}"))()\`
              : \`script_key = "YOUR_KEY_HERE"\\nloadstring(game:HttpGet("\${baseUrl}/loader/\${s.id}?key=" .. script_key))()\`;
            
            return \`
              <div class="script-card">
                <div style="font-weight:600;font-size:16px;">\${escapeHtml(s.name)}</div>
                <div style="font-size:12px;color:#475569;margin:4px 0;">ID: \${s.id}</div>
                <div style="margin:6px 0;">
                  <span class="badge \${s.status === 'active' ? 'badge-active' : 'badge-disabled'}">\${s.status}</span>
                  \${s.ffa_mode ? '<span class="badge badge-ffa">Open</span>' : ''}
                  \${isObfuscated ? '<span class="badge badge-obfuscated">Obfuscated</span>' : ''}
                </div>
                <div class="loader-box" onclick="copyLoader(this)">\${escapeHtml(loader)}</div>
                <div class="flex">
                  <button class="btn btn-secondary" onclick="toggleScript('\${s.id}')">\${s.status === 'active' ? 'Disable' : 'Enable'}</button>
                  <button class="btn btn-secondary" onclick="toggleFfa('\${s.id}')">\${s.ffa_mode ? 'Close' : 'Open'}</button>
                  \${!isObfuscated ? '<button class="btn" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;" onclick="obfuscateScript(\'' + s.id + '\')">Obfuscate</button>' : ''}
                  <button class="btn btn-danger" onclick="deleteScript('\${s.id}')">Delete</button>
                </div>
              </div>
            \`;
          }).join('');
        }
        
        function updateStats() {
          document.getElementById('statScripts').textContent = currentData.scripts?.length || 0;
          document.getElementById('statPanels').textContent = currentData.panels?.length || 0;
          document.getElementById('statKeys').textContent = currentData.keys?.length || 0;
          document.getElementById('statHwids').textContent = currentData.bannedHWIDs?.length || 0;
        }
        
        function escapeHtml(text) {
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }
        
        function copyLoader(el) {
          navigator.clipboard.writeText(el.textContent).then(() => {
            el.style.borderColor = '#22c3ff';
            setTimeout(() => el.style.borderColor = '', 500);
          });
        }
        
        async function submitScript() {
          const name = document.getElementById('scriptName').value.trim();
          const code = document.getElementById('scriptCode').value;
          const ffaMode = document.getElementById('ffaModeCheck').checked;
          const compressMode = document.getElementById('compressModeCheck').checked;
          
          if (!name || !code) return alert('Enter name and code.');
          
          try {
            const res = await fetch('/api/create-script', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, code, ffaMode, compressMode })
            });
            const data = await res.json();
            if (data.success) {
              document.getElementById('scriptName').value = '';
              document.getElementById('scriptCode').value = '';
              document.getElementById('ffaModeCheck').checked = false;
              document.getElementById('compressModeCheck').checked = false;
              loadData();
            } else {
              alert('Error: ' + (data.error || 'Unknown error'));
            }
          } catch(e) { alert('Error: ' + e.message); }
        }
        
        async function toggleScript(id) {
          await fetch('/api/scripts/' + id + '/toggle', { method: 'PUT' });
          loadData();
        }
        
        async function toggleFfa(id) {
          await fetch('/api/scripts/' + id + '/ffa', { method: 'PUT' });
          loadData();
        }
        
        async function obfuscateScript(id) {
          try {
            const res = await fetch('/api/obfuscate-script', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scriptId: id })
            });
            const data = await res.json();
            if (data.success) {
              alert('Script obfuscated!');
              loadData();
            } else {
              alert('Error: ' + (data.error || 'Unknown error'));
            }
          } catch(e) { alert('Error: ' + e.message); }
        }
        
        async function deleteScript(id) {
          if (!confirm('Delete this script?')) return;
          await fetch('/api/delete-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          loadData();
        }
        
        loadData();
        setInterval(loadData, 15000);
      </script>
    </body>
    </html>
  `);
});

// ============ DISCORD BOT ============
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel, Partials.Message],
  presence: {
    status: PresenceUpdateStatus.Online,
    activities: [{ name: 'LuaObfuscationHub', type: ActivityType.Watching }],
  },
});

async function registerCommands() {
  if (!DISCORD_TOKEN || !CLIENT_ID) return;

  const commands = [
    new SlashCommandBuilder()
      .setName('login')
      .setDescription('Validate an API key for this Discord account')
      .addStringOption((option) => option.setName('api_key').setDescription('Your API key').setRequired(true)),
    new SlashCommandBuilder().setName('limits').setDescription('Check your script and panel limits'),
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('Send a panel to the current Discord channel')
      .addStringOption((option) => option.setName('panel_id').setDescription('Panel ID').setRequired(true)),
    new SlashCommandBuilder()
      .setName('generatekey')
      .setDescription('Generate a license key')
      .addStringOption((option) => option.setName('panel_id').setDescription('Panel ID').setRequired(true))
      .addIntegerOption((option) => option.setName('hours').setDescription('Duration in hours (0 = permanent)').setRequired(true))
      .addStringOption((option) => option.setName('note').setDescription('Optional note')),
    new SlashCommandBuilder()
      .setName('loader')
      .setDescription('Get the loader for a script')
      .addStringOption((option) => option.setName('script_id').setDescription('Script ID').setRequired(true)),
    new SlashCommandBuilder()
      .setName('keys')
      .setDescription('List your recent license keys')
      .addStringOption((option) => option.setName('panel_id').setDescription('Filter by panel ID').setRequired(false)),
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    console.log('Registering slash commands');
    const body = commands.map((command) => command.toJSON());
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
      console.log('Registered guild commands');
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
      console.log('Registered global commands');
    }
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
}

client.once('ready', () => {
  console.log(`Bot online as ${client.user.tag}`);
  registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isModalSubmit() && interaction.customId.startsWith('redeem_')) {
      const scriptId = interaction.customId.slice('redeem_'.length);
      const input = interaction.fields.getTextInputValue('key_input').toUpperCase().trim();
      const keyRecord = db.prepare('SELECT * FROM license_keys WHERE key = ? AND script_id = ?').get(input, scriptId);

      if (!keyRecord) {
        return interaction.reply({ content: 'Invalid license key.', ephemeral: true });
      }
      if (isExpired(keyRecord.expires_at)) {
        return interaction.reply({ content: 'This key has expired.', ephemeral: true });
      }
      if (keyRecord.claimed_by) {
        return interaction.reply({ content: 'This key has already been claimed.', ephemeral: true });
      }

      db.prepare(
        'UPDATE license_keys SET claimed_by = ?, claimed_tag = ?, last_used_at = CURRENT_TIMESTAMP WHERE key = ?'
      ).run(interaction.user.id, interaction.user.tag, input);

      return interaction.reply({ content: `License key ${input} redeemed successfully.`, ephemeral: true });
    }

    if (interaction.isButton()) {
      const [action, ...restParts] = interaction.customId.split('_');
      const scriptId = restParts.join('_');
      if (!scriptId) {
        return interaction.reply({ content: 'Invalid action.', ephemeral: true });
      }

      if (action === 'view') {
        const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });

        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle(script.name)
          .addFields(
            { name: 'Status', value: script.status === 'active' ? 'Active' : 'Disabled', inline: true },
            { name: 'Free access', value: script.ffa_mode ? 'Yes' : 'No', inline: true },
            { name: 'Obfuscated', value: script.obfuscated_code ? 'Yes' : 'No', inline: true }
          )
          .setFooter({ text: 'LuaObfuscationHub' });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (action === 'redeem') {
        const modal = new ModalBuilder().setCustomId(`redeem_${scriptId}`).setTitle('Redeem license key');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('key_input')
              .setLabel('License key')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('ABCD1234EFGH5678')
          )
        );
        return interaction.showModal(modal);
      }

      if (action === 'loader') {
        const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });

        const baseUrl = publicBaseUrl();
        const loader = script.ffa_mode
          ? `loadstring(game:HttpGet("${baseUrl}/loader/${scriptId}"))()`
          : `script_key = "YOUR_KEY_HERE"\nloadstring(game:HttpGet("${baseUrl}/script/${scriptId}?key=" .. script_key .. "&hwid=" .. game:GetService("HttpService"):GenerateGUID(false)))()`;

        return interaction.reply({ content: `\`\`\`lua\n${loader}\n\`\`\``, ephemeral: true });
      }

      if (action === 'keys') {
        const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });

        const owner = db.prepare('SELECT discord_id FROM users WHERE id = ?').get(script.user_id);
        const isOwnerViewer = interaction.user.id === OWNER_ID || interaction.user.id === owner?.discord_id;

        if (!isOwnerViewer) {
          const message = script.ffa_mode
            ? 'This script is configured for open access and does not require a key.'
            : 'Keys are private. Use the redeem button if you already have one or contact the script owner.';
          return interaction.reply({ content: message, ephemeral: true });
        }

        const recentKeys = db
          .prepare(
            `SELECT key, note, expires_at, claimed_tag, created_at
             FROM license_keys
             WHERE script_id = ?
             ORDER BY created_at DESC
             LIMIT 10`
          )
          .all(scriptId);

        if (!recentKeys.length) {
          return interaction.reply({ content: 'No license keys exist for this script yet.', ephemeral: true });
        }

        const lines = recentKeys.map((row) => {
          const status = isExpired(row.expires_at)
            ? 'Expired'
            : row.claimed_tag
              ? `Claimed by ${row.claimed_tag}`
              : 'Available';
          const note = row.note ? ` | ${row.note}` : '';
          return `${row.key} | ${status}${note}`;
        });

        return interaction.reply({ content: `\`\`\`\n${lines.join('\n')}\n\`\`\``, ephemeral: true });
      }
    }

    if (interaction.isChatInputCommand()) {
      const command = interaction.commandName;

      if (command === 'login') {
        const apiKey = interaction.options.getString('api_key', true);
        const keyRecord = db.prepare('SELECT * FROM api_keys WHERE key = ? AND is_active = 1').get(apiKey);
        if (!keyRecord) return interaction.reply({ content: 'Invalid API key.', ephemeral: true });
        if (isExpired(keyRecord.expires_at)) return interaction.reply({ content: 'API key expired.', ephemeral: true });

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(keyRecord.owner_id);
        if (!user) return interaction.reply({ content: 'User not found.', ephemeral: true });

        db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?').run(apiKey);
        const limits = getRemainingLimits(user.id);

        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle('API key validated')
          .setDescription(`Account: ${user.username}`)
          .addFields(
            { name: 'Scripts', value: `${limits.currentScripts}/${limits.maxScripts}`, inline: true },
            { name: 'Panels', value: `${limits.currentPanels}/${limits.maxPanels}`, inline: true }
          )
          .setFooter({ text: 'LuaObfuscationHub' });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (command === 'limits') {
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) {
          return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });
        }

        const limits = getRemainingLimits(user.id);
        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle('Current limits')
          .addFields(
            { name: 'Scripts', value: `${limits.currentScripts}/${limits.maxScripts}`, inline: true },
            { name: 'Panels', value: `${limits.currentPanels}/${limits.maxPanels}`, inline: true },
            { name: 'Remaining scripts', value: `${limits.remainingScripts}`, inline: true },
            { name: 'Remaining panels', value: `${limits.remainingPanels}`, inline: true }
          )
          .setFooter({ text: 'LuaObfuscationHub' });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (command === 'panel') {
        const panelId = interaction.options.getString('panel_id', true);
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) {
          return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });
        }

        const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });

        const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(panel.script_id);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });

        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle(panel.name)
          .setDescription(panel.description || 'Lua script access panel')
          .addFields(
            { name: 'Script', value: script.name, inline: true },
            { name: 'Status', value: script.status === 'active' ? 'Active' : 'Disabled', inline: true },
            { name: 'Access', value: script.ffa_mode ? 'Open' : 'Key required', inline: true }
          )
          .setFooter({ text: 'LuaObfuscationHub' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`view_${script.id}`).setLabel('View script').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`redeem_${script.id}`).setLabel('Redeem key').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`loader_${script.id}`).setLabel('Loader').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`keys_${script.id}`).setLabel('Keys').setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({ embeds: [embed], components: [row] });
      }

      if (command === 'generatekey') {
        const panelId = interaction.options.getString('panel_id', true);
        const hours = interaction.options.getInteger('hours', true);
        const note = interaction.options.getString('note') || '';

        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) {
          return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });
        }

        const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });

        const key = generateLicenseKey();
        const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3600000).toISOString() : null;
        const id = makeId('key');

        db.prepare(
          `INSERT INTO license_keys (id, script_id, panel_id, user_id, key, note, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(id, panel.script_id, panel.id, user.id, key, note, expiresAt);

        return interaction.reply({
          content: `Generated key: ${key}\n${expiresAt ? `Expires: ${new Date(expiresAt).toLocaleString()}` : 'Permanent key'}`,
          ephemeral: true,
        });
      }

      if (command === 'loader') {
        const scriptId = interaction.options.getString('script_id', true);
        const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });

        const baseUrl = publicBaseUrl();
        const loader = script.ffa_mode
          ? `loadstring(game:HttpGet("${baseUrl}/loader/${scriptId}"))()`
          : `script_key = "YOUR_KEY_HERE"\nloadstring(game:HttpGet("${baseUrl}/script/${scriptId}?key=" .. script_key .. "&hwid=" .. game:GetService("HttpService"):GenerateGUID(false)))()`;

        return interaction.reply({ content: `\`\`\`lua\n${loader}\n\`\`\``, ephemeral: true });
      }

      if (command === 'keys') {
        const panelId = interaction.options.getString('panel_id');
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) {
          return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });
        }

        let rows;
        if (panelId) {
          const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
          if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });
          rows = db
            .prepare(
              `SELECT key, note, expires_at, claimed_tag, created_at
               FROM license_keys
               WHERE user_id = ? AND panel_id = ?
               ORDER BY created_at DESC
               LIMIT 10`
            )
            .all(user.id, panelId);
        } else {
          rows = db
            .prepare(
              `SELECT key, note, expires_at, claimed_tag, created_at
               FROM license_keys
               WHERE user_id = ?
               ORDER BY created_at DESC
               LIMIT 10`
            )
            .all(user.id);
        }

        if (!rows.length) {
          return interaction.reply({ content: 'No license keys were found.', ephemeral: true });
        }

        const lines = rows.map((row) => {
          const status = isExpired(row.expires_at)
            ? 'Expired'
            : row.claimed_tag
              ? `Claimed by ${row.claimed_tag}`
              : 'Available';
          const note = row.note ? ` | ${row.note}` : '';
          return `${row.key} | ${status}${note}`;
        });

        return interaction.reply({ content: `\`\`\`\n${lines.join('\n')}\n\`\`\``, ephemeral: true });
      }
    }
  } catch (error) {
    console.error('Interaction error:', error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'An unexpected error occurred.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'An unexpected error occurred.', ephemeral: true });
      }
    } catch {
      // ignore follow-up failures
    }
  }
});

const port = Number(process.env.PORT || 10000);

(async () => {
  try {
    ensureUploadsDir();

    app.listen(port, '0.0.0.0', () => {
      console.log(`LuaObfuscationHub running on port ${port}`);
      console.log('Website:', publicBaseUrl());
    });

    if (DISCORD_TOKEN) {
      await client.login(DISCORD_TOKEN);
    } else {
      console.warn('DISCORD_TOKEN is not set. Discord bot features are disabled.');
    }
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
})();

module.exports = { app, db, authenticateApiKey };
