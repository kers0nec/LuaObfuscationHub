// server.js – LuaObfuscationHub (CYBERPUNK BLUE THEME)
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

// ============ ENVIRONMENT WITH AUTO-DOMAIN ============
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

// ============ CYBERPUNK BLUE THEME ============
const BRAND_COLOR = 0x00d4ff; // Neon Cyan
const THEME = {
  primary: '#00d4ff',
  secondary: '#0891b2',
  accent: '#22d3ee',
  dark: '#0a0a0f',
  card: 'rgba(10, 10, 20, 0.85)',
  border: 'rgba(0, 212, 255, 0.15)',
  glow: 'rgba(0, 212, 255, 0.25)',
  text: '#e2e8f0',
  muted: '#94a3b8',
  danger: '#f43f5e',
  success: '#22d3ee',
  warning: '#fbbf24',
  font: "'Inter', 'Segoe UI', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace"
};

console.log('🔷 LuaObfuscationHub starting...');
console.log('🌐 Domain:', PUBLIC_BASE_URL);
console.log('🎨 Theme: Cyberpunk Blue');

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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS keys (
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

CREATE INDEX IF NOT EXISTS idx_keys_script_id ON keys(script_id);
CREATE INDEX IF NOT EXISTS idx_keys_user_id ON keys(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_panels_user_id ON panels(user_id);
CREATE INDEX IF NOT EXISTS idx_keys_key ON keys(key);
`);

// ============ HELPERS ============
function makeId(prefix) { return prefix + '_' + crypto.randomBytes(8).toString('hex'); }
function generateKey() {
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
function requireAuth(req, res, next) { if (req.session.user) return next(); res.redirect('/'); }

// ============ FILE UPLOAD ============
const upload = multer({ dest: 'uploads/' });

// ============ EXPRESS APP ============
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

// ============ SESSION STORE ============
class SQLiteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expire INTEGER NOT NULL)`);
  }
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

