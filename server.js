// server.js – LuaObfuscationHub (Complete)
const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const session = require('express-session');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const FormData = require('form-data');
const fs = require('fs');
const multer = require('multer');
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

// ============ ENVIRONMENT ============
function detectPublicUrl() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  if (process.env.HEROKU_APP_NAME) return `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
  if (process.env.FLY_APP_NAME) return `https://${process.env.FLY_APP_NAME}.fly.dev`;
  const port = process.env.PORT || 10000;
  return `http://localhost:${port}`;
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;
const DATABASE_PATH = process.env.DATABASE_PATH || './data.sqlite';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const PUBLIC_BASE_URL = detectPublicUrl();
const OWNER_ID = '1207803375807373415';
const BRAND_COLOR = 0x00d4ff;
const DEFAULT_MAX_SCRIPTS = 100;
const DEFAULT_MAX_PANELS = 50;

console.log('🔷 LuaObfuscationHub starting...');
console.log('🌐 Domain:', PUBLIC_BASE_URL);
console.log('👑 Owner ID:', OWNER_ID);
console.log(`📊 Default Limits: ${DEFAULT_MAX_SCRIPTS} scripts, ${DEFAULT_MAX_PANELS} panels`);

// ============ DATABASE ============
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

// ============ HELPERS ============
function makeId(prefix) { return prefix + '_' + crypto.randomBytes(8).toString('hex'); }

function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function publicBaseUrl() { return PUBLIC_BASE_URL.replace(/\/$/, ''); }
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function getSessionUser(req) { return req.session.user || null; }
function requireAuth(req, res, next) { 
  if (req.session.user) return next(); 
  res.redirect('/'); 
}
function requireOwner(req, res, next) {
  if (req.session.user && req.session.user.is_owner) return next();
  res.status(403).json({ error: 'Access denied. Owner only.' });
}

// ============ LIMIT FUNCTIONS ============
function getUserLimits(userId) {
  const user = db.prepare('SELECT max_scripts, max_panels FROM users WHERE id = ?').get(userId);
  return user || { max_scripts: DEFAULT_MAX_SCRIPTS, max_panels: DEFAULT_MAX_PANELS };
}

function getScriptCount(userId) {
  const result = db.prepare('SELECT COUNT(*) as count FROM scripts WHERE user_id = ?').get(userId);
  return result ? result.count : 0;
}

function getPanelCount(userId) {
  const result = db.prepare('SELECT COUNT(*) as count FROM panels WHERE user_id = ?').get(userId);
  return result ? result.count : 0;
}

function canCreateScript(userId) {
  const limits = getUserLimits(userId);
  return getScriptCount(userId) < limits.max_scripts;
}

function canCreatePanel(userId) {
  const limits = getUserLimits(userId);
  return getPanelCount(userId) < limits.max_panels;
}

function getRemainingLimits(userId) {
  const limits = getUserLimits(userId);
  const scriptCount = getScriptCount(userId);
  const panelCount = getPanelCount(userId);
  return {
    maxScripts: limits.max_scripts,
    currentScripts: scriptCount,
    remainingScripts: limits.max_scripts - scriptCount,
    maxPanels: limits.max_panels,
    currentPanels: panelCount,
    remainingPanels: limits.max_panels - panelCount
  };
}

// ============ API KEY AUTH ============
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key || req.body.api_key;
  if (!apiKey) return res.status(401).json({ error: 'API key required' });
  
  const keyRecord = db.prepare('SELECT * FROM api_keys WHERE key = ? AND is_active = 1').get(apiKey);
  if (!keyRecord) return res.status(401).json({ error: 'Invalid or inactive API key' });
  if (keyRecord.expires_at && new Date(keyRecord.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: 'API key expired' });
  }
  
  db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?').run(apiKey);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(keyRecord.owner_id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  
  req.apiUser = user;
  req.apiKey = keyRecord;
  next();
}

// ============ EXPRESS APP ============
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

// ============ SESSION STORE ============
class SQLiteSessionStore extends session.Store {
  constructor(db) { super(); this.db = db; }
  get(sid, callback) {
    try {
      const row = this.db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expire > ?').get(sid, Date.now());
      if (row) callback(null, JSON.parse(row.sess));
      else callback(null, null);
    } catch (err) { callback(err); }
  }
  set(sid, sess, callback) {
    try {
      const expire = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400000;
      this.db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)').run(sid, JSON.stringify(sess), expire);
      callback(null);
    } catch (err) { callback(err); }
  }
  destroy(sid, callback) {
    try { this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid); callback(null); }
    catch (err) { callback(err); }
  }
  touch(sid, sess, callback) {
    try {
      const expire = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400000;
      this.db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?').run(expire, sid);
      callback(null);
    } catch (err) { callback(err); }
  }
}

