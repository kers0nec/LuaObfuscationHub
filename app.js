:root {
  --bg: #07111f;
  --bg-soft: #0c1728;
  --panel: rgba(10, 18, 31, 0.82);
  --panel-strong: rgba(9, 16, 28, 0.92);
  --border: rgba(111, 198, 255, 0.16);
  --border-strong: rgba(111, 198, 255, 0.28);
  --text: #e7eef8;
  --muted: #93a7c4;
  --accent: #5ec7ff;
  --accent-strong: #3fa5ff;
  --accent-soft: rgba(94, 199, 255, 0.12);
  --success: #4ade80;
  --warning: #fbbf24;
  --danger: #f87171;
  --shadow: 0 20px 60px rgba(1, 7, 15, 0.45);
  --radius-lg: 24px;
  --radius-md: 18px;
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
    radial-gradient(circle at top left, rgba(63, 165, 255, 0.2), transparent 34%),
    radial-gradient(circle at top right, rgba(33, 114, 255, 0.18), transparent 28%),
    linear-gradient(180deg, #07111f 0%, #08101c 100%);
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
  background-size: 40px 40px;
  mask-image: radial-gradient(circle at center, black 58%, transparent 100%);
  opacity: 0.55;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}

.auth-layout {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px 20px;
}

.auth-card {
  width: min(100%, 560px);
  padding: 32px;
}

.brand-block {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 18px;
  align-items: start;
  margin-bottom: 28px;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 28px;
}

.brand-mark {
  width: 72px;
  height: 72px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 800;
  color: #07111f;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  box-shadow: 0 18px 50px rgba(63, 165, 255, 0.25);
}

.brand-mark.small {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  font-size: 18px;
}

.brand-name {
  font-size: 1rem;
  font-weight: 700;
}

.sidebar-caption {
  font-size: 0.82rem;
  color: var(--muted);
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
}

h2 {
  font-size: 1.2rem;
  margin-bottom: 6px;
}

h3 {
  font-size: 1rem;
}

.muted {
  color: var(--muted);
}

.helper-text {
  margin-top: 20px;
  color: var(--muted);
  font-size: 0.92rem;
}

.stack-lg {
  display: grid;
  gap: 18px;
}

.stack-xl {
  display: grid;
  gap: 20px;
}

.field {
  display: grid;
  gap: 8px;
}

.field label {
  font-size: 0.92rem;
  font-weight: 600;
  color: #c4d2e8;
}

input,
textarea,
select {
  width: 100%;
  color: var(--text);
  background: rgba(7, 14, 24, 0.78);
  border: 1px solid rgba(145, 184, 230, 0.16);
  border-radius: 14px;
  padding: 14px 15px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

input::placeholder,
textarea::placeholder {
  color: #7488a8;
}

input:focus,
textarea:focus,
select:focus {
  border-color: var(--border-strong);
  box-shadow: 0 0 0 4px rgba(94, 199, 255, 0.08);
}

textarea {
  resize: vertical;
  min-height: 130px;
}

.mono,
.code-block,
.code-actions button,
.mono-inline {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}

.checkbox-group {
  align-content: center;
  gap: 12px;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  color: #ccdaee;
}

.check input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent-strong);
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
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.button:hover {
  transform: translateY(-1px);
}

.button.primary {
  color: #07111f;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  box-shadow: 0 16px 40px rgba(63, 165, 255, 0.28);
}

.button.secondary,
.button.ghost {
  color: var(--text);
  border-color: rgba(145, 184, 230, 0.16);
  background: rgba(255, 255, 255, 0.02);
}

.button.danger {
  color: #ffd5d5;
  border-color: rgba(248, 113, 113, 0.25);
  background: rgba(248, 113, 113, 0.08);
}

.button.small {
  min-height: 38px;
  padding: 0 13px;
  border-radius: 12px;
  font-size: 0.9rem;
}

.full-width {
  width: 100%;
}

.divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 14px;
  align-items: center;
  color: var(--muted);
  font-size: 0.88rem;
}

.divider::before,
.divider::after {
  content: "";
  height: 1px;
  background: rgba(145, 184, 230, 0.14);
}

.dashboard-shell {
  display: grid;
  grid-template-columns: 290px 1fr;
  gap: 24px;
  padding: 24px;
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 24px;
  height: calc(100vh - 48px);
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.user-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  margin-bottom: 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(145, 184, 230, 0.1);
}

.avatar {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  border: 1px solid rgba(145, 184, 230, 0.18);
  object-fit: cover;
}

