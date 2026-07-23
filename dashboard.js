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
