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
console.log('Obfuscation API:', OBF_API_URL);

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
CREATE INDEX IF NOT EXISTS idx_scripts_public_id ON scripts(public_id);
CREATE INDEX IF NOT EXISTS idx_panels_user_id ON panels(user_id);
CREATE INDEX IF NOT EXISTS idx_whitelist_script_user ON script_whitelist(script_id, discord_user_id);
CREATE INDEX IF NOT EXISTS idx_access_bans_discord_id ON access_bans(discord_id);
CREATE INDEX IF NOT EXISTS idx_access_bans_user_id ON access_bans(user_id);
`);

function columnExists(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

function addColumnIfMissing(tableName, columnDefinition) {
  const [columnName] = columnDefinition.trim().split(/\s+/);
  if (!columnExists(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}

addColumnIfMissing('scripts', 'public_id TEXT');
addColumnIfMissing('license_keys', 'last_hwid_reset_at TEXT');
addColumnIfMissing('panels', 'buyer_role_id TEXT');
addColumnIfMissing('panels', 'free_key_hours INTEGER DEFAULT 24');

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
  const rows = db.prepare('SELECT id FROM scripts WHERE public_id IS NULL OR TRIM(public_id) = ""').all();
  const update = db.prepare('UPDATE scripts SET public_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  for (const row of rows) {
    update.run(makePublicId(), row.id);
  }
}

ensureScriptPublicIds();

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
  --bg: #08101a;
  --bg-alt: #0b1320;
  --panel: rgba(11, 18, 31, 0.84);
  --panel-strong: rgba(12, 19, 33, 0.96);
  --panel-soft: rgba(14, 24, 40, 0.72);
  --border: rgba(109, 185, 255, 0.14);
  --border-strong: rgba(109, 185, 255, 0.28);
  --text: #e6eef9;
  --muted: #93a5c4;
  --accent: #67d1ff;
  --accent-strong: #3aa3ff;
  --success: #4ade80;
  --warning: #fbbf24;
  --danger: #fb7185;
  --shadow: 0 24px 70px rgba(2, 8, 18, 0.45);
  --radius-xl: 28px;
  --radius-lg: 22px;
  --radius-md: 16px;
  --radius-sm: 12px;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

body {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(58, 163, 255, 0.18), transparent 28%),
    radial-gradient(circle at top right, rgba(103, 209, 255, 0.14), transparent 24%),
    linear-gradient(180deg, #08101a 0%, #070d16 100%);
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

.site-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(circle at center, black 60%, transparent 100%);
  opacity: 0.5;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}

h1,
h2,
h3,
p {
  margin: 0;
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
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
  padding: 28px 18px;
  position: relative;
  z-index: 1;
}

.auth-card {
  width: min(100%, 640px);
  padding: 34px;
  display: grid;
  gap: 24px;
}

.brand-block {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 18px;
  align-items: center;
}

.brand-mark {
  width: 86px;
  height: 86px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(103, 209, 255, 0.2), rgba(58, 163, 255, 0.08));
  border: 1px solid rgba(103, 209, 255, 0.24);
  box-shadow: 0 20px 50px rgba(58, 163, 255, 0.18);
  color: var(--accent);
  font-size: 30px;
  font-weight: 800;
}

.brand-mark.small {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  font-size: 18px;
}

.hero-title {
  font-size: clamp(2.1rem, 5vw, 3.7rem);
  line-height: 0.98;
  letter-spacing: -0.04em;
}

.hero-subtitle {
  margin-top: 10px;
  color: #cfdef5;
  max-width: 560px;
  font-size: 1rem;
}

.auth-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 18px;
}

.auth-panel,
.feature-panel {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-md);
  padding: 20px;
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

.stack { gap: 12px; }
.stack-lg { gap: 18px; }
.stack-xl { gap: 22px; }
.section-stack { gap: 18px; }

.field {
  gap: 8px;
}

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
  background: rgba(4, 10, 19, 0.8);
  border: 1px solid rgba(143, 182, 235, 0.14);
  border-radius: 14px;
  padding: 14px 15px;
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
  box-shadow: 0 0 0 4px rgba(103, 209, 255, 0.08);
}

textarea {
  resize: vertical;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 46px;
  padding: 0 16px;
  border-radius: 14px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease, opacity 0.2s ease;
}

.button:hover { transform: translateY(-1px); }
.button:disabled { opacity: 0.6; cursor: wait; transform: none; }

.button.primary {
  color: #07111b;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  box-shadow: 0 16px 40px rgba(58, 163, 255, 0.28);
}

.button.secondary,
.button.ghost {
  color: var(--text);
  border-color: rgba(143, 182, 235, 0.14);
  background: rgba(255, 255, 255, 0.03);
}

.button.danger {
  color: #ffd7de;
  border-color: rgba(251, 113, 133, 0.24);
  background: rgba(251, 113, 133, 0.08);
}

.button.small {
  min-height: 38px;
  padding: 0 13px;
  border-radius: 12px;
  font-size: 0.9rem;
}

.full-width { width: 100%; }

.divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 14px;
  align-items: center;
  color: var(--muted);
  font-size: 0.9rem;
}

.divider::before,
.divider::after {
  content: "";
  height: 1px;
  background: rgba(143, 182, 235, 0.12);
}

.feature-list {
  display: grid;
  gap: 12px;
}

.feature-item {
  padding: 14px 15px;
  border-radius: 14px;
  border: 1px solid rgba(143, 182, 235, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.feature-title {
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.dashboard-shell {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 288px 1fr;
  gap: 24px;
  min-height: 100vh;
  padding: 24px;
}

.sidebar {
  position: sticky;
  top: 24px;
  height: calc(100vh - 48px);
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-name {
  font-size: 1rem;
  font-weight: 700;
}

.user-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(143, 182, 235, 0.08);
}

.avatar {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  object-fit: cover;
  border: 1px solid rgba(143, 182, 235, 0.14);
}

.nav-list {
  gap: 10px;
  margin-bottom: auto;
}

.nav-link {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  color: #c6d4ea;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(143, 182, 235, 0.1);
}

.nav-link.active {
  color: var(--text);
  background: linear-gradient(135deg, rgba(103, 209, 255, 0.16), rgba(58, 163, 255, 0.08));
  border-color: rgba(103, 209, 255, 0.24);
}

.sidebar-footer {
  display: grid;
  gap: 10px;
}

.content-area {
  min-width: 0;
  display: grid;
  gap: 22px;
}

.topbar {
  padding: 22px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.page-title {
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  line-height: 1;
  letter-spacing: -0.03em;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

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
  padding: 10px 12px;
  border: 1px solid rgba(143, 182, 235, 0.12);
  background: rgba(255, 255, 255, 0.03);
}

.live-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--success);
  box-shadow: 0 0 16px rgba(74, 222, 128, 0.45);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  padding: 20px;
  gap: 10px;
}

.stat-value {
  font-size: 2rem;
  line-height: 1;
}

.view {
  display: none;
}

.view.active {
  display: grid;
  animation: fadeUp 0.28s ease;
}

.section-card {
  padding: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.form-grid {
  display: grid;
  gap: 16px;
}

.form-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.form-grid .full {
  grid-column: 1 / -1;
}

.form-actions,
.action-row,
.badge-row,
.card-toolbar,
.editor-actions,
.toggle-grid,
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.toggle-grid {
  align-items: stretch;
}

.switch-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 54px;
  padding: 0 16px;
  border-radius: 16px;
  border: 1px solid rgba(143, 182, 235, 0.1);
  background: rgba(255, 255, 255, 0.03);
}

.switch-card input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--accent-strong);
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 18px;
}

.resource-card {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(143, 182, 235, 0.1);
  background: var(--panel-strong);
  box-shadow: var(--shadow);
  display: grid;
  gap: 16px;
  transform: translateY(0);
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}

.resource-card:hover {
  transform: translateY(-2px);
  border-color: rgba(103, 209, 255, 0.22);
  box-shadow: 0 26px 80px rgba(2, 8, 18, 0.5);
}

.resource-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.resource-title {
  font-size: 1.05rem;
  font-weight: 700;
}

.badge {
  padding: 7px 10px;
  font-size: 0.78rem;
  font-weight: 700;
}

.badge.info { background: rgba(103, 209, 255, 0.14); color: #d4f2ff; }
.badge.success { background: rgba(74, 222, 128, 0.14); color: #d7ffe5; }
.badge.warning { background: rgba(251, 191, 36, 0.14); color: #fff1c5; }
.badge.danger { background: rgba(251, 113, 133, 0.14); color: #ffdbe2; }

.code-block {
  background: rgba(6, 12, 21, 0.92);
  border: 1px solid rgba(143, 182, 235, 0.1);
  border-radius: 18px;
  overflow: hidden;
}

.code-actions {
  padding: 11px 14px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  border-bottom: 1px solid rgba(143, 182, 235, 0.08);
  font-size: 0.88rem;
}

.code-actions button {
  border: 0;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
}

.code-block pre {
  margin: 0;
  padding: 14px 16px;
  font-size: 0.84rem;
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
  color: #bae7ff;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow: auto;
}

.meta-list {
  gap: 10px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.92rem;
}

.meta-item span:last-child {
  color: var(--muted);
  text-align: right;
}

.editor-card {
  display: grid;
  gap: 12px;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.editor-shell {
  display: grid;
  grid-template-columns: 56px 1fr;
  min-height: 420px;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid rgba(143, 182, 235, 0.12);
  background: rgba(5, 11, 20, 0.96);
}

.editor-lines {
  margin: 0;
  padding: 18px 10px 18px 16px;
  background: rgba(255, 255, 255, 0.03);
  color: #61779a;
  text-align: right;
  line-height: 1.6;
  user-select: none;
  overflow: hidden;
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
  font-size: 0.9rem;
}

.editor-textarea {
  min-height: 420px;
  border: 0;
  border-radius: 0;
  padding: 18px;
  margin: 0;
  resize: none;
  background: transparent;
  box-shadow: none !important;
  color: #edf6ff;
  line-height: 1.6;
  tab-size: 2;
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
  font-size: 0.93rem;
  caret-color: var(--accent);
  overflow: auto;
}

.editor-drop.active {
  border-color: rgba(103, 209, 255, 0.34);
  box-shadow: inset 0 0 0 1px rgba(103, 209, 255, 0.24);
}

.editor-actions {
  justify-content: space-between;
  align-items: center;
}

.editor-meta {
  gap: 6px;
}

.inline-note {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.empty-state {
  padding: 34px;
  border-radius: 20px;
  text-align: center;
  border: 1px dashed rgba(143, 182, 235, 0.14);
  background: rgba(255, 255, 255, 0.02);
}

.search-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.search-row .field {
  min-width: 220px;
  flex: 1 1 220px;
}

.toast-root {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: grid;
  gap: 10px;
  z-index: 9999;
}

.toast {
  min-width: 260px;
  max-width: 360px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(143, 182, 235, 0.14);
  background: rgba(11, 18, 31, 0.95);
  box-shadow: var(--shadow);
  animation: fadeUp 0.22s ease;
}

.toast.success { border-color: rgba(74, 222, 128, 0.24); }
.toast.error { border-color: rgba(251, 113, 133, 0.24); }
.toast-title { font-weight: 700; margin-bottom: 4px; }
.toast-message { color: var(--muted); font-size: 0.92rem; }

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
  padding: 24px;
  border-radius: 22px;
  background: rgba(10, 18, 31, 0.98);
  border: 1px solid rgba(143, 182, 235, 0.14);
  box-shadow: var(--shadow);
}

.hidden { display: none !important; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 1220px) {
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 1024px) {
  .dashboard-shell {
    grid-template-columns: 1fr;
    padding: 16px;
  }

  .sidebar {
    position: static;
    height: auto;
  }

  .nav-list {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
}

@media (max-width: 860px) {
  .auth-grid,
  .form-grid.two,
  .form-grid.three,
  .stats-grid,
  .resource-grid {
    grid-template-columns: 1fr;
  }

  .brand-block {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .brand-mark {
    margin: 0 auto;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .editor-shell {
    grid-template-columns: 44px 1fr;
    min-height: 340px;
  }

  .editor-textarea,
  .editor-lines {
    min-height: 340px;
  }
}

@media (max-width: 640px) {
  .auth-card,
  .section-card,
  .topbar,
  .sidebar,
  .modal-card {
    padding: 18px;
  }

  .dashboard-shell {
    gap: 16px;
  }

  .resource-grid {
    grid-template-columns: 1fr;
  }

  .resource-card,
  .editor-shell,
  .code-block {
    border-radius: 18px;
  }

  .editor-actions,
  .form-actions,
  .action-row,
  .topbar-actions {
    width: 100%;
  }

  .topbar-actions .button,
  .form-actions .button,
  .action-row .button,
  .editor-actions .button {
    flex: 1 1 auto;
  }
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
  scripts: 'Scripts',
  panels: 'Panels',
  keys: 'Keys',
  hwids: 'HWID Bans',
  admin: 'Admin',
};

const viewDescriptions = {
  scripts: 'Manage hosted scripts, loadstrings, compression, and upload flow.',
  panels: 'Create polished Discord panels and role-enabled access buttons.',
  keys: 'Generate, assign, copy, and revoke access keys.',
  hwids: 'Manage blocked hardware identifiers and enforcement.',
  admin: 'Create API keys, edit limits, and blacklist Discord IDs from website access.',
};

let currentView = 'scripts';
let currentData = {
  scripts: [],
  panels: [],
  keys: [],
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
            ${badge(script.ffa_mode ? 'Open Access' : 'Key Required', script.ffa_mode ? 'warning' : 'info')}
            ${badge(script.compress_mode ? 'Compressed' : 'Source', script.compress_mode ? 'info' : 'warning')}
          </div>
        </div>

        <div class="meta-list">
          <div class="meta-item"><strong>Script ID</strong><span>${escapeHtml(script.id)}</span></div>
          <div class="meta-item"><strong>Hosted Path</strong><span>${escapeHtml(script.public_id || '')}</span></div>
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
          <button class="button secondary small" onclick="toggleScript('${script.id}')">${script.status === 'active' ? 'Disable' : 'Enable'}</button>
          <button class="button secondary small" onclick="toggleFfa('${script.id}')">${script.ffa_mode ? 'Disable Open Access' : 'Enable Open Access'}</button>
          ${script.compress_mode ? '' : `<button class="button primary small" onclick="obfuscateScript('${script.id}')">Compress</button>`}
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
          <button class="button primary small" onclick="sendPanel('${panel.id}')">Send Panel</button>
          <button class="button secondary small" onclick='copyText(${JSON.stringify(panel.id)})'>Copy Panel ID</button>
          <button class="button danger small" onclick="deletePanel('${panel.id}')">Delete</button>
        </div>
      </article>
    `;
  }).join('');
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
}

