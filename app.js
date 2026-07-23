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