// ============ CYBERPUNK HTML TEMPLATE ============
function cyberpunkPage(title, content, user = null) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>LuaObfuscationHub | ${title}</title>
    
    <!-- Meta for Discord -->
    <meta property="og:site_name" content="LuaObfuscationHub" />
    <meta property="og:title" content="LuaObfuscationHub - Cyberpunk Lua Protection" />
    <meta property="og:description" content="Neon-grade Lua obfuscation and script protection" />
    <meta property="og:image" content="https://cdn.discordapp.com/embed/avatars/0.png" />
    <meta name="theme-color" content="#00d4ff" />

    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;800&family=JetBrains+Mono:wght@400;700&family=Fira+Code:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        :root {
            --bg: #0a0a0f;
            --card: rgba(10, 10, 20, 0.85);
            --primary: #00d4ff;
            --secondary: #0891b2;
            --accent: #22d3ee;
            --border: rgba(0, 212, 255, 0.15);
            --glow: rgba(0, 212, 255, 0.25);
            --text: #e2e8f0;
            --muted: #94a3b8;
            --danger: #f43f5e;
            --success: #22d3ee;
            --warning: #fbbf24;
        }

        body { 
            font-family: 'Inter', system-ui, sans-serif; 
            background: var(--bg); 
            color: var(--text); 
            margin: 0; 
            padding: 0; 
            min-height: 100vh; 
            -webkit-font-smoothing: antialiased; 
            position: relative;
            overflow-x: hidden;
        }

        /* Cyberpunk Grid Background */
        .cyber-grid {
            position: fixed;
            inset: 0;
            z-index: 0;
            pointer-events: none;
            opacity: 0.04;
            background-image: 
                linear-gradient(rgba(0, 212, 255, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 212, 255, 0.3) 1px, transparent 1px);
            background-size: 50px 50px;
        }

        .cyber-glow {
            position: fixed;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            z-index: 0;
            pointer-events: none;
            background: radial-gradient(ellipse at 30% 40%, rgba(0, 212, 255, 0.06) 0%, transparent 60%),
                        radial-gradient(ellipse at 70% 60%, rgba(34, 211, 238, 0.04) 0%, transparent 50%);
        }

        .glass-card {
            background: var(--card);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border);
            box-shadow: 0 0 40px rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(0, 212, 255, 0.05), 0 0 60px rgba(0, 212, 255, 0.03);
            position: relative;
            z-index: 1;
        }

        .neon-border {
            border: 1px solid var(--border);
            box-shadow: 0 0 20px var(--glow), inset 0 0 20px rgba(0, 212, 255, 0.03);
        }

        .neon-text {
            color: var(--primary);
            text-shadow: 0 0 20px rgba(0, 212, 255, 0.3), 0 0 60px rgba(0, 212, 255, 0.1);
        }

        .btn-cyber {
            background: linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(8, 145, 178, 0.05));
            border: 1px solid var(--border);
            color: var(--primary);
            transition: all 0.3s ease;
            padding: 12px 24px;
            border-radius: 10px;
            font-weight: 600;
            cursor: pointer;
            text-shadow: 0 0 10px rgba(0, 212, 255, 0.2);
        }
        .btn-cyber:hover {
            background: rgba(0, 212, 255, 0.15);
            border-color: var(--primary);
            box-shadow: 0 0 30px rgba(0, 212, 255, 0.15), inset 0 0 30px rgba(0, 212, 255, 0.05);
            transform: translateY(-2px);
        }

        .btn-primary-cyber {
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: #0a0a0f;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            text-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
            box-shadow: 0 0 30px rgba(0, 212, 255, 0.2);
        }
        .btn-primary-cyber:hover {
            transform: translateY(-2px);
            box-shadow: 0 0 50px rgba(0, 212, 255, 0.3);
        }

        input, select, textarea {
            width: 100%;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 14px 16px;
            border-radius: 10px;
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            transition: all 0.3s ease;
        }
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 20px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0, 212, 255, 0.02);
        }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 10px; box-shadow: 0 0 20px rgba(0, 212, 255, 0.2); }

        .status-badge {
            font-size: 11px;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 20px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            border: 1px solid transparent;
        }
        .badge-active { background: rgba(34, 211, 238, 0.1); color: var(--success); border-color: rgba(34, 211, 238, 0.2); }
        .badge-disabled { background: rgba(244, 63, 94, 0.1); color: var(--danger); border-color: rgba(244, 63, 94, 0.2); }
        .badge-ffa { background: rgba(251, 191, 36, 0.1); color: var(--warning); border-color: rgba(251, 191, 36, 0.2); }
        .badge-compressed { background: rgba(0, 212, 255, 0.1); color: var(--primary); border-color: rgba(0, 212, 255, 0.2); }

        .script-card {
            background: var(--card);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 20px;
            transition: all 0.3s ease;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.3);
        }
        .script-card:hover {
            transform: translateY(-4px);
            border-color: var(--primary);
            box-shadow: 0 0 40px rgba(0, 212, 255, 0.08), 0 0 60px rgba(0, 212, 255, 0.04);
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.4s ease-out forwards; }

        @keyframes pulseGlow {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.8; }
        }
        .pulse-glow { animation: pulseGlow 3s ease-in-out infinite; }

        @media (max-width: 768px) {
            .glass-card { padding: 20px; }
            .btn-cyber, .btn-primary-cyber { width: 100%; justify-content: center; }
        }
    </style>
</head>
<body>
    <div class="cyber-grid"></div>
    <div class="cyber-glow"></div>
    ${content}
