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

function textBlock(fn) {
  return fn
    .toString()
    .replace(/^[\s\S]*?\/\*/, '')
    .replace(/\*\/[\s\S]*$/, '')
    .trim();
}

const INLINE_APP_CSS = textBlock(function () {/*
:root {
  --bg: #0a0a0f;
  --bg-2: #0d1117;
  --panel: rgba(18, 18, 24, 0.86);
  --panel-2: rgba(14, 14, 20, 0.92);
  --border: rgba(0, 212, 255, 0.14);
  --border-strong: rgba(0, 212, 255, 0.32);
  --text: #e2e8f0;
  --muted: rgba(148, 163, 184, 0.86);
  --accent: #00d4ff;
  --accent-2: #0891b2;
  --success: #22c55e;
  --warning: #fbbf24;
  --danger: #ef4444;
  --shadow: 0 0 40px rgba(0, 212, 255, 0.06);
  --radius-lg: 22px;
  --radius-md: 16px;
  --radius-sm: 10px;
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
  background: radial-gradient(circle at top left, rgba(0, 212, 255, 0.08), transparent 35%), var(--bg);
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
  z-index: 0;
}

.site-bg::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.03;
  background-image:
    linear-gradient(rgba(0, 212, 255, 0.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 212, 255, 0.3) 1px, transparent 1px);
  background-size: 50px 50px;
}

.site-bg::after {
  content: "";
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(ellipse at 30% 40%, rgba(0, 212, 255, 0.08) 0%, transparent 60%);
}

.panel {
  background: var(--panel);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  border-radius: var(--radius-md);
}

.auth-layout {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px;
  position: relative;
  z-index: 1;
}

.auth-card {
  width: min(100%, 520px);
  padding: 32px;
  text-align: center;
}

.brand-block {
  display: grid;
  grid-template-columns: 1fr;
  justify-items: center;
  gap: 16px;
  margin-bottom: 28px;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}

.brand-mark {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  font-size: 26px;
  font-weight: 800;
  color: var(--accent);
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.16), rgba(8, 145, 178, 0.06));
  border: 1px solid rgba(0, 212, 255, 0.2);
  box-shadow: 0 0 30px rgba(0, 212, 255, 0.12);
}

.brand-mark.small {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  font-size: 18px;
}

.brand-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent);
  text-shadow: 0 0 20px rgba(0, 212, 255, 0.25);
}

.sidebar-caption,
.helper-text,
.muted,
.resource-meta,
.user-role,
.stat-meta,
.stat-label {
  color: var(--muted);
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  text-shadow: 0 0 20px rgba(0, 212, 255, 0.28);
  font-weight: 700;
  letter-spacing: 0.04em;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  font-size: clamp(2rem, 4vw, 3rem);
  color: var(--accent);
  text-shadow: 0 0 20px rgba(0, 212, 255, 0.28);
}

h2 {
  font-size: 1.2rem;
  color: var(--accent);
  margin-bottom: 6px;
}

h3 {
  font-size: 1rem;
}

.stack-lg,
.stack-xl,
.field,
.meta-list,
.nav-list {
  display: grid;
}

.stack-lg {
  gap: 16px;
}

.stack-xl {
  gap: 20px;
}

.field {
  gap: 8px;
  text-align: left;
}

.field label {
  color: rgba(148, 214, 255, 0.8);
  font-size: 0.92rem;
}

input,
textarea,
select {
  width: 100%;
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 13px 14px;
  border-radius: var(--radius-sm);
  transition: 0.25s ease;
}

input::placeholder,
textarea::placeholder {
  color: rgba(148, 163, 184, 0.62);
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.08);
}

textarea {
  resize: vertical;
}

.mono,
.code-block,
.mono-inline,
.code-actions button {
  font-family: "Courier New", Consolas, monospace;
}

.checkbox-group {
  align-content: center;
  gap: 10px;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.92rem;
  color: rgba(148, 214, 255, 0.8);
}

.check input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(0, 212, 255, 0.2);
  cursor: pointer;
  transition: all 0.25s ease;
}

.button:hover {
  transform: translateY(-2px);
}

.button.primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #0a0a0f;
  font-weight: 700;
  box-shadow: 0 0 30px rgba(0, 212, 255, 0.2);
}

.button.secondary,
.button.ghost {
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.12), rgba(8, 145, 178, 0.04));
  color: var(--accent);
}

.button.danger {
  background: rgba(239, 68, 68, 0.08);
  color: #fda4af;
  border-color: rgba(239, 68, 68, 0.22);
}

.button.small {
  min-height: 36px;
  padding: 0 12px;
  font-size: 0.86rem;
}

.full-width {
  width: 100%;
}

.divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 14px;
  align-items: center;
  color: rgba(148, 214, 255, 0.4);
  font-size: 0.85rem;
}

.divider::before,
.divider::after {
  content: "";
  height: 1px;
  background: rgba(0, 212, 255, 0.1);
}

.dashboard-shell {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  height: 100vh;
  position: fixed;
  inset: 0 auto 0 0;
  padding: 20px;
  border-right: 1px solid rgba(0, 212, 255, 0.1);
  border-radius: 0;
  background: rgba(18, 18, 24, 0.95);
  overflow-y: auto;
}

.user-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 2px solid rgba(0, 212, 255, 0.25);
  object-fit: cover;
}

.user-name {
  font-weight: 600;
}

.nav-list {
  gap: 8px;
  margin-bottom: auto;
}

.nav-link {
  appearance: none;
  border: 0;
  background: transparent;
  color: #94a3b8;
  padding: 10px 14px;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: 0.2s ease;
}

.nav-link:hover {
  background: rgba(0, 212, 255, 0.05);
  color: var(--text);
}

.nav-link.active {
  background: rgba(0, 212, 255, 0.1);
  color: var(--accent);
  border-left: 2px solid var(--accent);
}

.sidebar-footer {
  margin-top: 20px;
}

.content-area {
  margin-left: 240px;
  padding: 20px 30px;
  display: grid;
  gap: 18px;
}

.topbar {
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.live-pill,
.count-badge,
.pill,
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
}

.live-pill {
  padding: 8px 12px;
  color: rgba(148, 214, 255, 0.78);
  border: 1px solid rgba(0, 212, 255, 0.12);
  background: rgba(0, 0, 0, 0.2);
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--success);
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.6);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  padding: 18px;
  display: grid;
  gap: 8px;
}

.stat-value {
  font-size: 1.6rem;
  color: var(--accent);
}

.view {
  display: none;
}

.view.active {
  display: block;
}

.section-card {
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.inline-header {
  margin-bottom: 12px;
}

.form-grid {
  display: grid;
  gap: 16px;
}

.form-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-grid .full {
  grid-column: 1 / -1;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-start;
  margin-top: 12px;
}

.count-badge,
.pill {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.24);
  border: 1px solid rgba(0, 212, 255, 0.12);
  color: rgba(148, 214, 255, 0.78);
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.resource-card {
  background: rgba(18, 18, 24, 0.85);
  border: 1px solid rgba(0, 212, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  display: grid;
  gap: 12px;
}

.resource-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.badge-row,
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.badge {
  font-size: 0.72rem;
  padding: 5px 10px;
}

.badge.info {
  background: rgba(0, 212, 255, 0.15);
  color: var(--accent);
}

.badge.success {
  background: rgba(34, 197, 94, 0.15);
  color: #86efac;
}

.badge.warning {
  background: rgba(251, 191, 36, 0.15);
  color: #fcd34d;
}

.badge.danger {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}

.code-block {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(0, 212, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.code-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.1);
  color: rgba(148, 214, 255, 0.78);
}

.code-actions button {
  background: transparent;
  border: 0;
  color: var(--accent);
  cursor: pointer;
}

.code-block pre {
  margin: 0;
  padding: 12px;
  font-size: 12px;
  color: var(--accent);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.meta-list {
  gap: 8px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.88rem;
}

.meta-item span:last-child {
  color: rgba(148, 163, 184, 0.78);
  text-align: right;
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: rgba(148, 214, 255, 0.32);
  border: 1px dashed rgba(0, 212, 255, 0.12);
  border-radius: 12px;
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
  min-width: 250px;
  max-width: 360px;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(18, 18, 24, 0.96);
  border: 1px solid rgba(0, 212, 255, 0.14);
  box-shadow: var(--shadow);
}

.toast.success {
  border-color: rgba(34, 197, 94, 0.26);
}

.toast.error {
  border-color: rgba(239, 68, 68, 0.24);
}

.toast-title {
  font-weight: 700;
}

.toast-message {
  font-size: 0.9rem;
  color: var(--muted);
  margin-top: 4px;
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .dashboard-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: relative;
    width: 100%;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid rgba(0, 212, 255, 0.1);
  }

  .content-area {
    margin-left: 0;
    padding: 15px;
  }

  .form-grid.two,
  .stats-grid,
  .resource-grid {
    grid-template-columns: 1fr;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
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
  scripts: '📜 Scripts',
  panels: '📋 Panels',
  keys: '🔑 Keys',
  hwids: '🚫 HWID Bans',
  admin: '⚙️ Admin Panel',
};

let currentData = {
  scripts: [],
  panels: [],
  keys: [],
  bannedHWIDs: [],
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
let currentView = 'scripts';

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

  setTimeout(() => {
    toast.remove();
  }, 3200);
}

async function requestJSON(url, options = {}) {
  const response = await fetch(url, options);

  if (response.status === 401) {
    window.location.href = '/';
    throw new Error('Unauthorized');
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Request failed' };
  }

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function getScriptById(id) {
  return (currentData.scripts || []).find((script) => script.id === id);
}

function getPanelById(id) {
  return (currentData.panels || []).find((panel) => panel.id === id);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    notify('Copied', 'The value has been copied to your clipboard.');
  }).catch(() => {
    notify('Copy failed', 'The browser blocked clipboard access.', 'error');
  });
}

window.copyText = copyText;

function updateSummary() {
  const limits = currentData.limits || {};
  const activeKeys = (currentData.keys || []).filter((row) => !isExpired(row.expires_at)).length;

  qs('statScripts').textContent = `${limits.currentScripts || 0}/${limits.maxScripts || defaults.maxScripts}`;
  qs('statScriptsMeta').textContent = `${limits.remainingScripts || 0} remaining`;
  qs('statPanels').textContent = `${limits.currentPanels || 0}/${limits.maxPanels || defaults.maxPanels}`;
  qs('statPanelsMeta').textContent = `${limits.remainingPanels || 0} remaining`;
  qs('statKeys').textContent = String((currentData.keys || []).length);
  qs('statKeysMeta').textContent = `${activeKeys} active`;
  qs('statHwids').textContent = String((currentData.bannedHWIDs || []).length);
  qs('statHwidsMeta').textContent = 'Current blocks';
}

function renderScripts() {
  const list = qs('scriptsList');
  const scripts = currentData.scripts || [];
  qs('scriptsCount').textContent = `${scripts.length} item${scripts.length === 1 ? '' : 's'}`;

  if (!scripts.length) {
    list.innerHTML = emptyState('No scripts have been created yet.');
    return;
  }

  list.innerHTML = scripts.map((script) => {
    const isObfuscated = Boolean(script.obfuscated_code);
    const loader = script.ffa_mode
      ? `loadstring(game:HttpGet("${baseUrl}/loader/${script.id}"))()`
      : [
          'script_key = "YOUR_KEY_HERE"',
          `loadstring(game:HttpGet("${baseUrl}/script/${script.id}?key=" .. script_key .. "&hwid=" .. game:GetService("HttpService"):GenerateGUID(false)))()`,
        ].join('\n');

    const statusBadge = badge(script.status === 'active' ? '✅ Active' : '⛔ Disabled', script.status === 'active' ? 'success' : 'danger');
    const accessBadge = badge(script.ffa_mode ? '🔓 FFA' : '🔒 Key Required', script.ffa_mode ? 'warning' : 'info');
    const obfuscationBadge = badge(isObfuscated ? '🔮 Obfuscated' : 'Plain source', isObfuscated ? 'info' : 'warning');

    return `
      <article class="resource-card">
        <div class="resource-header">
          <div>
            <h3>${escapeHtml(script.name)}</h3>
            <div class="resource-meta">Created ${escapeHtml(formatDate(script.created_at))}</div>
          </div>
          <div class="badge-row">
            ${statusBadge}
            ${accessBadge}
            ${obfuscationBadge}
          </div>
        </div>

        <div class="code-block">
          <div class="code-actions">
            <span>Loader snippet</span>
            <button type="button" onclick='copyText(${JSON.stringify(loader)})'>Copy</button>
          </div>
          <pre>${escapeHtml(loader)}</pre>
        </div>

        <div class="action-row">
            <button class="button secondary small" onclick="toggleScript('${script.id}')">${script.status === 'active' ? '⏸ Disable' : '▶ Enable'}</button>
          <button class="button secondary small" onclick="toggleFfa('${script.id}')">${script.ffa_mode ? '🔓 Disable FFA' : '🔒 Enable FFA'}</button>
          ${isObfuscated ? '' : `<button class="button primary small" onclick="obfuscateScript('${script.id}')">🔮 Obfuscate</button>`}
          <button class="button danger small" onclick="deleteScript('${script.id}')">✕</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderPanels() {
  const list = qs('panelsList');
  const panels = currentData.panels || [];
  qs('panelsCount').textContent = `${panels.length} item${panels.length === 1 ? '' : 's'}`;

  if (!panels.length) {
    list.innerHTML = emptyState('No panels have been created yet.');
    return;
  }

  list.innerHTML = panels.map((panel) => {
    const script = getScriptById(panel.script_id);
    return `
      <article class="resource-card">
        <div class="resource-header">
          <div>
            <h3>${escapeHtml(panel.name)}</h3>
            <div class="resource-meta">${escapeHtml(panel.description || 'No description')}</div>
          </div>
          <div class="badge-row">${badge('📋 Panel', 'info')}</div>
        </div>

        <div class="meta-list">
          <div class="meta-item"><strong>Script</strong><span>${escapeHtml(script?.name || panel.script_id)}</span></div>
          <div class="meta-item"><strong>Channel</strong><span class="mono-inline">${escapeHtml(panel.channel_id)}</span></div>
          <div class="meta-item"><strong>Cooldown</strong><span>${escapeHtml(String(panel.hwid_cooldown))} seconds</span></div>
          <div class="meta-item"><strong>Created</strong><span>${escapeHtml(formatDate(panel.created_at))}</span></div>
        </div>

        <div class="action-row">
          <button class="button primary small" onclick="sendPanel('${panel.id}')">📤 Send</button>
          <button class="button danger small" onclick="deletePanel('${panel.id}')">✕</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderKeys() {
  const list = qs('keysList');
  const keys = currentData.keys || [];
  qs('keysCount').textContent = `${keys.length} item${keys.length === 1 ? '' : 's'}`;

  if (!keys.length) {
    list.innerHTML = emptyState('No license keys have been created yet.');
    return;
  }

  list.innerHTML = keys.map((row) => {
    const panel = getPanelById(row.panel_id);
    const script = getScriptById(row.script_id);
    const status = isExpired(row.expires_at)
      ? badge('❌ Expired', 'danger')
      : row.claimed_by
        ? badge('📌 Claimed', 'warning')
        : badge('✅ Active', 'success');

    return `
      <article class="resource-card">
        <div class="resource-header">
          <div>
            <h3 class="mono-inline">${escapeHtml(row.key)}</h3>
            <div class="resource-meta">${escapeHtml(row.note || 'No note')}</div>
          </div>
          <div class="badge-row">${status}</div>
        </div>

        <div class="meta-list">
          <div class="meta-item"><strong>Script</strong><span>${escapeHtml(script?.name || row.script_id)}</span></div>
          <div class="meta-item"><strong>Panel</strong><span>${escapeHtml(panel?.name || row.panel_id || 'None')}</span></div>
          <div class="meta-item"><strong>Expires</strong><span>${escapeHtml(formatDate(row.expires_at))}</span></div>
          <div class="meta-item"><strong>Claimed by</strong><span>${escapeHtml(row.claimed_tag || 'Not claimed')}</span></div>
        </div>

        <div class="action-row">
          <button class="button secondary small" onclick='copyText(${JSON.stringify(row.key)})'>Copy</button>
          <button class="button danger small" onclick="deleteKey('${row.key}')">✕</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderHwids() {
  const list = qs('hwidList');
  const rows = currentData.bannedHWIDs || [];
  qs('hwidsCount').textContent = `${rows.length} item${rows.length === 1 ? '' : 's'}`;

  if (!rows.length) {
    list.innerHTML = emptyState('No HWIDs are currently banned.');
    return;
  }

  list.innerHTML = rows.map((row) => `
    <article class="resource-card">
      <div class="resource-header">
        <div>
          <h3 class="mono-inline">${escapeHtml(row.hwid)}</h3>
          <div class="resource-meta">${escapeHtml(row.reason || 'No reason provided')}</div>
        </div>
          <div class="badge-row">${badge('🚫 Blocked', 'danger')}</div>
      </div>

      <div class="meta-list">
        <div class="meta-item"><strong>Created</strong><span>${escapeHtml(formatDate(row.created_at))}</span></div>
      </div>

      <div class="action-row">
        <button class="button danger small" onclick="unbanHwid('${row.hwid}')">↺ Unban</button>
      </div>
    </article>
  `).join('');
}

function renderApiKeys() {
  if (!currentUser.is_owner) return;
  const list = qs('apiKeysList');
  const rows = apiKeysCache || [];
  qs('apiKeysCount').textContent = `${rows.length} item${rows.length === 1 ? '' : 's'}`;

  if (!rows.length) {
    list.innerHTML = emptyState('No API keys have been generated yet.');
    return;
  }

  list.innerHTML = rows.map((row) => {
    const status = !row.is_active
      ? badge('❌ Revoked', 'danger')
      : isExpired(row.expires_at)
        ? badge('⏰ Expired', 'warning')
        : badge('✅ Active', 'success');

    return `
      <article class="resource-card">
        <div class="resource-header">
          <div>
            <h3 class="mono-inline">${escapeHtml(row.key)}</h3>
            <div class="resource-meta">${escapeHtml(row.notes || 'No notes')}</div>
          </div>
          <div class="badge-row">${status}</div>
        </div>

        <div class="meta-list">
          <div class="meta-item"><strong>User</strong><span>${escapeHtml(row.owner_username || row.owner_discord || row.owner_id)}</span></div>
          <div class="meta-item"><strong>Limits</strong><span>${escapeHtml(String(row.max_scripts))} scripts / ${escapeHtml(String(row.max_panels))} panels</span></div>
          <div class="meta-item"><strong>Expires</strong><span>${escapeHtml(formatDate(row.expires_at))}</span></div>
          <div class="meta-item"><strong>Last used</strong><span>${escapeHtml(formatDate(row.last_used_at))}</span></div>
        </div>

        <div class="action-row">
          <button class="button secondary small" onclick='copyText(${JSON.stringify(row.key)})'>Copy</button>
          ${row.is_active ? `<button class="button danger small" onclick="revokeApiKey('${row.key}')">Revoke</button>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function updateSelects() {
  const panelScriptSelect = qs('panelScriptId');
  const keyPanelSelect = qs('keyPanelId');

  if (panelScriptSelect) {
    panelScriptSelect.innerHTML = '<option value="">Select script</option>';
    (currentData.scripts || []).forEach((script) => {
      panelScriptSelect.innerHTML += `<option value="${escapeHtml(script.id)}">${escapeHtml(script.name)}</option>`;
    });
  }

  if (keyPanelSelect) {
    keyPanelSelect.innerHTML = '<option value="">Select panel</option>';
    (currentData.panels || []).forEach((panel) => {
      keyPanelSelect.innerHTML += `<option value="${escapeHtml(panel.id)}">${escapeHtml(panel.name)}</option>`;
    });
  }
}

function renderAll() {
  updateSummary();
  renderScripts();
  renderPanels();
  renderKeys();
  renderHwids();
  updateSelects();
  if (currentUser.is_owner) renderApiKeys();
}

async function loadData({ silent = false } = {}) {
  try {
    const data = await requestJSON('/api/data');
    currentData = data;
    serverTime = data.serverTime || Date.now();
    renderAll();
    if (!silent) {
      // quiet on manual background refreshes
    }
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
    if (!silent) notify('API keys failed', error.message || 'Unable to load API keys.', 'error');
  }
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach((node) => {
    node.classList.toggle('active', node.id === `view-${view}`);
  });
  document.querySelectorAll('.nav-link').forEach((node) => {
    node.classList.toggle('active', node.dataset.view === view);
  });
  qs('pageTitle').textContent = viewTitles[view] || 'Dashboard';

  if (view === 'admin') {
    loadApiKeys({ silent: true });
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

    if (compressMode) {
      notify('Script saved', 'Script stored successfully. Obfuscation is starting now.');
      try {
        await obfuscateScript(data.id, true);
      } catch {
        // handled in obfuscateScript
      }
    } else {
      notify('Script saved', 'The script has been stored successfully.');
      await loadData({ silent: true });
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
    if (!silent) notify('Obfuscation complete', 'The selected script was obfuscated successfully.');
    if (silent) notify('Obfuscation complete', 'The new script was saved and obfuscated successfully.');
  } catch (error) {
    notify('Obfuscation failed', error.message || 'Unable to obfuscate the script.', 'error');
    throw error;
  }
}

async function toggleScript(id) {
  try {
    await requestJSON(`/api/scripts/${id}/toggle`, { method: 'PUT' });
    await loadData({ silent: true });
    notify('Script updated', 'The script status has been updated.');
  } catch (error) {
    notify('Update failed', error.message || 'Unable to update the script.', 'error');
  }
}

async function toggleFfa(id) {
  try {
    await requestJSON(`/api/scripts/${id}/ffa`, { method: 'PUT' });
    await loadData({ silent: true });
    notify('Access updated', 'The script access mode has been updated.');
  } catch (error) {
    notify('Update failed', error.message || 'Unable to update the access mode.', 'error');
  }
}

async function deleteScript(id) {
  if (!window.confirm('Delete this script and all related panels and keys?')) return;
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
  const hwidCooldown = Number(qs('panelHwidCooldown').value) || 180;

  if (!name || !channelId || !scriptId) {
    notify('Missing fields', 'Enter a panel name, channel ID, and script.', 'error');
    return;
  }

  try {
    await requestJSON('/api/create-panel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, channelId, scriptId, hwidCooldown }),
    });

    qs('panelName').value = '';
    qs('panelDescription').value = '';
    qs('panelChannelId').value = '';
    qs('panelScriptId').value = '';
    qs('panelHwidCooldown').value = '180';

    await loadData({ silent: true });
    notify('Panel created', 'The panel has been created successfully.');
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
    await loadData({ silent: true });
    notify('Panel sent', 'The panel was sent to Discord successfully.');
  } catch (error) {
    notify('Send failed', error.message || 'Unable to send the panel.', 'error');
  }
}

async function deletePanel(id) {
  if (!window.confirm('Delete this panel and its related keys?')) return;
  try {
    await requestJSON('/api/delete-panel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadData({ silent: true });
    notify('Panel deleted', 'The panel was removed successfully.');
  } catch (error) {
    notify('Delete failed', error.message || 'Unable to delete the panel.', 'error');
  }
}

async function generateKey() {
  const panelId = qs('keyPanelId').value;
  const durationHours = Number(qs('keyDuration').value) || 0;
  const note = qs('keyNote').value.trim();

  if (!panelId) {
    notify('Panel required', 'Select a panel before generating a key.', 'error');
    return;
  }

  try {
    const data = await requestJSON('/api/generate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelId, durationHours, note }),
    });

    qs('keyPanelId').value = '';
    qs('keyDuration').value = '';
    qs('keyNote').value = '';

    await loadData({ silent: true });
    notify('Key generated', `A new key was created: ${data.key}`);
  } catch (error) {
    notify('Generate failed', error.message || 'Unable to generate a key.', 'error');
  }
}

async function deleteKey(key) {
  if (!window.confirm('Delete this key?')) return;
  try {
    await requestJSON('/api/delete-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    await loadData({ silent: true });
    notify('Key deleted', 'The license key was deleted successfully.');
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
    notify('HWID banned', 'The HWID has been added to the block list.');
  } catch (error) {
    notify('Ban failed', error.message || 'Unable to ban the HWID.', 'error');
  }
}

async function unbanHwid(hwid) {
  if (!window.confirm('Remove this HWID from the block list?')) return;
  try {
    await requestJSON('/api/unban-hwid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hwid }),
    });
    await loadData({ silent: true });
    notify('HWID unbanned', 'The HWID was removed from the block list.');
  } catch (error) {
    notify('Unban failed', error.message || 'Unable to unban the HWID.', 'error');
  }
}

async function adminGenerateKey() {
  const userId = qs('adminUserId').value.trim();
  const expiresInDays = Number(qs('adminExpiresDays').value) || 0;
  const notes = qs('adminNotes').value.trim();
  const maxScripts = Number(qs('adminMaxScripts').value) || defaults.maxScripts;
  const maxPanels = Number(qs('adminMaxPanels').value) || defaults.maxPanels;

  if (!userId) {
    notify('User required', 'Enter a user ID or Discord ID.', 'error');
    return;
  }

  try {
    const data = await requestJSON('/api/admin/generate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, expiresInDays, notes, maxScripts, maxPanels }),
    });

    qs('adminUserId').value = '';
    qs('adminExpiresDays').value = '';
    qs('adminNotes').value = '';

    await Promise.all([loadData({ silent: true }), loadApiKeys({ silent: true })]);
    notify('API key generated', `The new API key is ${data.apiKey}`);
  } catch (error) {
    notify('Generate failed', error.message || 'Unable to generate the API key.', 'error');
  }
}

async function revokeApiKey(key) {
  if (!window.confirm('Revoke this API key?')) return;
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
window.revokeApiKey = revokeApiKey;

function attachEvents() {
  document.querySelectorAll('.nav-link[data-view]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  qs('refreshButton')?.addEventListener('click', async () => {
    await loadData({ silent: false });
    if (currentView === 'admin') await loadApiKeys({ silent: false });
    notify('Dashboard refreshed', 'Latest data has been loaded.');
  });

  qs('saveScriptButton')?.addEventListener('click', submitScript);
  qs('savePanelButton')?.addEventListener('click', submitPanel);
  qs('generateKeyButton')?.addEventListener('click', generateKey);
  qs('banHwidButton')?.addEventListener('click', banHwid);
  qs('adminGenerateKeyButton')?.addEventListener('click', adminGenerateKey);
}

attachEvents();
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
            <h1>LuaObfuscationHub</h1>
            <p class="muted">Cyberpunk-grade Lua protection</p>
          </div>
        </div>

        <div class="stack-lg">
          <div class="field">
            <label for="apiKeyInput">API Key</label>
            <input id="apiKeyInput" type="text" placeholder="Enter your API Key" autocomplete="off" />
          </div>

          <button id="apiLoginButton" class="button primary">Login with API Key</button>

          <div class="divider"><span>or</span></div>

          <a class="button secondary full-width" href="/auth/discord">Login with Discord</a>
        </div>

        <p class="helper-text">Need an API key? Contact the owner.</p>
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
            <div class="sidebar-caption">Cyberpunk control panel</div>
          </div>
        </div>

        <div class="user-summary">
          <img src="${escapeHtml(buildAvatarUrl(user))}" alt="Avatar" class="avatar" />
          <div>
            <div class="user-name">${escapeHtml(user.username)}</div>
            <div class="user-role">${user.is_owner ? '👑 Owner' : 'User'}</div>
          </div>
        </div>

        <nav class="nav-list">
          <button class="nav-link active" data-view="scripts">📜 Scripts</button>
          <button class="nav-link" data-view="panels">📋 Panels</button>
          <button class="nav-link" data-view="keys">🔑 Keys</button>
          <button class="nav-link" data-view="hwids">🚫 HWID Bans</button>
          ${user.is_owner ? '<button class="nav-link" data-view="admin">⚙️ Admin Panel</button>' : ''}
        </nav>

        <div class="sidebar-footer">
          <a class="button secondary full-width" href="/logout">🚪 Logout</a>
        </div>
      </aside>

      <main class="content-area">
        <header class="topbar panel">
          <div>
            <p class="eyebrow">Dashboard</p>
            <h1 id="pageTitle">📜 Scripts</h1>
            <p class="muted">Manage hosting, access, keys, panels, and obfuscation.</p>
          </div>
          <div class="topbar-actions">
            <button class="button secondary" id="refreshButton">Refresh</button>
            <div class="live-pill"><span class="live-dot"></span> Live sync</div>
          </div>
        </header>

        <section class="stats-grid" id="statsGrid">
          <article class="stat-card panel">
            <span class="stat-label">📜 Scripts</span>
            <strong class="stat-value" id="statScripts">0</strong>
            <span class="stat-meta" id="statScriptsMeta">0 remaining</span>
          </article>
          <article class="stat-card panel">
            <span class="stat-label">📋 Panels</span>
            <strong class="stat-value" id="statPanels">0</strong>
            <span class="stat-meta" id="statPanelsMeta">0 remaining</span>
          </article>
          <article class="stat-card panel">
            <span class="stat-label">🔑 License Keys</span>
            <strong class="stat-value" id="statKeys">0</strong>
            <span class="stat-meta" id="statKeysMeta">Active inventory</span>
          </article>
          <article class="stat-card panel">
            <span class="stat-label">🚫 Banned HWIDs</span>
            <strong class="stat-value" id="statHwids">0</strong>
            <span class="stat-meta" id="statHwidsMeta">Current blocks</span>
          </article>
        </section>

        <section id="view-scripts" class="view active stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>📜 Upload Script</h2>
                <p class="muted">Save your Lua source and optionally obfuscate it after upload.</p>
              </div>
            </div>
            <div class="form-grid two">
              <div class="field">
                <label for="scriptName">Script name</label>
                <input id="scriptName" type="text" placeholder="Example: Main loader" />
              </div>
              <div class="field checkbox-group">
                <label class="check"><input id="ffaModeCheck" type="checkbox" /> 🔓 FFA Mode (No key required)</label>
                <label class="check"><input id="compressModeCheck" type="checkbox" /> 🔮 Auto-Obfuscate</label>
              </div>
              <div class="field full">
                <label for="scriptCode">Source code</label>
                <textarea id="scriptCode" rows="12" class="mono" placeholder="Paste your Lua code here"></textarea>
              </div>
            </div>
            <div class="form-actions">
              <button class="button primary" id="saveScriptButton">⚡ Host Script</button>
            </div>
          </div>

          <div class="section-header inline-header">
            <div>
              <h2>Your Scripts</h2>
              <p class="muted">Saved scripts, loaders, and access settings.</p>
            </div>
            <span class="count-badge" id="scriptsCount">0 items</span>
          </div>
          <div id="scriptsList" class="resource-grid"></div>
        </section>

        <section id="view-panels" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>📋 Create Panel</h2>
                <p class="muted">Choose a script and send a Discord access panel to a channel.</p>
              </div>
            </div>
            <div class="form-grid two">
              <div class="field">
                <label for="panelName">Panel name</label>
                <input id="panelName" type="text" placeholder="Example: Main access panel" />
              </div>
              <div class="field">
                <label for="panelChannelId">Discord channel ID</label>
                <input id="panelChannelId" type="text" placeholder="123456789012345678" />
              </div>
              <div class="field full">
                <label for="panelDescription">Description</label>
                <textarea id="panelDescription" rows="4" placeholder="Optional description shown in Discord"></textarea>
              </div>
              <div class="field">
                <label for="panelScriptId">Script</label>
                <select id="panelScriptId"><option value="">Select script</option></select>
              </div>
              <div class="field">
                <label for="panelHwidCooldown">HWID cooldown (seconds)</label>
                <input id="panelHwidCooldown" type="number" value="180" min="0" />
              </div>
            </div>
            <div class="form-actions">
              <button class="button primary" id="savePanelButton">⚡ Create Panel</button>
            </div>
          </div>

          <div class="section-header inline-header">
            <div>
              <h2>Your panels</h2>
              <p class="muted">Panels linked to Discord channels.</p>
            </div>
            <span class="count-badge" id="panelsCount">0 items</span>
          </div>
          <div id="panelsList" class="resource-grid"></div>
        </section>

        <section id="view-keys" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>🔑 Generate License Key</h2>
                <p class="muted">Issue a license key for a panel with an optional expiration window.</p>
              </div>
            </div>
            <div class="form-grid two">
              <div class="field">
                <label for="keyPanelId">Panel</label>
                <select id="keyPanelId"><option value="">Select panel</option></select>
              </div>
              <div class="field">
                <label for="keyDuration">Duration in hours</label>
                <input id="keyDuration" type="number" min="0" placeholder="0 for permanent" />
              </div>
              <div class="field full">
                <label for="keyNote">Note</label>
                <input id="keyNote" type="text" placeholder="Optional note" />
              </div>
            </div>
            <div class="form-actions">
              <button class="button primary" id="generateKeyButton">⚡ Generate Key</button>
            </div>
          </div>

          <div class="section-header inline-header">
            <div>
              <h2>Your keys</h2>
              <p class="muted">View status, expiration, and claim state.</p>
            </div>
            <span class="count-badge" id="keysCount">0 items</span>
          </div>
          <div id="keysList" class="resource-grid"></div>
        </section>

        <section id="view-hwids" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>🚫 Ban HWID</h2>
                <p class="muted">Block a device identifier from using protected scripts.</p>
              </div>
            </div>
            <div class="form-grid two">
              <div class="field">
                <label for="banHwidInput">HWID</label>
                <input id="banHwidInput" type="text" placeholder="Paste HWID" />
              </div>
              <div class="field">
                <label for="banReason">Reason</label>
                <input id="banReason" type="text" placeholder="Optional reason" />
              </div>
            </div>
            <div class="form-actions">
              <button class="button primary" id="banHwidButton">🚫 Ban</button>
            </div>
          </div>

          <div class="section-header inline-header">
            <div>
              <h2>Banned HWIDs</h2>
              <p class="muted">Review blocked identifiers.</p>
            </div>
            <span class="count-badge" id="hwidsCount">0 items</span>
          </div>
          <div id="hwidList" class="resource-grid"></div>
        </section>

        ${user.is_owner ? `
        <section id="view-admin" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>⚙️ Admin Panel</h2>
                <p class="muted">Generate API keys and assign access limits.</p>
              </div>
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
              <button class="button primary" id="adminGenerateKeyButton">⚡ Generate API Key</button>
            </div>
          </div>

          <div class="section-header inline-header">
            <div>
              <h2>API keys</h2>
              <p class="muted">Monitor active and revoked keys.</p>
            </div>
            <span class="count-badge" id="apiKeysCount">0 items</span>
          </div>
          <div id="apiKeysList" class="resource-grid"></div>
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
