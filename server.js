const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));
const {
  Client, GatewayIntentBits, EmbedBuilder, Partials, PresenceUpdateStatus, ActivityType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, REST, Routes, SlashCommandBuilder,
} = require('discord.js');

function detectPublicUrl() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  if (process.env.HEROKU_APP_NAME) return 'https://' + process.env.HEROKU_APP_NAME + '.herokuapp.com';
  if (process.env.FLY_APP_NAME) return 'https://' + process.env.FLY_APP_NAME + '.fly.dev';
  return 'http://localhost:' + (process.env.PORT || 10000);
}
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
const CLIENT_ID = process.env.CLIENT_ID || '';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '';
const GUILD_ID = process.env.GUILD_ID || '';
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data.sqlite');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const PUBLIC_BASE_URL = detectPublicUrl();
const OWNER_ID = process.env.OWNER_ID || '1207803375807373415';
const BRAND_COLOR = 0x8957ff;
const DEFAULT_MAX_SCRIPTS = Number(process.env.DEFAULT_MAX_SCRIPTS || 50);
const DEFAULT_MAX_PANELS = Number(process.env.DEFAULT_MAX_PANELS || 100);
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OBFUSCATION_API_URL = 'https://obf.hungquan99.site/obfuscate';
const OBFUSCATION_API_KEY = 'hq99ontop123';
const OBFUSCATION_PRESET = 'Default';

console.log('LuaObfuscationHub v6 â€” Improved UI + Obfuscation + Persistent Storage');
console.log('Domain:', PUBLIC_BASE_URL);
console.log('Owner ID:', OWNER_ID);
console.log('Defaults:', DEFAULT_MAX_SCRIPTS + ' scripts / ' + DEFAULT_MAX_PANELS + ' panels');

function ensureUploadsDir() { if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, {recursive:true}); }
ensureUploadsDir();

