/* ============================================================
   LuaObfuscationHub — Cyberpunk Blue theme
   Tokens:
   --bg       #050910  near-black navy base
   --bg-alt   #0a0f1c  panel base
   --line     #16233f  hairline borders
   --line-lit #1f3a63  brighter border on hover/focus
   --cyan     #22c3ff  primary accent (brand)
   --cyan-dim #12688f  primary accent, muted
   --violet   #7c5cff  secondary accent (used sparingly)
   --mint     #35e6b0  success / active
   --red      #ff4d6d  danger / destructive
   --amber    #ffb545  warning
   --ink      #e8f2ff  primary text
   --ink-dim  #8ea3c4  secondary text
   --ink-mute #56698c  tertiary text
   Type: Space Grotesk (display), Inter (body), JetBrains Mono (data/labels)
   ============================================================ */

* {
  box-sizing: border-box;
}

:root {
  --bg: #050910;
  --bg-alt: #0a0f1c;
  --line: #16233f;
  --line-lit: #23406b;
  --cyan: #22c3ff;
  --cyan-dim: #12688f;
  --violet: #7c5cff;
  --mint: #35e6b0;
  --red: #ff4d6d;
  --amber: #ffb545;
  --ink: #e8f2ff;
  --ink-dim: #8ea3c4;
  --ink-mute: #56698c;

  --font-display: 'Space Grotesk', 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Type scale — fixed so nothing renders oversized/undersized */
  --fs-2xs: 0.6875rem;  /* 11px — micro labels, badges */
  --fs-xs: 0.75rem;     /* 12px — eyebrows, meta text */
  --fs-sm: 0.8125rem;   /* 13px — body small, nav links */
  --fs-base: 0.9375rem; /* 15px — body default */
  --fs-md: 1.0625rem;   /* 17px — card titles */
  --fs-lg: 1.375rem;    /* 22px — page title */
  --fs-xl: 1.75rem;     /* 28px — stat values */
  --fs-2xl: 2rem;       /* 32px — auth h1 */

  color-scheme: dark;
}

html, body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: var(--fs-base);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Ambient cyberpunk backdrop: grid + glow, fixed behind everything */
.site-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(ellipse 900px 500px at 15% -10%, rgba(34, 195, 255, 0.16), transparent 60%),
    radial-gradient(ellipse 700px 500px at 110% 10%, rgba(124, 92, 255, 0.12), transparent 55%),
    linear-gradient(var(--bg), var(--bg));
}

.site-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(34, 195, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34, 195, 255, 0.06) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%);
}

a {
  color: inherit;
  text-decoration: none;
}

h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--ink);
}

p {
  margin: 0;
}

.muted {
  color: var(--ink-dim);
  font-size: var(--fs-sm);
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: var(--fs-2xs);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--cyan);
  margin: 0 0 0.35rem;
}

.panel {
  background: linear-gradient(180deg, rgba(16, 26, 46, 0.9), rgba(8, 13, 24, 0.9));
  border: 1px solid var(--line);
  border-radius: 14px;
  position: relative;
}

.panel::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(34, 195, 255, 0.25), transparent 40%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

/* ---------- Buttons & fields ---------- */

.button {
  font-family: var(--font-body);
  font-size: var(--fs-sm);
  font-weight: 600;
  padding: 0.7rem 1.1rem;
  border-radius: 9px;
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease, background 0.12s ease;
}

.button:active {
  transform: translateY(1px);
}