.user-name {
  font-weight: 700;
}

.user-role {
  color: var(--muted);
  font-size: 0.88rem;
}

.nav-list {
  display: grid;
  gap: 10px;
  margin-bottom: auto;
}

.nav-link {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  color: #c2d3eb;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(145, 184, 230, 0.12);
}

.nav-link.active {
  background: var(--accent-soft);
  border-color: rgba(94, 199, 255, 0.2);
  color: #f2f8ff;
}

.sidebar-footer {
  margin-top: 24px;
}

.content-area {
  min-width: 0;
  display: grid;
  gap: 24px;
}

.topbar {
  padding: 22px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(145, 184, 230, 0.12);
  color: #c5d8ee;
  font-size: 0.92rem;
}

.live-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--success);
  box-shadow: 0 0 16px rgba(74, 222, 128, 0.4);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  padding: 20px;
  display: grid;
  gap: 10px;
}

.stat-label {
  color: var(--muted);
  font-size: 0.88rem;
}

.stat-value {
  font-size: 1.9rem;
  line-height: 1;
}

.stat-meta {
  color: #c4d4eb;
  font-size: 0.94rem;
}

.view {
  display: none;
}

.view.active {
  display: grid;
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

.inline-header {
  margin-bottom: 0;
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
  justify-content: flex-end;
  margin-top: 18px;
}

.count-badge,
.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 999px;
  color: #d9e6f7;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(145, 184, 230, 0.12);
  font-size: 0.88rem;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.resource-card {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(145, 184, 230, 0.12);
  background: var(--panel-strong);
  box-shadow: var(--shadow);
  display: grid;
  gap: 14px;
}

.resource-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.resource-meta {
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.badge.info {
  color: #dff4ff;
  background: rgba(94, 199, 255, 0.15);
}

.badge.success {
  color: #d8ffe6;
  background: rgba(74, 222, 128, 0.15);
}

.badge.warning {
  color: #fff1c2;
  background: rgba(251, 191, 36, 0.16);
}

.badge.danger {
  color: #ffdada;
  background: rgba(248, 113, 113, 0.14);
}

.code-block {
  border-radius: 16px;
  background: rgba(5, 12, 22, 0.9);
  border: 1px solid rgba(145, 184, 230, 0.12);
  overflow: hidden;
}

.code-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  color: #cbd8ec;
  border-bottom: 1px solid rgba(145, 184, 230, 0.1);
  background: rgba(255, 255, 255, 0.02);
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
  color: #b5ddff;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.84rem;
  max-height: 190px;
  overflow: auto;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.empty-state {
  padding: 28px;
  text-align: center;
  border-radius: 18px;
  border: 1px dashed rgba(145, 184, 230, 0.16);
  color: var(--muted);
  background: rgba(255, 255, 255, 0.02);
}

.meta-list {
  display: grid;
  gap: 8px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.9rem;
  color: #d7e4f6;
}

.meta-item span:last-child {
  color: var(--muted);
  text-align: right;
}

.toast-root {
  position: fixed;
  right: 18px;
  bottom: 18px;
  display: grid;
  gap: 10px;
  z-index: 9999;
}

.toast {
  min-width: 260px;
  max-width: 360px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(145, 184, 230, 0.16);
  background: rgba(10, 18, 31, 0.96);
  box-shadow: var(--shadow);
}

.toast.success {
  border-color: rgba(74, 222, 128, 0.3);
}

.toast.error {
  border-color: rgba(248, 113, 113, 0.3);
}

.toast-title {
  font-weight: 700;
  margin-bottom: 4px;
}

.toast-message {
  color: var(--muted);
  font-size: 0.9rem;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .dashboard-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    height: auto;
  }
}

@media (max-width: 760px) {
  .auth-card,
  .section-card,
  .topbar,
  .sidebar {
    padding: 18px;
  }

  .brand-block {
    grid-template-columns: 1fr;
  }

  .brand-mark {
    width: 60px;
    height: 60px;
    border-radius: 18px;
  }

  .stats-grid,
  .form-grid.two {
    grid-template-columns: 1fr;
  }

  .resource-grid {
    grid-template-columns: 1fr;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .topbar-actions,
  .action-row,
  .form-actions {
    width: 100%;
  }

  .topbar-actions .button,
  .form-actions .button,
  .action-row .button {
    flex: 1 1 auto;
  }

  .dashboard-shell {
    padding: 16px;
    gap: 16px;
  }
}