function renderAll() {
  updateSummary();
  renderScripts();
  renderPanels();
  renderKeys();
  renderHwids();
  updateSelects();
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
    const data = await requestJSON('/api/create-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, ffaMode, compressMode }),
    });

    qs('scriptName').value = '';
    qs('scriptCode').value = '';
    qs('ffaModeCheck').checked = false;
    qs('compressModeCheck').checked = false;
    qs('editorFileLabel').textContent = 'untitled.lua';
    syncEditor();

    if (compressMode) {
      notify('Script saved', 'Script saved successfully. Compression is now running.');
      await obfuscateScript(data.id, true);
    } else {
      await loadData({ silent: true });
      notify('Script saved', 'The script has been saved successfully.');
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
    notify('Compression complete', silent ? 'The saved script was compressed successfully.' : 'Script compressed successfully.');
  } catch (error) {
    notify('Compression failed', error.message || 'Unable to compress the script.', 'error');
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
    await requestJSON('/api/create-panel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, channelId, scriptId, buyerRoleId, freeKeyHours, hwidCooldown }),
    });

    ['panelName', 'panelDescription', 'panelChannelId', 'panelBuyerRoleId'].forEach((id) => { qs(id).value = ''; });
    qs('panelScriptId').value = '';
    qs('panelFreeKeyHours').value = '24';
    qs('panelHwidCooldown').value = '180';

    await loadData({ silent: true });
    notify('Panel created', 'Discord panel configuration saved.');
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
    const data = await requestJSON('/api/generate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelId, durationHours, note, discordUserId, discordTag }),
    });

    ['keyDuration', 'keyNote', 'keyDiscordUserId', 'keyDiscordUserTag'].forEach((id) => { qs(id).value = ''; });
    qs('keyPanelId').value = '';

    await loadData({ silent: true });
    notify('Key generated', `New key created: ${data.key}`);
  } catch (error) {
    notify('Generate failed', error.message || 'Unable to generate a key.', 'error');
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
  document.querySelectorAll('.nav-link[data-view]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  qs('refreshButton')?.addEventListener('click', async () => {
    await loadData({ silent: false });
    if (currentView === 'admin') await loadApiKeys({ silent: false });
    notify('Dashboard refreshed', 'Latest data loaded successfully.');
  });

  qs('saveScriptButton')?.addEventListener('click', submitScript);
  qs('savePanelButton')?.addEventListener('click', submitPanel);
  qs('generateKeyButton')?.addEventListener('click', generateKey);
  qs('banHwidButton')?.addEventListener('click', banHwid);
  qs('adminGenerateKeyButton')?.addEventListener('click', adminGenerateKey);
  qs('adminUpdateLimitsButton')?.addEventListener('click', adminUpdateLimits);
  qs('adminBanUserButton')?.addEventListener('click', adminBanUser);
}