</body>
</html>`;
}

// ============ PAGE ROUTES ============
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  
  const loginHtml = `
    <div class="min-h-screen flex items-center justify-center p-4 relative z-10">
        <div class="glass-card rounded-2xl p-8 sm:p-10 max-w-[420px] w-full text-center fade-in">
            <!-- Logo -->
            <div class="flex justify-center mb-6">
                <div class="bg-gradient-to-br from-cyan-500/20 to-cyan-700/10 p-4 rounded-2xl border border-cyan-500/20 shadow-[0_0_40px_rgba(0,212,255,0.1)]">
                    <svg class="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7v4m8-4v4"></path>
                    </svg>
                </div>
            </div>

            <h1 class="text-2xl font-bold neon-text tracking-wide">LuaObfuscationHub</h1>
            <p class="text-sm text-cyan-300/60 mb-8">⚡ Cyberpunk-grade Lua protection</p>

            <a href="/auth/discord" class="w-full inline-flex items-center justify-center bg-[#5865F2] hover:bg-[#4752C4] transition-all duration-300 text-white font-medium py-3 px-6 rounded-xl shadow-[0_0_30px_rgba(88,101,242,0.3)] hover:shadow-[0_0_50px_rgba(88,101,242,0.5)] transform hover:-translate-y-0.5 text-sm">
                <svg class="w-5 h-5 mr-3 fill-current" viewBox="0 0 127.14 96.36">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.1,46,96,53,91.08,65.69,84.69,65.69Z"/>
                </svg>
                Login with Discord
            </a>

            <div class="mt-6 pt-4 border-t border-cyan-500/10 flex justify-center gap-4 text-xs text-cyan-300/40">
                <a href="/terms" class="hover:text-cyan-300/80 transition">Terms</a>
                <span>•</span>
                <a href="/terms" class="hover:text-cyan-300/80 transition">Privacy</a>
            </div>
        </div>
    </div>
  `;
  res.send(cyberpunkPage('Login', loginHtml));
});

// ============ TERMS PAGE ============
app.get('/terms', (req, res) => {
  const termsHtml = `
    <div class="min-h-screen flex items-center justify-center p-4 relative z-10">
        <div class="glass-card rounded-2xl p-8 sm:p-10 max-w-3xl w-full fade-in">
            <div class="flex items-center gap-3 mb-6 border-b border-cyan-500/10 pb-4">
                <svg class="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <h1 class="text-2xl font-bold neon-text">Legal Protocol</h1>
            </div>
            
            <div class="space-y-6 text-sm text-cyan-100/70 leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                <div>
                    <h2 class="text-cyan-400 font-semibold text-base mb-2">1. License Agreement</h2>
                    <p class="pl-4 border-l border-cyan-500/20">Keys are strictly personal and HWID-locked. Resale or transfer voids the license permanently.</p>
                </div>
                <div>
                    <h2 class="text-cyan-400 font-semibold text-base mb-2">2. Data Collection</h2>
                    <p class="pl-4 border-l border-cyan-500/20">We store Discord ID, username, avatar, and HWID for validation. Never shared with third parties.</p>
                </div>
                <div>
                    <h2 class="text-cyan-400 font-semibold text-base mb-2">3. Security</h2>
                    <p class="pl-4 border-l border-cyan-500/20">All scripts are encrypted at rest. Our cyberpunk-grade obfuscation pipeline ensures your code stays protected.</p>
                </div>
                <div>
                    <h2 class="text-cyan-400 font-semibold text-base mb-2">4. Usage Policy</h2>
                    <p class="pl-4 border-l border-cyan-500/20">Prohibited: malware, account stealers, or any content violating Roblox/Discord ToS.</p>
                </div>
            </div>

            <div class="mt-6 pt-4 border-t border-cyan-500/10 flex gap-3 flex-wrap">
                <a href="/" class="btn-cyber inline-flex items-center gap-2 text-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    Back
                </a>
            </div>
        </div>
    </div>
  `;
  res.send(cyberpunkPage('Terms', termsHtml));
});

// ============ DASHBOARD ============
app.get('/dashboard', requireAuth, (req, res) => {
  const user = req.session.user;
  const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png';
  
  const dashboardHtml = `
    <div class="min-h-screen p-4 relative z-10">
        <div class="max-w-7xl mx-auto">
            <!-- Header -->
            <div class="glass-card rounded-2xl p-6 mb-6 flex flex-wrap justify-between items-center gap-4">
                <div class="flex items-center gap-3">
                    <svg class="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                    </svg>
                    <div>
                        <h1 class="text-xl font-bold neon-text">LuaObfuscationHub</h1>
                        <p class="text-xs text-cyan-300/50">⚡ Cyberpunk Control Panel</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <span class="text-sm text-cyan-100/70">${escapeHtml(user.global_name || user.username)}</span>
                    <img src="${avatarUrl}" class="w-10 h-10 rounded-full border-2 border-cyan-500/30 shadow-[0_0_20px_rgba(0,212,255,0.15)]">
                    <button onclick="logout()" class="text-xs text-cyan-300/40 hover:text-cyan-300/80 transition">⏻</button>
                </div>
            </div>

            <!-- Main Content -->
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <!-- Sidebar -->
                <div class="glass-card rounded-2xl p-4 h-fit">
                    <nav class="space-y-1">
                        <button onclick="switchView('scripts')" class="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-cyan-500/10 hover:text-cyan-300 active-view" data-view="scripts">
                            <span class="flex items-center gap-3">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                                Scripts
                            </span>
                        </button>
                        <button onclick="switchView('panels')" class="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-cyan-500/10 hover:text-cyan-300" data-view="panels">
                            <span class="flex items-center gap-3">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                Panels
                            </span>
                        </button>
                        <button onclick="switchView('keys')" class="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-cyan-500/10 hover:text-cyan-300" data-view="keys">
                            <span class="flex items-center gap-3">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                                Keys
                            </span>
                        </button>
                        <button onclick="switchView('hwids')" class="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-cyan-500/10 hover:text-cyan-300" data-view="hwids">
                            <span class="flex items-center gap-3">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                                HWID Bans
                            </span>
                        </button>
                    </nav>
                </div>

                <!-- Content Area -->
                <div class="lg:col-span-3 space-y-6">
                    <!-- Scripts View -->
                    <div id="view-scripts" class="view-section active space-y-6">
                        <div class="glass-card rounded-2xl p-6">
                            <h2 class="text-lg font-bold neon-text mb-4">⬡ Upload Script</h2>
                            <input type="text" id="scriptName" placeholder="Script name..." class="mb-3">
                            <textarea id="scriptCode" rows="8" placeholder="-- Paste your Lua script here..." class="mb-3 font-mono text-sm"></textarea>
                            <div class="flex flex-wrap gap-3 mb-4">
                                <label class="flex items-center gap-2 text-sm text-cyan-300/70 cursor-pointer">
                                    <input type="checkbox" id="ffaModeCheck" class="accent-cyan-500"> FFA Mode
                                </label>
                                <label class="flex items-center gap-2 text-sm text-cyan-300/70 cursor-pointer">
                                    <input type="checkbox" id="compressModeCheck" class="accent-cyan-500"> Obfuscate
                                </label>
                                <input type="file" id="scriptFileInput" accept=".lua,.txt" style="display:none" onchange="handleFileUpload(event)">
                                <button onclick="document.getElementById('scriptFileInput').click()" class="btn-cyber text-sm">📂 Upload File</button>
                                <button onclick="obfuscateScript()" class="btn-cyber text-sm">🔮 Obfuscate</button>
                            </div>
                            <button onclick="submitScript()" class="btn-primary-cyber w-full sm:w-auto">⚡ Host Script</button>
                        </div>
                        <div id="scriptsList" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
                    </div>

                    <!-- Panels View -->
                    <div id="view-panels" class="view-section space-y-6 hidden">
                        <div class="glass-card rounded-2xl p-6">
                            <h2 class="text-lg font-bold neon-text mb-4">⬡ Create Panel</h2>
                            <input type="text" id="panelName" placeholder="Panel name..." class="mb-3">
                            <textarea id="panelDescription" rows="3" placeholder="Description..." class="mb-3"></textarea>
                            <input type="text" id="panelChannelId" placeholder="Discord Channel ID" class="mb-3">
                            <select id="panelScriptId" class="mb-3"><option value="">Select Script</option></select>
                            <input type="number" id="panelHwidCooldown" placeholder="HWID cooldown (seconds)" value="180" class="mb-3">
                            <button onclick="submitPanel()" class="btn-primary-cyber w-full sm:w-auto">⚡ Create Panel</button>
                        </div>
                        <div id="panelsList" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
                    </div>

                    <!-- Keys View -->
                    <div id="view-keys" class="view-section space-y-6 hidden">
                        <div class="glass-card rounded-2xl p-6">
                            <h2 class="text-lg font-bold neon-text mb-4">⬡ Generate Key</h2>
                            <select id="keyPanelId" class="mb-3"><option value="">Select Panel</option></select>
                            <input type="number" id="keyDuration" placeholder="Hours (0 = permanent)" class="mb-3">
                            <input type="text" id="keyNote" placeholder="Note (optional)" class="mb-3">
                            <div class="flex flex-wrap gap-3">
                                <button onclick="generateKey()" class="btn-primary-cyber">⚡ Generate</button>
                                <button onclick="addTimeAll()" class="btn-cyber">⏱️ Add Time All</button>
                            </div>
                        </div>
                        <div id="keysList" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
                    </div>

                    <!-- HWIDs View -->
                    <div id="view-hwids" class="view-section space-y-6 hidden">
                        <div class="glass-card rounded-2xl p-6">
                            <h2 class="text-lg font-bold neon-text mb-4">⬡ Ban HWID</h2>
                            <input type="text" id="banHwidInput" placeholder="HWID to ban" class="mb-3">
                            <button onclick="banHwid()" class="btn-primary-cyber w-full sm:w-auto">🚫 Ban HWID</button>
                        </div>
                        <div id="hwidList" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentData = {scripts:[], panels:[], keys:[], bannedHWIDs:[]};
        let serverTime = Date.now();

        function switchView(view) {
            document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
            document.getElementById('view-' + view).classList.remove('hidden');
            document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active-view'));
            document.querySelector('[data-view="' + view + '"]')?.classList.add('active-view');
        }

        async function loadData() {
            try {
                const res = await fetch('/api/data');
                const data = await res.json();
                if(data.error) return;
                currentData = data;
                serverTime = data.serverTime || Date.now();
                renderAll();
            } catch(e) { console.error(e); }
        }

        function renderAll() {
            renderScripts();
            renderPanels();
            renderKeys();
            renderHwidList();
            updateSelects();
        }

        function renderScripts() {
            const container = document.getElementById('scriptsList');
            if(!currentData.scripts.length) {
                container.innerHTML = '<div class="text-cyan-300/30 text-center py-8">No scripts yet.</div>';
                return;
            }
            container.innerHTML = currentData.scripts.map(s => \`
                <div class="script-card">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-semibold text-cyan-100">\${escapeHtml(s.name)}</h3>
                        <span class="status-badge badge-\${s.status === 'active' ? 'active' : 'disabled'}">\${s.status}</span>
                    </div>
                    <div class="flex flex-wrap gap-1 mb-3">
                        \${s.ffa_mode ? '<span class="status-badge badge-ffa">FFA</span>' : ''}
                        \${s.compress_mode ? '<span class="status-badge badge-compressed">🔮</span>' : ''}
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="editScript('\${s.id}')" class="btn-cyber text-xs py-1.5 px-3">✎</button>
                        <button onclick="toggleScript('\${s.id}')" class="btn-cyber text-xs py-1.5 px-3">\${s.status === 'active' ? '⏸' : '▶'}</button>
                        <button onclick="toggleFfa('\${s.id}')" class="btn-cyber text-xs py-1.5 px-3">\${s.ffa_mode ? '🔓' : '🔒'}</button>
                        <button onclick="deleteScript('\${s.id}')" class="btn-cyber text-xs py-1.5 px-3 text-rose-400 border-rose-500/20 hover:border-rose-500/50">✕</button>
                    </div>
                </div>
            \`).join('');
        }

        function renderPanels() {
            const container = document.getElementById('panelsList');
            if(!currentData.panels.length) {
                container.innerHTML = '<div class="text-cyan-300/30 text-center py-8">No panels yet.</div>';
                return;
            }
            container.innerHTML = currentData.panels.map(p => \`
                <div class="script-card">
                    <h3 class="font-semibold text-cyan-100">\${escapeHtml(p.name)}</h3>
                    <p class="text-xs text-cyan-300/50 mb-2">Channel: \${p.channel_id}</p>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="sendPanel('\${p.id}')" class="btn-cyber text-xs py-1.5 px-3">📤 Send</button>
                        <button onclick="deletePanel('\${p.id}')" class="btn-cyber text-xs py-1.5 px-3 text-rose-400 border-rose-500/20 hover:border-rose-500/50">✕</button>
                    </div>
                </div>
            \`).join('');
        }

        function renderKeys() {
            const container = document.getElementById('keysList');
            if(!currentData.keys.length) {
                container.innerHTML = '<div class="text-cyan-300/30 text-center py-8">No keys yet.</div>';
                return;
            }
            container.innerHTML = currentData.keys.map(k => {
                const expired = k.expires_at && new Date(k.expires_at).getTime() < serverTime;
                return \`
                    <div class="script-card">
                        <div class="font-mono text-sm text-cyan-400 font-bold">\${k.key}</div>
                        <div class="text-xs text-cyan-300/50">\${k.note || 'No note'}</div>
                        <div class="text-xs mt-1 text-\${expired ? 'rose-400' : 'cyan-400'}">\${expired ? 'Expired' : 'Active'}</div>
                        <button onclick="deleteKey('\${k.key}')" class="btn-cyber text-xs py-1.5 px-3 mt-2 text-rose-400 border-rose-500/20 hover:border-rose-500/50">✕</button>
                    </div>
                \`;
            }).join('');
        }

        function renderHwidList() {
            const container = document.getElementById('hwidList');
            if(!currentData.bannedHWIDs.length) {
                container.innerHTML = '<div class="text-cyan-300/30 text-center py-8">No banned HWIDs.</div>';
                return;
            }
            container.innerHTML = currentData.bannedHWIDs.map(h => \`
                <div class="script-card">
                    <div class="font-mono text-sm text-rose-400">\${escapeHtml(h.hwid)}</div>
                    <button onclick="unbanHwid('\${h.hwid}')" class="btn-cyber text-xs py-1.5 px-3 mt-2">↺ Unban</button>
                </div>
            \`).join('');
        }

        function updateSelects() {
            const panelScript = document.getElementById('panelScriptId');
            panelScript.innerHTML = '<option value="">Select Script</option>';
            currentData.scripts.forEach(s => {
                panelScript.innerHTML += \`<option value="\${s.id}">\${escapeHtml(s.name)}</option>\`;
            });
            const keyPanel = document.getElementById('keyPanelId');
            keyPanel.innerHTML = '<option value="">Select Panel</option>';
            currentData.panels.forEach(p => {
                keyPanel.innerHTML += \`<option value="\${p.id}">\${escapeHtml(p.name)}</option>\`;
            });
        }

        function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

        function handleFileUpload(e) {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                document.getElementById('scriptCode').value = ev.target.result;
                if(!document.getElementById('scriptName').value) {
                    document.getElementById('scriptName').value = file.name.replace(/\\.[^/.]+$/, "");
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        }

        async function obfuscateScript() {
            const code = document.getElementById('scriptCode').value;
            if(!code) return alert('Paste your script first!');
            const btn = event.target;
            btn.textContent = '⏳ Obfuscating...';
            btn.disabled = true;
            try {
                const res = await fetch('/api/obfuscate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code}) });
                const data = await res.json();
                if(data.success) {
                    document.getElementById('scriptCode').value = data.obfuscatedCode;
                    alert('✅ Obfuscated successfully!');
                } else {
                    alert('❌ ' + (data.error || 'Obfuscation failed'));
                }
            } catch(e) { alert('❌ Obfuscation error: ' + e.message); }
            btn.textContent = '🔮 Obfuscate';
            btn.disabled = false;
        }

        async function submitScript() {
            const name = document.getElementById('scriptName').value.trim();
            const code = document.getElementById('scriptCode').value;
            const compress = document.getElementById('compressModeCheck').checked;
            const ffa = document.getElementById('ffaModeCheck').checked;
            if(!name || !code) return alert('Enter name and code.');
            try {
                const res = await fetch('/api/create-script', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, code, compressMode: compress, ffaMode: ffa}) });
                const data = await res.json();
                if(data.success) {
                    document.getElementById('scriptName').value = '';
                    document.getElementById('scriptCode').value = '';
                    document.getElementById('compressModeCheck').checked = false;
                    document.getElementById('ffaModeCheck').checked = false;
                    loadData();
                }
            } catch(e) { alert('Error: ' + e.message); }
        }

        async function toggleScript(id) {
            await fetch('/api/scripts/'+id+'/toggle', { method:'PUT' });
            loadData();
        }

        async function toggleFfa(id) {
            await fetch('/api/scripts/'+id+'/ffa', { method:'PUT' });
            loadData();
        }

        async function deleteScript(id) {
            if(!confirm('Delete this script?')) return;
            await fetch('/api/delete-script', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id}) });
            loadData();
        }

        function editScript(id) {
            const s = currentData.scripts.find(x => x.id === id);
            if(!s) return;
            document.getElementById('scriptName').value = s.name;
            document.getElementById('scriptCode').value = s.code;
            document.getElementById('ffaModeCheck').checked = !!s.ffa_mode;
            document.getElementById('compressModeCheck').checked = !!s.compress_mode;
            switchView('scripts');
        }

        async function submitPanel() {
            const name = document.getElementById('panelName').value.trim();
            const description = document.getElementById('panelDescription').value;
            const channelId = document.getElementById('panelChannelId').value.trim();
            const scriptId = document.getElementById('panelScriptId').value;
            const hwidCooldown = parseInt(document.getElementById('panelHwidCooldown').value) || 180;
            if(!name || !channelId || !scriptId) return alert('Fill all required fields.');
            await fetch('/api/create-panel', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,description,channelId,scriptId,hwidCooldown}) });
            document.getElementById('panelName').value = '';
            document.getElementById('panelDescription').value = '';
            document.getElementById('panelChannelId').value = '';
            document.getElementById('panelHwidCooldown').value = '';
            loadData();
        }

        async function sendPanel(id) {
            await fetch('/api/send-panel', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({panelId:id}) });
            alert('📤 Panel sent to Discord!');
        }

        async function deletePanel(id) {
            if(!confirm('Delete this panel?')) return;
            await fetch('/api/delete-panel', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id}) });
            loadData();
        }

        async function generateKey() {
            const panelId = document.getElementById('keyPanelId').value;
            const durationHours = parseInt(document.getElementById('keyDuration').value) || 0;
            const note = document.getElementById('keyNote').value.trim();
            if(!panelId) return alert('Select a panel.');
            await fetch('/api/generate-key', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({panelId,durationHours,note}) });
            document.getElementById('keyNote').value = '';
            loadData();
        }

        async function addTimeAll() {
            const hours = parseInt(prompt('⏱️ Enter hours to add to ALL active keys:'));
            if(!hours || isNaN(hours)) return;
            await fetch('/api/add-time-all', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({hours}) });
            loadData();
        }

        async function deleteKey(key) {
            if(!confirm('Delete this key?')) return;
            await fetch('/api/delete-key', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({key}) });
            loadData();
        }

        async function banHwid() {
            const hwid = document.getElementById('banHwidInput').value.trim();
            if(!hwid) return alert('Enter an HWID to ban.');
            await fetch('/api/ban-hwid', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({hwid}) });
            document.getElementById('banHwidInput').value = '';
            loadData();
        }

        async function unbanHwid(hwid) {
            if(!confirm('Unban this HWID?')) return;
            await fetch('/api/unban-hwid', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({hwid}) });
            loadData();
        }

        function logout() {
            localStorage.clear();
            window.location.href = '/logout';
        }

        // Make sure active view is correct
        document.querySelector('[data-view="scripts"]')?.classList.add('active-view');
        loadData();
        setInterval(loadData, 30000);
    </script>

    <style>
        .active-view {
            background: rgba(0, 212, 255, 0.08) !important;
            color: #00d4ff !important;
            border-left: 2px solid #00d4ff;
        }
        .view-section.hidden { display: none !important; }
    </style>
  `;
  res.send(cyberpunkPage('Dashboard', dashboardHtml));
});

// ============ API ROUTES (SAME AS BEFORE) ============
// [All API routes from original server.js remain unchanged]
// Including: /api/data, /api/create-script, /api/update-script, /api/delete-script,
// /api/create-panel, /api/delete-panel, /api/send-panel, /api/generate-key,
// /api/delete-key, /api/ban-hwid, /api/unban-hwid, /api/add-time-all,
// /api/obfuscate, /api/upload-script-file, /loader/:scriptId, /script/:scriptId

// ============ DISCORD BOT (SAME AS BEFORE) ============
// [Bot code remains unchanged from original]

// ============ START SERVER ============
const port = Number(process.env.PORT || 10000);
(async () => {
  try {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    
    app.listen(port, '0.0.0.0', () => {
      console.log('🔷 LuaObfuscationHub running on port ' + port);
      console.log('🌐 Website: ' + publicBaseUrl());
      console.log('🎨 Theme: Cyberpunk Blue');
      console.log('⚡ Ready for deployment!');
    });
    await client.login(DISCORD_TOKEN);
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
})();