.button.primary {
  background: linear-gradient(135deg, var(--cyan), #4fd6ff);
  color: #04121c;
  box-shadow: 0 0 0 1px rgba(34, 195, 255, 0.4), 0 8px 24px -8px rgba(34, 195, 255, 0.55);
}

.button.primary:hover {
  box-shadow: 0 0 0 1px rgba(34, 195, 255, 0.6), 0 10px 28px -6px rgba(34, 195, 255, 0.7);
}

.button.secondary {
  background: rgba(34, 195, 255, 0.06);
  border-color: var(--line);
  color: var(--ink);
}

.button.secondary:hover {
  border-color: var(--cyan-dim);
  background: rgba(34, 195, 255, 0.1);
}

.button.danger {
  background: rgba(255, 77, 109, 0.1);
  border-color: rgba(255, 77, 109, 0.4);
  color: #ffb9c5;
}

.button.danger:hover {
  background: rgba(255, 77, 109, 0.18);
}

.button.full-width {
  width: 100%;
}

.button.small {
  padding: 0.45rem 0.75rem;
  font-size: var(--fs-xs);
}

button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
  outline: 2px solid var(--cyan);
  outline-offset: 2px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field label {
  font-size: var(--fs-xs);
  color: var(--ink-dim);
  font-weight: 500;
}

.field.full {
  grid-column: 1 / -1;
}

.field.checkbox-group {
  justify-content: center;
  gap: 0.6rem;
}

input[type="text"],
input[type="number"],
input[type="password"],
textarea,
select {
  font-family: var(--font-body);
  font-size: var(--fs-sm);
  color: var(--ink);
  background: rgba(5, 10, 20, 0.7);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.65rem 0.8rem;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

input::placeholder, textarea::placeholder {
  color: var(--ink-mute);
}

input:focus, textarea:focus, select:focus {
  border-color: var(--cyan-dim);
  box-shadow: 0 0 0 3px rgba(34, 195, 255, 0.12);
}

textarea.mono {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  resize: vertical;
  min-height: 160px;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--fs-sm);
  color: var(--ink-dim);
  cursor: pointer;
}

.check input {
  accent-color: var(--cyan);
  width: 16px;
  height: 16px;
}

.stack-lg { display: flex; flex-direction: column; gap: 1rem; }
.stack-xl { display: flex; flex-direction: column; gap: 1.5rem; }

.divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--ink-mute);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line);
}

.helper-text {
  font-size: var(--fs-xs);
  color: var(--ink-mute);
  text-align: center;
}

/* ---------- Auth page ---------- */

.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  padding: 2.25rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.brand-block h1 {
  font-size: var(--fs-2xl);
}

.brand-mark {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.4rem;
  color: #04121c;
  background: linear-gradient(135deg, var(--cyan), var(--violet));
  box-shadow: 0 0 24px -4px rgba(34, 195, 255, 0.7);
  flex-shrink: 0;
}

.brand-mark.small {
  width: 36px;
  height: 36px;
  font-size: 1.05rem;
  border-radius: 10px;
}

/* ---------- Dashboard shell ---------- */

.dashboard-shell {
  display: grid;
  grid-template-columns: 264px 1fr;
  min-height: 100vh;
  gap: 1.25rem;
  padding: 1.25rem;
}

.sidebar {
  padding: 1.35rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: sticky;
  top: 1.25rem;
  height: calc(100vh - 2.5rem);
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.brand-name {
  font-family: var(--font-display);
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--ink);
}

.sidebar-caption {
  font-size: var(--fs-2xs);
  color: var(--ink-mute);
  margin-top: 0.1rem;
}

.user-summary {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(34, 195, 255, 0.04);
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--line-lit);
}

.user-name {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--ink);
}

.user-role {
  font-size: var(--fs-2xs);
  color: var(--ink-dim);
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.nav-link {
  font-family: var(--font-body);
  font-size: var(--fs-sm);
  font-weight: 500;
  text-align: left;
  color: var(--ink-dim);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0.6rem 0.7rem;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.nav-link:hover {
  background: rgba(34, 195, 255, 0.06);
  color: var(--ink);
}

.nav-link.active {
  background: rgba(34, 195, 255, 0.12);
  border-color: var(--cyan-dim);
  color: var(--cyan);
}

/* Quick stats block inside the sidebar */
.sidebar-stats {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.8rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  background: rgba(5, 10, 20, 0.5);
}

.sidebar-stats-title {
  font-family: var(--font-mono);
  font-size: var(--fs-2xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-mute);
  margin-bottom: 0.1rem;
}

.sidebar-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-xs);
}

.sidebar-stat-label {
  color: var(--ink-dim);
}

.sidebar-stat-value {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--cyan);
}

