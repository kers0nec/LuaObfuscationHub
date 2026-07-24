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
function defaultDatabasePath() {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  if (fs.existsSync('/var/data')) return '/var/data/luaobfuscationhub.sqlite';
  return path.join(__dirname, 'data.sqlite');
}
const DATABASE_PATH = defaultDatabasePath();
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const PUBLIC_BASE_URL = detectPublicUrl();
const OWNER_ID = process.env.OWNER_ID || '1207803375807373415';
const BRAND_COLOR = 0x22c3ff;
const DEFAULT_MAX_SCRIPTS = Number(process.env.DEFAULT_MAX_SCRIPTS || 50);
const DEFAULT_MAX_PANELS = Number(process.env.DEFAULT_MAX_PANELS || 100);
const HQ99_OBF_API_URL = process.env.HQ99_OBF_API_URL || 'https://obf.hungquan99.site/obfuscate';
const HQ99_OBF_API_KEY = process.env.HQ99_OBF_API_KEY || 'hq99ontop123';
const UPLOADS_DIR = path.join(__dirname, 'uploads');

console.log('LuaObfuscationHub starting');
console.log('Domain:', PUBLIC_BASE_URL);
console.log('Owner ID:', OWNER_ID);
console.log('Database path:', DATABASE_PATH);
console.log('Obfuscation API:', HQ99_OBF_API_URL);

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
  public_id TEXT UNIQUE,
  obfuscator TEXT DEFAULT 'hq99',
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
  last_hwid_reset_at TEXT,
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
  buyer_role_id TEXT,
  free_key_hours INTEGER DEFAULT 24,
  hwid_cooldown INTEGER DEFAULT 180,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(script_id) REFERENCES scripts(id)
);