app.use(session({
  store: new SQLiteSessionStore(db),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: PUBLIC_BASE_URL.startsWith('https'), 
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: PUBLIC_BASE_URL.startsWith('https') ? 'none' : 'lax',
    httpOnly: true
  }
}));

// ============ API ROUTES ============

// --- Get user limits ---
app.get('/api/limits', requireAuth, (req, res) => {
  const limits = getRemainingLimits(req.session.user.id);
  res.json(limits);
});

// --- Update user limits (Owner only) ---
app.post('/api/admin/set-limits', requireOwner, (req, res) => {
  const { userId, maxScripts, maxPanels } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  const user = db.prepare('SELECT * FROM users WHERE id = ? OR discord_id = ?').get(userId, userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const updates = [];
  if (maxScripts !== undefined) updates.push(`max_scripts = ${Math.max(0, parseInt(maxScripts))}`);
  if (maxPanels !== undefined) updates.push(`max_panels = ${Math.max(0, parseInt(maxPanels))}`);
  if (updates.length === 0) return res.status(400).json({ error: 'No limits specified' });
  
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(user.id);
  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ 
    success: true, 
    user: {
      id: updatedUser.id,
      discord_id: updatedUser.discord_id,
      username: updatedUser.username,
      maxScripts: updatedUser.max_scripts,
      maxPanels: updatedUser.max_panels
    }
  });
});

// --- Generate API Key (Owner Only) ---
app.post('/api/admin/generate-key', requireOwner, (req, res) => {
  const { userId, expiresInDays, notes, maxScripts, maxPanels } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  let user = db.prepare('SELECT * FROM users WHERE id = ? OR discord_id = ?').get(userId, userId);
  if (!user) {
    const id = makeId('user');
    db.prepare(`INSERT INTO users (id, discord_id, username, provider, max_scripts, max_panels)
                VALUES (?, ?, ?, ?, ?, ?)`).run(id, userId, `User_${userId.substring(0,8)}`, 'api', maxScripts || DEFAULT_MAX_SCRIPTS, maxPanels || DEFAULT_MAX_PANELS);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
  
  const apiKey = generateApiKey();
  const keyId = makeId('apikey');
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : null;
  
  db.prepare(`INSERT INTO api_keys (id, key, owner_id, created_by, expires_at, notes)
              VALUES (?, ?, ?, ?, ?, ?)`).run(keyId, apiKey, user.id, req.session.user.id, expiresAt, notes || '');
  db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(apiKey, user.id);
  
  if (maxScripts !== undefined || maxPanels !== undefined) {
    const updates = [];
    if (maxScripts !== undefined) updates.push(`max_scripts = ${Math.max(0, parseInt(maxScripts))}`);
    if (maxPanels !== undefined) updates.push(`max_panels = ${Math.max(0, parseInt(maxPanels))}`);
    if (updates.length > 0) db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(user.id);
  }
  
  const finalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ 
    success: true, 
    apiKey,
    userId: finalUser.id,
    discordId: finalUser.discord_id,
    username: finalUser.username,
    maxScripts: finalUser.max_scripts,
    maxPanels: finalUser.max_panels,
    expiresAt: expiresAt || 'Never'
  });
});

// --- List API Keys (Owner Only) ---
app.get('/api/admin/api-keys', requireOwner, (req, res) => {
  const keys = db.prepare(`SELECT ak.*, u.username as owner_username, u.discord_id as owner_discord, u.max_scripts, u.max_panels
                           FROM api_keys ak LEFT JOIN users u ON ak.owner_id = u.id ORDER BY ak.created_at DESC`).all();
  res.json(keys);
});

// --- Revoke API Key (Owner Only) ---
app.post('/api/admin/revoke-key', requireOwner, (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  db.prepare('UPDATE api_keys SET is_active = 0 WHERE key = ?').run(key);
  res.json({ success: true });
});

// --- Login with API Key ---
app.post('/api/login', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API key required' });
  
  const keyRecord = db.prepare('SELECT * FROM api_keys WHERE key = ? AND is_active = 1').get(apiKey);
  if (!keyRecord) return res.status(401).json({ error: 'Invalid API key' });
  if (keyRecord.expires_at && new Date(keyRecord.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: 'API key expired' });
  }
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(keyRecord.owner_id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  
  db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?').run(apiKey);
  
  req.session.user = {
    id: user.id,
    discord_id: user.discord_id,
    username: user.username,
    global_name: user.username,
    avatar: user.avatar,
    is_owner: user.is_owner === 1 || user.discord_id === OWNER_ID,
    maxScripts: user.max_scripts,
    maxPanels: user.max_panels
  };
  
  req.session.save((err) => {
    if (err) console.error('Session save error:', err);
    res.json({ success: true, user: req.session.user, redirect: '/dashboard' });
  });
});