.sidebar-footer {
  margin-top: auto;
}

/* ---------- Content area ---------- */

.content-area {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.topbar {
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.topbar h1 {
  font-size: var(--fs-lg);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--font-mono);
  font-size: var(--fs-2xs);
  color: var(--mint);
  border: 1px solid rgba(53, 230, 176, 0.3);
  background: rgba(53, 230, 176, 0.08);
  padding: 0.4rem 0.7rem;
  border-radius: 999px;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--mint);
  box-shadow: 0 0 8px 1px var(--mint);
  animation: pulse 1.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.stat-card {
  padding: 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.stat-label {
  font-size: var(--fs-xs);
  color: var(--ink-dim);
}

.stat-value {
  font-family: var(--font-display);
  font-size: var(--fs-xl);
  color: var(--ink);
}

.stat-meta {
  font-family: var(--font-mono);
  font-size: var(--fs-2xs);
  color: var(--cyan);
}

.view {
  display: none;
}

.view.active {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-card {
  padding: 1.4rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.section-header h2 {
  font-size: var(--fs-md);
  margin-bottom: 0.2rem;
}

.section-header.inline-header {
  padding: 0 0.1rem;
}

.count-badge {
  font-family: var(--font-mono);
  font-size: var(--fs-2xs);
  color: var(--ink-dim);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.3rem 0.7rem;
  white-space: nowrap;
}

.form-grid {
  display: grid;
  gap: 1rem;
}

.form-grid.two {
  grid-template-columns: repeat(2, 1fr);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.resource-card {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.resource-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
}

.resource-title {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--ink);
  word-break: break-word;
}

.resource-sub {
  font-family: var(--font-mono);
  font-size: var(--fs-2xs);
  color: var(--ink-mute);
  word-break: break-all;
}

.badge {
  font-family: var(--font-mono);
  font-size: var(--fs-2xs);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  white-space: nowrap;
}

.badge.active { color: var(--mint); background: rgba(53, 230, 176, 0.1); border: 1px solid rgba(53, 230, 176, 0.3); }
.badge.disabled { color: var(--red); background: rgba(255, 77, 109, 0.1); border: 1px solid rgba(255, 77, 109, 0.3); }
.badge.open { color: var(--cyan); background: rgba(34, 195, 255, 0.1); border: 1px solid rgba(34, 195, 255, 0.3); }
.badge.locked { color: var(--amber); background: rgba(255, 181, 69, 0.1); border: 1px solid rgba(255, 181, 69, 0.3); }

.resource-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.9rem;
  font-size: var(--fs-2xs);
  color: var(--ink-dim);
}

.resource-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.2rem;
}

.empty-state {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ink-mute);
  font-size: var(--fs-sm);
  border: 1px dashed var(--line);
  border-radius: 12px;
  grid-column: 1 / -1;
}

/* ---------- Toasts ---------- */

.toast-root {
  position: fixed;
  bottom: 1.25rem;
  right: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  z-index: 50;
}

.toast {
  font-size: var(--fs-sm);
  color: var(--ink);
  background: rgba(10, 15, 28, 0.95);
  border: 1px solid var(--line-lit);
  border-left: 3px solid var(--cyan);
  border-radius: 8px;
  padding: 0.7rem 1rem;
  box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.6);
  max-width: 320px;
  animation: toast-in 0.18s ease;
}

.toast.error {
  border-left-color: var(--red);
}

.toast.success {
  border-left-color: var(--mint);
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---------- Responsive ---------- */

@media (max-width: 980px) {
  .dashboard-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    height: auto;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }

  .nav-list {
    flex-direction: row;
    flex-wrap: wrap;
    flex: 1;
  }

  .sidebar-stats {
    width: 100%;
    order: 3;
  }

  .sidebar-footer {
    margin-top: 0;
  }
}

@media (max-width: 640px) {
  .form-grid.two {
    grid-template-columns: 1fr;
  }

  .dashboard-shell {
    padding: 0.75rem;
    gap: 0.75rem;
  }

  .topbar {
    padding: 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-dot {
    animation: none;
  }
  .toast {
    animation: none;
  }
}