CREATE TABLE IF NOT EXISTS script_whitelist (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_tag TEXT,
  granted_key TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(script_id) REFERENCES scripts(id),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS script_blacklist (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_tag TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(script_id) REFERENCES scripts(id),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS access_bans (
  id TEXT PRIMARY KEY,
  discord_id TEXT UNIQUE,
  user_id TEXT,
  reason TEXT,
  banned_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(banned_by) REFERENCES users(id)
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
CREATE INDEX IF NOT EXISTS idx_whitelist_script_user ON script_whitelist(script_id, discord_user_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_script_user ON script_blacklist(script_id, discord_user_id);
CREATE INDEX IF NOT EXISTS idx_access_bans_discord_id ON access_bans(discord_id);
CREATE INDEX IF NOT EXISTS idx_access_bans_user_id ON access_bans(user_id);
`);

function columnExists(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info('${tableName}')`).all();
  return columns.some((column) => column.name === columnName);
}

function addColumnIfMissing(tableName, columnDefinition) {
  const [columnName] = columnDefinition.trim().split(/\s+/);
  if (!columnExists(tableName, columnName)) {
    try {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
    } catch (error) {
      if (!columnExists(tableName, columnName)) throw error;
    }
  }
}

function createIndexIfPossible(indexSql, tableName, requiredColumn) {
  if (!requiredColumn || columnExists(tableName, requiredColumn)) {
    db.exec(indexSql);
  }
}

addColumnIfMissing('scripts', 'public_id TEXT');
addColumnIfMissing('scripts', "obfuscator TEXT DEFAULT 'hq99'");
addColumnIfMissing('license_keys', 'last_hwid_reset_at TEXT');
addColumnIfMissing('panels', 'buyer_role_id TEXT');
addColumnIfMissing('panels', 'free_key_hours INTEGER DEFAULT 24');
addColumnIfMissing('script_whitelist', 'expires_at TEXT');

createIndexIfPossible('CREATE INDEX IF NOT EXISTS idx_scripts_public_id ON scripts(public_id);', 'scripts', 'public_id');

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

function makePublicId() {
  return crypto.randomBytes(32).toString('hex');
}

function ensureScriptPublicIds() {
  try {
    if (!columnExists('scripts', 'public_id')) {
      console.warn('Skipping public_id backfill because scripts.public_id does not exist yet');
      return;
    }

    const rows = db.prepare("SELECT id FROM scripts WHERE public_id IS NULL OR TRIM(COALESCE(public_id, '')) = ''").all();
    const update = db.prepare('UPDATE scripts SET public_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    for (const row of rows) {
      update.run(makePublicId(), row.id);
    }
  } catch (error) {
    console.error('public_id migration warning:', error.message);
  }
}

ensureScriptPublicIds();
try {
  if (columnExists('scripts', 'obfuscator')) {
    db.prepare("UPDATE scripts SET obfuscator = 'hq99' WHERE obfuscator IS NULL OR TRIM(COALESCE(obfuscator, '')) = '' OR obfuscator = 'kers0ne' OR obfuscator = 'none'").run();
  }
} catch (error) {
  console.error('obfuscator migration warning:', error.message);
}
try {
  db.prepare('UPDATE users SET max_scripts = ?, max_panels = ? WHERE max_scripts IS NULL OR max_panels IS NULL').run(DEFAULT_MAX_SCRIPTS, DEFAULT_MAX_PANELS);
} catch (error) {
  console.error('user limits migration warning:', error.message);
}

function getAccessBan(discordId, userId = null) {
  if (userId) {
    return db.prepare('SELECT * FROM access_bans WHERE discord_id = ? OR user_id = ?').get(discordId || '', userId);
  }
  return db.prepare('SELECT * FROM access_bans WHERE discord_id = ?').get(discordId || '');
}

function isAccessBanned(discordId, userId = null) {
  return Boolean(getAccessBan(discordId, userId));
}

function assertNotAccessBanned(discordId, userId = null) {
  const ban = getAccessBan(discordId, userId);
  if (!ban) return null;
  return ban.reason || 'This account is blacklisted from using this website.';
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

function textBlock(fn) {
  return fn
    .toString()
    .replace(/^[\s\S]*?\/\*/, '')
    .replace(/\*\/[\s\S]*$/, '')
    .trim();
}

const INLINE_APP_CSS = textBlock(function () {/*
:root {
  --bg: #050912;
  --bg-alt: #0a1220;
  --panel: rgba(11, 18, 31, 0.8);
  --panel-strong: rgba(13, 21, 36, 0.96);
  --panel-soft: rgba(17, 27, 45, 0.72);
  --border: rgba(129, 195, 255, 0.14);
  --border-strong: rgba(129, 195, 255, 0.3);
  --text: #edf5ff;
  --muted: #91a7ca;
  --accent: #80d8ff;
  --accent-strong: #4d8dff;
  --accent-soft: rgba(77, 141, 255, 0.14);
  --success: #4ade80;
  --warning: #fbbf24;
  --danger: #fb7185;
  --shadow: 0 18px 60px rgba(2, 8, 18, 0.42);
  --radius-xl: 26px;
  --radius-lg: 20px;
  --radius-md: 16px;
  --radius-sm: 12px;
}

* { box-sizing: border-box; }

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

html { scroll-behavior: smooth; }

body {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(77, 141, 255, 0.24), transparent 24%),
    radial-gradient(circle at top right, rgba(128, 216, 255, 0.16), transparent 20%),
    radial-gradient(circle at bottom center, rgba(44, 89, 199, 0.12), transparent 22%),
    linear-gradient(180deg, #050912 0%, #09111d 48%, #050912 100%);
  line-height: 1.45;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 50% 0%, rgba(255,255,255,0.06), transparent 30%);
  opacity: 0.45;
}

button,
input,
textarea,
select {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.02);
}

::-webkit-scrollbar-thumb {
  background: rgba(132, 186, 255, 0.22);
  border-radius: 999px;
}

.site-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.022) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(circle at center, black 65%, transparent 100%);
  opacity: 0.45;
}

.panel {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(13, 21, 36, 0.94), rgba(10, 17, 29, 0.9));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}

.panel::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(128, 216, 255, 0.55), transparent);
  pointer-events: none;
}

h1,h2,h3,p { margin: 0; }

.eyebrow {
  margin: 0 0 6px;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--accent);
}

.muted,
.helper-text,
.resource-meta,
.user-role,
.stat-label,
.stat-meta,
.sidebar-caption,
.editor-subtext,
.empty-state,
.kbd-hint {
  color: var(--muted);
}

.auth-layout {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px 16px;
  position: relative;
  z-index: 1;
}

.auth-card {
  width: min(100%, 980px);
  padding: 24px;
  display: grid;
  gap: 20px;
}

.brand-block {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 16px;
  align-items: center;
}

.brand-mark {
  width: 76px;
  height: 76px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 800;
  color: var(--accent);
  background: linear-gradient(135deg, rgba(128, 216, 255, 0.22), rgba(77, 141, 255, 0.08));
  border: 1px solid rgba(128, 216, 255, 0.2);
  box-shadow: 0 18px 46px rgba(77, 141, 255, 0.18);
}

.brand-mark.small {
  width: 46px;
  height: 46px;
  font-size: 18px;
  border-radius: 16px;
}

.hero-title {
  font-size: clamp(1.85rem, 4.4vw, 3.2rem);
  line-height: 0.96;
  letter-spacing: -0.04em;
}

.hero-subtitle {
  margin-top: 10px;
  max-width: 60ch;
  color: #cfdef5;
  font-size: 0.98rem;
}

.auth-grid {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 18px;
}

.auth-panel,
.feature-panel {
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-md);
  padding: 18px;
}

.stack,
.stack-lg,
.stack-xl,
.field,
.nav-list,
.meta-list,
.editor-meta,
.stat-card,
.side-note,
.section-stack {
  display: grid;
}

.stack { gap: 10px; }
.stack-lg { gap: 14px; }
.stack-xl { gap: 18px; }
.section-stack { gap: 16px; }

.field { gap: 8px; }

.field label,
.switch-card label,
.nav-link,
.user-name {
  font-weight: 600;
}

input,
textarea,
select {
  width: 100%;
  color: var(--text);
  background: rgba(6, 12, 22, 0.82);
  border: 1px solid rgba(143, 182, 235, 0.12);
  border-radius: 12px;
  padding: 12px 13px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

input::placeholder,
textarea::placeholder {
  color: #7287aa;
}

input:focus,
textarea:focus,
select:focus {
  border-color: var(--border-strong);
  box-shadow: 0 0 0 3px rgba(103, 209, 255, 0.08);
}

textarea { resize: vertical; }

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 15px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease, opacity 0.18s ease;
  white-space: nowrap;
}

.button:hover { transform: translateY(-1px); }
.button:disabled { opacity: 0.6; cursor: wait; transform: none; }

.button.primary {
  color: #07111b;
  font-weight: 700;
  background: linear-gradient(135deg, #86e2ff 0%, #5dbdff 45%, #5b84ff 100%);
  box-shadow: 0 14px 34px rgba(77, 141, 255, 0.25);
}

.button.secondary,
.button.ghost {
  color: var(--text);
  border-color: rgba(143, 182, 235, 0.14);
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025));
}

.button.danger {
  color: #ffd7de;
  border-color: rgba(251, 113, 133, 0.24);
  background: rgba(251, 113, 133, 0.08);
}

.button.small {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 0.85rem;
}

.full-width { width: 100%; }

.divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
  color: var(--muted);
  font-size: 0.86rem;
}
.divider::before,
.divider::after {
  content: "";
  height: 1px;
  background: rgba(143, 182, 235, 0.12);
}

.feature-list { display: grid; gap: 10px; }
.feature-item {
  padding: 12px 13px;
  border-radius: 12px;
  border: 1px solid rgba(143, 182, 235, 0.08);
  background: rgba(255, 255, 255, 0.02);
}
.feature-title { font-size: 0.92rem; font-weight: 700; margin-bottom: 4px; }

.dashboard-shell {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 18px;
  min-height: 100vh;
  padding: 16px;
}

.sidebar {
  position: sticky;
  top: 16px;
  height: calc(100vh - 32px);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.brand-row { display: flex; align-items: center; gap: 12px; }
.brand-name { font-size: 0.98rem; font-weight: 700; }

.user-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(143, 182, 235, 0.08);
}

.avatar {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid rgba(143, 182, 235, 0.14);
}

.nav-list { gap: 8px; margin-bottom: auto; }

.nav-link {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: #c6d4ea;
  padding: 11px 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.nav-link:hover {
  background: rgba(255,255,255,0.03);
  border-color: rgba(143, 182, 235, 0.1);
}

.nav-link.active {
  color: var(--text);
  background: linear-gradient(135deg, rgba(103, 209, 255, 0.16), rgba(58, 163, 255, 0.08));
  border-color: rgba(103, 209, 255, 0.22);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}

.sidebar-footer { display: grid; gap: 10px; }

.content-area { min-width: 0; display: grid; gap: 16px; }

.topbar {
  padding: 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.page-title {
  font-size: clamp(1.45rem, 3vw, 2.3rem);
  line-height: 1;
  letter-spacing: -0.03em;
}

.topbar-actions { display: flex; align-items: center; gap: 10px; }

.live-pill,
.count-badge,
.badge,
.filter-pill,
.editor-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
}

.live-pill,
.count-badge,
.filter-pill,
.editor-chip {
  padding: 8px 11px;
  border: 1px solid rgba(143, 182, 235, 0.12);
  background: rgba(255,255,255,0.03);
}

.live-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--success);
  box-shadow: 0 0 16px rgba(74, 222, 128, 0.45);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  padding: 16px;
  gap: 8px;
}

.stat-value {
  font-size: 1.65rem;
  line-height: 1;
}

.view { display: none; }
.view.active { display: grid; animation: fadeUp 0.22s ease; }

.section-card { padding: 18px; }
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.form-grid { display: grid; gap: 14px; }
.form-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.form-grid .full { grid-column: 1 / -1; }

.form-actions,
.action-row,
.badge-row,
.card-toolbar,
.editor-actions,
.toggle-grid,
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.toggle-grid { align-items: stretch; }

.switch-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(143, 182, 235, 0.1);
  background: rgba(255,255,255,0.03);
}
.switch-card input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--accent-strong);
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 14px;
}

.resource-card {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(143, 182, 235, 0.12);
  background: linear-gradient(180deg, rgba(15, 24, 40, 0.96), rgba(10, 17, 29, 0.92));
  box-shadow: var(--shadow);
  display: grid;
  gap: 14px;
  transform: translateY(0);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  position: relative;
  overflow: hidden;
}

.resource-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top right, rgba(128, 216, 255, 0.08), transparent 30%);
  pointer-events: none;
}

.resource-card:hover {
  transform: translateY(-2px);
  border-color: rgba(103, 209, 255, 0.24);
  box-shadow: 0 24px 64px rgba(2, 8, 18, 0.48);
}

.resource-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.resource-title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
}

.badge {
  padding: 6px 9px;
  font-size: 0.75rem;
  font-weight: 700;
}
.badge.info { background: rgba(103, 209, 255, 0.14); color: #d4f2ff; }
.badge.success { background: rgba(74, 222, 128, 0.14); color: #d7ffe5; }
.badge.warning { background: rgba(251, 191, 36, 0.14); color: #fff1c5; }
.badge.danger { background: rgba(251, 113, 133, 0.14); color: #ffdbe2; }

.code-block {
  background: linear-gradient(180deg, rgba(6, 12, 21, 0.98), rgba(8, 14, 26, 0.94));
  border: 1px solid rgba(143, 182, 235, 0.1);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
}

.code-actions {
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  border-bottom: 1px solid rgba(143, 182, 235, 0.08);
  font-size: 0.84rem;
}
.code-actions button {
  border: 0;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
}
.code-block pre {
  margin: 0;
  padding: 12px 14px;
  font-size: 0.8rem;
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
  color: #bae7ff;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow: auto;
}

.meta-list { gap: 8px; }
.meta-item {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.87rem;
}
.meta-item span:last-child {
  color: var(--muted);
  text-align: right;
}

.editor-card { display: grid; gap: 10px; }
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.editor-shell {
  display: grid;
  grid-template-columns: 44px 1fr;
  min-height: 360px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(143, 182, 235, 0.12);
  background: linear-gradient(180deg, rgba(6, 12, 22, 0.98), rgba(7, 14, 26, 0.94));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
}
.editor-lines {
  margin: 0;
  padding: 16px 8px 16px 12px;
  background: rgba(255,255,255,0.03);
  color: #61779a;
  text-align: right;
  line-height: 1.55;
  user-select: none;
  overflow: hidden;
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
  font-size: 0.84rem;
}
.editor-textarea {
  min-height: 360px;
  border: 0;
  border-radius: 0;
  padding: 16px;
  margin: 0;
  resize: none;
  background: transparent;
  box-shadow: none !important;
  color: #edf6ff;
  line-height: 1.55;
  tab-size: 2;
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
  font-size: 0.9rem;
  caret-color: var(--accent);
  overflow: auto;
}
.editor-drop.active {
  border-color: rgba(103, 209, 255, 0.34);
  box-shadow: inset 0 0 0 1px rgba(103, 209, 255, 0.24);
}
.editor-actions { justify-content: space-between; align-items: center; }
.editor-meta { gap: 6px; }
.inline-note { display: flex; justify-content: space-between; gap: 10px; align-items: center; }

.empty-state {
  padding: 24px;
  border-radius: 16px;
  text-align: center;
  border: 1px dashed rgba(143, 182, 235, 0.14);
  background: rgba(255,255,255,0.02);
}

.search-row { display: flex; gap: 12px; flex-wrap: wrap; }
.search-row .field { min-width: 220px; flex: 1 1 220px; }

.toast-root {
  position: fixed;
  right: 14px;
  bottom: 14px;
  display: grid;
  gap: 8px;
  z-index: 9999;
}
.toast {
  min-width: 240px;
  max-width: 340px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(143, 182, 235, 0.14);
  background: rgba(11, 18, 31, 0.96);
  box-shadow: var(--shadow);
  animation: fadeUp 0.2s ease;
}
.toast.success { border-color: rgba(74, 222, 128, 0.24); }
.toast.error { border-color: rgba(251, 113, 133, 0.24); }
.toast-title { font-weight: 700; margin-bottom: 4px; }
.toast-message { color: var(--muted); font-size: 0.9rem; }

.modal {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(4, 8, 16, 0.62);
  backdrop-filter: blur(8px);
}
.modal.open { display: flex; }
.modal-card {
  width: min(100%, 500px);
  padding: 20px;
  border-radius: 18px;
  background: rgba(10, 18, 31, 0.98);
  border: 1px solid rgba(143, 182, 235, 0.14);
  box-shadow: var(--shadow);
}
.hidden { display: none !important; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 1180px) {
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .resource-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
}

@media (max-width: 980px) {
  .dashboard-shell {
    grid-template-columns: 1fr;
    padding: 12px;
  }
  .sidebar {
    position: static;
    height: auto;
  }
  .nav-list {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
  .auth-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .auth-card,
  .section-card,
  .topbar,
  .sidebar,
  .modal-card {
    padding: 16px;
  }
  .brand-block {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .brand-mark { margin: 0 auto; }
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }
  .form-grid.two,
  .form-grid.three,
  .stats-grid,
  .resource-grid {
    grid-template-columns: 1fr;
  }
  .editor-shell {
    min-height: 300px;
  }
  .editor-textarea,
  .editor-lines {
    min-height: 300px;
  }
}

@media (max-width: 560px) {
  .dashboard-shell { gap: 12px; }
  .resource-card,
  .code-block,
  .editor-shell {
    border-radius: 14px;
  }
  .brand-mark {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    font-size: 24px;
  }
  .brand-mark.small {
    width: 42px;
    height: 42px;
    border-radius: 14px;
  }
  .button,
  .button.small {
    width: 100%;
  }
  .action-row,
  .form-actions,
  .editor-actions,
  .topbar-actions {
    width: 100%;
  }
  .topbar-actions .button,
  .form-actions .button,
  .action-row .button,
  .editor-actions .button {
    flex: 1 1 100%;
  }
  .nav-list {
    grid-template-columns: 1fr 1fr;
  }
  .stat-card {
    padding: 14px;
  }
  .resource-title { font-size: 0.95rem; }
}

:root {
  --bg: #060914;
  --bg-alt: #0a1020;
  --panel: rgba(13, 20, 37, 0.86);
  --panel-strong: rgba(15, 24, 44, 0.98);
  --panel-soft: rgba(18, 29, 52, 0.76);
  --border: rgba(153, 190, 255, 0.13);
  --border-strong: rgba(107, 215, 255, 0.42);
  --text: #f4f8ff;
  --muted: #8ea4c9;
  --accent: #8fe8ff;
  --accent-strong: #5d8cff;
  --accent-soft: rgba(93, 140, 255, 0.15);
  --shadow: 0 22px 70px rgba(1, 5, 15, 0.5);
  --radius-xl: 24px;
  --radius-lg: 18px;
  --radius-md: 14px;
  --radius-sm: 10px;
}

body {
  background:
    radial-gradient(900px 520px at 8% -12%, rgba(59, 119, 255, 0.22), transparent 62%),
    radial-gradient(700px 500px at 96% 0%, rgba(53, 211, 255, 0.13), transparent 64%),
    linear-gradient(160deg, #050812 0%, #0a1020 52%, #050812 100%);
}

body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.2;
  background-image: radial-gradient(rgba(190, 223, 255, 0.22) 0.6px, transparent 0.6px);
  background-size: 18px 18px;
  mask-image: linear-gradient(to bottom, black, transparent 80%);
}

.panel {
  border-color: rgba(153, 190, 255, 0.13);
  background: linear-gradient(145deg, rgba(18, 28, 50, 0.9), rgba(9, 16, 30, 0.88));
  box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,0.035);
}

.dashboard-shell {
  max-width: 1560px;
  margin: 0 auto;
  grid-template-columns: 232px minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
}

.sidebar {
  padding: 14px;
  gap: 14px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(13, 23, 43, 0.94), rgba(8, 14, 27, 0.9));
}

.brand-mark.small {
  width: 40px;
  height: 40px;
  border-radius: 13px;
  font-size: 16px;
  background: linear-gradient(135deg, #9beaff 0%, #6f9cff 54%, #665bff 100%);
  color: #07111d;
  box-shadow: 0 10px 28px rgba(79, 143, 255, 0.32);
}

.brand-name { letter-spacing: -0.02em; }
.sidebar-caption { font-size: 0.69rem; letter-spacing: 0.02em; }

.user-summary {
  padding: 11px;
  border-radius: 13px;
  background: rgba(255,255,255,0.035);
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 11px;
}

.nav-list { gap: 4px; }
.nav-link {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  font-size: 0.86rem;
  color: #a8badd;
}
.nav-link::before {
  content: "";
  width: 5px;
  height: 5px;
  flex: 0 0 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
}
.nav-link.active::before { opacity: 1; box-shadow: 0 0 12px currentColor; }
.nav-link.active {
  background: linear-gradient(90deg, rgba(110, 220, 255, 0.16), rgba(93, 140, 255, 0.08));
  border-color: rgba(110, 220, 255, 0.2);
}

.content-area { gap: 12px; }
.topbar {
  padding: 14px 16px;
  min-height: 72px;
  border-radius: 18px;
}
.topbar .stack { gap: 4px; }
.eyebrow { font-size: 0.64rem; letter-spacing: 0.18em; }
.page-title { font-size: clamp(1.35rem, 2.5vw, 1.95rem); }
.topbar-actions { gap: 8px; }
.mobile-menu-button { display: none; }

.stats-grid { gap: 10px; }
.stat-card {
  min-height: 106px;
  padding: 14px;
  gap: 9px;
  transition: transform .18s ease, border-color .18s ease;
}
.stat-card:hover { transform: translateY(-2px); border-color: rgba(111, 220, 255, 0.28); }
.stat-card::after {
  content: "";
  width: 42px;
  height: 3px;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--accent), var(--accent-strong));
  opacity: 0.75;
}
.stat-value { font-size: 1.75rem; letter-spacing: -0.04em; }
.stat-label, .stat-meta { font-size: 0.74rem; }

.section-card { padding: 16px; border-radius: 18px; }
.section-header { margin-bottom: 14px; }
.section-header h2 { letter-spacing: -0.025em; }
.resource-grid { gap: 10px; }
.resource-card {
  padding: 14px;
  border-radius: 15px;
  gap: 12px;
  box-shadow: 0 14px 38px rgba(2, 8, 18, 0.28);
}
.resource-card:hover { transform: translateY(-2px); }
.resource-title { font-size: 0.94rem; }
.resource-meta { font-size: 0.78rem; }
.badge { padding: 5px 8px; font-size: 0.68rem; }
.meta-item { font-size: 0.8rem; }
.button { min-height: 38px; border-radius: 10px; font-size: 0.84rem; }
.button.small { min-height: 32px; border-radius: 9px; font-size: 0.76rem; }
.button.primary {
  background: linear-gradient(135deg, #9cecff 0%, #68caff 37%, #6688ff 100%);
  box-shadow: 0 10px 25px rgba(71, 132, 255, 0.22);
}
.count-badge, .live-pill { padding: 7px 10px; font-size: 0.72rem; }

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(280px, .75fr);
  gap: 10px;
}
.overview-hero {
  min-height: 208px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px;
  background:
    radial-gradient(circle at 88% 14%, rgba(120, 224, 255, 0.18), transparent 28%),
    linear-gradient(135deg, rgba(24, 43, 78, 0.96), rgba(11, 20, 38, 0.94));
}
.overview-hero h2 { max-width: 470px; font-size: clamp(1.35rem, 3vw, 2rem); letter-spacing: -0.04em; }
.overview-hero p { max-width: 530px; color: #a9bddf; font-size: .88rem; }
.overview-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.overview-side { display: grid; gap: 10px; }
.pulse-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(153,190,255,.09);
}
.pulse-row:last-child { border-bottom: 0; }
.pulse-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: var(--accent);
  background: rgba(111,220,255,.1);
  font-size: .7rem;
  font-weight: 800;
}
.pulse-copy { min-width: 0; }
.pulse-copy strong, .pulse-copy span { display: block; }
.pulse-copy strong { font-size: .78rem; }
.pulse-copy span { color: var(--muted); font-size: .72rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mini-label { color: var(--muted); text-transform: uppercase; letter-spacing: .12em; font-size: .62rem; font-weight: 700; }
.panel-preview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 230px;
  gap: 12px;
}
.discord-preview {
  position: relative;
  overflow: hidden;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(153,190,255,.12);
  background: linear-gradient(145deg, rgba(25, 37, 64, .94), rgba(12, 19, 35, .96));
}
.discord-preview::before {
  content: "";
  position: absolute;
  width: 180px;
  height: 180px;
  right: -70px;
  top: -90px;
  border-radius: 50%;
  background: rgba(113, 215, 255, .13);
  filter: blur(2px);
}
.preview-kicker { color: var(--accent); font-size: .68rem; text-transform: uppercase; letter-spacing: .14em; font-weight: 800; }
.preview-title { margin-top: 7px; font-size: 1.05rem; font-weight: 800; }
.preview-copy { margin-top: 5px; color: var(--muted); font-size: .78rem; }
.access-strip { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.access-strip span { padding: 5px 8px; border-radius: 7px; font-size: .67rem; background: rgba(255,255,255,.055); color: #c3d3ed; }
.access-strip span.is-on { color: #caffda; background: rgba(74,222,128,.1); }
.preview-actions { display: grid; gap: 7px; margin-top: 16px; }
.preview-actions .button { width: 100%; }
.panel-settings { display: grid; gap: 8px; align-content: start; }
.setting-line { display: flex; justify-content: space-between; gap: 8px; padding: 9px 0; border-bottom: 1px solid rgba(153,190,255,.08); font-size: .75rem; }
.setting-line span:last-child { color: var(--muted); text-align: right; }
.filter-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.filter-toolbar input { flex: 1 1 220px; min-width: 0; padding: 10px 12px; }
.filter-pill { cursor: pointer; padding: 7px 10px; color: var(--muted); font-size: .72rem; }
.filter-pill.active { color: var(--text); border-color: rgba(111,220,255,.26); background: rgba(111,220,255,.1); }
.whitelist-card { border-color: rgba(117, 184, 255, .2); }
.whitelist-card .resource-title { display: flex; align-items: center; gap: 7px; }
.whitelist-card .resource-title::before { content: "✓"; width: 18px; height: 18px; display: grid; place-items: center; border-radius: 6px; color: #061522; background: #84eab1; font-size: .68rem; }

@media (max-width: 980px) {
  .dashboard-shell { grid-template-columns: 1fr; }
  .sidebar {
    position: fixed;
    z-index: 50;
    inset: 12px auto 12px 12px;
    width: min(280px, calc(100vw - 24px));
    height: auto;
    transform: translateX(-115%);
    transition: transform .22s ease;
    box-shadow: 20px 0 60px rgba(0,0,0,.45);
  }
  .sidebar.mobile-open { transform: translateX(0); }
  .sidebar::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  .mobile-menu-button { display: inline-flex; }
  .panel-preview { grid-template-columns: 1fr; }
}

@media (max-width: 680px) {
  .dashboard-shell { padding: 8px; }
  .topbar { align-items: flex-start; padding: 12px; }
  .topbar-actions { width: 100%; justify-content: flex-start; }
  .topbar-actions .button { flex: 0 0 auto; width: auto; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat-card { min-height: 92px; padding: 12px; }
  .overview-grid { grid-template-columns: 1fr; }
  .section-card { padding: 13px; }
  .section-header { align-items: flex-start; }
  .section-header .count-badge { flex: 0 0 auto; }
}

@media (max-width: 420px) {
  .stats-grid { gap: 7px; }
  .stat-value { font-size: 1.45rem; }
  .stat-card { min-height: 84px; }
  .topbar-actions .live-pill { display: none; }
  .overview-hero { min-height: 230px; padding: 14px; }
  .overview-actions .button { flex: 1 1 100%; }
}


*/});

const INLINE_LOGIN_JS = textBlock(function () {/*
async function loginWithApiKey() {
  const input = document.getElementById('apiKeyInput');
  const button = document.getElementById('apiLoginButton');
  const apiKey = input.value.trim();

  if (!apiKey) {
    alert('Enter your API key.');
    input.focus();
    return;
  }

  button.disabled = true;
  button.textContent = 'Signing in...';

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }

    window.location.href = data.redirect || '/dashboard';
  } catch (error) {
    alert(error.message || 'Login failed');
  } finally {
    button.disabled = false;
    button.textContent = 'Login with API Key';
  }
}

document.getElementById('apiLoginButton')?.addEventListener('click', loginWithApiKey);
document.getElementById('apiKeyInput')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') loginWithApiKey();
});

*/});

const INLINE_DASHBOARD_JS = textBlock(function () {/*
const APP = window.__APP__ || {};
const currentUser = APP.user || {};
const defaults = APP.defaults || { maxScripts: 100, maxPanels: 50 };
const baseUrl = APP.baseUrl || window.location.origin;

const viewTitles = {
  overview: 'Overview',
  scripts: 'Scripts',
  panels: 'Panels',
  keys: 'Keys',
  whitelist: 'Whitelist',
  hwids: 'HWID Bans',
  admin: 'Admin',
};

const viewDescriptions = {
  overview: 'A live read on your protected script workspace and access layer.',
  scripts: 'Manage hosted scripts, loadstrings, FFA mode, and upload flow.',
  panels: 'Create polished Discord panels and role-enabled access buttons.',
  keys: 'Generate, assign, copy, and revoke access keys.',
  whitelist: 'Grant durable script access to trusted Discord users without sharing keys.',
  hwids: 'Manage blocked hardware identifiers and enforcement.',
  admin: 'Create API keys, edit limits, and blacklist Discord IDs from website access.',
};

let currentView = 'overview';
let currentData = {
  scripts: [],
  panels: [],
  keys: [],
  whitelist: [],
  bannedHWIDs: [],
  accessBans: [],
  limits: {
    maxScripts: defaults.maxScripts,
    currentScripts: 0,
    remainingScripts: defaults.maxScripts,
    maxPanels: defaults.maxPanels,
    currentPanels: 0,
    remainingPanels: defaults.maxPanels,
  },
};
let apiKeysCache = [];
let serverTime = Date.now();
let editingScriptId = null;
let editingPanelId = null;
let editingKeyValue = null;

function qs(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  const node = document.createElement('div');
  node.textContent = value == null ? '' : String(value);
  return node.innerHTML;
}

function formatDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleString();
}

function isExpired(value) {
  return Boolean(value) && new Date(value).getTime() < serverTime;
}

function badge(label, type = 'info') {
  return `<span class="badge ${type}">${escapeHtml(label)}</span>`;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function notify(title, message, type = 'success') {
  const root = qs('toastRoot');
  if (!root) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-title">${escapeHtml(title)}</div>
    <div class="toast-message">${escapeHtml(message)}</div>
  `;
  root.appendChild(toast);
  setTimeout(() => toast.remove(), 3400);
}

async function requestJSON(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    window.location.href = '/';
    throw new Error('Unauthorized');
  }

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Request failed' };
  }

  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function hostedLoader(script) {
  const url = `${baseUrl}/scripts/hosted/${script.public_id}.lua`;
  return script.ffa_mode
    ? `loadstring(game:HttpGet("${url}"))()`
    : `script_key = "YOUR_KEY_HERE"\n\nloadstring(game:HttpGet("${url}"))()`;
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    notify('Copied', 'Copied to clipboard.');
  }).catch(() => {
    notify('Clipboard blocked', 'Browser denied clipboard access.', 'error');
  });
}

function getScriptById(id) {
  return (currentData.scripts || []).find((row) => row.id === id);
}

function getPanelById(id) {
  return (currentData.panels || []).find((row) => row.id === id);
}

function setPageMeta(view) {
  qs('pageTitle').textContent = viewTitles[view] || 'Dashboard';
  qs('pageSubtitle').textContent = viewDescriptions[view] || 'Manage your workspace.';
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach((node) => node.classList.toggle('active', node.id === `view-${view}`));
  document.querySelectorAll('.nav-link').forEach((node) => node.classList.toggle('active', node.dataset.view === view));
  setPageMeta(view);
  if (view === 'admin') loadApiKeys({ silent: true });
}

function updateSummary() {
  const limits = currentData.limits || {};
  const activeKeys = (currentData.keys || []).filter((row) => !isExpired(row.expires_at)).length;
  qs('statScripts').textContent = `${limits.currentScripts || 0}`;
  qs('statScriptsMeta').textContent = `${limits.remainingScripts || 0} of ${limits.maxScripts || defaults.maxScripts} remaining`;
  qs('statPanels').textContent = `${limits.currentPanels || 0}`;
  qs('statPanelsMeta').textContent = `${limits.remainingPanels || 0} of ${limits.maxPanels || defaults.maxPanels} remaining`;
  qs('statKeys').textContent = `${currentData.keys?.length || 0}`;
  qs('statKeysMeta').textContent = `${activeKeys} active keys`;
  qs('statHwids').textContent = `${currentData.bannedHWIDs?.length || 0}`;
  qs('statHwidsMeta').textContent = 'Tracked block entries';
  if (qs('statWhitelist')) qs('statWhitelist').textContent = `${currentData.whitelist?.length || 0}`;
  if (qs('statWhitelistMeta')) qs('statWhitelistMeta').textContent = 'Trusted access grants';
}

function renderWhitelist() {
  const list = qs('whitelistList');
  if (!list) return;
  const rows = currentData.whitelist || [];
  qs('whitelistCount').textContent = `${rows.length} grants`;
  if (!rows.length) {
    list.innerHTML = emptyState('No trusted users yet. Add a Discord ID to grant permanent access to a script.');
    return;
  }

  list.innerHTML = rows.map((row) => `
    <article class="resource-card whitelist-card">
      <div class="resource-header">
        <div>
          <div class="resource-title">${escapeHtml(row.discord_tag || row.discord_user_id)}</div>
          <div class="resource-meta">${escapeHtml(row.discord_user_id)} · granted ${escapeHtml(formatDate(row.created_at))}</div>
        </div>
        <div class="badge-row">${badge('Trusted access', 'success')}</div>
      </div>
      <div class="meta-list">
        <div class="meta-item"><strong>Script</strong><span>${escapeHtml(row.script_name || row.script_id)}</span></div>
        <div class="meta-item"><strong>Granted key</strong><span>${escapeHtml(row.granted_key || 'Managed automatically')}</span></div>
        <div class="meta-item"><strong>Access mode</strong><span>Permanent whitelist</span></div>
      </div>
      <div class="action-row">
        ${row.granted_key ? `<button class="button secondary small" onclick='copyText(${JSON.stringify(row.granted_key)})'>Copy key</button>` : ''}
        <button class="button danger small" onclick="removeWhitelist('${escapeHtml(row.id)}')">Remove access</button>
      </div>
    </article>
  `).join('');
}

async function addWhitelist() {
  const scriptId = qs('whitelistScriptId')?.value;
  const discordUserId = qs('whitelistDiscordUserId')?.value.trim();
  const discordTag = qs('whitelistDiscordTag')?.value.trim();
  if (!scriptId || !discordUserId) {
    notify('Missing fields', 'Select a script and enter a Discord user ID.', 'error');
    return;
  }

  try {
    const data = await requestJSON('/api/whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptId, discordUserId, discordTag }),
    });
    qs('whitelistDiscordUserId').value = '';
    qs('whitelistDiscordTag').value = '';
    await loadData({ silent: true });
    notify('Access granted', `${data.discordTag || discordUserId} is now whitelisted.`);
  } catch (error) {
    notify('Whitelist failed', error.message || 'Unable to grant script access.', 'error');
  }
}

async function removeWhitelist(id) {
  if (!confirm('Remove this trusted access grant?')) return;
  try {
    await requestJSON('/api/remove-whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadData({ silent: true });
    notify('Access removed', 'The whitelist grant was removed.');
  } catch (error) {
    notify('Remove failed', error.message || 'Unable to remove whitelist access.', 'error');
  }
}

function renderScripts() {
  const list = qs('scriptsList');
  const rows = currentData.scripts || [];
  qs('scriptsCount').textContent = `${rows.length} items`;
  if (!rows.length) {
    list.innerHTML = emptyState('No scripts have been uploaded yet.');
    return;
  }

  list.innerHTML = rows.map((script) => {
    const loader = hostedLoader(script);
    const hostedUrl = `${baseUrl}/scripts/hosted/${script.public_id}.lua`;
    return `
      <article class="resource-card">
        <div class="resource-header">
          <div>
            <div class="resource-title">${escapeHtml(script.name)}</div>
            <div class="resource-meta">Created ${escapeHtml(formatDate(script.created_at))}</div>
          </div>
          <div class="badge-row">
            ${badge(script.status === 'active' ? 'Active' : 'Disabled', script.status === 'active' ? 'success' : 'danger')}
            ${badge(script.ffa_mode ? 'FFA Mode' : 'Key Required', script.ffa_mode ? 'warning' : 'info')}
            ${badge(script.obfuscated_code ? 'HQ99 Obfuscated' : 'Raw Source', script.obfuscated_code ? 'info' : 'warning')}
          </div>
        </div>

        <div class="meta-list">
          <div class="meta-item"><strong>Script ID</strong><span>${escapeHtml(script.id)}</span></div>
          <div class="meta-item"><strong>Hosted Path</strong><span>${escapeHtml(script.public_id || '')}</span></div>
          <div class="meta-item"><strong>Delivery</strong><span>${script.ffa_mode ? 'Direct access' : 'Key protected'}</span></div>
          <div class="meta-item"><strong>Build</strong><span>${script.obfuscated_code ? 'HQ99 obfuscated' : 'Raw source'}</span></div>
        </div>

        <div class="code-block">
          <div class="code-actions">
            <span>Loader snippet</span>
            <button type="button" onclick='copyText(${JSON.stringify(loader)})'>Copy</button>
          </div>
          <pre>${escapeHtml(loader)}</pre>
        </div>

        <div class="code-block">
          <div class="code-actions">
            <span>Hosted file</span>
            <button type="button" onclick='copyText(${JSON.stringify(hostedUrl)})'>Copy URL</button>
          </div>
          <pre>${escapeHtml(hostedUrl)}</pre>
        </div>

        <div class="action-row">
          <button class="button secondary small" onclick="editScript('${script.id}')">Edit</button>
          <button class="button secondary small" onclick="toggleScript('${script.id}')">${script.status === 'active' ? 'Disable' : 'Enable'}</button>
          <button class="button secondary small" onclick="toggleFfa('${script.id}')">${script.ffa_mode ? 'Disable FFA' : 'Enable FFA'}</button>
          <button class="button primary small" onclick="obfuscateScript('${script.id}')">Compress</button>
          <button class="button danger small" onclick="deleteScript('${script.id}')">Delete</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderPanels() {
  const list = qs('panelsList');
  const rows = currentData.panels || [];
  qs('panelsCount').textContent = `${rows.length} items`;
  if (!rows.length) {
    list.innerHTML = emptyState('No Discord panels have been created yet.');
    return;
  }

  list.innerHTML = rows.map((panel) => {
    const script = getScriptById(panel.script_id);
    return `
      <article class="resource-card">
        <div class="resource-header">
          <div>
            <div class="resource-title">${escapeHtml(panel.name)}</div>
            <div class="resource-meta">${escapeHtml(panel.description || 'No description')}</div>
          </div>
          <div class="badge-row">
            ${badge('Discord Panel', 'info')}
            ${badge((panel.free_key_hours || 0) > 0 ? `Free Key ${panel.free_key_hours}h` : 'Free Key Off', (panel.free_key_hours || 0) > 0 ? 'success' : 'warning')}
          </div>
        </div>

        <div class="meta-list">
          <div class="meta-item"><strong>Script</strong><span>${escapeHtml(script?.name || panel.script_id)}</span></div>
          <div class="meta-item"><strong>Channel ID</strong><span>${escapeHtml(panel.channel_id)}</span></div>
          <div class="meta-item"><strong>Buyer Role</strong><span>${escapeHtml(panel.buyer_role_id || 'Not set')}</span></div>
          <div class="meta-item"><strong>HWID Cooldown</strong><span>${escapeHtml(String(panel.hwid_cooldown || 0))} seconds</span></div>
        </div>

        <div class="action-row">
          <button class="button secondary small" onclick="editPanel('${panel.id}')">Edit</button>
          <button class="button primary small" onclick="sendPanel('${panel.id}')">Send Panel</button>
          <button class="button secondary small" onclick='copyText(${JSON.stringify(panel.id)})'>Copy Panel ID</button>
          <button class="button danger small" onclick="deletePanel('${panel.id}')">Delete</button>
        </div>
      </article>
    `;
  }).join('');
}

function resetScriptForm() {
  editingScriptId = null;
  qs('scriptName').value = '';
  qs('scriptCode').value = '';
  qs('ffaModeCheck').checked = false;
  qs('compressModeCheck').checked = true;
  qs('editorFileLabel').textContent = 'untitled.lua';
  qs('saveScriptButton').textContent = 'Save script';
  qs('cancelScriptEditButton').classList.add('hidden');
  syncEditor();
}

function editScript(id) {
  const script = getScriptById(id);
  if (!script) {
    notify('Script not found', 'Unable to load the selected script for editing.', 'error');
    return;
  }

  editingScriptId = id;
  qs('scriptName').value = script.name || '';
  qs('scriptCode').value = script.code || '';
  qs('ffaModeCheck').checked = Boolean(script.ffa_mode);
  qs('compressModeCheck').checked = Boolean(script.compress_mode || script.obfuscated_code);
  qs('editorFileLabel').textContent = `${script.name || 'script'}.lua`;
  qs('saveScriptButton').textContent = 'Update script';
  qs('cancelScriptEditButton').classList.remove('hidden');
  syncEditor();
  setView('scripts');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePanelPreview() {
  const name = qs('panelName')?.value.trim() || 'Release panel';
  const description = qs('panelDescription')?.value.trim() || 'yo';
  const scriptId = qs('panelScriptId')?.value || '';
  const buyerRoleId = qs('panelBuyerRoleId')?.value.trim() || 'Not set';
  const freeKeyHours = Number(qs('panelFreeKeyHours')?.value) || 0;
  const hwidCooldown = Number(qs('panelHwidCooldown')?.value) || 0;
  const script = getScriptById(scriptId);

  qs('panelPreviewTitle').textContent = `🔷 ${name}`;
  qs('panelPreviewDescription').textContent = description || 'yo';
  qs('panelPreviewScriptBadge').textContent = script ? `📜 ${script.name}` : '📜 No script selected';
  const accessBadge = qs('panelPreviewAccessBadge');
  accessBadge.textContent = script?.ffa_mode ? '🔓 Open Access' : '🔑 Key Required';
  accessBadge.className = `badge ${script?.ffa_mode ? 'warning' : 'success'}`;
  qs('panelPreviewRole').textContent = buyerRoleId;
  qs('panelPreviewFreeKey').textContent = freeKeyHours > 0 ? `${freeKeyHours} hours` : 'Disabled';
  qs('panelPreviewHwid').textContent = `${hwidCooldown || 0} seconds`;
}

function resetPanelForm() {
  editingPanelId = null;
  qs('panelName').value = '';
  qs('panelDescription').value = '';
  qs('panelChannelId').value = '';
  qs('panelScriptId').value = '';
  qs('panelBuyerRoleId').value = '';
  qs('panelFreeKeyHours').value = '24';
  qs('panelHwidCooldown').value = '180';
  qs('savePanelButton').textContent = 'Create panel';
  qs('cancelPanelEditButton').classList.add('hidden');
  updatePanelPreview();
}

function editPanel(id) {
  const panel = getPanelById(id);
  if (!panel) {
    notify('Panel not found', 'Unable to load the selected panel for editing.', 'error');
    return;
  }

  editingPanelId = id;
  qs('panelName').value = panel.name || '';
  qs('panelDescription').value = panel.description || '';
  qs('panelChannelId').value = panel.channel_id || '';
  qs('panelScriptId').value = panel.script_id || '';
  qs('panelBuyerRoleId').value = panel.buyer_role_id || '';
  qs('panelFreeKeyHours').value = String(panel.free_key_hours ?? 24);
  qs('panelHwidCooldown').value = String(panel.hwid_cooldown ?? 180);
  qs('savePanelButton').textContent = 'Update panel';
  qs('cancelPanelEditButton').classList.remove('hidden');
  updatePanelPreview();
  setView('panels');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetKeyForm() {
  editingKeyValue = null;
  qs('keyPanelId').value = '';
  qs('keyDuration').value = '';
  qs('keyDiscordUserId').value = '';
  qs('keyDiscordUserTag').value = '';
  qs('keyNote').value = '';
  qs('generateKeyButton').textContent = 'Generate key';
  qs('cancelKeyEditButton').classList.add('hidden');
}

function editKey(keyValue) {
  const row = (currentData.keys || []).find((item) => item.key === keyValue);
  if (!row) {
    notify('Key not found', 'Unable to load the selected key for editing.', 'error');
    return;
  }

  editingKeyValue = keyValue;
  qs('keyPanelId').value = row.panel_id || '';
  if (row.expires_at) {
    const remaining = Math.max(0, Math.ceil((new Date(row.expires_at).getTime() - serverTime) / 3600000));
    qs('keyDuration').value = String(remaining);
  } else {
    qs('keyDuration').value = '0';
  }
  qs('keyDiscordUserId').value = row.claimed_by || '';
  qs('keyDiscordUserTag').value = row.claimed_tag || '';
  qs('keyNote').value = row.note || '';
  qs('generateKeyButton').textContent = 'Update key';
  qs('cancelKeyEditButton').classList.remove('hidden');
  setView('keys');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderKeys() {
  const list = qs('keysList');
  const rows = currentData.keys || [];
  qs('keysCount').textContent = `${rows.length} items`;
  if (!rows.length) {
    list.innerHTML = emptyState('No license keys have been created yet.');
    return;
  }

  list.innerHTML = rows.map((row) => {
    const panel = getPanelById(row.panel_id);
    const script = getScriptById(row.script_id);
    const state = isExpired(row.expires_at)
      ? badge('Expired', 'danger')
      : row.claimed_by
        ? badge('Assigned', 'warning')
        : badge('Available', 'success');

    return `
      <article class="resource-card">
        <div class="resource-header">
          <div>
            <div class="resource-title">${escapeHtml(row.key)}</div>
            <div class="resource-meta">${escapeHtml(row.note || 'No note')}</div>
          </div>
          <div class="badge-row">${state}</div>
        </div>

        <div class="meta-list">
          <div class="meta-item"><strong>Script</strong><span>${escapeHtml(script?.name || row.script_id)}</span></div>
          <div class="meta-item"><strong>Panel</strong><span>${escapeHtml(panel?.name || row.panel_id || 'None')}</span></div>
          <div class="meta-item"><strong>Expires</strong><span>${escapeHtml(formatDate(row.expires_at))}</span></div>
          <div class="meta-item"><strong>Assigned To</strong><span>${escapeHtml(row.claimed_tag || 'Unassigned')}</span></div>
          <div class="meta-item"><strong>Locked HWID</strong><span>${escapeHtml(row.hwid || 'Not locked yet')}</span></div>
        </div>

        <div class="action-row">
          <button class="button secondary small" onclick="editKey('${row.key}')">Edit</button>
          <button class="button secondary small" onclick='copyText(${JSON.stringify(row.key)})'>Copy</button>
          <button class="button danger small" onclick="deleteKey('${row.key}')">Delete</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderHwids() {
  const list = qs('hwidList');
  const rows = currentData.bannedHWIDs || [];
  qs('hwidsCount').textContent = `${rows.length} items`;
  if (!rows.length) {
    list.innerHTML = emptyState('No HWIDs are currently blocked.');
    return;
  }

  list.innerHTML = rows.map((row) => `
    <article class="resource-card">
      <div class="resource-header">
        <div>
          <div class="resource-title">${escapeHtml(row.hwid)}</div>
          <div class="resource-meta">${escapeHtml(row.reason || 'No reason provided')}</div>
        </div>
        <div class="badge-row">${badge('Blocked', 'danger')}</div>
      </div>
      <div class="meta-list">
        <div class="meta-item"><strong>Created</strong><span>${escapeHtml(formatDate(row.created_at))}</span></div>
      </div>
      <div class="action-row">
        <button class="button danger small" onclick="unbanHwid('${row.hwid}')">Unban</button>
      </div>
    </article>
  `).join('');
}

function renderApiKeys() {
  if (!currentUser.is_owner) return;
  const list = qs('apiKeysList');
  const rows = apiKeysCache || [];
  qs('apiKeysCount').textContent = `${rows.length} items`;
  if (!rows.length) {
    list.innerHTML = emptyState('No API keys have been generated yet.');
    return;
  }

  list.innerHTML = rows.map((row) => {
    const status = !row.is_active
      ? badge('Revoked', 'danger')
      : isExpired(row.expires_at)
        ? badge('Expired', 'warning')
        : badge('Active', 'success');
    return `
      <article class="resource-card">
        <div class="resource-header">
          <div>
            <div class="resource-title">${escapeHtml(row.key)}</div>
            <div class="resource-meta">${escapeHtml(row.notes || 'No notes')}</div>
          </div>
          <div class="badge-row">${status}</div>
        </div>
        <div class="meta-list">
          <div class="meta-item"><strong>User</strong><span>${escapeHtml(row.owner_username || row.owner_discord || row.owner_id)}</span></div>
          <div class="meta-item"><strong>Limits</strong><span>${escapeHtml(String(row.max_scripts))} scripts / ${escapeHtml(String(row.max_panels))} panels</span></div>
          <div class="meta-item"><strong>Expires</strong><span>${escapeHtml(formatDate(row.expires_at))}</span></div>
          <div class="meta-item"><strong>Last Used</strong><span>${escapeHtml(formatDate(row.last_used_at))}</span></div>
        </div>
        <div class="action-row">
          <button class="button secondary small" onclick='copyText(${JSON.stringify(row.key)})'>Copy</button>
          <button class="button secondary small" onclick='prefillLimitEditor(${JSON.stringify(row.owner_discord || row.owner_id)}, ${Number(row.max_scripts || 0)}, ${Number(row.max_panels || 0)})'>Edit Limits</button>
          ${row.is_active ? `<button class="button danger small" onclick="revokeApiKey('${row.key}')">Revoke</button>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function renderAccessBans() {
  if (!currentUser.is_owner) return;
  const list = qs('accessBansList');
  const rows = currentData.accessBans || [];
  qs('accessBansCount').textContent = `${rows.length} items`;
  if (!rows.length) {
    list.innerHTML = emptyState('No website access bans are active.');
    return;
  }

  list.innerHTML = rows.map((row) => `
    <article class="resource-card">
      <div class="resource-header">
        <div>
          <div class="resource-title">${escapeHtml(row.discord_id || row.user_id || 'Unknown')}</div>
          <div class="resource-meta">${escapeHtml(row.reason || 'Blacklisted from website access')}</div>
        </div>
        <div class="badge-row">${badge('Website Blacklist', 'danger')}</div>
      </div>
      <div class="meta-list">
        <div class="meta-item"><strong>Linked user</strong><span>${escapeHtml(row.user_id || 'Not linked')}</span></div>
        <div class="meta-item"><strong>Created</strong><span>${escapeHtml(formatDate(row.created_at))}</span></div>
      </div>
      <div class="action-row">
        <button class="button danger small" onclick="adminUnbanUser('${row.discord_id || row.user_id}')">Unban user</button>
      </div>
    </article>
  `).join('');
}

function updateSelects() {
  const scripts = currentData.scripts || [];
  const panels = currentData.panels || [];

  const panelSelect = qs('panelScriptId');
  const keyPanelSelect = qs('keyPanelId');

  if (panelSelect) {
    const current = panelSelect.value;
    panelSelect.innerHTML = '<option value="">Select script</option>';
    scripts.forEach((script) => {
      panelSelect.innerHTML += `<option value="${escapeHtml(script.id)}">${escapeHtml(script.name)}</option>`;
    });
    if ([...panelSelect.options].some((option) => option.value === current)) panelSelect.value = current;
  }

  if (keyPanelSelect) {
    const current = keyPanelSelect.value;
    keyPanelSelect.innerHTML = '<option value="">Select panel</option>';
    panels.forEach((panel) => {
      keyPanelSelect.innerHTML += `<option value="${escapeHtml(panel.id)}">${escapeHtml(panel.name)}</option>`;
    });
    if ([...keyPanelSelect.options].some((option) => option.value === current)) keyPanelSelect.value = current;
  }

  const whitelistScriptSelect = qs('whitelistScriptId');
  if (whitelistScriptSelect) {
    const current = whitelistScriptSelect.value;
    whitelistScriptSelect.innerHTML = '<option value="">Select protected script</option>';
    scripts.forEach((script) => {
      whitelistScriptSelect.innerHTML += `<option value="${escapeHtml(script.id)}">${escapeHtml(script.name)}</option>`;
    });
    if ([...whitelistScriptSelect.options].some((option) => option.value === current)) whitelistScriptSelect.value = current;
  }
}

function renderAll() {
  updateSummary();
  renderScripts();
  renderPanels();
  renderKeys();
  renderWhitelist();
  renderHwids();
  updateSelects();
  updatePanelPreview();
  if (currentUser.is_owner) {
    renderApiKeys();
    renderAccessBans();
  }
}

async function loadData({ silent = false } = {}) {
  try {
    const data = await requestJSON('/api/data');
    currentData = data;
    serverTime = data.serverTime || Date.now();
    renderAll();
  } catch (error) {
    if (!silent) notify('Refresh failed', error.message || 'Unable to load dashboard data.', 'error');
  }
}

async function loadApiKeys({ silent = true } = {}) {
  if (!currentUser.is_owner) return;
  try {
    apiKeysCache = await requestJSON('/api/admin/api-keys');
    renderApiKeys();
  } catch (error) {
    if (!silent) notify('API key load failed', error.message || 'Unable to load API keys.', 'error');
  }
}

async function submitScript() {
  const name = qs('scriptName').value.trim();
  const code = qs('scriptCode').value;
  const ffaMode = qs('ffaModeCheck').checked;
  const compressMode = qs('compressModeCheck').checked;
  if (!name || !code.trim()) {
    notify('Missing fields', 'Enter a script name and source code.', 'error');
    return;
  }

  try {
    const isEditing = Boolean(editingScriptId);
    const data = await requestJSON(isEditing ? `/api/scripts/${editingScriptId}` : '/api/create-script', {
      method: isEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, ffaMode, compressMode }),
    });

    const targetId = data.id || editingScriptId;
    resetScriptForm();

    if (compressMode) {
      notify(isEditing ? 'Script updated' : 'Script saved', isEditing ? 'Script updated. HQ99 obfuscation is running now.' : 'Script saved. HQ99 obfuscation is running now.');
      await obfuscateScript(targetId, true);
    } else {
      await loadData({ silent: true });
      notify(isEditing ? 'Script updated' : 'Script saved', isEditing ? 'The script has been updated successfully.' : 'The script has been saved successfully.');
    }
  } catch (error) {
    notify('Save failed', error.message || 'Unable to save script.', 'error');
  }
}

async function obfuscateScript(scriptId, silent = false) {
  try {
    await requestJSON('/api/obfuscate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptId }),
    });
    await loadData({ silent: true });
    if (!silent) notify('HQ99 complete', 'The script was obfuscated successfully.');
    if (silent) notify('HQ99 complete', 'The saved script was auto-obfuscated successfully.');
  } catch (error) {
    notify('Obfuscation failed', error.message || 'Unable to obfuscate this script.', 'error');
    throw error;
  }
}

async function toggleScript(id) {
  try {
    await requestJSON(`/api/scripts/${id}/toggle`, { method: 'PUT' });
    await loadData({ silent: true });
    notify('Script updated', 'Script status updated successfully.');
  } catch (error) {
    notify('Update failed', error.message || 'Unable to update the script.', 'error');
  }
}

async function toggleFfa(id) {
  try {
    await requestJSON(`/api/scripts/${id}/ffa`, { method: 'PUT' });
    await loadData({ silent: true });
    notify('Access updated', 'Access mode updated successfully.');
  } catch (error) {
    notify('Update failed', error.message || 'Unable to update access mode.', 'error');
  }
}

async function deleteScript(id) {
  if (!confirm('Delete this script and all related keys and panels?')) return;
  try {
    await requestJSON('/api/delete-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadData({ silent: true });
    notify('Script deleted', 'The script and related records were removed.');
  } catch (error) {
    notify('Delete failed', error.message || 'Unable to delete the script.', 'error');
  }
}

async function submitPanel() {
  const name = qs('panelName').value.trim();
  const description = qs('panelDescription').value.trim();
  const channelId = qs('panelChannelId').value.trim();
  const scriptId = qs('panelScriptId').value;
  const buyerRoleId = qs('panelBuyerRoleId').value.trim();
  const freeKeyHours = Number(qs('panelFreeKeyHours').value) || 24;
  const hwidCooldown = Number(qs('panelHwidCooldown').value) || 180;

  if (!name || !channelId || !scriptId) {
    notify('Missing fields', 'Enter a panel name, channel ID, and script.', 'error');
    return;
  }

  try {
    const isEditing = Boolean(editingPanelId);
    await requestJSON(isEditing ? `/api/panels/${editingPanelId}` : '/api/create-panel', {
      method: isEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, channelId, scriptId, buyerRoleId, freeKeyHours, hwidCooldown }),
    });

    resetPanelForm();
    await loadData({ silent: true });
    notify(isEditing ? 'Panel updated' : 'Panel created', isEditing ? 'Discord panel configuration updated.' : 'Discord panel configuration saved.');
  } catch (error) {
    notify('Create failed', error.message || 'Unable to create the panel.', 'error');
  }
}

async function sendPanel(id) {
  try {
    await requestJSON('/api/send-panel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelId: id }),
    });
    notify('Panel sent', 'The panel message was sent to Discord successfully.');
  } catch (error) {
    notify('Send failed', error.message || 'Unable to send the panel.', 'error');
  }
}

async function deletePanel(id) {
  if (!confirm('Delete this panel and its keys?')) return;
  try {
    await requestJSON('/api/delete-panel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadData({ silent: true });
    notify('Panel deleted', 'Panel removed successfully.');
  } catch (error) {
    notify('Delete failed', error.message || 'Unable to delete the panel.', 'error');
  }
}

async function generateKey() {
  const panelId = qs('keyPanelId').value;
  const durationHours = Number(qs('keyDuration').value) || 0;
  const note = qs('keyNote').value.trim();
  const discordUserId = qs('keyDiscordUserId').value.trim();
  const discordTag = qs('keyDiscordUserTag').value.trim();

  if (!panelId) {
    notify('Panel required', 'Select a panel before generating a key.', 'error');
    return;
  }

  try {
    const isEditing = Boolean(editingKeyValue);
    const data = await requestJSON(isEditing ? `/api/keys/${encodeURIComponent(editingKeyValue)}` : '/api/generate-key', {
      method: isEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelId, durationHours, note, discordUserId, discordTag }),
    });

    resetKeyForm();
    await loadData({ silent: true });
    notify(isEditing ? 'Key updated' : 'Key generated', isEditing ? `Key ${data.key} updated successfully.` : `New key created: ${data.key}`);
  } catch (error) {
    notify(isEditing ? 'Update failed' : 'Generate failed', error.message || 'Unable to save the key.', 'error');
  }
}

async function deleteKey(key) {
  if (!confirm('Delete this key?')) return;
  try {
    await requestJSON('/api/delete-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (editingKeyValue === key) resetKeyForm();
    await loadData({ silent: true });
    notify('Key deleted', 'The key was deleted successfully.');
  } catch (error) {
    notify('Delete failed', error.message || 'Unable to delete the key.', 'error');
  }
}

async function banHwid() {
  const hwid = qs('banHwidInput').value.trim();
  const reason = qs('banReason').value.trim();
  if (!hwid) {
    notify('HWID required', 'Enter an HWID before saving.', 'error');
    return;
  }

  try {
    await requestJSON('/api/ban-hwid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hwid, reason }),
    });
    qs('banHwidInput').value = '';
    qs('banReason').value = '';
    await loadData({ silent: true });
    notify('HWID banned', 'HWID added to the blocked list.');
  } catch (error) {
    notify('Ban failed', error.message || 'Unable to block the HWID.', 'error');
  }
}

async function unbanHwid(hwid) {
  if (!confirm('Remove this HWID from the blocked list?')) return;
  try {
    await requestJSON('/api/unban-hwid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hwid }),
    });
    await loadData({ silent: true });
    notify('HWID removed', 'HWID removed from the blocked list.');
  } catch (error) {
    notify('Unban failed', error.message || 'Unable to remove the HWID.', 'error');
  }
}

async function adminGenerateKey() {
  const userId = qs('adminUserId').value.trim();
  const expiresInDays = Number(qs('adminExpiresDays').value) || 0;
  const notes = qs('adminNotes').value.trim();
  const maxScripts = Number(qs('adminMaxScripts').value) || defaults.maxScripts;
  const maxPanels = Number(qs('adminMaxPanels').value) || defaults.maxPanels;
  if (!userId) {
    notify('User required', 'Enter a user or Discord ID.', 'error');
    return;
  }

  try {
    const data = await requestJSON('/api/admin/generate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, expiresInDays, notes, maxScripts, maxPanels }),
    });
    ['adminUserId', 'adminExpiresDays', 'adminNotes'].forEach((id) => { qs(id).value = ''; });
    await Promise.all([loadData({ silent: true }), loadApiKeys({ silent: true })]);
    notify('API key generated', `New API key created: ${data.apiKey}`);
  } catch (error) {
    notify('Generate failed', error.message || 'Unable to generate the API key.', 'error');
  }
}

function prefillLimitEditor(userId, maxScripts, maxPanels) {
  qs('limitUserId').value = userId || '';
  qs('limitMaxScripts').value = Number.isFinite(maxScripts) ? String(maxScripts) : String(defaults.maxScripts);
  qs('limitMaxPanels').value = Number.isFinite(maxPanels) ? String(maxPanels) : String(defaults.maxPanels);
  setView('admin');
  notify('Limit editor ready', 'Selected user loaded into the limit editor.');
}

async function adminUpdateLimits() {
  const userId = qs('limitUserId').value.trim();
  const maxScripts = Number(qs('limitMaxScripts').value);
  const maxPanels = Number(qs('limitMaxPanels').value);
  if (!userId) {
    notify('User required', 'Enter a user ID or Discord ID to update limits.', 'error');
    return;
  }

  try {
    const data = await requestJSON('/api/admin/set-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, maxScripts, maxPanels }),
    });
    await Promise.all([loadData({ silent: true }), loadApiKeys({ silent: true })]);
    notify('Limits updated', `${data.user.username || data.user.discord_id} now has ${data.user.maxScripts} script slots and ${data.user.maxPanels} panel slots.`);
  } catch (error) {
    notify('Update failed', error.message || 'Unable to update limits.', 'error');
  }
}

async function adminBanUser() {
  const discordId = qs('banDiscordId').value.trim();
  const reason = qs('banDiscordReason').value.trim();
  if (!discordId) {
    notify('Discord ID required', 'Enter the Discord ID you want to blacklist.', 'error');
    return;
  }

  try {
    await requestJSON('/api/admin/ban-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId, reason }),
    });
    qs('banDiscordId').value = '';
    qs('banDiscordReason').value = '';
    await loadData({ silent: true });
    notify('User blacklisted', 'This Discord ID can no longer log into the website until unbanned.');
  } catch (error) {
    notify('Blacklist failed', error.message || 'Unable to blacklist this Discord ID.', 'error');
  }
}

async function adminUnbanUser(discordId) {
  if (!confirm('Unban this Discord ID from website access?')) return;
  try {
    await requestJSON('/api/admin/unban-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId }),
    });
    await loadData({ silent: true });
    notify('User unbanned', 'Website access restored for that Discord ID.');
  } catch (error) {
    notify('Unban failed', error.message || 'Unable to unban this Discord ID.', 'error');
  }
}

async function revokeApiKey(key) {
  if (!confirm('Revoke this API key?')) return;
  try {
    await requestJSON('/api/admin/revoke-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    await loadApiKeys({ silent: true });
    notify('API key revoked', 'The API key was revoked successfully.');
  } catch (error) {
    notify('Revoke failed', error.message || 'Unable to revoke the API key.', 'error');
  }
}

function syncEditor() {
  const textarea = qs('scriptCode');
  const linesEl = qs('editorLineNumbers');
  const lines = Math.max(1, textarea.value.split('\n').length);
  linesEl.textContent = Array.from({ length: lines }, (_, index) => index + 1).join('\n');
  linesEl.scrollTop = textarea.scrollTop;
  qs('editorLines').textContent = `${lines} lines`;
  qs('editorChars').textContent = `${textarea.value.length} chars`;
}

function readScriptFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    qs('scriptCode').value = String(reader.result || '');
    if (!qs('scriptName').value.trim()) {
      qs('scriptName').value = file.name.replace(/\.[^.]+$/, '');
    }
    qs('editorFileLabel').textContent = file.name;
    syncEditor();
    notify('File loaded', `${file.name} is ready to save.`);
  };
  reader.onerror = () => notify('File read failed', 'Unable to read the selected file.', 'error');
  reader.readAsText(file);
}

function attachEditor() {
  const textarea = qs('scriptCode');
  const dropZone = qs('editorDropZone');
  const fileInput = qs('scriptFileInput');

  ['input', 'scroll'].forEach((eventName) => {
    textarea.addEventListener(eventName, syncEditor);
  });

  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = `${textarea.value.slice(0, start)}  ${textarea.value.slice(end)}`;
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      syncEditor();
    }
  });

  qs('uploadScriptFileButton')?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', (event) => readScriptFile(event.target.files?.[0]));

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('editor-drop', 'active');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('active');
    });
  });

  dropZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) readScriptFile(file);
  });

  syncEditor();
}

function attachEvents() {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      setView(button.dataset.view);
      qs('sidebar')?.classList.remove('mobile-open');
    });
  });

  qs('mobileMenuButton')?.addEventListener('click', () => {
    qs('sidebar')?.classList.toggle('mobile-open');
  });
  qs('refreshButton')?.addEventListener('click', async () => {
    await loadData({ silent: false });
    if (currentView === 'admin') await loadApiKeys({ silent: false });
    notify('Dashboard refreshed', 'Latest data loaded successfully.');
  });

  qs('saveScriptButton')?.addEventListener('click', submitScript);
  qs('cancelScriptEditButton')?.addEventListener('click', resetScriptForm);
  qs('savePanelButton')?.addEventListener('click', submitPanel);
  qs('cancelPanelEditButton')?.addEventListener('click', resetPanelForm);
  qs('generateKeyButton')?.addEventListener('click', generateKey);
  qs('cancelKeyEditButton')?.addEventListener('click', resetKeyForm);
  qs('addWhitelistButton')?.addEventListener('click', addWhitelist);
  qs('banHwidButton')?.addEventListener('click', banHwid);
  qs('adminGenerateKeyButton')?.addEventListener('click', adminGenerateKey);
  qs('adminUpdateLimitsButton')?.addEventListener('click', adminUpdateLimits);
  qs('adminBanUserButton')?.addEventListener('click', adminBanUser);

  ['panelName', 'panelDescription', 'panelScriptId', 'panelBuyerRoleId', 'panelFreeKeyHours', 'panelHwidCooldown'].forEach((id) => {
    qs(id)?.addEventListener('input', updatePanelPreview);
    qs(id)?.addEventListener('change', updatePanelPreview);
  });
}

window.submitScript = submitScript;
window.editScript = editScript;
window.obfuscateScript = obfuscateScript;
window.toggleScript = toggleScript;
window.toggleFfa = toggleFfa;
window.deleteScript = deleteScript;
window.submitPanel = submitPanel;
window.editPanel = editPanel;
window.sendPanel = sendPanel;
window.deletePanel = deletePanel;
window.generateKey = generateKey;
window.editKey = editKey;
window.deleteKey = deleteKey;
window.addWhitelist = addWhitelist;
window.removeWhitelist = removeWhitelist;
window.banHwid = banHwid;
window.unbanHwid = unbanHwid;
window.adminGenerateKey = adminGenerateKey;
window.prefillLimitEditor = prefillLimitEditor;
window.adminUpdateLimits = adminUpdateLimits;
window.adminBanUser = adminBanUser;
window.adminUnbanUser = adminUnbanUser;
window.revokeApiKey = revokeApiKey;
window.copyText = copyText;

attachEvents();
attachEditor();
setPageMeta('overview');
loadData({ silent: true });
if (currentUser.is_owner) loadApiKeys({ silent: true });

window.addEventListener('focus', () => {
  loadData({ silent: true });
  if (currentView === 'admin') loadApiKeys({ silent: true });
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadData({ silent: true });
    if (currentView === 'admin') loadApiKeys({ silent: true });
  }
});

setInterval(() => {
  loadData({ silent: true });
  if (currentView === 'admin') loadApiKeys({ silent: true });
}, 20000);

*/});

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
  if (!req.session.user) {
    if (wantsJson(req)) return res.status(401).json({ error: 'Unauthorized' });
    return res.redirect('/');
  }

  const banReason = assertNotAccessBanned(req.session.user.discord_id, req.session.user.id);
  if (banReason) {
    req.session.destroy(() => {});
    if (wantsJson(req)) return res.status(403).json({ error: banReason });
    return res.status(403).send(banReason);
  }

  return next();
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

function getScriptById(scriptId) {
  return db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);
}

function getOwnedScriptForDiscord(scriptRef, discordId) {
  const owner = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
  if (!owner) return { owner: null, script: null };

  const reference = String(scriptRef || '').trim();
  if (!reference) return { owner, script: null };

  const script = db.prepare(
    `SELECT * FROM scripts
     WHERE user_id = ?
       AND (id = ? OR public_id = ? OR lower(name) = lower(?))
     ORDER BY CASE WHEN id = ? THEN 0 WHEN public_id = ? THEN 1 ELSE 2 END
     LIMIT 1`
  ).get(owner.id, reference, reference, reference, reference, reference);

  return { owner, script: script || null };
}

function getScriptByPublicId(publicId) {
  return db.prepare('SELECT * FROM scripts WHERE public_id = ?').get(publicId);
}

function getPanelById(panelId) {
  return db.prepare('SELECT * FROM panels WHERE id = ?').get(panelId);
}

function buildHostedLoaderUrl(publicId) {
  return `${publicBaseUrl()}/scripts/hosted/${publicId}.lua`;
}

function buildRawScriptUrl(publicId) {
  return `${publicBaseUrl()}/scripts/raw/${publicId}.lua`;
}

function buildLoaderSnippet(script) {
  if (!script.public_id) {
    db.prepare('UPDATE scripts SET public_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(makePublicId(), script.id);
    script = getScriptById(script.id);
  }

  if (script.ffa_mode) {
    return `loadstring(game:HttpGet("${buildHostedLoaderUrl(script.public_id)}"))()`;
  }

  return [
    'script_key = "YOUR_KEY_HERE"',
    '',
    `loadstring(game:HttpGet("${buildHostedLoaderUrl(script.public_id)}"))()`,
  ].join('\n');
}

function createLicenseKeyRecord({ scriptId, panelId = null, userId, note = '', expiresAt = null, claimedBy = null, claimedTag = null }) {
  const id = makeId('key');
  const key = generateLicenseKey();
  db.prepare(
    `INSERT INTO license_keys (id, script_id, panel_id, user_id, key, note, expires_at, claimed_by, claimed_tag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, scriptId, panelId, userId, key, note, expiresAt, claimedBy, claimedTag);
  return db.prepare('SELECT * FROM license_keys WHERE id = ?').get(id);
}

function getLatestActiveClaimedKey(scriptId, discordUserId) {
  const rows = db.prepare(
    `SELECT * FROM license_keys
     WHERE script_id = ? AND claimed_by = ?
     ORDER BY created_at DESC`
  ).all(scriptId, discordUserId);
  return rows.find((row) => !isExpired(row.expires_at)) || null;
}

function isScriptBlacklisted(scriptId, discordUserId) {
  if (!scriptId || !discordUserId) return false;
  return Boolean(
    db.prepare(
      'SELECT id FROM script_blacklist WHERE script_id = ? AND discord_user_id = ?'
    ).get(scriptId, discordUserId)
  );
}

function ensureWhitelistAccess({ ownerUserId, scriptId, discordUserId, discordTag, expiresAt = null }) {
  if (isScriptBlacklisted(scriptId, discordUserId)) {
    throw new Error('This Discord user is blacklisted from the script.');
  }

  let whitelist = db.prepare(
    'SELECT * FROM script_whitelist WHERE script_id = ? AND discord_user_id = ?'
  ).get(scriptId, discordUserId);

  if (whitelist?.granted_key) {
    const existingKey = db.prepare('SELECT * FROM license_keys WHERE key = ?').get(whitelist.granted_key);
    if (existingKey && !isExpired(existingKey.expires_at)) {
      if (expiresAt !== null) {
        db.prepare('UPDATE license_keys SET expires_at = ? WHERE key = ?').run(expiresAt, existingKey.key);
        db.prepare('UPDATE script_whitelist SET expires_at = ? WHERE id = ?').run(expiresAt, whitelist.id);
      } else {
        db.prepare('UPDATE script_whitelist SET expires_at = NULL WHERE id = ?').run(whitelist.id);
      }
      if (!existingKey.claimed_by) {
        db.prepare('UPDATE license_keys SET claimed_by = ?, claimed_tag = ? WHERE key = ?').run(discordUserId, discordTag, existingKey.key);
      }
      return db.prepare('SELECT * FROM license_keys WHERE key = ?').get(existingKey.key);
    }
  }

  const newKey = createLicenseKeyRecord({
    scriptId,
    userId: ownerUserId,
    note: `Whitelist for ${discordTag}`,
    expiresAt,
    claimedBy: discordUserId,
    claimedTag: discordTag,
  });

  if (whitelist) {
    db.prepare(
      'UPDATE script_whitelist SET discord_tag = ?, granted_key = ?, expires_at = ? WHERE id = ?'
    ).run(discordTag, newKey.key, expiresAt, whitelist.id);
  } else {
    db.prepare(
      `INSERT INTO script_whitelist (id, script_id, owner_user_id, discord_user_id, discord_tag, granted_key, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(makeId('wl'), scriptId, ownerUserId, discordUserId, discordTag, newKey.key, expiresAt);
  }

  return newKey;
}

function canDiscordUserAccessScript(scriptId, discordUserId) {
  if (!discordUserId) return false;
  if (isScriptBlacklisted(scriptId, discordUserId)) return false;
  const key = getLatestActiveClaimedKey(scriptId, discordUserId);
  if (key) return true;
  const whitelist = db.prepare(
    'SELECT * FROM script_whitelist WHERE script_id = ? AND discord_user_id = ?'
  ).get(scriptId, discordUserId);
  return Boolean(whitelist && !isExpired(whitelist.expires_at));
}

function buildPanelEmbed(panel, script) {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🔷 ${panel.name}`)
    .setDescription(panel.description || 'yo')
    .addFields(
      { name: '📜 Script', value: script.name, inline: true },
      { name: '📊 Status', value: script.status === 'active' ? 'Active' : 'Disabled', inline: true },
      { name: '🧩 Version', value: script.version || '1.0.0', inline: true }
    )
    .setFooter({ text: 'LuaObfuscationHub | v5' });
}

function buildPanelComponents(panel) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`panelview_${panel.id}`).setLabel('📜 View Script').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`panelredeem_${panel.id}`).setLabel('🔑 Redeem Key').setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`panelkeyinfo_${panel.id}`).setLabel('📊 Key Info').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`panelbuyerrole_${panel.id}`).setLabel('👤 Get Buyer Role').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`panelfreekey_${panel.id}`).setLabel('🔗 Free Key').setStyle(ButtonStyle.Secondary)
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`panelresethwid_${panel.id}`).setLabel('⚙️ Reset HWID').setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3, row4];
}

function buildMobileViewButton(customId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(customId).setLabel('Mobile View').setStyle(ButtonStyle.Secondary)
  );
}

async function obfuscateWithHq99(code) {
  ensureUploadsDir();
  const tempFile = path.join(UPLOADS_DIR, `temp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.lua`);
  fs.writeFileSync(tempFile, code, 'utf8');

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(tempFile));
    form.append('preset', 'Default');
    form.append('roblox', 'true');
    form.append('anti_env_logger', 'true');

    const response = await fetch(HQ99_OBF_API_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': HQ99_OBF_API_KEY,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'HQ99 obfuscation request failed');
    }

    return await response.text();
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
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
  const banReason = assertNotAccessBanned(user.discord_id, user.id);
  if (banReason) return res.status(403).json({ error: banReason });

  req.apiUser = user;
  req.apiKey = keyRecord;
  return next();
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

    const banReason = assertNotAccessBanned(oauthUser.id);
    if (banReason) {
      return res.status(403).send(banReason);
    }

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

app.get('/api/admin/access-bans', requireOwner, (req, res) => {
  const rows = db.prepare(
    `SELECT ab.*, u.username AS user_username, u.discord_id AS linked_discord_id
     FROM access_bans ab
     LEFT JOIN users u ON ab.user_id = u.id
     ORDER BY ab.created_at DESC`
  ).all();
  res.json(rows);
});

app.post('/api/admin/ban-user', requireOwner, (req, res) => {
  const discordId = String(req.body.discordId || '').trim();
  const reason = String(req.body.reason || '').trim();
  if (!discordId) return res.status(400).json({ error: 'Discord ID required' });

  const linkedUser = db.prepare('SELECT * FROM users WHERE discord_id = ? OR id = ?').get(discordId, discordId);
  const existing = getAccessBan(discordId, linkedUser?.id || null);
  if (existing) return res.json({ success: true, alreadyBanned: true });

  db.prepare(
    `INSERT INTO access_bans (id, discord_id, user_id, reason, banned_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(makeId('ban'), linkedUser?.discord_id || discordId, linkedUser?.id || null, reason || 'Blacklisted from website access', req.session.user.id);

  res.json({ success: true });
});

app.post('/api/admin/unban-user', requireOwner, (req, res) => {
  const discordId = String(req.body.discordId || '').trim();
  if (!discordId) return res.status(400).json({ error: 'Discord ID required' });
  db.prepare('DELETE FROM access_bans WHERE discord_id = ?').run(discordId);
  const linkedUser = db.prepare('SELECT * FROM users WHERE discord_id = ? OR id = ?').get(discordId, discordId);
  if (linkedUser) {
    db.prepare('DELETE FROM access_bans WHERE user_id = ?').run(linkedUser.id);
  }
  res.json({ success: true });
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

  const banReason = assertNotAccessBanned(user.discord_id, user.id);
  if (banReason) return res.status(403).json({ error: banReason });

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
  const ffaMode = Boolean(req.body.ffaMode);
  const compressMode = Boolean(req.body.compressMode);

  if (!name || !code.trim()) {
    return res.status(400).json({ error: 'Missing name or code' });
  }

  const id = makeId('script');
  const publicId = makePublicId();
  db.prepare(
    `INSERT INTO scripts (id, user_id, name, code, obfuscated_code, public_id, obfuscator, ffa_mode, compress_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, user.id, name, code, null, publicId, 'hq99', ffaMode ? 1 : 0, compressMode ? 1 : 0);

  res.json({
    success: true,
    id,
    remaining: getRemainingLimits(user.id),
  });
});

app.put('/api/scripts/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const { id } = req.params;
  const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(id, user.id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  const name = String(req.body.name || '').trim();
  const code = String(req.body.code || '');
  const ffaMode = Boolean(req.body.ffaMode);
  const compressMode = Boolean(req.body.compressMode);

  if (!name || !code.trim()) {
    return res.status(400).json({ error: 'Missing name or code' });
  }

  const codeChanged = code !== (script.code || '');
  const nextObfuscatedCode = compressMode ? (codeChanged ? null : script.obfuscated_code) : null;

  db.prepare(
    `UPDATE scripts
     SET name = ?, code = ?, obfuscated_code = ?, obfuscator = 'hq99', ffa_mode = ?, compress_mode = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(name, code, nextObfuscatedCode, ffaMode ? 1 : 0, compressMode ? 1 : 0, id);

  res.json({
    success: true,
    id,
    codeChanged,
  });
});

app.post('/api/obfuscate-script', requireAuth, async (req, res) => {
  const { scriptId } = req.body;
  if (!scriptId) return res.status(400).json({ error: 'Script ID required' });

  const user = req.session.user;
  const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(scriptId, user.id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  try {
    const obfuscatedCode = await obfuscateWithHq99(script.code || '');
    db.prepare(
      `UPDATE scripts
       SET obfuscated_code = ?, obfuscator = 'hq99', compress_mode = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(obfuscatedCode, scriptId);
    res.json({ success: true, obfuscatedCode });
  } catch (error) {
    res.status(500).json({ error: `HQ99 obfuscation failed: ${error.message}` });
  }
});

app.post('/api/delete-script', requireAuth, (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Script ID required' });

  db.prepare('DELETE FROM scripts WHERE id = ? AND user_id = ?').run(id, req.session.user.id);
  db.prepare('DELETE FROM panels WHERE script_id = ? AND user_id = ?').run(id, req.session.user.id);
  db.prepare('DELETE FROM license_keys WHERE script_id = ? AND user_id = ?').run(id, req.session.user.id);
  db.prepare('DELETE FROM script_whitelist WHERE script_id = ? AND owner_user_id = ?').run(id, req.session.user.id);

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
  const buyerRoleId = String(req.body.buyerRoleId || '').trim();
  const freeKeyHours = Math.max(0, Number(req.body.freeKeyHours) || 24);
  const hwidCooldown = Math.max(0, Number(req.body.hwidCooldown) || 180);

  if (!name || !channelId || !scriptId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(scriptId, user.id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  const id = makeId('panel');
  db.prepare(
    `INSERT INTO panels (id, user_id, name, description, channel_id, script_id, buyer_role_id, free_key_hours, hwid_cooldown)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, user.id, name, description, channelId, scriptId, buyerRoleId, freeKeyHours, hwidCooldown);

  res.json({ success: true, id, remaining: getRemainingLimits(user.id) });
});

app.put('/api/panels/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const { id } = req.params;
  const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(id, user.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const channelId = String(req.body.channelId || '').trim();
  const scriptId = String(req.body.scriptId || '').trim();
  const buyerRoleId = String(req.body.buyerRoleId || '').trim();
  const freeKeyHours = Math.max(0, Number(req.body.freeKeyHours) || 24);
  const hwidCooldown = Math.max(0, Number(req.body.hwidCooldown) || 180);

  if (!name || !channelId || !scriptId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(scriptId, user.id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  db.prepare(
    `UPDATE panels
     SET name = ?, description = ?, channel_id = ?, script_id = ?, buyer_role_id = ?, free_key_hours = ?, hwid_cooldown = ?
     WHERE id = ? AND user_id = ?`
  ).run(name, description, channelId, scriptId, buyerRoleId, freeKeyHours, hwidCooldown, id, user.id);

  res.json({ success: true, id });
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

    const embed = buildPanelEmbed(panel, script);
    await channel.send({ embeds: [embed], components: buildPanelComponents(panel) });
    res.json({ success: true });
  } catch (error) {
    console.error('Send panel error:', error);
    res.status(500).json({ error: 'Failed to send panel' });
  }
});

app.post('/api/generate-key', requireAuth, (req, res) => {
  const { panelId, durationHours, note, discordUserId, discordTag } = req.body;
  if (!panelId) return res.status(400).json({ error: 'Panel ID required' });

  const user = req.session.user;
  const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const expiresAt = Number(durationHours) > 0
    ? new Date(Date.now() + Number(durationHours) * 3600000).toISOString()
    : null;

  const row = createLicenseKeyRecord({
    scriptId: panel.script_id,
    panelId: panel.id,
    userId: user.id,
    note: note || '',
    expiresAt,
    claimedBy: discordUserId || null,
    claimedTag: discordTag || null,
  });

  res.json({ success: true, key: row.key, expiresAt, claimedBy: row.claimed_by || null });
});

app.put('/api/keys/:key', requireAuth, (req, res) => {
  const user = req.session.user;
  const keyValue = String(req.params.key || '').trim();
  const keyRecord = db.prepare('SELECT * FROM license_keys WHERE key = ? AND user_id = ?').get(keyValue, user.id);
  if (!keyRecord) return res.status(404).json({ error: 'Key not found' });

  const panelId = String(req.body.panelId || '').trim();
  const durationHours = Number(req.body.durationHours) || 0;
  const note = String(req.body.note || '').trim();
  const discordUserId = String(req.body.discordUserId || '').trim();
  const discordTag = String(req.body.discordTag || '').trim();
  if (!panelId) return res.status(400).json({ error: 'Panel ID required' });

  const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const expiresAt = durationHours > 0
    ? new Date(Date.now() + durationHours * 3600000).toISOString()
    : null;

  db.prepare(
    `UPDATE license_keys
     SET script_id = ?, panel_id = ?, note = ?, expires_at = ?, claimed_by = ?, claimed_tag = ?, last_used_at = ?
     WHERE key = ? AND user_id = ?`
  ).run(panel.script_id, panel.id, note, expiresAt, discordUserId || null, discordTag || null, keyRecord.last_used_at || null, keyValue, user.id);

  res.json({ success: true, key: keyValue, expiresAt });
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

app.post('/api/whitelist', requireAuth, (req, res) => {
  const user = req.session.user;
  const scriptId = String(req.body.scriptId || '').trim();
  const discordUserId = String(req.body.discordUserId || '').trim();
  const discordTag = String(req.body.discordTag || '').trim();

  if (!scriptId || !discordUserId) {
    return res.status(400).json({ error: 'Script and Discord user ID are required' });
  }

  const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(scriptId, user.id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  const row = ensureWhitelistAccess({
    ownerUserId: user.id,
    scriptId,
    discordUserId,
    discordTag: discordTag || discordUserId,
  });

  res.json({
    success: true,
    key: row.key,
    discordTag: discordTag || discordUserId,
  });
});

app.post('/api/remove-whitelist', requireAuth, (req, res) => {
  const id = String(req.body.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Whitelist entry ID required' });

  const entry = db.prepare(
    'SELECT granted_key FROM script_whitelist WHERE id = ? AND owner_user_id = ?'
  ).get(id, req.session.user.id);
  if (!entry) return res.status(404).json({ error: 'Whitelist entry not found' });

  const remove = db.transaction(() => {
    if (entry.granted_key) {
      db.prepare('DELETE FROM license_keys WHERE key = ? AND user_id = ?').run(
        entry.granted_key,
        req.session.user.id
      );
    }
    return db.prepare(
      'DELETE FROM script_whitelist WHERE id = ? AND owner_user_id = ?'
    ).run(id, req.session.user.id);
  });
  const result = remove();

  if (!result.changes) return res.status(404).json({ error: 'Whitelist entry not found' });
  res.json({ success: true });
});

app.get('/api/data', requireAuth, (req, res) => {
  const user = req.session.user;
  const scripts = db.prepare('SELECT * FROM scripts WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  const panels = db.prepare('SELECT * FROM panels WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  const keys = db.prepare('SELECT * FROM license_keys WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  const whitelist = db.prepare(
    `SELECT script_whitelist.*, scripts.name AS script_name
     FROM script_whitelist
     JOIN scripts ON scripts.id = script_whitelist.script_id
     WHERE script_whitelist.owner_user_id = ?
     ORDER BY script_whitelist.created_at DESC`
  ).all(user.id);
  const bannedHWIDs = user.is_owner
    ? db.prepare('SELECT * FROM banned_hwids ORDER BY created_at DESC').all()
    : db.prepare('SELECT * FROM banned_hwids WHERE banned_by = ? ORDER BY created_at DESC').all(user.id);
  const accessBans = user.is_owner
    ? db.prepare('SELECT * FROM access_bans ORDER BY created_at DESC').all()
    : [];
  const limits = getRemainingLimits(user.id);

  res.json({
    scripts,
    panels,
    keys,
    whitelist,
    bannedHWIDs,
    accessBans,
    limits,
    serverTime: Date.now(),
  });
});

function sendScriptContent(script, key, hwid, res) {
  if (!script) return res.status(404).type('text/plain').send('-- Script not found');
  if (script.status === 'disabled') return res.status(403).type('text/plain').send('-- Script disabled');

  if (script.ffa_mode) {
    return res.type('text/plain').send(script.obfuscated_code || script.code || '-- Empty');
  }

  if (!key) return res.status(403).type('text/plain').send('-- Missing key');

  const keyRecord = db.prepare('SELECT * FROM license_keys WHERE key = ? AND script_id = ?').get(key, script.id);
  if (!keyRecord) return res.status(403).type('text/plain').send('-- Invalid key');
  if (isExpired(keyRecord.expires_at)) return res.status(403).type('text/plain').send('-- Key expired');
  if (keyRecord.claimed_by && isScriptBlacklisted(script.id, keyRecord.claimed_by)) {
    return res.status(403).type('text/plain').send('-- User blacklisted');
  }

  if (hwid) {
    const banned = db.prepare('SELECT * FROM banned_hwids WHERE hwid = ?').get(hwid);
    if (banned) return res.status(403).type('text/plain').send('-- HWID banned');
  }

  if (hwid && keyRecord.hwid && keyRecord.hwid !== hwid) {
    return res.status(403).type('text/plain').send('-- HWID mismatch');
  }

  if (hwid && !keyRecord.hwid) {
    db.prepare('UPDATE license_keys SET hwid = ?, last_used_at = CURRENT_TIMESTAMP WHERE key = ?').run(hwid, keyRecord.key);
  } else {
    db.prepare('UPDATE license_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?').run(keyRecord.key);
  }

  return res.type('text/plain').send(script.obfuscated_code || script.code || '-- Empty');
}

function buildHostedLoaderSource(script) {
  const rawUrl = buildRawScriptUrl(script.public_id);
  if (script.ffa_mode) {
    return `loadstring(game:HttpGet("${rawUrl}"))()`;
  }

  return [
    'local env = _G',
    'if getgenv then env = getgenv() end',
    'local key = env.script_key',
    'assert(key and tostring(key) ~= "", "Missing script_key")',
    'local HttpService = game:GetService("HttpService")',
    'local hwid = HttpService:GenerateGUID(false)',
    `loadstring(game:HttpGet("${rawUrl}?key=" .. tostring(key) .. "&hwid=" .. hwid))()`,
  ].join('\n');
}

app.get('/scripts/raw/:publicId.lua', (req, res) => {
  const { publicId } = req.params;
  const { key, hwid } = req.query;
  const script = getScriptByPublicId(publicId);
  return sendScriptContent(script, key, hwid, res);
});

app.get('/scripts/hosted/:publicId.lua', (req, res) => {
  const { publicId } = req.params;
  const script = getScriptByPublicId(publicId);
  if (!script) return res.status(404).type('text/plain').send('-- Script not found');
  if (script.status === 'disabled') return res.status(403).type('text/plain').send('-- Script disabled');
  return res.type('text/plain').send(buildHostedLoaderSource(script));
});

app.get('/script/:scriptId', (req, res) => {
  const { scriptId } = req.params;
  const { key, hwid } = req.query;
  return sendScriptContent(getScriptById(scriptId), key, hwid, res);
});

app.get('/loader/:scriptId', (req, res) => {
  const { scriptId } = req.params;
  const script = getScriptById(scriptId);
  if (!script) return res.status(404).type('text/plain').send('-- Script not found');
  if (!script.public_id) {
    db.prepare('UPDATE scripts SET public_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(makePublicId(), script.id);
  }
  const freshScript = getScriptById(scriptId);
  return res.type('text/plain').send(buildHostedLoaderSource(freshScript));
});

function pageShell({ title, body, appData = null, inlineScript = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${INLINE_APP_CSS}</style>
</head>
<body>
  ${body}
  ${appData ? `<script>window.__APP__ = ${safeSerialize(appData)};</script>` : ''}
  ${inlineScript ? `<script>${inlineScript}</script>` : ''}
</body>
</html>`;
}

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');

  const body = `
    <div class="site-bg"></div>
    <main class="auth-layout">
      <section class="auth-card panel">
        <div class="brand-block">
          <div class="brand-mark">L</div>
          <div>
            <p class="eyebrow">LuaObfuscationHub</p>
            <h1 class="hero-title">Modern script hosting with a cleaner workflow</h1>
            <p class="hero-subtitle">Manage scripts, panels, buyer roles, loadstrings, HWID access, and website controls from a single dashboard.</p>
          </div>
        </div>

        <div class="auth-grid">
          <div class="auth-panel stack-lg">
            <div class="field">
              <label for="apiKeyInput">API key</label>
              <input id="apiKeyInput" type="text" placeholder="Enter your API key" autocomplete="off" />
            </div>
            <button id="apiLoginButton" class="button primary full-width">Login with API key</button>
            <div class="divider"><span>or</span></div>
            <a class="button secondary full-width" href="/auth/discord">Continue with Discord</a>
            <p class="helper-text">Need access? Request an API key from the server owner.</p>
          </div>

          <aside class="feature-panel stack">
            <div class="feature-title">Included</div>
            <div class="feature-list">
              <div class="feature-item">
                <div class="feature-title">Hosted loader paths</div>
                <div class="helper-text">Key-based loadstrings with hosted file paths and working FFA mode support.</div>
              </div>
              <div class="feature-item">
                <div class="feature-title">Discord access panels</div>
                <div class="helper-text">Panels with key redemption, buyer role, free key, and HWID reset buttons.</div>
              </div>
              <div class="feature-item">
                <div class="feature-title">Better mobile layout</div>
                <div class="helper-text">Responsive workspace cards, sidebar navigation, and a script editor designed for phones.</div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>`;

  res.send(pageShell({ title: 'LuaObfuscationHub', body, inlineScript: INLINE_LOGIN_JS }));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/dashboard', requireAuth, (req, res) => {
  const user = req.session.user;
  const body = `
    <div class="site-bg"></div>
    <div class="dashboard-shell">
      <aside id="sidebar" class="sidebar panel">
        <div class="brand-row">
          <div class="brand-mark small">L</div>
          <div>
            <div class="brand-name">LuaObfuscationHub</div>
            <div class="sidebar-caption">Hosted script control center</div>
          </div>
        </div>

        <div class="user-summary">
          <img src="${escapeHtml(buildAvatarUrl(user))}" alt="Avatar" class="avatar" />
          <div>
            <div class="user-name">${escapeHtml(user.username)}</div>
            <div class="user-role">${user.is_owner ? 'Owner account' : 'Standard account'}</div>
          </div>
        </div>

        <nav class="nav-list">
          <button class="nav-link active" data-view="overview">Overview</button>
          <button class="nav-link" data-view="scripts">Scripts</button>
          <button class="nav-link" data-view="panels">Panels</button>
          <button class="nav-link" data-view="keys">Keys</button>
          <button class="nav-link" data-view="whitelist">Whitelist</button>
          <button class="nav-link" data-view="hwids">HWID bans</button>
          ${user.is_owner ? '<button class="nav-link" data-view="admin">Admin</button>' : ''}
        </nav>

        <div class="sidebar-footer">
          <div class="auth-panel stack">
            <div class="feature-title">Workspace</div>
            <div class="helper-text">Your existing scripts and keys remain stored in the SQLite database used by this server.</div>
          </div>
          <a class="button secondary full-width" href="/logout">Logout</a>
        </div>
      </aside>

      <main class="content-area">
        <header class="topbar panel">
          <div class="stack">
            <p class="eyebrow">Dashboard</p>
            <h1 class="page-title" id="pageTitle">Scripts</h1>
            <p class="muted" id="pageSubtitle">Manage hosted scripts, loadstrings, FFA mode, and upload flow.</p>
          </div>
          <div class="topbar-actions">
            <button class="button secondary mobile-menu-button" id="mobileMenuButton" type="button">Menu</button>
            <button class="button secondary" id="refreshButton">Refresh</button>
            <div class="live-pill"><span class="live-dot"></span> Live sync</div>
          </div>
        </header>

        <section class="stats-grid">
          <article class="stat-card panel">
            <span class="stat-label">Scripts</span>
            <strong class="stat-value" id="statScripts">0</strong>
            <span class="stat-meta" id="statScriptsMeta">0 remaining</span>
          </article>
          <article class="stat-card panel">
            <span class="stat-label">Panels</span>
            <strong class="stat-value" id="statPanels">0</strong>
            <span class="stat-meta" id="statPanelsMeta">0 remaining</span>
          </article>
          <article class="stat-card panel">
            <span class="stat-label">Keys</span>
            <strong class="stat-value" id="statKeys">0</strong>
            <span class="stat-meta" id="statKeysMeta">0 active</span>
          </article>
          <article class="stat-card panel">
            <span class="stat-label">HWID bans</span>
            <strong class="stat-value" id="statHwids">0</strong>
            <span class="stat-meta" id="statHwidsMeta">Current entries</span>
          </article>
          <article class="stat-card panel">
            <span class="stat-label">Whitelist</span>
            <strong class="stat-value" id="statWhitelist">0</strong>
            <span class="stat-meta" id="statWhitelistMeta">Trusted access grants</span>
          </article>
        </section>

        <section id="view-overview" class="view active stack-xl">
          <div class="overview-grid">
            <article class="panel overview-hero">
              <div>
                <p class="eyebrow">Security workspace</p>
                <h2>Your access layer is ready for the next release.</h2>
                <p>Ship protected Lua scripts with clear Discord access, managed keys, and trusted whitelist grants in one compact workspace.</p>
              </div>
              <div class="overview-actions">
                <button class="button primary" data-view="scripts">Add a script</button>
                <button class="button secondary" data-view="whitelist">Manage whitelist</button>
              </div>
            </article>
            <article class="panel section-card">
              <div class="section-header">
                <div>
                  <p class="mini-label">Protection pulse</p>
                  <h2>Live safeguards</h2>
                </div>
                <span class="badge success">Healthy</span>
              </div>
              <div class="pulse-row">
                <span class="pulse-icon">01</span>
                <div class="pulse-copy"><strong>Hosted delivery</strong><span>Protected loader paths online</span></div>
              </div>
              <div class="pulse-row">
                <span class="pulse-icon">02</span>
                <div class="pulse-copy"><strong>Access control</strong><span>Keys and whitelist grants enforced</span></div>
              </div>
              <div class="pulse-row">
                <span class="pulse-icon">03</span>
                <div class="pulse-copy"><strong>HWID layer</strong><span>Blocked devices checked at load time</span></div>
              </div>
            </article>
          </div>

          <div class="panel section-card">
            <div class="section-header">
              <div>
                <p class="mini-label">Discord access panel</p>
                <h2>Give buyers a cleaner path to access</h2>
                <p class="muted">A compact panel flow with key redemption, trusted whitelist access, role delivery, and HWID reset controls.</p>
              </div>
              <button class="button secondary small" data-view="panels">Open builder</button>
            </div>
            <div class="panel-preview">
              <div class="discord-preview">
                <div class="preview-kicker">Protected release</div>
                <div class="preview-title">Nebula / private build</div>
                <div class="preview-copy">A single access surface for verified buyers and trusted testers.</div>
                <div class="access-strip">
                  <span class="is-on">Protected</span><span>Key required</span><span>HWID locked</span>
                </div>
                <div class="preview-actions">
                  <button class="button primary small" data-view="keys">Generate access key</button>
                  <button class="button secondary small" data-view="whitelist">Grant trusted access</button>
                </div>
              </div>
              <div class="panel-settings">
                <div class="mini-label">Included controls</div>
                <div class="setting-line"><span>Key redemption</span><span>Enabled</span></div>
                <div class="setting-line"><span>Buyer role</span><span>Optional</span></div>
                <div class="setting-line"><span>Free key</span><span>24 hours</span></div>
                <div class="setting-line"><span>HWID reset</span><span>180 seconds</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="view-scripts" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Script workspace</h2>
                <p class="muted">Paste code, upload a file, edit existing scripts, and switch FFA mode whenever you need.</p>
              </div>
              <span class="count-badge" id="scriptsCount">0 items</span>
            </div>

            <div class="form-grid two">
              <div class="field full">
                <label for="scriptName">Script name</label>
                <input id="scriptName" type="text" placeholder="Main loader" />
              </div>
              <div class="toggle-grid full">
                <label class="switch-card"><input id="ffaModeCheck" type="checkbox" /> <span>FFA Mode (no key required)</span></label>
                <label class="switch-card"><input id="compressModeCheck" type="checkbox" checked /> <span>Auto obfuscate with HQ99</span></label>
              </div>
              <div class="field full">
                <label for="scriptCode">Script source</label>
                <div class="editor-card">
                  <div class="editor-toolbar">
                    <span class="editor-chip" id="editorFileLabel">untitled.lua</span>
                    <div class="editor-meta">
                      <span class="kbd-hint" id="editorLines">1 lines</span>
                      <span class="kbd-hint" id="editorChars">0 chars</span>
                    </div>
                  </div>
                  <div class="editor-shell" id="editorDropZone">
                    <pre id="editorLineNumbers" class="editor-lines">1</pre>
                    <textarea id="scriptCode" class="editor-textarea" spellcheck="false" placeholder="Paste your Lua or Luau source here"></textarea>
                  </div>
                  <div class="editor-actions">
                    <div class="action-row">
                      <button class="button secondary" id="uploadScriptFileButton" type="button">Upload file</button>
                      <input id="scriptFileInput" type="file" accept=".lua,.luau,.txt,.json,.js,.ts" class="hidden" />
                    </div>
                    <span class="editor-subtext">Drag and drop a source file here or paste directly into the editor.</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button class="button primary" id="saveScriptButton">Save script</button>
              <button class="button secondary hidden" id="cancelScriptEditButton" type="button">Cancel edit</button>
            </div>
          </div>

          <div id="scriptsList" class="resource-grid"></div>
        </section>

        <section id="view-panels" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Discord panel builder</h2>
                <p class="muted">Create a panel that sends the modern button layout for script access, keys, buyer role, and HWID reset.</p>
              </div>
              <span class="count-badge" id="panelsCount">0 items</span>
            </div>

            <div class="form-grid three">
              <div class="field">
                <label for="panelName">Panel name</label>
                <input id="panelName" type="text" placeholder="Release panel" />
              </div>
              <div class="field">
                <label for="panelChannelId">Discord channel ID</label>
                <input id="panelChannelId" type="text" placeholder="123456789012345678" />
              </div>
              <div class="field">
                <label for="panelScriptId">Script</label>
                <select id="panelScriptId"><option value="">Select script</option></select>
              </div>
              <div class="field full">
                <label for="panelDescription">Description</label>
                <textarea id="panelDescription" rows="4" placeholder="Short release notes or panel copy"></textarea>
              </div>
              <div class="field">
                <label for="panelBuyerRoleId">Buyer role ID</label>
                <input id="panelBuyerRoleId" type="text" placeholder="Optional Discord role ID" />
              </div>
              <div class="field">
                <label for="panelFreeKeyHours">Free key duration</label>
                <input id="panelFreeKeyHours" type="number" min="0" value="24" placeholder="Hours, 0 disables" />
              </div>
              <div class="field">
                <label for="panelHwidCooldown">HWID reset cooldown</label>
                <input id="panelHwidCooldown" type="number" min="0" value="180" placeholder="Seconds" />
              </div>
            </div>

            <div class="section-stack">
              <div class="resource-card">
                <div class="resource-header">
                  <div>
                    <div class="resource-title" id="panelPreviewTitle">🔷 Release panel</div>
                    <div class="resource-meta" id="panelPreviewDescription">yo</div>
                  </div>
                  <div class="badge-row">
                    <span class="badge info" id="panelPreviewScriptBadge">📜 No script selected</span>
                    <span class="badge success" id="panelPreviewAccessBadge">🔑 Key Required</span>
                  </div>
                </div>
                <div class="meta-list">
                  <div class="meta-item"><strong>Brand</strong><span>LuaObfuscationHub | v5</span></div>
                  <div class="meta-item"><strong>Buyer role</strong><span id="panelPreviewRole">Not set</span></div>
                  <div class="meta-item"><strong>Free key</strong><span id="panelPreviewFreeKey">24 hours</span></div>
                  <div class="meta-item"><strong>HWID cooldown</strong><span id="panelPreviewHwid">180 seconds</span></div>
                </div>
                <div class="section-stack">
                  <div class="action-row">
                    <span class="button primary small">📜 View Script</span>
                    <span class="button primary small" style="background: linear-gradient(135deg, #35d17c, #25985a); color: #fff;">🔑 Redeem Key</span>
                  </div>
                  <div class="action-row">
                    <span class="button secondary small">📊 Key Info</span>
                  </div>
                  <div class="action-row">
                    <span class="button secondary small">👤 Get Buyer Role</span>
                    <span class="button secondary small">🔗 Free Key</span>
                  </div>
                  <div class="action-row">
                    <span class="button danger small">⚙️ Reset HWID</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button class="button primary" id="savePanelButton">Create panel</button>
              <button class="button secondary hidden" id="cancelPanelEditButton" type="button">Cancel edit</button>
            </div>
          </div>

          <div id="panelsList" class="resource-grid"></div>
        </section>

        <section id="view-keys" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Key manager</h2>
                <p class="muted">Create keys manually, optionally assign them to a Discord user, and manage existing access.</p>
              </div>
              <span class="count-badge" id="keysCount">0 items</span>
            </div>

            <div class="form-grid three">
              <div class="field">
                <label for="keyPanelId">Panel</label>
                <select id="keyPanelId"><option value="">Select panel</option></select>
              </div>
              <div class="field">
                <label for="keyDuration">Duration in hours</label>
                <input id="keyDuration" type="number" min="0" placeholder="0 for permanent" />
              </div>
              <div class="field">
                <label for="keyDiscordUserId">Discord user ID</label>
                <input id="keyDiscordUserId" type="text" placeholder="Optional assignment" />
              </div>
              <div class="field">
                <label for="keyDiscordUserTag">Discord tag</label>
                <input id="keyDiscordUserTag" type="text" placeholder="Optional tag for display" />
              </div>
              <div class="field full">
                <label for="keyNote">Note</label>
                <input id="keyNote" type="text" placeholder="Internal note or buyer reference" />
              </div>
            </div>

            <div class="form-actions">
              <button class="button primary" id="generateKeyButton">Generate key</button>
              <button class="button secondary hidden" id="cancelKeyEditButton" type="button">Cancel edit</button>
            </div>
          </div>

          <div id="keysList" class="resource-grid"></div>
        </section>

        <section id="view-whitelist" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <p class="mini-label">Trusted access</p>
                <h2>Whitelist manager</h2>
                <p class="muted">Give trusted Discord users permanent access to a protected script without handing out a reusable key.</p>
              </div>
              <span class="count-badge" id="whitelistCount">0 grants</span>
            </div>
            <div class="form-grid three">
              <div class="field">
                <label for="whitelistScriptId">Protected script</label>
                <select id="whitelistScriptId"><option value="">Select protected script</option></select>
              </div>
              <div class="field">
                <label for="whitelistDiscordUserId">Discord user ID</label>
                <input id="whitelistDiscordUserId" type="text" inputmode="numeric" placeholder="123456789012345678" />
              </div>
              <div class="field">
                <label for="whitelistDiscordTag">Discord tag</label>
                <input id="whitelistDiscordTag" type="text" placeholder="trusted-user" />
              </div>
            </div>
            <div class="form-actions">
              <button class="button primary" id="addWhitelistButton" type="button">Grant trusted access</button>
            </div>
          </div>
          <div id="whitelistList" class="resource-grid"></div>
        </section>

        <section id="view-hwids" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>HWID enforcement</h2>
                <p class="muted">Add or remove blocked hardware identifiers that should not load protected scripts.</p>
              </div>
              <span class="count-badge" id="hwidsCount">0 items</span>
            </div>

            <div class="form-grid two">
              <div class="field">
                <label for="banHwidInput">HWID</label>
                <input id="banHwidInput" type="text" placeholder="Paste HWID value" />
              </div>
              <div class="field">
                <label for="banReason">Reason</label>
                <input id="banReason" type="text" placeholder="Optional reason" />
              </div>
            </div>

            <div class="form-actions">
              <button class="button primary" id="banHwidButton">Block HWID</button>
            </div>
          </div>

          <div id="hwidList" class="resource-grid"></div>
        </section>

        ${user.is_owner ? `
        <section id="view-admin" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Admin tools</h2>
                <p class="muted">Create API keys, edit user limits higher or lower, and blacklist users from website access.</p>
              </div>
              <span class="count-badge" id="apiKeysCount">0 items</span>
            </div>

            <div class="form-grid two">
              <div class="field">
                <label for="adminUserId">User ID or Discord ID</label>
                <input id="adminUserId" type="text" placeholder="User ID or Discord ID" />
              </div>
              <div class="field">
                <label for="adminExpiresDays">Expires in days</label>
                <input id="adminExpiresDays" type="number" min="0" placeholder="0 for never" />
              </div>
              <div class="field">
                <label for="adminMaxScripts">Max scripts</label>
                <input id="adminMaxScripts" type="number" min="0" value="${DEFAULT_MAX_SCRIPTS}" />
              </div>
              <div class="field">
                <label for="adminMaxPanels">Max panels</label>
                <input id="adminMaxPanels" type="number" min="0" value="${DEFAULT_MAX_PANELS}" />
              </div>
              <div class="field full">
                <label for="adminNotes">Notes</label>
                <input id="adminNotes" type="text" placeholder="Optional note" />
              </div>
            </div>

            <div class="form-actions">
              <button class="button primary" id="adminGenerateKeyButton">Generate API key</button>
            </div>
          </div>

          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Edit user limits</h2>
                <p class="muted">Raise or lower how many scripts and panels a user account can create.</p>
              </div>
            </div>
            <div class="form-grid three">
              <div class="field">
                <label for="limitUserId">User ID or Discord ID</label>
                <input id="limitUserId" type="text" placeholder="User ID or Discord ID" />
              </div>
              <div class="field">
                <label for="limitMaxScripts">Max scripts</label>
                <input id="limitMaxScripts" type="number" min="0" value="${DEFAULT_MAX_SCRIPTS}" />
              </div>
              <div class="field">
                <label for="limitMaxPanels">Max panels</label>
                <input id="limitMaxPanels" type="number" min="0" value="${DEFAULT_MAX_PANELS}" />
              </div>
            </div>
            <div class="form-actions">
              <button class="button secondary" id="adminUpdateLimitsButton">Update limits</button>
            </div>
          </div>

          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Website access blacklist</h2>
                <p class="muted">Ban a Discord ID from logging into the website until it is removed.</p>
              </div>
              <span class="count-badge" id="accessBansCount">0 items</span>
            </div>
            <div class="form-grid two">
              <div class="field">
                <label for="banDiscordId">Discord ID</label>
                <input id="banDiscordId" type="text" placeholder="Discord ID to blacklist" />
              </div>
              <div class="field">
                <label for="banDiscordReason">Reason</label>
                <input id="banDiscordReason" type="text" placeholder="Optional ban reason" />
              </div>
            </div>
            <div class="form-actions">
              <button class="button danger" id="adminBanUserButton">Blacklist user</button>
            </div>
          </div>

          <div id="apiKeysList" class="resource-grid"></div>
          <div id="accessBansList" class="resource-grid"></div>
        </section>` : ''}
      </main>
    </div>

    <div id="toastRoot" class="toast-root"></div>`;

  res.send(
    pageShell({
      title: 'LuaObfuscationHub Dashboard',
      body,
      inlineScript: INLINE_DASHBOARD_JS,
      appData: {
        user: {
          ...user,
          avatarUrl: buildAvatarUrl(user),
        },
        defaults: {
          maxScripts: DEFAULT_MAX_SCRIPTS,
          maxPanels: DEFAULT_MAX_PANELS,
        },
        baseUrl: publicBaseUrl(),
      },
    })
  );
});

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
      .setName('setup')
      .setDescription('Set up the LuaObfuscationHub access panel in this channel')
      .addStringOption((option) => option.setName('script').setDescription('Script ID, public ID, or exact script name').setRequired(true)),
    new SlashCommandBuilder()
      .setName('generatekey')
      .setDescription('Generate a license key for a script')
      .addStringOption((option) => option.setName('script').setDescription('Script ID, public ID, or exact script name').setRequired(true))
      .addIntegerOption((option) => option.setName('duration').setDescription('Duration in hours; 0 is permanent').setMinValue(0).setRequired(false))
      .addUserOption((option) => option.setName('user').setDescription('Assign the key to a Discord user').setRequired(false))
      .addStringOption((option) => option.setName('note').setDescription('Optional internal note').setRequired(false)),
    new SlashCommandBuilder()
      .setName('whitelist')
      .setDescription('Whitelist a Discord user to a script')
      .addStringOption((option) => option.setName('script').setDescription('Script ID, public ID, or exact script name').setRequired(true))
      .addUserOption((option) => option.setName('user').setDescription('User to whitelist').setRequired(true))
      .addIntegerOption((option) => option.setName('duration').setDescription('Duration in hours; leave blank for permanent').setMinValue(1).setRequired(false)),
    new SlashCommandBuilder()
      .setName('blacklist')
      .setDescription('Blacklist a Discord user from a script')
      .addStringOption((option) => option.setName('script').setDescription('Script ID, public ID, or exact script name').setRequired(true))
      .addUserOption((option) => option.setName('user').setDescription('User to blacklist').setRequired(true)),
    new SlashCommandBuilder()
      .setName('deletekey')
      .setDescription('Delete a license key')
      .addStringOption((option) => option.setName('key').setDescription('License key to delete').setRequired(true)),
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
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('redeempanel_')) {
        const panelId = interaction.customId.slice('redeempanel_'.length);
        const panel = getPanelById(panelId);
        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });

        const input = interaction.fields.getTextInputValue('key_input').toUpperCase().trim();
        const keyRecord = db.prepare('SELECT * FROM license_keys WHERE key = ? AND script_id = ?').get(input, panel.script_id);

        if (!keyRecord) return interaction.reply({ content: 'Invalid license key.', ephemeral: true });
        if (isScriptBlacklisted(panel.script_id, interaction.user.id)) {
          return interaction.reply({ content: 'You are blacklisted from this script.', ephemeral: true });
        }
        if (isExpired(keyRecord.expires_at)) return interaction.reply({ content: 'This key has expired.', ephemeral: true });
        if (keyRecord.claimed_by && keyRecord.claimed_by !== interaction.user.id) {
          return interaction.reply({ content: 'This key has already been claimed by another user.', ephemeral: true });
        }

        db.prepare(
          'UPDATE license_keys SET claimed_by = ?, claimed_tag = ?, last_used_at = CURRENT_TIMESTAMP WHERE key = ?'
        ).run(interaction.user.id, interaction.user.tag, input);

        return interaction.reply({ content: `Key redeemed successfully.\n\n${buildLoaderSnippet(getScriptById(panel.script_id))}`, ephemeral: true });
      }

      if (interaction.customId.startsWith('redeem_')) {
        const scriptId = interaction.customId.slice('redeem_'.length);
        const input = interaction.fields.getTextInputValue('key_input').toUpperCase().trim();
        const keyRecord = db.prepare('SELECT * FROM license_keys WHERE key = ? AND script_id = ?').get(input, scriptId);

        if (!keyRecord) return interaction.reply({ content: 'Invalid license key.', ephemeral: true });
        if (isScriptBlacklisted(scriptId, interaction.user.id)) {
          return interaction.reply({ content: 'You are blacklisted from this script.', ephemeral: true });
        }
        if (isExpired(keyRecord.expires_at)) return interaction.reply({ content: 'This key has expired.', ephemeral: true });
        if (keyRecord.claimed_by && keyRecord.claimed_by !== interaction.user.id) {
          return interaction.reply({ content: 'This key has already been claimed by another user.', ephemeral: true });
        }

        db.prepare(
          'UPDATE license_keys SET claimed_by = ?, claimed_tag = ?, last_used_at = CURRENT_TIMESTAMP WHERE key = ?'
        ).run(interaction.user.id, interaction.user.tag, input);

        return interaction.reply({ content: `Key redeemed successfully.`, ephemeral: true });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('panel')) {
        const separator = interaction.customId.indexOf('_');
        const action = interaction.customId.slice(5, separator);
        const panelId = interaction.customId.slice(separator + 1);
        const panel = getPanelById(panelId);
        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });
        const script = getScriptById(panel.script_id);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });

        if (action === 'view') {
          const embed = buildPanelEmbed(panel, script)
            .addFields(
              { name: 'Access', value: script.ffa_mode ? 'Open access' : 'Key required', inline: true },
              { name: 'HWID Cooldown', value: `${panel.hwid_cooldown || 0}s`, inline: true },
              { name: 'Loader Ready', value: 'Use the button below to grab the hosted mobile loadstring.', inline: false }
            );
          return interaction.reply({ embeds: [embed], components: [buildMobileViewButton(`panelmobile_${panel.id}`)], ephemeral: true });
        }

        if (action === 'mobile') {
          return interaction.reply({
            content: `Mobile View\n\`\`\`lua\n${buildLoaderSnippet(script)}\n\`\`\``,
            ephemeral: true,
          });
        }

        if (action === 'redeem') {
          const modal = new ModalBuilder().setCustomId(`redeempanel_${panel.id}`).setTitle('Redeem Key');
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('key_input')
                .setLabel('Enter your key')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('ABCD1234EFGH5678')
            )
          );
          return interaction.showModal(modal);
        }

        if (action === 'keyinfo') {
          const message = script.ffa_mode
            ? `This script is using open access.\n\n${buildLoaderSnippet(script)}`
            : `This script uses the key system. Set your key first, then run the hosted loader.\n\n${buildLoaderSnippet(script)}`;
          return interaction.reply({ content: message, ephemeral: true });
        }

        if (action === 'buyerrole') {
          if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This button only works inside a server.', ephemeral: true });
          }
          if (!panel.buyer_role_id) {
            return interaction.reply({ content: 'No buyer role has been configured for this panel.', ephemeral: true });
          }
          if (!canDiscordUserAccessScript(script.id, interaction.user.id)) {
            return interaction.reply({ content: 'You need a valid key or whitelist entry before claiming the buyer role.', ephemeral: true });
          }

          const member = await interaction.guild.members.fetch(interaction.user.id);
          await member.roles.add(panel.buyer_role_id);
          return interaction.reply({ content: 'Buyer role granted successfully.', ephemeral: true });
        }

        if (action === 'freekey') {
          if (Number(panel.free_key_hours || 0) <= 0) {
            return interaction.reply({ content: 'Free keys are disabled for this panel.', ephemeral: true });
          }

          const existing = getLatestActiveClaimedKey(script.id, interaction.user.id);
          if (existing) {
            return interaction.reply({ content: `You already have an active key: ${existing.key}\n\n${buildLoaderSnippet(script)}`, ephemeral: true });
          }

          const expiresAt = new Date(Date.now() + Number(panel.free_key_hours) * 3600000).toISOString();
          const row = createLicenseKeyRecord({
            scriptId: script.id,
            panelId: panel.id,
            userId: panel.user_id,
            note: `Free key issued to ${interaction.user.tag}`,
            expiresAt,
            claimedBy: interaction.user.id,
            claimedTag: interaction.user.tag,
          });

          return interaction.reply({
            content: `Free key generated: ${row.key}\nExpires: ${new Date(expiresAt).toLocaleString()}\n\n${buildLoaderSnippet(script)}`,
            ephemeral: true,
          });
        }

        if (action === 'resethwid') {
          const key = getLatestActiveClaimedKey(script.id, interaction.user.id);
          if (!key) {
            return interaction.reply({ content: 'No active claimed key was found for your account.', ephemeral: true });
          }

          if (key.last_hwid_reset_at) {
            const nextAllowed = new Date(key.last_hwid_reset_at).getTime() + Number(panel.hwid_cooldown || 0) * 1000;
            if (nextAllowed > Date.now()) {
              const remaining = Math.ceil((nextAllowed - Date.now()) / 1000);
              return interaction.reply({ content: `Please wait ${remaining}s before resetting HWID again.`, ephemeral: true });
            }
          }

          db.prepare(
            'UPDATE license_keys SET hwid = NULL, last_hwid_reset_at = CURRENT_TIMESTAMP WHERE key = ?'
          ).run(key.key);
          return interaction.reply({ content: 'HWID has been reset for your active key.', ephemeral: true });
        }
      }

      const [action, ...restParts] = interaction.customId.split('_');
      const scriptId = restParts.join('_');
      if (!scriptId) {
        return interaction.reply({ content: 'Invalid action.', ephemeral: true });
      }

      if (action === 'view') {
        const script = getScriptById(scriptId);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });

        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle(script.name)
          .addFields(
            { name: 'Status', value: script.status === 'active' ? 'Active' : 'Disabled', inline: true },
            { name: 'Access', value: script.ffa_mode ? 'Open access' : 'Key required', inline: true },
            { name: 'Loader Ready', value: 'Use the button below to view the hosted loadstring.', inline: false }
          )
          .setFooter({ text: 'LuaObfuscationHub' });

        return interaction.reply({ embeds: [embed], components: [buildMobileViewButton(`mobile_${script.id}`)], ephemeral: true });
      }

      if (action === 'mobile') {
        const script = getScriptById(scriptId);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });
        return interaction.reply({ content: `Mobile View\n\`\`\`lua\n${buildLoaderSnippet(script)}\n\`\`\``, ephemeral: true });
      }

      if (action === 'redeem') {
        const modal = new ModalBuilder().setCustomId(`redeem_${scriptId}`).setTitle('Redeem Key');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('key_input')
              .setLabel('Enter your key')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('ABCD1234EFGH5678')
          )
        );
        return interaction.showModal(modal);
      }

      if (action === 'loader') {
        const script = getScriptById(scriptId);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });
        return interaction.reply({ content: `\`\`\`lua\n${buildLoaderSnippet(script)}\n\`\`\``, ephemeral: true });
      }

      if (action === 'keys') {
        const script = getScriptById(scriptId);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });

        const owner = db.prepare('SELECT discord_id FROM users WHERE id = ?').get(script.user_id);
        const isOwnerViewer = interaction.user.id === OWNER_ID || interaction.user.id === owner?.discord_id;
        if (!isOwnerViewer) {
          return interaction.reply({ content: 'Keys are private to the script owner.', ephemeral: true });
        }

        const recentKeys = db.prepare(
          `SELECT key, note, expires_at, claimed_tag, created_at
           FROM license_keys
           WHERE script_id = ?
           ORDER BY created_at DESC
           LIMIT 10`
        ).all(scriptId);

        if (!recentKeys.length) {
          return interaction.reply({ content: 'No license keys exist for this script yet.', ephemeral: true });
        }

        const lines = recentKeys.map((row) => {
          const status = isExpired(row.expires_at)
            ? 'Expired'
            : row.claimed_tag
              ? `Claimed by ${row.claimed_tag}`
              : 'Available';
          return `${row.key} | ${status}${row.note ? ` | ${row.note}` : ''}`;
        });

        return interaction.reply({ content: `\`\`\`\n${lines.join('\n')}\n\`\`\``, ephemeral: true });
      }
    }

    if (interaction.isChatInputCommand()) {
      const command = interaction.commandName;

      if (command === 'setup') {
        const scriptRef = interaction.options.getString('script', true);
        const { owner, script } = getOwnedScriptForDiscord(scriptRef, interaction.user.id);
        if (!owner) return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });
        if (!script) return interaction.reply({ content: 'Script not found. Use its ID, public ID, or exact name.', ephemeral: true });
        if (!interaction.channel || !interaction.channel.isTextBased()) {
          return interaction.reply({ content: 'Use /setup in a text channel.', ephemeral: true });
        }

        let panel = db.prepare(
          'SELECT * FROM panels WHERE user_id = ? AND script_id = ? AND channel_id = ? ORDER BY created_at ASC LIMIT 1'
        ).get(owner.id, script.id, interaction.channel.id);

        if (!panel) {
          if (!canCreatePanel(owner.id)) return interaction.reply({ content: 'Your panel limit has been reached.', ephemeral: true });
          const panelId = makeId('panel');
          db.prepare(
            `INSERT INTO panels (id, user_id, name, description, channel_id, script_id, free_key_hours, hwid_cooldown)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            panelId,
            owner.id,
            `${script.name} Access`,
            'Manage script access, keys, and HWID controls from this panel.',
            interaction.channel.id,
            script.id,
            24,
            180
          );
          panel = getPanelById(panelId);
        }

        await interaction.channel.send({
          embeds: [buildPanelEmbed(panel, script)],
          components: buildPanelComponents(panel),
        });
        return interaction.reply({ content: `LuaObfuscationHub panel set up for **${script.name}** in this channel.`, ephemeral: true });
      }

      if (command === 'whitelist') {
        const scriptRef = interaction.options.getString('script', true);
        const targetUser = interaction.options.getUser('user', true);
        const duration = interaction.options.getInteger('duration');
        const { owner, script } = getOwnedScriptForDiscord(scriptRef, interaction.user.id);
        if (!owner) return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });
        if (!script) return interaction.reply({ content: 'Script not found. Use its ID, public ID, or exact name.', ephemeral: true });
        if (isScriptBlacklisted(script.id, targetUser.id)) {
          return interaction.reply({ content: `${targetUser.tag} is blacklisted from this script. Remove the blacklist first.`, ephemeral: true });
        }

        const expiresAt = duration ? new Date(Date.now() + duration * 3600000).toISOString() : null;
        const row = ensureWhitelistAccess({
          ownerUserId: owner.id,
          scriptId: script.id,
          discordUserId: targetUser.id,
          discordTag: targetUser.tag,
          expiresAt,
        });

        return interaction.reply({
          content: `Whitelisted **${targetUser.tag}** for **${script.name}**.\nAuto-generated key: \`${row.key}\`\n${expiresAt ? `Expires: ${new Date(expiresAt).toLocaleString()}` : 'Permanent access'}`,
          ephemeral: true,
        });
      }

      if (command === 'blacklist') {
        const scriptRef = interaction.options.getString('script', true);
        const targetUser = interaction.options.getUser('user', true);
        const { owner, script } = getOwnedScriptForDiscord(scriptRef, interaction.user.id);
        if (!owner) return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });
        if (!script) return interaction.reply({ content: 'Script not found. Use its ID, public ID, or exact name.', ephemeral: true });

        const existing = db.prepare(
          'SELECT id FROM script_blacklist WHERE script_id = ? AND discord_user_id = ?'
        ).get(script.id, targetUser.id);
        if (!existing) {
          db.prepare(
            `INSERT INTO script_blacklist (id, script_id, owner_user_id, discord_user_id, discord_tag, reason)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).run(makeId('bl'), script.id, owner.id, targetUser.id, targetUser.tag, 'Blacklisted by script owner');
        }

        const removeAccess = db.transaction(() => {
          const whitelist = db.prepare(
            'SELECT granted_key FROM script_whitelist WHERE script_id = ? AND discord_user_id = ?'
          ).get(script.id, targetUser.id);
          if (whitelist?.granted_key) {
            db.prepare('DELETE FROM license_keys WHERE key = ? AND user_id = ?').run(whitelist.granted_key, owner.id);
          }
          db.prepare('DELETE FROM script_whitelist WHERE script_id = ? AND discord_user_id = ?').run(script.id, targetUser.id);
          db.prepare('DELETE FROM license_keys WHERE script_id = ? AND user_id = ? AND claimed_by = ?').run(script.id, owner.id, targetUser.id);
        });
        removeAccess();

        return interaction.reply({ content: `Blacklisted **${targetUser.tag}** from **${script.name}** and removed their access.`, ephemeral: true });
      }

      if (command === 'generatekey') {
        const scriptRef = interaction.options.getString('script', true);
        const duration = interaction.options.getInteger('duration') || 0;
        const note = interaction.options.getString('note') || '';
        const targetUser = interaction.options.getUser('user');
        const { owner, script } = getOwnedScriptForDiscord(scriptRef, interaction.user.id);
        if (!owner) return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });
        if (!script) return interaction.reply({ content: 'Script not found. Use its ID, public ID, or exact name.', ephemeral: true });
        if (targetUser && isScriptBlacklisted(script.id, targetUser.id)) {
          return interaction.reply({ content: `${targetUser.tag} is blacklisted from this script.`, ephemeral: true });
        }

        const expiresAt = duration > 0 ? new Date(Date.now() + duration * 3600000).toISOString() : null;
        const row = createLicenseKeyRecord({
          scriptId: script.id,
          userId: owner.id,
          note,
          expiresAt,
          claimedBy: targetUser?.id || null,
          claimedTag: targetUser?.tag || null,
        });
        return interaction.reply({
          content: `Generated key for **${script.name}**: \`${row.key}\`\n${targetUser ? `Assigned to: ${targetUser.tag}\n` : ''}${expiresAt ? `Expires: ${new Date(expiresAt).toLocaleString()}` : 'Permanent key'}`,
          ephemeral: true,
        });
      }

      if (command === 'deletekey') {
        const key = interaction.options.getString('key', true).trim().toUpperCase();
        const owner = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!owner) return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });
        const keyRecord = db.prepare('SELECT * FROM license_keys WHERE key = ? AND user_id = ?').get(key, owner.id);
        if (!keyRecord) return interaction.reply({ content: 'Key not found in your workspace.', ephemeral: true });
        db.prepare('DELETE FROM license_keys WHERE key = ? AND user_id = ?').run(key, owner.id);
        db.prepare('UPDATE script_whitelist SET granted_key = NULL WHERE granted_key = ? AND owner_user_id = ?').run(key, owner.id);
        return interaction.reply({ content: `Deleted key \`${key}\`.`, ephemeral: true });
      }

      return interaction.reply({
        content: 'This bot only supports /setup, /whitelist, /blacklist, /generatekey, and /deletekey.',
        ephemeral: true,
      });
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