// --- Check if user is owner ---
app.get('/api/check-owner', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.json({ isOwner: false });
  const isOwner = user.discord_id === OWNER_ID || user.is_owner === true;
  res.json({ isOwner, discordId: user.discord_id });
});

// ============ PAGE ROUTES ============

// --- Home Page ---
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LuaObfuscationHub</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #0a0a0f; color: #e2e8f0; min-height: 100vh; }
        .cyber-grid {
            position: fixed; inset: 0; pointer-events: none; opacity: 0.03;
            background-image: linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px);
            background-size: 50px 50px; z-index: 0;
        }
        .glow {
            position: fixed; top: -50%; left: -50%; width: 200%; height: 200%;
            pointer-events: none; background: radial-gradient(ellipse at 30% 40%, rgba(0,212,255,0.08) 0%, transparent 60%); z-index: 0;
        }
        .glass { background: rgba(18,18,24,0.8); backdrop-filter: blur(20px); border: 1px solid rgba(0,212,255,0.15); box-shadow: 0 0 40px rgba(0,212,255,0.05); }
        .neon-text { color: #00d4ff; text-shadow: 0 0 20px rgba(0,212,255,0.3); }
        .btn-cyber {
            background: linear-gradient(135deg, rgba(0,212,255,0.15), rgba(8,145,178,0.05));
            border: 1px solid rgba(0,212,255,0.2); color: #00d4ff; padding: 12px 28px; border-radius: 10px;
            font-weight: 600; cursor: pointer; transition: all 0.3s ease; text-decoration: none; display: inline-block;
        }
        .btn-cyber:hover { background: rgba(0,212,255,0.2); box-shadow: 0 0 30px rgba(0,212,255,0.15); transform: translateY(-2px); }
        .btn-primary-cyber {
            background: linear-gradient(135deg, #00d4ff, #0891b2); color: #0a0a0f; padding: 12px 28px;
            border-radius: 10px; font-weight: 700; cursor: pointer; transition: all 0.3s ease;
            text-decoration: none; display: inline-block; box-shadow: 0 0 30px rgba(0,212,255,0.2);
        }
        .btn-primary-cyber:hover { transform: translateY(-2px); box-shadow: 0 0 50px rgba(0,212,255,0.3); }
        input {
            width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(0,212,255,0.15);
            color: #e2e8f0; padding: 14px 16px; border-radius: 10px; font-size: 14px;
            transition: all 0.3s ease;
        }
        input:focus { outline: none; border-color: #00d4ff; box-shadow: 0 0 20px rgba(0,212,255,0.1); }
    </style>
</head>
<body>
    <div class="cyber-grid"></div><div class="glow"></div>
    <div class="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div class="glass rounded-2xl p-8 sm:p-12 max-w-md w-full text-center">
            <div class="flex justify-center mb-6">
                <div class="bg-gradient-to-br from-cyan-500/20 to-cyan-700/10 p-4 rounded-2xl border border-cyan-500/20">
                    <svg class="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                    </svg>
                </div>
            </div>
            <h1 class="text-3xl font-bold neon-text">LuaObfuscationHub</h1>
            <p class="text-cyan-300/60 mb-8">⚡ Cyberpunk-grade Lua protection</p>
            
            <div class="space-y-4">
                <input type="text" id="apiKeyInput" placeholder="Enter your API Key" class="text-center">
                <button onclick="loginWithApiKey()" class="btn-primary-cyber w-full">🚀 Login with API Key</button>
                <div class="relative">
                    <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-cyan-500/10"></div></div>
                    <div class="relative flex justify-center text-sm"><span class="px-4 bg-[#0a0a0f] text-cyan-300/40">or</span></div>
                </div>
                <a href="/auth/discord" class="btn-cyber w-full flex items-center justify-center gap-2">
                    <svg class="w-5 h-5" viewBox="0 0 127.14 96.36"><path fill="currentColor" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.1,46,96,53,91.08,65.69,84.69,65.69Z"/></svg>
                    Login with Discord
                </a>
            </div>
            <p class="mt-6 text-xs text-cyan-300/30">Need an API key? Contact the owner.</p>
        </div>
    </div>
    <script>
        async function loginWithApiKey() {
            const apiKey = document.getElementById('apiKeyInput').value.trim();
            if (!apiKey) return alert('Please enter your API key');
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey })
                });
                const data = await res.json();
                if (data.success) window.location.href = data.redirect;
                else alert('❌ ' + (data.error || 'Login failed'));
            } catch (e) { alert('❌ Error: ' + e.message); }
        }
        document.getElementById('apiKeyInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loginWithApiKey();
        });
    </script>