window.submitScript = submitScript;
window.obfuscateScript = obfuscateScript;
window.toggleScript = toggleScript;
window.toggleFfa = toggleFfa;
window.deleteScript = deleteScript;
window.submitPanel = submitPanel;
window.sendPanel = sendPanel;
window.deletePanel = deletePanel;
window.generateKey = generateKey;
window.deleteKey = deleteKey;
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
setPageMeta('scripts');
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

function ensureWhitelistAccess({ ownerUserId, scriptId, discordUserId, discordTag }) {
  let whitelist = db.prepare(
    'SELECT * FROM script_whitelist WHERE script_id = ? AND discord_user_id = ?'
  ).get(scriptId, discordUserId);

  if (whitelist?.granted_key) {
    const existingKey = db.prepare('SELECT * FROM license_keys WHERE key = ?').get(whitelist.granted_key);
    if (existingKey && !isExpired(existingKey.expires_at)) {
      if (!existingKey.claimed_by) {
        db.prepare('UPDATE license_keys SET claimed_by = ?, claimed_tag = ? WHERE key = ?').run(discordUserId, discordTag, existingKey.key);
      }
      return existingKey;
    }
  }

  const newKey = createLicenseKeyRecord({
    scriptId,
    userId: ownerUserId,
    note: `Whitelist for ${discordTag}`,
    expiresAt: null,
    claimedBy: discordUserId,
    claimedTag: discordTag,
  });

  if (whitelist) {
    db.prepare(
      'UPDATE script_whitelist SET discord_tag = ?, granted_key = ? WHERE id = ?'
    ).run(discordTag, newKey.key, whitelist.id);
  } else {
    db.prepare(
      `INSERT INTO script_whitelist (id, script_id, owner_user_id, discord_user_id, discord_tag, granted_key)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(makeId('wl'), scriptId, ownerUserId, discordUserId, discordTag, newKey.key);
  }

  return newKey;
}

function canDiscordUserAccessScript(scriptId, discordUserId) {
  if (!discordUserId) return false;
  const key = getLatestActiveClaimedKey(scriptId, discordUserId);
  if (key) return true;
  const whitelist = db.prepare(
    'SELECT * FROM script_whitelist WHERE script_id = ? AND discord_user_id = ?'
  ).get(scriptId, discordUserId);
  return Boolean(whitelist);
}

function buildPanelEmbed(panel, script) {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(panel.name)
    .setDescription(panel.description || 'Secure script access panel')
    .addFields(
      { name: 'Script', value: script.name, inline: true },
      { name: 'Status', value: script.status === 'active' ? 'Active' : 'Disabled', inline: true },
      { name: 'Version', value: script.version || '1.0.0', inline: true }
    )
    .setFooter({ text: 'LuaObfuscationHub | v5' });
}

function buildPanelComponents(panel) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`panelview_${panel.id}`).setLabel('View Script').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`panelredeem_${panel.id}`).setLabel('Redeem Key').setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`panelkeyinfo_${panel.id}`).setLabel('Key Info').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`panelbuyerrole_${panel.id}`).setLabel('Get Buyer Role').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`panelfreekey_${panel.id}`).setLabel('Free Key').setStyle(ButtonStyle.Secondary)
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`panelresethwid_${panel.id}`).setLabel('Reset HWID').setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3, row4];
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
  const compressMode = Boolean(req.body.compressMode);
  const ffaMode = Boolean(req.body.ffaMode);

  if (!name || !code.trim()) {
    return res.status(400).json({ error: 'Missing name or code' });
  }

  const id = makeId('script');
  const publicId = makePublicId();
  db.prepare(
    `INSERT INTO scripts (id, user_id, name, code, obfuscated_code, public_id, ffa_mode, compress_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, user.id, name, code, null, publicId, ffaMode ? 1 : 0, compressMode ? 1 : 0);

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
  const accessBans = user.is_owner
    ? db.prepare('SELECT * FROM access_bans ORDER BY created_at DESC').all()
    : [];
  const limits = getRemainingLimits(user.id);

  res.json({
    scripts,
    panels,
    keys,
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
            <p class="hero-subtitle">Manage scripts, panels, buyer roles, loadstrings, HWID access, and compression from a single dashboard.</p>
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
                <div class="helper-text">Key-based loadstrings with hosted file paths and compression support.</div>
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
      <aside class="sidebar panel">
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
          <button class="nav-link active" data-view="scripts">Scripts</button>
          <button class="nav-link" data-view="panels">Panels</button>
          <button class="nav-link" data-view="keys">Keys</button>
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
            <p class="muted" id="pageSubtitle">Manage hosted scripts, loadstrings, compression, and upload flow.</p>
          </div>
          <div class="topbar-actions">
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
        </section>

        <section id="view-scripts" class="view active stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Script workspace</h2>
                <p class="muted">Paste code, upload a file, and host a new script with compression support.</p>
              </div>
              <span class="count-badge" id="scriptsCount">0 items</span>
            </div>

            <div class="form-grid two">
              <div class="field">
                <label for="scriptName">Script name</label>
                <input id="scriptName" type="text" placeholder="Main loader" />
              </div>
              <div class="toggle-grid">
                <label class="switch-card"><input id="ffaModeCheck" type="checkbox" /> <span>Open access mode</span></label>
                <label class="switch-card"><input id="compressModeCheck" type="checkbox" /> <span>Compress on save</span></label>
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

            <div class="form-actions">
              <button class="button primary" id="savePanelButton">Create panel</button>
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
            </div>
          </div>

          <div id="keysList" class="resource-grid"></div>
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
      .addStringOption((option) => option.setName('note').setDescription('Optional note'))
      .addUserOption((option) => option.setName('user').setDescription('Assign the key to a Discord user').setRequired(false)),
    new SlashCommandBuilder()
      .setName('setbuyerrole')
      .setDescription('Set the buyer role for a panel')
      .addStringOption((option) => option.setName('panel_id').setDescription('Panel ID').setRequired(true))
      .addRoleOption((option) => option.setName('role').setDescription('Role to assign').setRequired(true)),
    new SlashCommandBuilder()
      .setName('whitelist')
      .setDescription('Whitelist a Discord user to a script')
      .addStringOption((option) => option.setName('script_id').setDescription('Script ID').setRequired(true))
      .addUserOption((option) => option.setName('user').setDescription('User to whitelist').setRequired(true)),
    new SlashCommandBuilder()
      .setName('banuser')
      .setDescription('Blacklist a Discord ID from logging into the website')
      .addStringOption((option) => option.setName('discord_id').setDescription('Discord ID to ban').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Optional reason').setRequired(false)),
    new SlashCommandBuilder()
      .setName('unbanuser')
      .setDescription('Remove a Discord ID from the website blacklist')
      .addStringOption((option) => option.setName('discord_id').setDescription('Discord ID to unban').setRequired(true)),
    new SlashCommandBuilder()
      .setName('banhwid')
      .setDescription('Ban a hardware ID from script use')
      .addStringOption((option) => option.setName('hwid').setDescription('HWID to ban').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Optional reason').setRequired(false)),
    new SlashCommandBuilder()
      .setName('unbanhwid')
      .setDescription('Remove a hardware ID ban')
      .addStringOption((option) => option.setName('hwid').setDescription('HWID to unban').setRequired(true)),
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
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('redeempanel_')) {
        const panelId = interaction.customId.slice('redeempanel_'.length);
        const panel = getPanelById(panelId);
        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });

        const input = interaction.fields.getTextInputValue('key_input').toUpperCase().trim();
        const keyRecord = db.prepare('SELECT * FROM license_keys WHERE key = ? AND script_id = ?').get(input, panel.script_id);

        if (!keyRecord) return interaction.reply({ content: 'Invalid license key.', ephemeral: true });
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
              { name: 'Compression', value: script.compress_mode ? 'Enabled' : 'Disabled', inline: true },
              { name: 'Hosted Loader', value: `\`\`\`lua\n${buildLoaderSnippet(script)}\n\`\`\``, inline: false }
            );
          return interaction.reply({ embeds: [embed], ephemeral: true });
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
            { name: 'Compression', value: script.compress_mode ? 'Enabled' : 'Disabled', inline: true }
          )
          .setFooter({ text: 'LuaObfuscationHub' });

        return interaction.reply({ embeds: [embed], ephemeral: true });
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
        if (!user) return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });

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
        if (!user) return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });

        const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });
        const script = getScriptById(panel.script_id);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });
        if (!interaction.channel || !interaction.channel.isTextBased()) {
          return interaction.reply({ content: 'This command must be used in a text channel.', ephemeral: true });
        }

        await interaction.channel.send({ embeds: [buildPanelEmbed(panel, script)], components: buildPanelComponents(panel) });
        return interaction.reply({ content: 'Panel sent to this channel.', ephemeral: true });
      }

      if (command === 'generatekey') {
        const panelId = interaction.options.getString('panel_id', true);
        const hours = interaction.options.getInteger('hours', true);
        const note = interaction.options.getString('note') || '';
        const targetUser = interaction.options.getUser('user');

        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });

        const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });

        const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3600000).toISOString() : null;
        const row = createLicenseKeyRecord({
          scriptId: panel.script_id,
          panelId: panel.id,
          userId: user.id,
          note,
          expiresAt,
          claimedBy: targetUser?.id || null,
          claimedTag: targetUser ? targetUser.tag : null,
        });

        return interaction.reply({
          content: `Generated key: ${row.key}\n${targetUser ? `Assigned to: ${targetUser.tag}\n` : ''}${expiresAt ? `Expires: ${new Date(expiresAt).toLocaleString()}` : 'Permanent key'}`,
          ephemeral: true,
        });
      }

      if (command === 'setbuyerrole') {
        const panelId = interaction.options.getString('panel_id', true);
        const role = interaction.options.getRole('role', true);
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });

        const panel = getPanelById(panelId);
        if (!panel || panel.user_id !== user.id) return interaction.reply({ content: 'Panel not found.', ephemeral: true });
        db.prepare('UPDATE panels SET buyer_role_id = ? WHERE id = ?').run(role.id, panelId);
        return interaction.reply({ content: `Buyer role set to ${role.name} for panel ${panel.name}.`, ephemeral: true });
      }

      if (command === 'whitelist') {
        const scriptId = interaction.options.getString('script_id', true);
        const targetUser = interaction.options.getUser('user', true);
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });

        const script = getScriptById(scriptId);
        if (!script || script.user_id !== user.id) return interaction.reply({ content: 'Script not found.', ephemeral: true });

        const row = ensureWhitelistAccess({
          ownerUserId: user.id,
          scriptId,
          discordUserId: targetUser.id,
          discordTag: targetUser.tag,
        });

        return interaction.reply({
          content: `Whitelisted ${targetUser.tag} to ${script.name}.\nAssigned key: ${row.key}`,
          ephemeral: true,
        });
      }

      if (command === 'banuser') {
        if (interaction.user.id !== OWNER_ID) {
          return interaction.reply({ content: 'Only the owner can blacklist website users.', ephemeral: true });
        }
        const discordId = interaction.options.getString('discord_id', true);
        const reason = interaction.options.getString('reason') || 'Blacklisted from website access';
        const linkedUser = db.prepare('SELECT * FROM users WHERE discord_id = ? OR id = ?').get(discordId, discordId);
        const existing = getAccessBan(discordId, linkedUser?.id || null);
        const actingUser = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!existing) {
          db.prepare(
            `INSERT INTO access_bans (id, discord_id, user_id, reason, banned_by)
             VALUES (?, ?, ?, ?, ?)`
          ).run(makeId('ban'), linkedUser?.discord_id || discordId, linkedUser?.id || null, reason, actingUser?.id || null);
        }
        return interaction.reply({ content: `Website access blacklisted for ${discordId}.`, ephemeral: true });
      }

      if (command === 'unbanuser') {
        if (interaction.user.id !== OWNER_ID) {
          return interaction.reply({ content: 'Only the owner can unban website users.', ephemeral: true });
        }
        const discordId = interaction.options.getString('discord_id', true);
        db.prepare('DELETE FROM access_bans WHERE discord_id = ?').run(discordId);
        const linkedUser = db.prepare('SELECT * FROM users WHERE discord_id = ? OR id = ?').get(discordId, discordId);
        if (linkedUser) db.prepare('DELETE FROM access_bans WHERE user_id = ?').run(linkedUser.id);
        return interaction.reply({ content: `Website access restored for ${discordId}.`, ephemeral: true });
      }

      if (command === 'banhwid') {
        const hwid = interaction.options.getString('hwid', true).trim();
        const reason = interaction.options.getString('reason') || '';
        const websiteUser = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        const bannedBy = websiteUser?.id || null;
        db.prepare('INSERT OR REPLACE INTO banned_hwids (hwid, reason, banned_by) VALUES (?, ?, ?)').run(hwid, reason, bannedBy);
        return interaction.reply({ content: `HWID ${hwid} has been banned.`, ephemeral: true });
      }

      if (command === 'unbanhwid') {
        const hwid = interaction.options.getString('hwid', true).trim();
        db.prepare('DELETE FROM banned_hwids WHERE hwid = ?').run(hwid);
        return interaction.reply({ content: `HWID ${hwid} has been unbanned.`, ephemeral: true });
      }

      if (command === 'loader') {
        const scriptId = interaction.options.getString('script_id', true);
        const script = getScriptById(scriptId);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });
        return interaction.reply({ content: `\`\`\`lua\n${buildLoaderSnippet(script)}\n\`\`\``, ephemeral: true });
      }

      if (command === 'keys') {
        const panelId = interaction.options.getString('panel_id');
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) return interaction.reply({ content: 'No linked dashboard account was found for this Discord user.', ephemeral: true });

        let rows;
        if (panelId) {
          const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
          if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });
          rows = db.prepare(
            `SELECT key, note, expires_at, claimed_tag, created_at
             FROM license_keys
             WHERE user_id = ? AND panel_id = ?
             ORDER BY created_at DESC
             LIMIT 10`
          ).all(user.id, panelId);
        } else {
          rows = db.prepare(
            `SELECT key, note, expires_at, claimed_tag, created_at
             FROM license_keys
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 10`
          ).all(user.id);
        }

        if (!rows.length) return interaction.reply({ content: 'No license keys were found.', ephemeral: true });

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