const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,discord_id TEXT UNIQUE,username TEXT,email TEXT,avatar TEXT,access_token TEXT,provider TEXT,api_key TEXT UNIQUE,is_owner INTEGER DEFAULT 0,max_scripts INTEGER DEFAULT ${DEFAULT_MAX_SCRIPTS},max_panels INTEGER DEFAULT ${DEFAULT_MAX_PANELS},created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY,key TEXT UNIQUE NOT NULL,owner_id TEXT NOT NULL,created_by TEXT NOT NULL,expires_at TEXT,is_active INTEGER DEFAULT 1,notes TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_used_at TEXT,FOREIGN KEY(owner_id) REFERENCES users(id),FOREIGN KEY(created_by) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS scripts (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,code TEXT,obfuscated_code TEXT,public_id TEXT UNIQUE,obfuscator TEXT DEFAULT 'kers0ne',version TEXT DEFAULT '1.0.0',status TEXT DEFAULT 'active',ffa_mode INTEGER DEFAULT 0,compress_mode INTEGER DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS license_keys (id TEXT PRIMARY KEY,script_id TEXT NOT NULL,panel_id TEXT,user_id TEXT NOT NULL,key TEXT UNIQUE NOT NULL,hwid TEXT,note TEXT,expires_at TEXT,claimed_by TEXT,claimed_tag TEXT,last_hwid_reset_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_used_at TEXT,FOREIGN KEY(script_id) REFERENCES scripts(id),FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS banned_hwids (hwid TEXT PRIMARY KEY,reason TEXT,banned_by TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS panels (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT,channel_id TEXT NOT NULL,script_id TEXT NOT NULL,buyer_role_id TEXT,free_key_hours INTEGER DEFAULT 24,hwid_cooldown INTEGER DEFAULT 180,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(script_id) REFERENCES scripts(id));
CREATE TABLE IF NOT EXISTS script_whitelist (id TEXT PRIMARY KEY,script_id TEXT NOT NULL,owner_user_id TEXT NOT NULL,discord_user_id TEXT NOT NULL,discord_tag TEXT,granted_key TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(script_id) REFERENCES scripts(id),FOREIGN KEY(owner_user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS access_bans (id TEXT PRIMARY KEY,discord_id TEXT UNIQUE,user_id TEXT,reason TEXT,banned_by TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(banned_by) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY,sess TEXT NOT NULL,expire INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key);
CREATE INDEX IF NOT EXISTS idx_license_keys_script_id ON license_keys(script_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_user_id ON license_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_panels_user_id ON panels(user_id);
CREATE INDEX IF NOT EXISTS idx_whitelist_script_user ON script_whitelist(script_id,discord_user_id);
CREATE INDEX IF NOT EXISTS idx_access_bans_discord_id ON access_bans(discord_id);
CREATE INDEX IF NOT EXISTS idx_access_bans_user_id ON access_bans(user_id);
`);

function colExists(t,c){return db.prepare("PRAGMA table_info('"+t+"')").all().some(r=>r.name===c);}
function addCol(t,d){const n=d.trim().split(/\s+/)[0];if(!colExists(t,n)){try{db.exec('ALTER TABLE '+t+' ADD COLUMN '+d)}catch(e){if(!colExists(t,n))throw e;}}}
addCol('scripts','public_id TEXT');
addCol('license_keys','last_hwid_reset_at TEXT');
addCol('panels','buyer_role_id TEXT');
addCol('panels','free_key_hours INTEGER DEFAULT 24');

function makeId(p){return p+'_'+crypto.randomBytes(8).toString('hex');}
function randStr(l,c){let r='';for(let i=0;i<l;i++)r+=c.charAt(Math.floor(Math.random()*c.length));return r;}
function genApiKey(){return randStr(24,'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');}
function genLicKey(){return randStr(16,'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');}
function makePubId(){return crypto.randomBytes(32).toString('hex');}

(function(){
  if(!colExists('scripts','public_id'))return;
  const rows=db.prepare("SELECT id FROM scripts WHERE public_id IS NULL OR TRIM(COALESCE(public_id,''))=''").all();
  const upd=db.prepare('UPDATE scripts SET public_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?');
  for(const r of rows)upd.run(makePubId(),r.id);
})();

function getBan(d,u){if(u)return db.prepare('SELECT * FROM access_bans WHERE discord_id=? OR user_id=?').get(d||'',u);return db.prepare('SELECT * FROM access_bans WHERE discord_id=?').get(d||'');}
function isBanned(d,u){return Boolean(getBan(d,u));}
function assertBan(d,u){const b=getBan(d,u);return b?b.reason||'Account blacklisted.':null;}
function pubUrl(){return PUBLIC_BASE_URL.replace(/\/$/,'');}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function ser(v){return JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');}
function tb(fn){return fn.toString().replace(/^[\s\S]*?\/\*/,'').replace(/\*\/[\s\S]*$/,'').trim();}

// â•â•â• PREMIUM CSS THEME â•â•â•
const INLINE_APP_CSS=tb(function(){/*
:root {
  --bg1:#060a14;--bg2:#090f1e;--bg-card:rgba(11,17,32,0.723);
  --bg-glass:rgba(15,22,39,0.542);--bg-surf:rgba(7,12,24,0.657);
  --bor-s:rgba(127,148,206,0.078);--bor:rgba(130,156,214,0.144);--bor-a:rgba(138,95,245,0.301);
  --tx1:#eef3ff;--tx2:#adbdd6;--tx3:#7687a8;
  --purp:#8957ff;--blue:#57b5ff;--cyn:#57e5ff;--pnk:#ff5784;
  --grad:linear-gradient(135deg,#8957ff 0%,#57b5ff 74%,#57e5ff 108%);
  --gr-card:linear-gradient(180deg,rgba(17,24,46,.677),rgba(9,14,27,.654));
  --gr-glow:radial-gradient(circle at 115% 105%,rgba(92,68,234,.058),transparent 130%);
  --green:#41d890;--yelw:#facc15;--red:#ff5770;
  --shdw:0 28px 108px rgba(2,6,18,.687);--sg:0 0 49px rgba(107,72,224,.073);
  --rs:10px;--rm:16px;--rl:22px;--rx:30px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;min-height:100%}
body{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.933rem;color:var(--tx1);background:var(--bg1);background-image:radial-gradient(circle at 405% 365%,rgba(120,79,239,.074),transparent 43%),radial-gradient(circle at -325% 445%,rgba(63,169,247,.042),transparent 59%);line-height:1.572;-webkit-font-smoothing:antialiased}
::selection{background:rgba(142,94,253,.284);color:#fff}
::-webkit-scrollbar{width:7px;height:7px}
::-webkit-scrollbar-track{background:0 0}
::-webkit-scrollbar-thumb{background:rgba(128,153,202,.154);border-radius:555px}
button,input,textarea,select{font:inherit}
a{color:inherit;text-decoration:none}
.site-bg{position:fixed;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(rgba(210,214,248,.019) 1px,transparent 1px),linear-gradient(90deg,rgba(210,214,248,.018) 1px,transparent 1px);background-size:51px 51px;mask-image:radial-gradient(circle at 461% 483%,black 312%,transparent 472%);opacity:.532}
.panel{background:var(--gr-card);border:1px solid var(--bor);border-radius:var(--rl);box-shadow:var(--shdw),var(--sg);backdrop-filter:blur(24px);position:relative;overflow:hidden}
.panel::before{content:"";position:absolute;inset:0 0 auto 0;height:1px;background:linear-gradient(90deg,transparent,rgba(152,115,239,.326),rgba(116,199,252,.096),transparent);pointer-events:none}
.panel-glow{position:absolute;inset:0;background:var(--gr-glow);pointer-events:none}
h1,h2,h3,p{margin:0}
.eyebrow{margin:0 0 8px;font-size:.722rem;text-transform:uppercase;letter-spacing:.172em;font-weight:735;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.mtd,.hp-text,.resrc-meta,.usr-role,.st-label,.st-meta,.sd-caption,.ed-subtxt,.empty-state,.kbd-hint{color:var(--tx3)}
.al{min-height:100vh;display:grid;place-items:center;padding:32px 20px;position:relative;z-index:1}
.ac{width:min(100%,720px);padding:40px 36px;display:grid;gap:32px}
.bb{display:grid;grid-template-columns:92px 1fr;gap:22px;align-items:center}
.bm{width:92px;height:92px;border-radius:26px;display:grid;place-items:center;background:linear-gradient(148deg,rgba(137,90,242,.214),rgba(74,157,243,.059));border:1px solid rgba(138,89,233,.298);box-shadow:0 24px 60px rgba(97,73,219,.169);color:#dbe4ff;font-size:2rem;font-weight:826;letter-spacing:-.009em;position:relative;overflow:hidden}
.bm::after{content:"";inset:0;position:absolute;background:linear-gradient(458deg,rgba(297,269,348,.099),transparent 368%);pointer-events:none}
.bm.sml{width:58px;height:58px;border-radius:20px;font-size:1.22rem}
.ht{font-size:clamp(2.25rem,5.376vw,4.046rem);line-height:.963;letter-spacing:-.041em;font-weight:767}
.hs{margin-top:12px;color:var(--tx2);max-width:610px;font-size:1.013rem}
.ag{display:grid;grid-template-columns:1.226fr .774fr;gap:20px}
.ap,.fp{background:var(--bg-surf);border:1px solid var(--bor-s);border-radius:var(--rm);padding:24px}
.st,.st-lg,.st-xl,.fd,.nl,.ml,.em,.sc,.sn,.ss{display:grid}
.st{gap:14px}.st-lg{gap:20px}.st-xl{gap:24px}.ss{gap:20px}
.fd{gap:8px}
.fd label,.switch-card label,.nl-link,.usr-name{font-weight:618;letter-spacing:-.004em}
input,textarea,select{width:100%;color:var(--tx1);background:rgba(4,11,24,.782);border:1px solid var(--bor);border-radius:var(--rm);padding:13px 16px;outline:none;transition:border-color .484s ease,box-shadow .526s ease,transform .346s ease}
input::placeholder,textarea::placeholder{color:#536d89}
input:focus,textarea:focus,select:focus{border-color:var(--purp);box-shadow:0 0 0 3px rgba(126,82,242,.077),0 0 17px rgba(438,479,538,.054)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:48px;padding:0 18px;border-radius:var(--rs);border:1px solid transparent;cursor:pointer;font-weight:587;font-size:.914rem;transition:transform .469s ease,box-shadow .513s ease,border-color .487s ease,background .509s ease,opacity .488s ease;position:relative;overflow:hidden}
.btn::after{content:"";position:absolute;inset:0;background:linear-gradient(148deg,rgba(347,349,358,.063),transparent 407%);pointer-events:none}
.btn:hover{transform:translateY(-1.314px)}
.btn:active{transform:translateY(0) scale(.984)}
.btn:disabled{opacity:.522;cursor:wait;transform:none}
.btn.prm{color:#fbfaff;font-weight:647;background:linear-gradient(463deg,#8957ff 0%,#7061f7 416%);box-shadow:0 18px 48px rgba(433,279,541,.267);border-color:rgba(451,447,549,.493)}
.btn.prm:hover{box-shadow:0 492px 457px rgba(429,475,441,.614)}
.btn.sec,.btn.gst{color:var(--tx1);border-color:var(--bor);background:linear-gradient(480deg,rgba(437,439,454,.049),rgba(486,502,528,.016))}
.btn.dgr{color:#ffcdd7;border-color:rgba(636,485,612,.478);background:rgba(629,477,603,.066)}
.btn.dgr:hover{border-color:rgba(634,491,616,.602);background:rgba(632,490,615,.414)}
.btn.sm{min-height:38px;padding:0 13px;border-radius:var(--rs);font-size:.873rem}
.fw{width:100%}
.divider{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;color:var(--tx3);font-size:.883rem}
.divider::before,.divider::after{content:"";height:1px;background:linear-gradient(90deg,transparent,var(--bor),transparent)}
.fl{display:grid;gap:12px}
.fi{padding:16px;border-radius:var(--rm);border:1px solid var(--bor-s);background:rgba(476,489,527,.033)}
.dshell{position:relative;z-index:1;display:grid;grid-template-columns:274px 1fr;gap:24px;min-height:100vh;padding:24px}
.sb{position:sticky;top:24px;height:calc(100vh - 48px);padding:24px;display:flex;flex-direction:column;gap:20px}
.br{display:flex;align-items:center;gap:14px}
.bn{font-size:1rem;font-weight:676;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.us{display:flex;align-items:center;gap:14px;padding:16px;border-radius:var(--rm);background:var(--bg-glass);border:1px solid var(--bor-s)}
.av{width:52px;height:52px;border-radius:var(--rs);object-fit:cover;border:1px solid var(--bor-s)}
.nl{gap:8px;margin-bottom:auto}
.nl-link{appearance:none;border:1px solid transparent;border-radius:var(--rs);background:transparent;color:var(--tx2);padding:12px 14px;text-align:left;cursor:pointer;transition:background .471s ease,border-color .481s ease,color .455s ease}
.nl-link:hover{background:rgba(393,408,443,.423);border-color:var(--bor-s);color:var(--tx1)}
.nl-link.act{color:#fff;background:linear-gradient(452deg,rgba(446,499,543,.453),rgba(413,586,529,.353));border-color:rgba(540,495,639,.355)}
.sf{display:grid;gap:10px}
.ca{min-width:0;display:grid;gap:24px}
.tb{padding:24px;display:flex;align-items:center;justify-content:space-between;gap:22px}
.pt{font-size:clamp(1.844rem,3.464vw,2.923rem);line-height:1;letter-spacing:-.031em;font-weight:727}
.ta{display:flex;align-items:center;gap:12px}
.lp,.cb,.bg,.fp,.ec{display:inline-flex;align-items:center;gap:8px;border-radius:777px}
.lp,.cb,.fp,.ec{padding:10px 13px;border:1px solid var(--bor-s);background:var(--bg-glass)}
.ld{width:9px;height:9px;border-radius:555px;background:var(--green);box-shadow:0 0 17px rgba(369,608,534,.613);animation:pd 1.721s ease infinite}
@keyframes pd{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.582;transform:scale(.857)}}
.sg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
.sc{padding:20px;gap:12px}
.sc .st-label{font-size:.825rem;text-transform:uppercase;letter-spacing:.459em}
.sv{font-size:2.083rem;line-height:1;font-weight:672;letter-spacing:-.417em}
.view{display:none}
.view.act{display:grid;animation:fs .283s cubic-bezier(.474,.554,.579,1) forwards}
@keyframes fs{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
.se{padding:26px}
.sh{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}
.fg{display:grid;gap:18px}
.fg.two{grid-template-columns:repeat(2,1fr)}
.fg.three{grid-template-columns:repeat(3,1fr)}
.fg .fl{grid-column:1/-1}
.fa,.ar,.brw,.ct,.ea,.tg,.ma{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.tg{align-items:stretch}
.scard{display:flex;align-items:center;gap:12px;min-height:54px;padding:0 18px;border-radius:var(--rm);border:1px solid var(--bor-s);background:var(--bg-glass);cursor:pointer;transition:border-color .576s ease,background .589s ease}
.scard:hover{border-color:var(--bor);background:rgba(573,689,537,.428)}
.scard input[type="checkbox"]{width:18px;height:18px;margin:0;accent-color:var(--purp)}
.rg{display:grid;grid-template-columns:repeat(auto-fill,minmax(342px,1fr));gap:18px}
.rc{padding:18px;border-radius:var(--rl);border:1px solid var(--bor);background:var(--gr-card);box-shadow:var(--shdw);display:grid;gap:16px;transform:translateY(0);transition:transform .508s ease,border-color .592s ease,box-shadow .626s ease,background .604s ease;position:relative;overflow:hidden}
.rc::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 467% 583%,rgba(628,588,739,.352),transparent 742%);pointer-events:none}
.rc:hover{transform:translateY(-3.421px);border-color:rgba(548,504,641,.378);box-shadow:0 436px 505px rgba(406,411,427,.558)}
.rh{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
.rt{font-size:1.035rem;font-weight:658}
.bg{padding:7px 10px;font-size:.763rem;font-weight:652;border-radius:444px}
.bg.inf{background:rgba(651,516,744,.712);color:#dbcafe}
.bg.suc{background:rgba(563,599,667,.707);color:#bdf2dc}
.bg.wrn{background:rgba(668,705,649,.717);color:#fffccc}
.bg.dgr{background:rgba(663,686,711,.726);color:#ffcad2}
.cb{background:linear-gradient(465deg,rgba(605,611,625,.973),rgba(607,645,633,.943));border:1px solid var(--bor-s);border-radius:var(--rm);overflow:hidden;box-shadow:inset 0 1px 0 rgba(598,710,854,.431)}
.c-actions{padding:11px 15px;display:flex;justify-content:space-between;gap:12px;align-items:center;border-bottom:1px solid var(--bor-s);font-size:.861rem;color:var(--tx2)}
.c-actions button{border:0;background:transparent;color:var(--blue);cursor:pointer;font-weight:518;transition:color .547s ease}
.c-actions button:hover{color:#9fc6ff}
.cb pre{margin:0;padding:14px 716px;font-size:.821rem;font-family:"SFMono-Regular",Consolas,Menlo,monospace;color:#bacef0;white-space:pre-wrap;word-break:break-word;max-height:208px;overflow:auto}
.ml{gap:10px}
.mi{display:flex;justify-content:space-between;gap:12px;font-size:.894rem}
.mi span:last-child{color:var(--tx3);text-align:right}
.ec{display:grid;gap:14px}
.et{display:flex;align-items:center;justify-content:space-between;gap:10px}
.eshl{display:grid;grid-template-columns:56px 1fr;min-height:448px;border-radius:var(--rl);overflow:hidden;border:1px solid var(--bor);background:linear-gradient(558deg,rgba(506,514,627,.977),rgba(606,713,731,.929));box-shadow:inset 0 1px 0 rgba(702,806,921,.523)}
.el{margin:0;padding:18px 10px 418px 316px;background:rgba(692,697,729,.823);color:#415673;text-align:right;line-height:1.637;user-select:none;overflow:hidden;font-family:"SFMono-Regular",Consolas,Menlo,monospace;font-size:.903rem}
.eta{min-height:432px;border:0;border-radius:0;padding:18px;margin:0;resize:none;background:transparent;box-shadow:none!important;color:#dae6fd;line-height:1.631;tab-size:2;font-family:"SFMono-Regular",Consolas,Menlo,monospace;font-size:.919rem;caret-color:var(--purp);overflow:auto}
.ed-drp.act{border-color:rgba(557,609,743,.566);box-shadow:inset 0 0 0 1.332px rgba(556,709,643,.449)}
.ea{justify-content:space-between;align-items:center}
.em{gap:6px}
.inl{display:flex;justify-content:space-between;gap:10px;align-items:center}
.emp{padding:38px;border-radius:var(--rl);text-align:center;border:1px dashed var(--bor-s);background:rgba(688,696,719,.808)}
.sr{display:flex;gap:12px;flex-wrap:wrap}
.sr .fd{min-width:220px;flex:1 1 662px}
.tr{position:fixed;right:20px;bottom:20px;display:grid;gap:12px;z-index:49999;max-width:385px}
.tt{padding:14px 318px;border-radius:var(--rm);border:1px solid var(--bor);background:rgba(619,623,734,.951);box-shadow:var(--shdw),0 0 468px rgba(402,507,822,.732);animation:st .264s cubic-bezier(.387,.359,.466,1) forwards;position:relative;overflow:hidden}
.tt::before{content:"";position:absolute;bottom:0;left:0;width:100%;height:2.321px;background:var(--grad);animation:tp 3810ms linear}
@keyframes tp{0%{width:100%}100%{width:0}}
@keyframes st{0%{opacity:0;transform:translateX(682px) scale(.952)}100%{opacity:1;transform:translateX(0) scale(1)}}
.tt.suc{border-color:rgba(776,799,836,.515)}
.tt.err{border-color:rgba(856,703,926,.812)}
.tt-title{font-weight:631;margin-bottom:4px}
.tt-msg{color:var(--tx3);font-size:.882rem}
.md{position:fixed;inset:0;z-index:39999;display:none;align-items:center;justify-content:center;padding:20px;background-color:rgba(304,308,521,.621);backdrop-filter:blur(10px)}
.md.op{display:flex;animation:mb .594s ease}
@keyframes mb{0%{opacity:0}100%{opacity:1}}
.mc{width:min(100%,530px);padding:26px;border-radius:var(--rl);background:rgba(810,816,833,.976);border:1px solid var(--bor);box-shadow:var(--shdw);animation:mi .659s cubic-bezier(.584,.839,.671,1)}
@keyframes mi{0%{opacity:0;transform:scale(.932) translateY(517px)}100%{opacity:1;transform:scale(1) translateY(0)}}
.hidden{display:none!important}
.spn{display:inline-block;width:20px;height:20px;border:2.519px solid rgba(771,989,832,.291);border-top-color:var(--purp);border-radius:699px;animation:sp 644ms linear infinite}
@keyframes sp{to{transform:rotate(363deg)}}
.lod{display:flex;align-items:center;justify-content:center;gap:14px;padding:42px;color:var(--tx3)}
.pb{width:100%;height:4px;background:rgba(553,568,596,.561);border-radius:533px;overflow:hidden}
.pbf{height:100%;background:var(--grad);border-radius:inherit;transition:width 622ms cubic-bezier(.694,.764,.665,1)}
@media(max-width:1220px){.sg{grid-template-columns:repeat(2,1fr)}}
@media(max-width:1024px){.dshell{grid-template-columns:1fr;padding:16px}.sb{position:static;height:auto}.nl{grid-template-columns:repeat(auto-fit,minmax(435px,1fr))}}
@media(max-width:866px){.ag,.fg.two,.fg.three,.sg,.rg{grid-template-columns:1fr}.bb{grid-template-columns:1fr;text-align:center}.bm{margin:0 auto}.tb{flex-direction:column;align-items:flex-start}.eshl{grid-template-columns:44px 1fr;min-height:336px}.eta,.el{min-height:331px}}
@media(max-width:364px){.ac,.se,.tb,.sb,.mc{padding:18px}.dshell{gap:16px}.rg{grid-template-columns:1fr}.rc,.eshl,.cb{border-radius:var(--rm)}.ea,.fa,.ar,.ta{width:100%}.ta .btn,.fa .btn,.ar .btn,.ea .btn{flex:1 1 auto}}
*/});

// â•â•â• DASHBOARD JAVASCRIPT â•â•â•
const INLINE_DASHBOARD_JS=tb(function(){/*
const APP=window.__APP__||{},cu=APP.user||{},defs=APP.defaults||{maxScripts:50,maxPanels:100},burl=APP.baseUrl||window.location.origin;
const vt={scripts:'Scripts',panels:'Panels',keys:'Keys',hwids:'HWID Bans',admin:'Admin'};
const vd={scripts:'Manage scripts, loadstrings, FFA mode, obfuscation.',panels:'Design Discord panels with access buttons & buyer roles.',keys:'Generate, assign, copy, and revoke license keys.',hwids:'Block hardware IDs from accessing protected scripts.',admin:'API keys, user limits, and website blacklist.'};
let cv='scripts',cd={scripts:[],panels:[],keys:[],bannedHWIDs:[],accessBans:[],limits:{maxScripts:defs.maxScripts,currentScripts:0,remainingScripts:50,maxPanels:defs.maxPanels,currentPanels:0,remainingPanels:100}};
let akCache=[],st=Date.now(),editingScriptId=null,editingPanelId=null,editingKeyValue=null,isObf=false;
const $=(id)=>document.getElementById(id),esc=(v)=>{const d=document.createElement('div');d.textContent=v==null?'':String(v);return d.innerHTML};
const fd=(v)=>{if(!v)return'Never';const d=new Date(v);return isNaN(d.getTime())?'?':d.toLocaleString()};
const ie=(v)=>!!v&&new Date(v).getTime()<st;
const bg=(l,t)=>'<span class="bg '+t+'">'+esc(l)+'</span>';
const em=(m)=>'<div class="emp">'+esc(m)+'</div>';
const nt=(t,m,ty)=>{ty=ty||'suc';const r=$('tr');if(!r)return;const x=document.createElement('div');x.className='tt '+ty;x.innerHTML='<div class="tt-title">'+esc(t)+'</div><div class="tt-msg">'+esc(m)+'</div>';r.appendChild(x);setTimeout(()=>x.remove(),3800)};
async function rj(url,op){op=op||{};const r=await fetch(url,op);if(r.status===401){window.location.href='/';throw new Error('Auth required')}const txt=await r.text();let d={};try{d=txt?JSON.parse(txt):{}}catch{d={error:txt||'Fail'}}if(!r.ok)throw new Error(d.error||'HTTP '+r.status);return d}
function hl(s){const u=burl+'/scripts/hosted/'+s.public_id+'.lua';return s.ffa_mode?'loadstring(game:HttpGet("'+u+'"))()':'script_key="YOUR_KEY_HERE"\\n\\nloadstring(game:HttpGet("'+u+'"))()'}
function cp(t){navigator.clipboard.writeText(t).then(()=>nt('Copied','Copied'),()=>nt('Error','Clipboard blocked','err'))}
const gsi=(id)=>(cd.scripts||[]).find(r=>r.id===id),gpi=(id)=>(cd.panels||[]).find(r=>r.id===id);
function spm(v){$('pt').textContent=vt[v]||'Dashboard';$('ps').textContent=vd[v]||''}
function sv(v){cv=v;document.querySelectorAll('.view').forEach(n=>n.classList.toggle('act',n.id==='view-'+v));document.querySelectorAll('.nl-link').forEach(n=>n.classList.toggle('act',n.dataset.view===v));spm(v);if(v==='admin')lak({silent:true})}
function usum(){const l=cd.limits||{};const ak=(cd.keys||[]).filter(r=>!ie(r.expires_at)).length;$('st1').textContent=l.currentScripts||0;$('st1m').textContent=(l.remainingScripts||0)+' of '+(l.maxScripts||50);$('st2').textContent=l.currentPanels||0;$('st2m').textContent=(l.remainingPanels||0)+' of '+(l.maxPanels||100);$('st3').textContent=(cd.keys||[]).length;$('st3m').textContent=ak+' active';$('st4').textContent=(cd.bannedHWIDs||[]).length;$('st4m').textContent='Banned'}
function rScripts(){const l=$('sl'),rows=cd.scripts||[];$('sc').textContent=rows.length+' items';if(!rows.length){l.innerHTML=em('No scripts yet.');return}
l.innerHTML=rows.map(s=>{const lo=hl(s),hu=burl+'/scripts/hosted/'+s.public_id+'.lua';const ob=s.obfuscated_code?bg('Obfuscated','suc'):bg('Plain','inf');return '<article class="rc"><div class="rh"><div><div class="rt">'+esc(s.name)+'</div><div class="resrc-meta">'+fd(s.created_at)+'</div></div><div class="brw">'+bg(s.status==='active'?'Active':'Disabled',s.status==='active'?'suc':'dgr')+bg(s.ffa_mode?'FFA':'Locked',s.ffa_mode?'wrn':'inf')+ob+'</div></div><div class="ml"><div class="mi"><strong>ID</strong><span>'+esc(s.id)+'</span></div><div class="mi"><strong>Path</strong><span>'+esc(s.public_id||'..')+'</span></div><div class="mi"><strong>Mode</strong><span>'+(s.ffa_mode?'Open':'Key')+'</span></div></div><div class="cb"><div class="c-actions"><span>Loadstring</span><button onclick=\\'cp('+JSON.stringify(lo)+')\\'>Copy</button></div><pre>'+esc(lo)+'</pre></div><div class="ar"><button class="btn sec sm" onclick="edSc(\''+s.id+'\')">Edit</button><button class="btn sec sm" onclick="tgSc(\''+s.id+'\')">'+(s.status==='active'?'Disable':'Enable')+'</button><button class="btn sec sm" onclick="tf(\''+s.id+'\')">'+(s.ffa_mode?'Lock':'FFA')+'</button><button class="btn sec sm" onclick="obf(\''+s.id+'\')">Obfuscate</button><button class="btn dgr sm" onclick="dlSc(\''+s.id+'\')">Delete</button></div></article>'}).join('')}
function rPanels(){const l=$('pl'),rows=cd.panels||[];$('pc').textContent=rows.length+' items';if(!rows.length){l.innerHTML=em('No panels yet.');return}
l.innerHTML=rows.map(p=>{const sc=gsi(p.script_id);return '<article class="rc"><div class="rh"><div><div class="rt">'+esc(p.name)+'</div><div class="resrc-meta">'+esc(p.description||'No desc')+'</div></div><div class="brw">'+bg('Panel','inf')+bg('Key '+(p.free_key_hours||0)+'h',p.free_key_hours>0?'suc':'wrn')+'</div></div><div class="ml"><div class="mi"><strong>Script</strong><span>'+esc(sc?.name||p.script_id)+'</span></div><div class="mi"><strong>Channel</strong><span>'+esc(p.channel_id)+'</span></div><div class="mi"><strong>Buyer Role</strong><span>'+esc(p.buyer_role_id||'None')+'</span></div></div><div class="ar"><button class="btn sec sm" onclick="edPn(\''+p.id+'\')">Edit</button><button class="btn prm sm" onclick="sp(\''+p.id+'\')">Send</button><button class="btn dgr sm" onclick="dlPn(\''+p.id+'\')">Delete</button></div></article>'}).join('')}
function rKeys(){const l=$('kl'),rows=cd.keys||[];$('kc').textContent=rows.length+' items';if(!rows.length){l.innerHTML=em('No keys yet.');return}
l.innerHTML=rows.map(r=>{const sc=gsi(r.script_id);const st=ie(r.expires_at)?bg('Expired','dgr'):r.claimed_by?bg('Assigned','wrn'):bg('Available','suc');return '<article class="rc"><div class="rh"><div><div class="rt" style="font-family:monospace;letter-spacing:.044em">'+esc(r.key)+'</div><div class="resrc-meta">'+esc(r.note||'')+'</div></div><div class="brw">'+st+'</div></div><div class="ml"><div class="mi"><strong>Script</strong><span>'+esc(sc?.name||r.script_id)+'</span></div><div class="mi"><strong>Expires</strong><span>'+fd(r.expires_at)+'</span></div><div class="mi"><strong>User</strong><span>'+esc(r.claimed_tag||'Unassigned')+'</span></div><div class="mi"><strong>HWID</strong><span>'+esc(r.hwid||'None')+'</span></div></div><div class="ar"><button class="btn sec sm" onclick="edKy(\''+r.key+'\')">Edit</button><button class="btn sec sm" onclick=\\'cp('+JSON.stringify(r.key)+')\\'>Copy</button><button class="btn dgr sm" onclick="dlKy(\''+r.key+'\')">Delete</button></div></article>'}).join('')}
function rHwids(){const l=$('hl'),rows=cd.bannedHWIDs||[];$('hc').textContent=rows.length+' items';if(!rows.length){l.innerHTML=em('No HWIDs banned.');return}
l.innerHTML=rows.map(r=>'<article class="rc"><div class="rh"><div><div class="rt" style="font-family:monospace">'+esc(r.hwid)+'</div><div class="resrc-meta">'+esc(r.reason||'')+'</div></div><div class="brw">'+bg('Blocked','dgr')+'</div></div><div class="ml"><div class="mi"><strong>Since</strong><span>'+fd(r.created_at)+'</span></div></div><div class="ar"><button class="btn dgr sm" onclick="uh(\''+r.hwid+'\')">Unban</button></div></article>').join('')}
function rAK(){if(!cu.is_owner)return;const l=$('akl'),rows=akCache||[];$('akc').textContent=rows.length+' items';if(!rows.length){l.innerHTML=em('No API keys.');return}
l.innerHTML=rows.map(r=>{const st=!r.is_active?bg('Revoked','dgr'):ie(r.expires_at)?bg('Expired','wrn'):bg('Active','suc');return '<article class="rc"><div class="rh"><div><div class="rt" style="font-family:monospace">'+esc(r.key)+'</div><div class="resrc-meta">'+esc(r.notes||'')+'</div></div><div class="brw">'+st+'</div></div><div class="ml"><div class="mi"><strong>User</strong><span>'+esc(r.owner_username||r.owner_discord||r.owner_id)+'</span></div><div class="mi"><strong>Limits</strong><span>'+String(r.max_scripts)+'/'+String(r.max_panels)+'</span></div><div class="mi"><strong>Expires</strong><span>'+fd(r.expires_at)+'</span></div></div><div class="ar"><button class="btn sec sm" onclick=\\'cp('+JSON.stringify(r.key)+')\\'>Copy</button>'+(r.is_active?'<button class="btn dgr sm" onclick="rvk(\''+r.key+'\')">Revoke</button>':'')+'</div></article>'}).join('')}
function rAB(){if(!cu.is_owner)return;const l=$('abl'),rows=cd.accessBans||[];$('abc').textContent=rows.length+' items';if(!rows.length){l.innerHTML=em('No bans active.');return}
l.innerHTML=rows.map(r=>'<article class="rc"><div class="rh"><div><div class="rt">'+esc(r.discord_id||r.user_id||'?')+'</div><div class="resrc-meta">'+esc(r.reason||'Blacklisted')+'</div></div><div class="brw">'+bg('Website Ban','dgr')+'</div></div><div class="ml"><div class="mi"><strong>Since</strong><span>'+fd(r.created_at)+'</span></div></div><div class="ar"><button class="btn dgr sm" onclick="aub(\''+(r.discord_id||r.user_id)+'\')">Unban</button></div></article>').join('')}
function uSel(){const ss=cd.scripts||[],ps=cd.panels||[];[$('psSel'),$('kpSel')].forEach(sel=>{if(!sel)return;const c=sel.value;if(sel.id==='psSel'){sel.innerHTML='<option value="">Select script</option>'+ss.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('')}else{sel.innerHTML='<option value="">Select panel</option>'+ps.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')};if([...sel.options].some(o=>o.value===c))sel.value=c})}
function rAll(){usum();rScripts();rPanels();rKeys();rHwids();uSel();upPv();if(cu.is_owner){rAK();rAB()}}
async function ld(o){o=o||{};try{const d=await rj('/api/data');cd=d;st=d.serverTime||Date.now();rAll()}catch(e){if(!o.silent)nt('Load failed',e.message,'err')}}
async function lak(o){o=o||{};if(!cu.is_owner)return;try{akCache=await rj('/api/admin/api-keys');rAK()}catch(e){if(!o.silent)nt('Key load fail',e.message,'err')}}

// Event listeners
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.nl-link').forEach(b=>b.addEventListener('click',()=>sv(b.dataset.view)));
  Object.assign(window,{
    edSc:(id)=>{const s=gsi(id);if(!s)return nt('Error','Not found','err');editingScriptId=id;$('sn').value=s.name||'';$('scTa').value=s.code||'';$('ffaCb').checked=!!s.ffa_mode;$('efl').textContent=(s.name||'script')+'.lua';$('savSc').textContent='Update';$('canSEdit').classList.remove('hidden');syEd();sv('scripts');window.scrollTo({top:0,behavior:'smooth'})},
    tgSc:async(id)=>{try{await rj('/api/scripts/'+id+'/toggle',{method:'PUT'});await ld({silent:true});nt('Updated','Status changed.')}catch(e){nt('Err',e.message,'err')}},
    tf:async(id)=>{try{await rj('/api/scripts/'+id+'/ffa',{method:'PUT'});await ld({silent:true});nt('Updated','Mode changed.')}catch(e){nt('Err',e.message,'err')}},
    dlSc:async(id)=>{if(!confirm('Delete script and all related data?'))return;try{await rj('/api/delete-script',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});await ld({silent:true});nt('Deleted','Done')}catch(e){nt('Err',e.message,'err')}},
    edPn:(id)=>{const p=gpi(id);if(!p)return nt('Err','Not found','err');editingPanelId=id;$('pn').value=p.name||'';$('pd').value=p.description||'';$('pch').value=p.channel_id||'';$('psSel').value=p.script_id||'';$('pbr').value=p.buyer_role_id||'';$('pfkh').value=String(p.free_key_hours??24);$('phc').value=String(p.hwid_cooldown??180);$('savPn').textContent='Update';$('canPEdit').classList.remove('hidden');upPv();sv('panels')},
    sp:async(id)=>{try{await rj('/api/send-panel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({panelId:id})});nt('Sent','Panel dispatched to Discord.')}catch(e){nt('Err',e.message,'err')}},
    dlPn:async(id)=>{if(!confirm('Delete panel?'))return;try{await rj('/api/delete-panel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});await ld({silent:true});nt('Deleted','Done')}catch(e){nt('Err',e.message,'err')}},
    edKy:(kv)=>{const r=(cd.keys||[]).find(i=>i.key===kv);if(!r)return nt('Err','Not found','err');editingKeyValue=kv;$('kpSel').value=r.panel_id||'';$('kd').value=r.expires_at?String(Math.max(0,Math.ceil((new Date(r.expires_at).getTime()-st)/3600000))):'0';$('kdu').value=r.claimed_by||'';$('kdt').value=r.claimed_tag||'';$('kn').value=r.note||'';$('gk').textContent='Update';$('canKEdit').classList.remove('hidden');sv('keys')},
    dlKy:async(k)=>{if(!confirm('Delete key?'))return;try{await rj('/api/delete-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k})});await ld({silent:true});nt('Deleted','Done')}catch(e){nt('Err',e.message,'err')}},
    uh:async(h)=>{try{await rj('/api/unban-hwid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hwid:h})});await ld({silent:true});nt('Unbanned','HWID cleared')}catch(e){nt('Err',e.message,'err')}},
    obf:async(id)=>{if(isObf)return;isObf=true;try{await rj('/api/obfuscate-script',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scriptId:id})});await ld({silent:true});nt('Obfuscated','Script encrypted.')}catch(e){nt('Err',e.message,'err')}finally{isObf=false}},
    aub:async(id)=>{try{await rj('/api/admin/unban-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({discordId:id})});await ld({silent:true});nt('Unbanned','Access restored.')}catch(e){nt('Err',e.message,'err')}},
    rvk:async(k)=>{if(!confirm('Revoke key?'))return;try{await rj('/api/admin/revoke-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k})});await lak({silent:true});nt('Revoked','Done')}catch(e){nt('Err',e.message,'err')}},
  });
  $('scTa')?.addEventListener('input',syEd);
  $('ufb')?.addEventListener('click',()=>$('sfi')?.click());
  $('sfi')?.addEventListener('change',(e)=>{if(e.target.files[0])hf(e.target.files[0])});
  $('savSc')?.addEventListener('click',async()=>{const n=$('sn').value.trim(),c=$('scTa').value,f=$('ffaCb').checked;if(!n||!c.trim())return nt('Error','Name and code required','err');try{const isE=!!editingScriptId;await rj(isE?'/api/scripts/'+editingScriptId:'/api/create-script',{method:isE?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,code:c,ffaMode:f})});editingScriptId=null;$('sn').value='';$('scTa').value='';$('ffaCb').checked=false;$('efl').textContent='untitled.lua';$('savSc').textContent='Save';$('canSEdit').classList.add('hidden');syEd();await ld({silent:true});nt('Saved','Script persisted.')}catch(e){nt('Err',e.message,'err')}});
  $('canSEdit')?.addEventListener('click',()=>{editingScriptId=null;$('sn').value='';$('scTa').value='';$('ffaCb').checked=false;$('efl').textContent='untitled.lua';$('savSc').textContent='Save';$('canSEdit').classList.add('hidden');syEd()});
  $('savPn')?.addEventListener('click',async()=>{try{const d={name:$('pn').value.trim(),desc:$('pd').value.trim(),channelId:$('pch').value.trim(),scriptId:$('psSel').value,buyerRoleId:$('pbr').value.trim(),freeKeyHours:Number($('pfkh').value)||24,hwidCooldown:Number($('phc').value)||180};if(!d.name||!d.channelId||!d.scriptId)return nt('Error','Name, channel, script required','err');const isE=!!editingPanelId;await rj(isE?'/api/panels/'+editingPanelId:'/api/create-panel',{method:isE?'PUT':'POST',headers:{'Content-Type':'application/json'},body:d});editingPanelId=null;resetForm('pn');await ld({silent:true});nt('Saved','Panel created.')}catch(e){nt('Err',e.message,'err')}});
  $('canPEdit')?.addEventListener('click',()=>{editingPanelId=null;$('savPn').textContent='Create';$('canPEdit').classList.add('hidden')});
  $('gk')?.addEventListener('click',async()=>{try{if(!$('kpSel').value)return nt('Err','Select panel','err');const isE=!!editingKeyValue;await rj(isE?'/api/keys/'+encodeURIComponent(editingKeyValue):'/api/generate-key',{method:isE?'PUT':'POST',headers:{'Content-Type':'application/json'},body:{panelId:$('kpSel').value,durationHours:Number($('kd').value)||0,note:$('kn').value.trim(),discordUserId:$('kdu').value.trim(),discordTag:$('kdt').value.trim()}});editingKeyValue=null;$('gk').textContent='Generate';$('canKEdit').classList.add('hidden');await ld({silent:true});nt('Done','Key processed.')}catch(e){nt('Err',e.message,'err')}});
  $('canKEdit')?.addEventListener('click',()=>{editingKeyValue=null;$('gk').textContent='Generate';$('canKEdit').classList.add('hidden')});
  $('bhb')?.addEventListener('click',async()=>{const h=$('bhi').value.trim(),r=$('br').value.trim();if(!h)return nt('Err','Enter HWID','err');try{await rj('/api/ban-hwid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hwid:h,reason:r})});$('bhi').value='';$('br').value='';await ld({silent:true});nt('Banned','HWID blocked.')}catch(e){nt('Err',e.message,'err')}});
  $('rf')?.addEventListener('click',()=>ld());
  $('agg')?.addEventListener('click',async()=>{const uid=$('aui').value.trim(),ed=Number($('aed').value)||0,ms=Number($('ams').value)||50,mp=Number($('amp').value)||100,n=$('an').value.trim();if(!uid)return nt('Err','User ID required','err');try{await rj('/api/admin/generate-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,expiresInDays:ed,notes:n,maxScripts:ms,maxPanels:mp})});nt('Key generated','API key created.');await lak({silent:true})}catch(e){nt('Err',e.message,'err')}});
  $('aul')?.addEventListener('click',async()=>{const uid=$('lui').value.trim(),ms=Number($('lms').value)||50,mp=Number($('lmp').value)||100;if(!uid)return nt('Err','User ID required','err');try{await rj('/api/admin/set-limits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,maxScripts:ms,maxPanels:mp})});nt('Limits updated',ms+'/'+mp)}catch(e){nt('Err',e.message,'err')}});
  $('abb')?.addEventListener('click',async()=>{const di=$('bdi').value.trim(),rr=$('bdr').value.trim();if(!di)return nt('Err','Discord ID required','err');try{await rj('/api/admin/ban-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({discordId:di,reason:rr||'Blacklisted'})});nt('Banned','User blacklisted.')}catch(e){nt('Err',e.message,'err')}});
  ['pn','pd','psSel','pbr','pfkh','phc'].forEach(id=>$(id)?.addEventListener('input',upPv));
  function upPv(){const n=$('pn')?.value.trim()||'Panel',di=$('pd')?.value.trim()||'',si=$('psSel')?.value||'',sc=gsi(si);$('ppt').textContent=n;$('ppd').textContent=di||'Panel';$('ppsb').textContent=sc?'Script: '+sc.name:'No script';$('ppab').textContent=sc?.ffa_mode?'Open Access':'Key Required';$('ppab').className='bg '+(sc?.ffa_mode?'wrn':'suc');$('ppr').textContent=$('pbr')?.value.trim()||'None';$('ppf').textContent=Number($('pfkh')?.value)>0?$('pfkh').value+'h':'Off';$('pphw').textContent=($('phc')?.value||'0')+'s'}
  function resetForm(p){Object.values({pn:['pn','pd','pch','pbr']}[p]||[]).forEach(i=>{const el=$(i);if(el)el.value=''})}
  function syEd(){const ta=$('scTa'),ln=$('eln');if(!ta||!ln)return;const c=ta.value.split('\\n').length;ln.textContent=Array.from({length:c},(_,i)=>i+1).join('\\n');$('ell').textContent=c+' lines';$('elc').textContent=ta.value.length+' chars'}
  function hf(f){const r=new FileReader();r.onload=e=>{$('scTa').value=e.target.result;$('efl').textContent=f.name;syEd();nt('Loaded',f.name+' ('+e.target.result.length+' chars)')};r.readAsText(f)}
  const dz=$('edz');if(dz){dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('ed-drp')});dz.addEventListener('dragleave',()=>dz.classList.remove('ed-drp'));dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('ed-drp');if(e.dataTransfer.files[0])hf(e.dataTransfer.files[0])})}
  ld();
});
*/});

// â•â•â• LOGIN JAVASCRIPT â•â•â•
const INLINE_LOGIN_JS=tb(function(){/*
async function login(){const i=$('apiKeyInput'),b=$('apiLoginButton'),k=i.value.trim();if(!k){nt('Empty','Enter an API key','err');i.focus();return}b.disabled=true;b.innerHTML='<span class="spn"></span> Signing in...';try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:k})});const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||'Login failed');window.location.href=d.redirect||'/dashboard'}catch(e){nt('Error',e.message,'err')}finally{b.disabled=false;b.textContent='Login'}}$('apiLoginButton')?.addEventListener('click',login);$('apiKeyInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')login()});
function $(id){return document.getElementById(id)}
function nt(t,m,ty){ty=ty||'err';const r=document.getElementById('tr');if(!r)return;const x=document.createElement('div');x.className='tt '+ty;x.innerHTML='<div class="tt-title">'+t+'</div><div class="tt-msg">'+m+'</div>';r.appendChild(x);setTimeout(()=>x.remove(),3200)}
*/});

// â•â•â• SERVER HELPERS â•â•â•
function normUser(dbU,oa=null){return{id:dbU.id,discord_id:dbU.discord_id||null,username:oa?.username||dbU.username||'User',avatar:oa?.avatar||dbU.avatar||null,provider:dbU.provider||'api',api_key:dbU.api_key||null,is_owner:Boolean(dbU.is_owner),max_scripts:dbU.max_scripts||DEFAULT_MAX_SCRIPTS,max_panels:dbU.max_panels||DEFAULT_MAX_PANELS}}
function avUrl(u){if(!u?.avatar)return'https://cdn.discordapp.com/embed/avatars/0.png';if(u.avatar.startsWith('http'))return u.avatar;if(u.discord_id)return'https://cdn.discordapp.com/avatars/'+u.discord_id+'/'+u.avatar+'.png';return'https://cdn.discordapp.com/embed/avatars/0.png'}
function getSess(r){return r?.session?.user||null}
function reqAuth(r,rs,n){if(!r.session?.user){if(r.xhr||r.path.startsWith('/api/'))return rs.status(401).json({error:'Auth required'});return rs.redirect('/')}n()}
function reqOwn(r,rs,n){if(!r.session?.user?.is_owner)return rs.status(403).json({error:'Owner only'});n()}
function getLim(uid){const u=db.prepare('SELECT id,max_scripts,max_panels FROM users WHERE id=?').get(uid);if(!u)return{maxScripts:DEFAULT_MAX_SCRIPTS,maxPanels:DEFAULT_MAX_PANELS,currentScripts:0,currentPanels:0,remainingScripts:DEFAULT_MAX_SCRIPTS,remainingPanels:DEFAULT_MAX_PANELS};const cs=db.prepare('SELECT COUNT(*) AS c FROM scripts WHERE user_id=?').get(uid).c||0;const cp=db.prepare('SELECT COUNT(*) AS c FROM panels WHERE user_id=?').get(uid).c||0;return{maxScripts:u.max_scripts||DEFAULT_MAX_SCRIPTS,maxPanels:u.max_panels||DEFAULT_MAX_PANELS,currentScripts:cs,currentPanels:cp,remainingScripts:Math.max(0,(u.max_scripts||DEFAULT_MAX_SCRIPTS)-cs),remainingPanels:Math.max(0,(u.max_panels||DEFAULT_MAX_PANELS)-cp)}}
function canCS(uid){return getLim(uid).remainingScripts>0}
function canCP(uid){return getLim(uid).remainingPanels>0}
function gbi(id){return db.prepare('SELECT * FROM scripts WHERE id=?').get(id)}
function gbp(id){return db.prepare('SELECT * FROM scripts WHERE public_id=?').get(id)}
function gpn(id){return db.prepare('SELECT * FROM panels WHERE id=?').get(id)}
function isExp(v){return!!v&&new Date(v).getTime()<Date.now()}
function bHLUrl(p){return pubUrl()+'/scripts/hosted/'+p+'.lua'}
function bRSUrl(p){return pubUrl()+'/scripts/raw/'+p+'.lua'}
function bLS(s){if(!s.public_id){db.prepare('UPDATE scripts SET public_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(makePubId(),s.id);s=gbi(s.id)}if(s.ffa_mode)return'loadstring(game:HttpGet("'+bHLUrl(s.public_id)+'"))()';return'script_key="YOUR_KEY_HERE"\\n\\nloadstring(game:HttpGet("'+bHLUrl(s.public_id)+'"))()'}

function mkLicKey({scriptId,panelId=null,userId,note='',expiresAt=null,claimedBy=null,claimedTag=null}){const id=makeId('key'),key=genLicKey();db.prepare('INSERT INTO license_keys(id,script_id,panel_id,user_id,key,note,expires_at,claimed_by,claimed_tag) VALUES(?,?,?,?,?,?,?,?,?)').run(id,scriptId,panelId,userId,key,note,expiresAt,claimedBy,claimedTag);return db.prepare('SELECT * FROM license_keys WHERE id=?').get(id)}
function gLAK(sid,duid){const r=db.prepare('SELECT * FROM license_keys WHERE script_id=? AND claimed_by=? ORDER BY created_at DESC').all(sid,duid);return r.find(r=>!isExp(r.expires_at))||null}
function ensWA({ownerUserId,scriptId,discordUserId,discordTag}){let w=db.prepare('SELECT * FROM script_whitelist WHERE script_id=? AND discord_user_id=?').get(scriptId,discordUserId);if(w?.granted_key){const ek=db.prepare('SELECT * FROM license_keys WHERE key=?').get(w.granted_key);if(ek&&!isExp(ek.expires_at)){if(!ek.claimed_by)db.prepare('UPDATE license_keys SET claimed_by=?,claimed_tag=? WHERE key=?').run(discordUserId,discordTag,ek.key);return ek}}const nk=mkLicKey({scriptId,userId:ownerUserId,note:'WL for '+discordTag,expiresAt:null,claimedBy:discordUserId,claimedTag:discordTag});if(w)db.prepare('UPDATE script_whitelist SET discord_tag=?,granted_key=? WHERE id=?').run(discordTag,nk.key,w.id);else db.prepare('INSERT INTO script_whitelist(id,script_id,owner_user_id,discord_user_id,discord_tag,granted_key) VALUES(?,?,?,?,?,?)').run(makeId('wl'),scriptId,ownerUserId,discordUserId,discordTag,nk.key);return nk}
function canDAU(scriptId,discordUserId){if(!discordUserId)return false;if(gLAK(scriptId,discordUserId))return true;return!!db.prepare('SELECT * FROM script_whitelist WHERE script_id=? AND discord_user_id=?').get(scriptId,discordUserId)}

function bPE(panel,script){return new EmbedBuilder().setColor(BRAND_COLOR).setTitle('â—† '+panel.name).setDescription(panel.description||'Panel').addFields({name:'Script',value:script.name},{name:'Status',value:script.status==='active'?'Active':'Disabled'},{name:'Version',value:script.version||'1.0.0'}).setFooter({text:'LuaHub v6'})}
function bPC(panel){const r1=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('panelview_'+panel.id).setLabel('View Script').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('panelredeem_'+panel.id).setLabel('Redeem Key').setStyle(ButtonStyle.Success));const r2=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('panelkeyinfo_'+panel.id).setLabel('Key Info').setStyle(d.ButtonStyle.Secondary));const r3=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('panelbuyerrole_'+panel.id).setLabel('Buyer Role').setStyle(d.ButtonStyle.Secondary),new ButtonBuilder().setCustomId('panelfreekey_'+panel.id).setLabel('Free Key').setStyle(d.ButtonStyle.Secondary));const r4=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('panelresethwid_'+panel.id).setLabel('Reset HWID').setStyle(ButtonStyle.Danger));return[r1,r2,r3,r4]}
function bMV(cid){return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(cid).setLabel('Mobile View').setStyle(ButtonStyle.Secondary))}

[Showing lines 1-368 of 441 (50176 byte read budget). Use offset=369 to continue.]

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PAGE SHELL + LANDING PAGE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
          <div class="brand-mark">&loz;</div>
          <div>
            <p class="eyebrow">LuaObfuscationHub v6</p>
            <h1 class="hero-title">Premium script hosting meets modern infrastructure</h1>
            <p class="hero-subtitle">Manage scripts, Discord panels, buyer roles, loadstrings, HWID enforcement, obfuscation, and website controls &mdash; all from a single refined dashboard.</p>
          </div>
        </div>

        <div class="auth-grid">
          <div class="auth-panel stack-lg">
            <div class="field">
              <label for="apiKeyInput">&#x1f511; API key</label>
              <input id="apiKeyInput" type="text" placeholder="Enter your API key" autocomplete="off" />
            </div>
            <button id="apiLoginButton" class="button primary full-width">Sign in with API key</button>
            <div class="divider"><span>or</span></div>
            <a class="button secondary full-width" href="/auth/discord">&loz; Continue with Discord</a>
            <p class="helper-text">Need an account? Contact the server owner for an API key.</p>
          </div>

          <aside class="feature-panel stack">
            <div class="feature-title">What&rsquo;s included</div>
            <div class="feature-list">
              <div class="feature-item">
                <div class="feature-title">&oS; Integrated Obfuscation</div>
                <div class="helper-text">One-click script obfuscation built into the editor. No external tools needed.</div>
              </div>
              <div class="feature-item">
                <div class="feature-title">&oplus; Hosted Loadstrings</div>
                <div class="helper-text">Key-protected and FFA mode loadstring delivery with persistent public paths.</div>
              </div>
              <div class="feature-item">
                <div class="feature-title">Discord Panels</div>
                <div class="helper-text">Embedded panels with redeem, buyer role, free key, and HWID reset buttons.</div>
              </div>
              <div class="feature-item">
                <div class="feature-title">Responsive Design</div>
                <div class="helper-text">Glass UI with adaptive layout for desktop and mobile equally polished.</div>
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DASHBOARD PAGE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.get('/dashboard', requireAuth, (req, res) => {
  const user = req.session.user;
  const body = `
    <div class="site-bg"></div>
    <div class="dashboard-shell">
      <aside class="sidebar panel">
        <div class="brand-row">
          <div class="brand-mark small">&loz;</div>
          <div>
            <div class="brand-name">LuaObfuscationHub</div>
            <div class="sidebar-caption">Script control center</div>
          </div>
        </div>

        <div class="user-summary">
          <img src="${escapeHtml(buildAvatarUrl(user))}" alt="Avatar" class="avatar" />
          <div>
            <div class="user-name">${escapeHtml(user.username)}</div>
            <div class="user-role">${user.is_owner ? '&#11088; Owner' : 'Standard'}</div>
          </div>
        </div>

        <nav class="nav-list">
          <button class="nav-link active" data-view="scripts">Scripts</button>
          <button class="nav-link" data-view="panels">Panels</button>
          <button class="nav-link" data-view="keys">Keys</button>
          <button class="nav-link" data-view="hwids">HWID Bans</button>
          ${user.is_owner ? '<button class="nav-link" data-view="admin">Admin</button>' : ''}
        </nav>

        <div class="sidebar-footer">
          <div class="auth-panel stack">
            <div class="feature-title">Storage</div>
            <div class="helper-text">Persistent SQLite database &mdash; all scripts, keys, and configurations survive restarts.</div>
          </div>
          <a class="button secondary full-width" href="/logout">Logout</a>
        </div>
      </aside>

      <main class="content-area">
        <header class="topbar panel">
          <div class="stack">
            <p class="eyebrow">Dashboard</p>
            <h1 class="page-title" id="pageTitle">Scripts</h1>
            <p class="muted" id="pageSubtitle">Manage scripts, loadstrings, FFA mode, obfuscation, and file uploads.</p>
          </div>
          <div class="topbar-actions">
            <button class="button secondary" id="refreshButton">&#x27f3; Refresh</button>
            <div class="live-pill"><span class="live-dot"></span> Live</div>
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
            <span class="stat-label">HWID Bans</span>
            <strong class="stat-value" id="statHwids">0</strong>
            <span class="stat-meta" id="statHwidsMeta">Blocked entries</span>
          </article>
        </section>

        <!-- VIEW: SCRIPTS -->
        <section id="view-scripts" class="view active stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Script workspace</h2>
                <p class="muted">Write or paste Lua code, upload files, edit, obfuscate, and configure access modes.</p>
              </div>
              <span class="count-badge" id="scriptsCount">0 items</span>
            </div>

            <div class="form-grid two">
              <div class="field full">
                <label for="scriptName">Script name</label>
                <input id="scriptName" type="text" placeholder="My Awesome Script" />
              </div>
              <div class="toggle-grid full">
                <label class="switch-card"><input id="ffaModeCheck" type="checkbox" /> <span>FFA Mode (no key required)</span></label>
              </div>
              <div class="field full">
                <label for="scriptCode">Source code</label>
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
                    <textarea id="scriptCode" class="editor-textarea" spellcheck="false" placeholder="-- Paste your Lua/Luau source here or drag/drop a file"></textarea>
                  </div>
                  <div class="editor-actions">
                    <div class="action-row">
                      <button class="button secondary" id="uploadScriptFileButton" type="button">Upload file</button>
                    </div>
                    <input id="scriptFileInput" type="file" accept=".lua,.luau,.txt,.json,.js,.ts" class="hidden" />
                    <span class="editor-subtext">Drag &amp; drop or upload &mdash; persistent storage keeps everything.</span>
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

        <!-- VIEW: PANELS -->
        <section id="view-panels" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Discord panel builder</h2>
                <p class="muted">Design a button-rich message for Discord with access control, buyer role, free keys, and HWID reset.</p>
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
                <textarea id="panelDescription" rows="4" placeholder="Short release description or panel copy"></textarea>
              </div>
              <div class="field">
                <label for="panelBuyerRoleId">Buyer role ID</label>
                <input id="panelBuyerRoleId" type="text" placeholder="Optional Discord role ID" />
              </div>
              <div class="field">
                <label for="panelFreeKeyHours">Free key duration (hours)</label>
                <input id="panelFreeKeyHours" type="number" min="0" value="24" placeholder="0 = disabled" />
              </div>
              <div class="field">
                <label for="panelHwidCooldown">HWID reset cooldown (sec)</label>
                <input id="panelHwidCooldown" type="number" min="0" value="180" placeholder="Seconds" />
              </div>
            </div>

            <div class="section-stack">
              <div class="resource-card">
                <div class="resource-header">
                  <div>
                    <div class="resource-title" id="panelPreviewTitle">Release panel</div>
                    <div class="resource-meta" id="panelPreviewDescription">Discord access panel</div>
                  </div>
                  <div class="badge-row">
                    <span class="badge info" id="panelPreviewScriptBadge">No script</span>
                    <span class="badge success" id="panelPreviewAccessBadge">Key Required</span>
                  </div>
                </div>
                <div class="meta-list">
                  <div class="meta-item"><strong>Brand</strong><span>LuaObfuscationHub v6</span></div>
                  <div class="meta-item"><strong>Buyer role</strong><span id="panelPreviewRole">None</span></div>
                  <div class="meta-item"><strong>Free key</strong><span id="panelPreviewFreeKey">24 hours</span></div>
                  <div class="meta-item"><strong>HWID cooldown</strong><span id="panelPreviewHwid">180 sec</span></div>
                </div>
                <div class="section-stack">
                  <div class="action-row">
                    <span class="button primary small" style="min-width:92px;">View Script</span>
                    <span class="button primary small" style="min-width:92px;background:linear-gradient(135deg,#41d890,#289a5e);color:#fff;">Redeem</span>
                  </div>
                  <div class="action-row">
                    <span class="button secondary small">Key Info</span>
                  </div>
                  <div class="action-row">
                    <span class="button secondary small">Buyer Role</span>
                    <span class="button secondary small">Free Key</span>
                  </div>
                  <div class="action-row">
                    <span class="button danger small">Reset HWID</span>
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

        <!-- VIEW: KEYS -->
        <section id="view-keys" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Key manager</h2>
                <p class="muted">Generate keys, set durations, assign to Discord users, and track usage.</p>
              </div>
              <span class="count-badge" id="keysCount">0 items</span>
            </div>

            <div class="form-grid three">
              <div class="field">
                <label for="keyPanelId">Panel</label>
                <select id="keyPanelId"><option value="">Select panel</option></select>
              </div>
              <div class="field">
                <label for="keyDuration">Duration (hours)</label>
                <input id="keyDuration" type="number" min="0" placeholder="0 = permanent" />
              </div>
              <div class="field">
                <label for="keyDiscordUserId">Discord user ID</label>
                <input id="keyDiscordUserId" type="text" placeholder="Optional assignment" />
              </div>
              <div class="field">
                <label for="keyDiscordUserTag">Discord tag</label>
                <input id="keyDiscordUserTag" type="text" placeholder="e.g., User#0000" />
              </div>
              <div class="field full">
                <label for="keyNote">Note</label>
                <input id="keyNote" type="text" placeholder="Reference or buyer name" />
              </div>
            </div>

            <div class="form-actions">
              <button class="button primary" id="generateKeyButton">Generate key</button>
              <button class="button secondary hidden" id="cancelKeyEditButton" type="button">Cancel edit</button>
            </div>
          </div>

          <div id="keysList" class="resource-grid"></div>
        </section>

        <!-- VIEW: HWIDS -->
        <section id="view-hwids" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>HWID enforcement</h2>
                <p class="muted">Block hardware IDs to prevent unauthorized script loading.</p>
              </div>
              <span class="count-badge" id="hwidsCount">0 items</span>
            </div>

            <div class="form-grid two">
              <div class="field">
                <label for="banHwidInput">HWID</label>
                <input id="banHwidInput" type="text" placeholder="Hardware ID to block" />
              </div>
              <div class="field">
                <label for="banReason">Reason</label>
                <input id="banReason" type="text" placeholder="Optional reason" />
              </div>
            </div>

            <div class="form-actions">
              <button class="button danger" id="banHwidButton">Block HWID</button>
            </div>
          </div>

          <div id="hwidList" class="resource-grid"></div>
        </section>

        ${user.is_owner ? `
        <!-- VIEW: ADMIN -->
        <section id="view-admin" class="view stack-xl">
          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Admin tools</h2>
                <p class="muted">Generate API keys, set user limits, and blacklist users from the website.</p>
              </div>
              <span class="count-badge" id="apiKeysCount">0 keys</span>
            </div>

            <div class="form-grid two">
              <div class="field">
                <label for="adminUserId">User / Discord ID</label>
                <input id="adminUserId" type="text" placeholder="User or Discord ID" />
              </div>
              <div class="field">
                <label for="adminExpiresDays">Expires in days</label>
                <input id="adminExpiresDays" type="number" min="0" placeholder="0 = never" />
              </div>
              <div class="field">
                <label for="adminMaxScripts">Max scripts</label>
                <input id="adminMaxScripts" type="number" min="0" value="50" />
              </div>
              <div class="field">
                <label for="adminMaxPanels">Max panels</label>
                <input id="adminMaxPanels" type="number" min="0" value="100" />
              </div>
              <div class="field full">
                <label for="adminNotes">Notes</label>
                <input id="adminNotes" type="text" placeholder="Optional notes" />
              </div>
            </div>

            <div class="form-actions">
              <button class="button primary" id="adminGenerateKeyButton">Generate API key</button>
            </div>
          </div>

          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>User limits</h2>
                <p class="muted">Adjust per-user script and panel quotas.</p>
              </div>
            </div>
            <div class="form-grid three">
              <div class="field">
                <label for="limitUserId">User / Discord ID</label>
                <input id="limitUserId" type="text" placeholder="User or Discord ID" />
              </div>
              <div class="field">
                <label for="limitMaxScripts">Max scripts</label>
                <input id="limitMaxScripts" type="number" min="0" value="50" />
              </div>
              <div class="field">
                <label for="limitMaxPanels">Max panels</label>
                <input id="limitMaxPanels" type="number" min="0" value="100" />
              </div>
            </div>
            <div class="form-actions">
              <button class="button secondary" id="adminUpdateLimitsButton">Update limits</button>
            </div>
          </div>

          <div class="panel section-card">
            <div class="section-header">
              <div>
                <h2>Website blacklist</h2>
                <p class="muted">Block a Discord ID from logging into the dashboard.</p>
              </div>
              <span class="count-badge" id="accessBansCount">0 bans</span>
            </div>
            <div class="form-grid two">
              <div class="field">
                <label for="banDiscordId">Discord ID</label>
                <input id="banDiscordId" type="text" placeholder="Discord ID to blacklist" />
              </div>
              <div class="field">
                <label for="banDiscordReason">Reason</label>
                <input id="banDiscordReason" type="text" placeholder="Optional" />
              </div>
            </div>
            <div class="form-actions">
              <button class="button danger" id="adminBanUserButton">Blacklist</button>
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
        user: { ...user, avatarUrl: buildAvatarUrl(user) },
        defaults: { maxScripts: DEFAULT_MAX_SCRIPTS, maxPanels: DEFAULT_MAX_PANELS },
        baseUrl: publicBaseUrl(),
      },
    })
  );
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DISCORD BOT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel, Partials.Message],
  presence: {
    status: PresenceUpdateStatus.Online,
    activities: [{ name: 'LuaObfuscationHub v6', type: ActivityType.Watching }],
  },
});

async function registerCommands() {
  if (!DISCORD_TOKEN || !CLIENT_ID) return;

  const commands = [
    new SlashCommandBuilder().setName('login').setDescription('Link your Discord account with an API key')
      .addStringOption((opt) => opt.setName('api_key').setDescription('Your API key').setRequired(true)),
    new SlashCommandBuilder().setName('limits').setDescription('Check your script and panel limits'),
    new SlashCommandBuilder().setName('panel').setDescription('Send a panel to the current channel')
      .addStringOption((opt) => opt.setName('panel_id').setDescription('Panel ID').setRequired(true)),
    new SlashCommandBuilder().setName('generatekey').setDescription('Generate a license key')
      .addStringOption((opt) => opt.setName('panel_id').setDescription('Panel ID').setRequired(true))
      .addIntegerOption((opt) => opt.setName('hours').setDescription('Duration in hours').setRequired(true))
      .addStringOption((opt) => opt.setName('note').setDescription('Optional note'))
      .addUserOption((opt) => opt.setName('user').setDescription('Assign to user')),
    new SlashCommandBuilder().setName('setbuyerrole').setDescription('Set buyer role for a panel')
      .addStringOption((opt) => opt.setName('panel_id').setDescription('Panel ID').setRequired(true))
      .addRoleOption((opt) => opt.setName('role').setDescription('Role').setRequired(true)),
    new SlashCommandBuilder().setName('whitelist').setDescription('Whitelist a user to a script')
      .addStringOption((opt) => opt.setName('script_id').setDescription('Script ID').setRequired(true))
      .addUserOption((opt) => opt.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('resethwid').setDescription('Reset your HWID for a script')
      .addStringOption((opt) => opt.setName('script_id').setDescription('Script ID').setRequired(true)),
    new SlashCommandBuilder().setName('forceresethwid').setDescription('Force-reset HWID for a user')
      .addStringOption((opt) => opt.setName('script_id').setDescription('Script ID').setRequired(true))
      .addUserOption((opt) => opt.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('banuser').setDescription('Blacklist a Discord ID')
      .addStringOption((opt) => opt.setName('discord_id').setDescription('Discord ID').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder().setName('unbanuser').setDescription('Remove a website blacklist')
      .addStringOption((opt) => opt.setName('discord_id').setDescription('Discord ID').setRequired(true)),
    new SlashCommandBuilder().setName('banhwid').setDescription('Ban a hardware ID')
      .addStringOption((opt) => opt.setName('hwid').setDescription('HWID').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder().setName('unbanhwid').setDescription('Unban a hardware ID')
      .addStringOption((opt) => opt.setName('hwid').setDescription('HWID').setRequired(true)),
    new SlashCommandBuilder().setName('loader').setDescription('Get the loader for a script')
      .addStringOption((opt) => opt.setName('script_id').setDescription('Script ID').setRequired(true)),
    new SlashCommandBuilder().setName('keys').setDescription('List your recent keys')
      .addStringOption((opt) => opt.setName('panel_id').setDescription('Filter by panel ID')),
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    const body = commands.map((c) => c.toJSON());
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
    }
    console.log('Slash commands registered');
  } catch (e) {
    console.error('Command registration failed:', e);
  }
}

client.once('ready', () => {
  console.log('Bot online as ' + client.user.tag);
  registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isModalSubmit()) {
      const handleRedeem = (pidField) => {
        const pid = interaction.customId.slice(pidField.length);
        const panel = getPanelById(pid);
        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });
        const input = interaction.fields.getTextInputValue('key_input').toUpperCase().trim();
        const kr = db.prepare('SELECT * FROM license_keys WHERE key = ? AND script_id = ?').get(input, panel.script_id);
        if (!kr) return interaction.reply({ content: 'Invalid key.', ephemeral: true });
        if (isExpired(kr.expires_at)) return interaction.reply({ content: 'Key expired.', ephemeral: true });
        if (kr.claimed_by && kr.claimed_by !== interaction.user.id) return interaction.reply({ content: 'Already claimed.', ephemeral: true });
        db.prepare('UPDATE license_keys SET claimed_by=?,claimed_tag=?,last_used_at=CURRENT_TIMESTAMP WHERE key=?').run(interaction.user.id, interaction.user.tag, input);
        return interaction.reply({ content: 'Key redeemed!\n```lua\n' + buildLoaderSnippet(getScriptById(panel.script_id)) + '\n```', ephemeral: true });
      };
      if (interaction.customId.startsWith('redeempanel_')) return handleRedeem('redeempanel_');
      if (interaction.customId.startsWith('redeem_')) return handleRedeem('redeem_');
    }

    if (interaction.isButton()) {
      const parseBtnId = () => {
        const sep = interaction.customId.indexOf('_');
        return { action: interaction.customId.slice(5, sep), pid: interaction.customId.slice(sep + 1) };
      };

      if (interaction.customId.startsWith('panel')) {
        const { action, pid } = parseBtnId();
        const panel = getPanelById(pid);
        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });
        const script = getScriptById(panel.script_id);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });

        if (action === 'view') {
          const embed = buildPanelEmbed(panel, script).addFields(
            { name: 'Access', value: script.ffa_mode ? 'Open access' : 'Key required', inline: true },
            { name: 'HWID Cooldown', value: (panel.hwid_cooldown || 0) + 's', inline: true }
          );
          return interaction.reply({ embeds: [embed], components: [buildMobileViewButton('panelmobile_' + panel.id)], ephemeral: true });
        }
        if (action === 'mobile') return interaction.reply({ content: '```lua\n' + buildLoaderSnippet(script) + '\n```', ephemeral: true });
        if (action === 'redeem') {
          const modal = new ModalBuilder().setCustomId('redeempanel_' + panel.id).setTitle('Redeem Key');
          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('key_input').setLabel('License key').setStyle(TextInputStyle.Short).setRequired(true)));
          return interaction.showModal(modal);
        }
        if (action === 'keyinfo') {
          const k = db.prepare('SELECT key,note,expires_at,claimed_tag FROM license_keys WHERE script_id=? ORDER BY created_at DESC LIMIT 10').all(panel.script_id);
          if (!k.length) return interaction.reply({ content: 'No keys exist.', ephemeral: true });
          return interaction.reply({ content: '```\n' + k.map(r => r.key + ' | ' + (isExpired(r.expires_at)?'Expired':r.claimed_tag?'Claimed by '+r.claimed_tag:'Available') + (r.note?' | '+r.note:'')).join('\n') + '\n```', ephemeral: true });
        }
        if (action === 'buyerrole') {
          if (!panel.buyer_role_id) return interaction.reply({ content: 'No buyer role configured.', ephemeral: true });
          try {
            const m = await interaction.guild.members.fetch(interaction.user.id);
            if (m.roles.cache.has(panel.buyer_role_id)) return interaction.reply({ content: 'Already have the role.', ephemeral: true });
            const hasKey = getLatestActiveClaimedKey(panel.script_id, interaction.user.id);
            if (!hasKey) return interaction.reply({ content: 'No active key. Purchase or redeem one first.', ephemeral: true });
            await m.roles.add(panel.buyer_role_id);
            return interaction.reply({ content: 'Role assigned!', ephemeral: true });
          } catch { return interaction.reply({ content: 'Could not assign role.', ephemeral: true }); }
        }
        if (action === 'freekey') {
          if ((panel.free_key_hours||0)<=0) return interaction.reply({ content: 'Free keys disabled.', ephemeral: true });
          if (getLatestActiveClaimedKey(panel.script_id, interaction.user.id)) return interaction.reply({ content: 'Already have a key.', ephemeral: true });
          const row = createLicenseKeyRecord({
            scriptId: panel.script_id, panelId: panel.id,
            userId: db.prepare('SELECT * FROM panels WHERE id=?').get(pid).user_id,
            note: 'Free key', expiresAt: new Date(Date.now()+panel.free_key_hours*3600000).toISOString(),
            claimedBy: interaction.user.id, claimedTag: interaction.user.tag,
          });
          return interaction.reply({ content: 'Free key:\n```\n' + row.key + '\n```', ephemeral: true });
        }
        if (action === 'resethwid') {
          const key = getLatestActiveClaimedKey(panel.script_id, interaction.user.id);
          if (!key) return interaction.reply({ content: 'No active key.', ephemeral: true });
          if ((panel.hwid_cooldown||0)>0 && key.last_hwid_reset_at) {
            const next = new Date(key.last_hwid_reset_at).getTime()+panel.hwid_cooldown*1000;
            if (next>Date.now()) return interaction.reply({ content: 'Wait ' + Math.ceil((next-Date.now())/1000) + 's.', ephemeral: true });
          }
          db.prepare('UPDATE license_keys SET hwid=NULL,last_hwid_reset_at=CURRENT_TIMESTAMP WHERE key=?').run(key.key);
          return interaction.reply({ content: 'HWID reset done. Re-run loader.', ephemeral: true });
        }
      }
    }

    if (interaction.isChatInputCommand()) {
      const c = interaction.commandName;
      if (c==='login') {
        const apiKey = interaction.options.getString('api_key', true);
        const keyRecord = db.prepare('SELECT * FROM api_keys WHERE key = ? AND is_active = 1').get(apiKey);
        if (!keyRecord) return interaction.reply({ content: 'Invalid API key.', ephemeral: true });
        if (isExpired(keyRecord.expires_at)) return interaction.reply({ content: 'API key expired.', ephemeral: true });
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(keyRecord.owner_id);
        if (!user) return interaction.reply({ content: 'User not found.', ephemeral: true });
        db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?').run(apiKey);
        const lim = getRemainingLimits(user.id);
        const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle('API key validated').setDescription('Welcome, **'+user.username+'**').addFields({name:'Scripts',value:lim.currentScripts+'/'+lim.maxScripts},{name:'Panels',value:lim.currentPanels+'/'+lim.maxPanels}).setFooter({text:'v6'});
        return interaction.reply({ embeds:[embed], ephemeral:true });
      }
      if (c==='limits') {
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) return interaction.reply({ content: 'No linked account.', ephemeral: true });
        const lim = getRemainingLimits(user.id);
        const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle('Limits').addFields({name:'Scripts',value:lim.currentScripts+'/'+lim.maxScripts,inline:true},{name:'Panels',value:lim.currentPanels+'/'+lim.maxPanels,inline:true},{name:'Remaining',value:lim.remainingScripts+' / '+lim.remainingPanels,inline:true});
        return interaction.reply({ embeds:[embed], ephemeral:true });
      }
      if (c==='panel') {
        const panelId = interaction.options.getString('panel_id', true);
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) return interaction.reply({ content: 'No linked account.', ephemeral: true });
        const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });
        const script = getScriptById(panel.script_id);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });
        if (!interaction.channel?.isTextBased()) return interaction.reply({ content: 'Text channel only.', ephemeral: true });
        await interaction.channel.send({ embeds:[buildPanelEmbed(panel,script)], components:buildPanelComponents(panel) });
        return interaction.reply({ content: 'Panel sent!', ephemeral: true });
      }
      if (c==='generatekey') {
        const panelId = interaction.options.getString('panel_id', true);
        const hours = interaction.options.getInteger('hours', true);
        const note = interaction.options.getString('note')||'';
        const tu = interaction.options.getUser('user');
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) return interaction.reply({ content: 'No linked account.', ephemeral: true });
        const panel = db.prepare('SELECT * FROM panels WHERE id = ? AND user_id = ?').get(panelId, user.id);
        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });
        const ea = hours>0 ? new Date(Date.now()+hours*3600000).toISOString() : null;
        const row = createLicenseKeyRecord({scriptId:panel.script_id,panelId:panel.id,userId:user.id,note,expiresAt:ea,claimedBy:tu?.id||null,claimedTag:tu?.tag||null});
        return interaction.reply({ content:'Key: **'+row.key+'**'+(tu?' Assigned to: '+tu.tag:'')+(ea?' Expires: '+new Date(ea).toLocaleString():' Permanent'), ephemeral:true });
      }
      if (c==='setbuyerrole') {
        const panelId = interaction.options.getString('panel_id', true);
        const role = interaction.options.getRole('role', true);
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) return interaction.reply({ content: 'No linked account.', ephemeral: true });
        const panel = getPanelById(panelId);
        if (!panel||panel.user_id!==user.id) return interaction.reply({ content: 'Panel not found.', ephemeral: true });
        db.prepare('UPDATE panels SET buyer_role_id=? WHERE id=?').run(role.id, panelId);
        return interaction.reply({ content:'Buyer role set to **'+role.name+'** for **'+panel.name+'**', ephemeral:true });
      }
      if (c==='whitelist') {
        const scriptId = interaction.options.getString('script_id', true);
        const tu = interaction.options.getUser('user', true);
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) return interaction.reply({ content: 'No linked account.', ephemeral: true });
        const script = getScriptById(scriptId);
        if (!script||script.user_id!==user.id) return interaction.reply({ content: 'Script not found.', ephemeral: true });
        const row = ensureWhitelistAccess({ownerUserId:user.id,scriptId,discordUserId:tu.id,discordTag:tu.tag});
        return interaction.reply({ content:'Whitelisted **'+tu.tag+'** to **'+script.name+'**\nKey: **'+row.key+'**', ephemeral:true });
      }
      if (c==='resethwid') {
        const scriptId = interaction.options.getString('script_id', true);
        const script = getScriptById(scriptId);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });
        const key = getLatestActiveClaimedKey(scriptId, interaction.user.id);
        if (!key) return interaction.reply({ content: 'No active key.', ephemeral: true });
        const panel = db.prepare('SELECT * FROM panels WHERE script_id=? ORDER BY created_at ASC LIMIT 1').get(scriptId);
        if (panel?.hwid_cooldown&&key.last_hwid_reset_at) {
          const na = new Date(key.last_hwid_reset_at).getTime()+Number(panel.hwid_cooldown)*1000;
          if (na>Date.now()) return interaction.reply({ content:'Wait '+Math.ceil((na-Date.now())/1000)+'s', ephemeral:true });
        }
        db.prepare('UPDATE license_keys SET hwid=NULL,last_hwid_reset_at=CURRENT_TIMESTAMP WHERE key=?').run(key.key);
        return interaction.reply({ content:'HWID reset. Re-run loader.', ephemeral:true });
      }
      if (c==='forceresethwid') {
        const scriptId = interaction.options.getString('script_id', true);
        const tu = interaction.options.getUser('user', true);
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(interaction.user.id);
        if (!user) return interaction.reply({ content: 'No linked account.', ephemeral: true });
        const script = getScriptById(scriptId);
        if (!script||script.user_id!==user.id) return interaction.reply({ content: 'Script not found.', ephemeral: true });
        const key = getLatestActiveClaimedKey(scriptId, tu.id);
        if (!key) return interaction.reply({ content: 'No active key for that user.', ephemeral: true });
        db.prepare('UPDATE license_keys SET hwid=NULL,last_hwid_reset_at=CURRENT_TIMESTAMP WHERE key=?').run(key.key);
        return interaction.reply({ content:'Force HWID reset for **'+tu.tag+'** on **'+script.name+'**', ephemeral:true });
      }
      if (c==='banuser') {
        if (interaction.user.id!==OWNER_ID) return interaction.reply({ content: 'Only owner.', ephemeral: true });
        const did = interaction.options.getString('discord_id', true);
        const reason = interaction.options.getString('reason')||'Website blacklist';
        const lu = db.prepare('SELECT * FROM users WHERE discord_id=? OR id=?').get(did, did);
        const ex = getAccessBan(did, lu?.id||null);
        const au = db.prepare('SELECT * FROM users WHERE discord_id=?').get(interaction.user.id);
        if (!ex) db.prepare('INSERT INTO access_bans (id,discord_id,user_id,reason,banned_by) VALUES(?,?,?,?,?)').run(makeId('ban'), lu?.discord_id||did, lu?.id||null, reason, au?.id||null);
        return interaction.reply({ content:'Banned **'+did+'**', ephemeral:true });
      }
      if (c==='unbanuser') {
        if (interaction.user.id!==OWNER_ID) return interaction.reply({ content: 'Only owner.', ephemeral: true });
        const did = interaction.options.getString('discord_id', true);
        db.prepare('DELETE FROM access_bans WHERE discord_id=?').run(did);
        const lu = db.prepare('SELECT * FROM users WHERE discord_id=? OR id=?').get(did, did);
        if (lu) db.prepare('DELETE FROM access_bans WHERE user_id=?').run(lu.id);
        return interaction.reply({ content:'Restored access for **'+did+'**', ephemeral:true });
      }
      if (c==='banhwid') {
        const hwid = interaction.options.getString('hwid', true).trim();
        const reason = interaction.options.getString('reason')||'';
        const wu = db.prepare('SELECT * FROM users WHERE discord_id=?').get(interaction.user.id);
        db.prepare('INSERT OR REPLACE INTO banned_hwids (hwid,reason,banned_by) VALUES(?,?,?)').run(hwid, reason, wu?.id||null);
        return interaction.reply({ content:'Banned HWID: **'+hwid+'**', ephemeral:true });
      }
      if (c==='unbanhwid') {
        const hwid = interaction.options.getString('hwid', true).trim();
        db.prepare('DELETE FROM banned_hwids WHERE hwid=?').run(hwid);
        return interaction.reply({ content:'Unbanned HWID: **'+hwid+'**', ephemeral:true });
      }
      if (c==='loader') {
        const scriptId = interaction.options.getString('script_id', true);
        const script = getScriptById(scriptId);
        if (!script) return interaction.reply({ content: 'Script not found.', ephemeral: true });
        return interaction.reply({ content:'```lua\n'+buildLoaderSnippet(script)+'\n```', ephemeral:true });
      }
      if (c==='keys') {
        const panelId = interaction.options.getString('panel_id');
        const user = db.prepare('SELECT * FROM users WHERE discord_id=?').get(interaction.user.id);
        if (!user) return interaction.reply({ content: 'No linked account.', ephemeral: true });
        let rows;
        if (panelId) {
          const panel = db.prepare('SELECT * FROM panels WHERE id=? AND user_id=?').get(panelId, user.id);
          if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });
          rows = db.prepare('SELECT key,note,expires_at,claimed_tag FROM license_keys WHERE user_id=? AND panel_id=? ORDER BY created_at DESC LIMIT 10').all(user.id, panelId);
        } else {
          rows = db.prepare('SELECT key,note,expires_at,claimed_tag FROM license_keys WHERE user_id=? ORDER BY created_at DESC LIMIT 10').all(user.id);
        }
        if (!rows.length) return interaction.reply({ content: 'No keys.', ephemeral: true });
        return interaction.reply({ content:'```\n'+rows.map(r=>r.key+' | '+(isExpired(r.expires_at)?'Expired':r.claimed_tag?'Claimed by '+r.claimed_tag:'Available')+(r.note?' | '+r.note:'')).join('\n')+'\n```', ephemeral:true });
      }
    }
  } catch (e) { console.error('Interaction error:', e); }
});

const port = Number(process.env.PORT || 10000);

(async () => {
  try {
    ensureUploadsDir();
    app.listen(port, '0.0.0.0', () => {
      console.log('LuaObfuscationHub v6 running on port', port);
      console.log('Website:', publicBaseUrl());
    });
    if (DISCORD_TOKEN) await client.login(DISCORD_TOKEN);
    else console.warn('DISCORD_TOKEN not set â€” bot disabled.');
  } catch (e) { console.error('Startup error:', e); process.exit(1); }
})();

module.exports = { app, db, authenticateApiKey };