</body>
</html>`);
});

// ============ DISCORD BOT ============
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
  presence: { status: PresenceUpdateStatus.Online, activities: [{ name: 'LuaObfuscationHub', type: ActivityType.Watching }] }
});

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('login')
      .setDescription('Login to the dashboard with your API key')
      .addStringOption(option => option.setName('api_key').setDescription('Your API key').setRequired(true)),
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('Send a panel to a channel')
      .addStringOption(option => option.setName('panel_id').setDescription('Panel ID').setRequired(true)),
    new SlashCommandBuilder()
      .setName('generatekey')
      .setDescription('Generate a new license key')
      .addStringOption(option => option.setName('panel_id').setDescription('Panel ID').setRequired(true))
      .addIntegerOption(option => option.setName('hours').setDescription('Duration in hours (0 = permanent)').setRequired(true))
      .addStringOption(option => option.setName('note').setDescription('Note for the key')),
    new SlashCommandBuilder()
      .setName('limits')
      .setDescription('Check your script and panel limits'),
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('📡 Registering slash commands...');
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands.map(cmd => cmd.toJSON()) });
      console.log('✅ Registered guild commands');
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(cmd => cmd.toJSON()) });
      console.log('✅ Registered global commands');
    }
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
}

client.once('ready', () => {
  console.log('🤖 Bot online as ' + client.user.tag);
  registerCommands();
});

// ============ COMMAND HANDLERS ============
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isModalSubmit()) return;
    if (interaction.isButton()) return await handleButtonInteraction(interaction);
    if (interaction.isChatInputCommand()) await handleCommand(interaction);
  } catch (error) {
    console.error('❌ Interaction error:', error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
      }
    } catch (e) {}
  }
});

async function handleCommand(interaction) {
  const command = interaction.commandName;
  
  if (command === 'login') {
    const apiKey = interaction.options.getString('api_key');
    const keyRecord = db.prepare('SELECT * FROM api_keys WHERE key = ? AND is_active = 1').get(apiKey);
    if (!keyRecord) return interaction.reply({ content: '❌ Invalid or inactive API key.', ephemeral: true });
    if (keyRecord.expires_at && new Date(keyRecord.expires_at).getTime() < Date.now()) {
      return interaction.reply({ content: '❌ API key expired.', ephemeral: true });
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(keyRecord.owner_id);
    if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });
    
    db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?').run(apiKey);
    const limits = getRemainingLimits(user.id);
    
    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🔷 Login Successful')
      .setDescription(`Welcome **${user.username}**!`)
      .addFields(
        { name: '📊 Scripts', value: `${limits.currentScripts}/${limits.maxScripts}`, inline: true },
        { name: '📋 Panels', value: `${limits.currentPanels}/${limits.maxPanels}`, inline: true },
        { name: '🔑 API Key', value: `\`${apiKey}\``, inline: false }
      )
      .setFooter({ text: 'LuaObfuscationHub', iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  else if (command === 'limits') {
    const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
    if (!user) return interaction.reply({ content: '❌ You need to login first. Use `/login`', ephemeral: true });
    
    const limits = getRemainingLimits(user.id);
    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('📊 Your Limits')
      .addFields(
        { name: '📜 Scripts', value: `${limits.currentScripts} / ${limits.maxScripts}`, inline: true },
        { name: '📋 Panels', value: `${limits.currentPanels} / ${limits.maxPanels}`, inline: true },
        { name: '📈 Remaining Scripts', value: `${limits.remainingScripts}`, inline: true },
        { name: '📈 Remaining Panels', value: `${limits.remainingPanels}`, inline: true }
      )
      .setFooter({ text: 'LuaObfuscationHub' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  else if (command === 'panel') {
    const panelId = interaction.options.getString('panel_id');
    const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
    if (!user) return interaction.reply({ content: '❌ You need to login first. Use `/login`', ephemeral: true });
    
    const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
    if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
    
    const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(panel.script_id);
    if (!script) return interaction.reply({ content: '❌ Script not found.', ephemeral: true });
    
    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🔷 ' + panel.name)
      .setDescription(panel.description || '⚡ Cyberpunk Lua protection')
      .addFields(
        { name: '📜 Script', value: script.name, inline: true },
        { name: '📊 Status', value: script.status === 'active' ? '✅ Active' : '⛔ Disabled', inline: true },
        { name: '⏱️ HWID Cooldown', value: panel.hwid_cooldown + 's', inline: true }
      )
      .setFooter({ text: 'LuaObfuscationHub' })
      .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('view_' + script.id).setLabel('👁️ View Script').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('redeem_' + script.id).setLabel('🔑 Redeem Key').setStyle(ButtonStyle.Success)
    );
    await interaction.reply({ embeds: [embed], components: [row] });
  }
  
  else if (command === 'generatekey') {
    const panelId = interaction.options.getString('panel_id');
    const hours = interaction.options.getInteger('hours');
    const note = interaction.options.getString('note') || '';
    const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
    if (!user) return interaction.reply({ content: '❌ You need to login first. Use `/login`', ephemeral: true });
    
    const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
    if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
    
    const licenseKey = generateLicenseKey();
    const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3600000).toISOString() : null;
    const id = makeId('key');
    
    db.prepare(`INSERT INTO license_keys (id, script_id, panel_id, user_id, key, note, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, panel.script_id, panel.id, user.id, licenseKey, note, expiresAt);
    
    await interaction.reply({ 
      content: `✅ Generated license key: \`${licenseKey}\`\n${expiresAt ? '⏰ Expires: ' + new Date(expiresAt).toLocaleString() : '♾️ Permanent'}`,
      ephemeral: true 
    });
  }
}

async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;
  const parts = customId.split('_');
  const action = parts[0];
  const scriptId = parts.slice(1).join('_');
  
  if (!scriptId) return interaction.reply({ content: '❌ Invalid interaction.', ephemeral: true });
  
  const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
  if (!user) return interaction.reply({ content: '❌ You need to login first. Use `/login`', ephemeral: true });
  
  if (action === 'view') {
    const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(scriptId, user.id);
    if (!script) return interaction.reply({ content: '❌ Script not found.', ephemeral: true });
    
    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('📜 Script: ' + script.name)
      .setDescription('Status: ' + (script.status === 'active' ? '✅ Active' : '⛔ Disabled'))
      .addFields(
        { name: 'Version', value: script.version || '1.0.0', inline: true },
        { name: 'FFA Mode', value: script.ffa_mode ? '✅ Enabled' : '❌ Disabled', inline: true },
        { name: 'Compressed', value: script.compress_mode ? '✅ Yes' : '❌ No', inline: true }
      )
      .setFooter({ text: 'LuaObfuscationHub' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  else if (action === 'redeem') {
    const modal = new ModalBuilder()
      .setCustomId('redeem_' + scriptId)
      .setTitle('🔑 Redeem License Key');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('key_input')
          .setLabel('Enter your license key')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('ABC123XYZ789')
      )
    );
    await interaction.showModal(modal);
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith('redeem_')) return;
  
  const scriptId = interaction.customId.split('_')[1];
  const keyVal = interaction.fields.getTextInputValue('key_input').toUpperCase().trim();
  
  const keyRecord = db.prepare('SELECT * FROM license_keys WHERE key = ? AND script_id = ?').get(keyVal, scriptId);
  if (!keyRecord) return interaction.reply({ content: '❌ Invalid license key.', ephemeral: true });
  if (keyRecord.expires_at && new Date(keyRecord.expires_at).getTime() < Date.now()) {
    return interaction.reply({ content: '❌ Key expired.', ephemeral: true });
  }
  if (keyRecord.claimed_by) return interaction.reply({ content: '❌ Key already claimed.', ephemeral: true });
  
  db.prepare('UPDATE license_keys SET claimed_by = ?, claimed_tag = ?, last_used_at = CURRENT_TIMESTAMP WHERE key = ?')
    .run(interaction.user.id, interaction.user.tag, keyVal);
  await interaction.reply({ content: '✅ License key `' + keyVal + '` redeemed!', ephemeral: true });
});

// ============ START SERVER ============
const port = Number(process.env.PORT || 10000);
(async () => {
  try {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    
    app.listen(port, '0.0.0.0', () => {
      console.log('🔷 LuaObfuscationHub running on port ' + port);
      console.log('🌐 Website: ' + publicBaseUrl());
      console.log('👑 Owner ID: ' + OWNER_ID);
      console.log('⚡ Ready for deployment!');
    });
    await client.login(DISCORD_TOKEN);
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
})();
