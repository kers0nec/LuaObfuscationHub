(function () {
  const APP = window.__APP__ || {};
  const state = { scripts: [], panels: [], keys: [], bannedHWIDs: [], limits: null };

  const pageTitles = {
    scripts: '📜 Scripts',
    panels: '📋 Panels',
    keys: '🔑 Keys',
    hwids: '🚫 HWID Bans',
    admin: '⚙️ Admin Panel',
  };

  function toast(message, type = 'default') {
    const root = document.getElementById('toastRoot');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function formatDate(iso) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString();
  }

  function isExpired(iso) {
    return Boolean(iso) && new Date(iso).getTime() < Date.now();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ---------- Nav ----------

  function setActiveView(view) {
    document.querySelectorAll('.nav-link').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach((section) => {
      section.classList.toggle('active', section.id === `view-${view}`);
    });
    const title = document.getElementById('pageTitle');
    if (title) title.textContent = pageTitles[view] || view;
  }

  document.querySelectorAll('.nav-link').forEach((btn) => {
    btn.addEventListener('click', () => setActiveView(btn.dataset.view));
  });

  // ---------- Rendering ----------

  function renderStats() {
    const limits = state.limits || {};
    document.getElementById('statScripts').textContent = state.scripts.length;
    document.getElementById('statScriptsMeta').textContent = `${limits.remainingScripts ?? '?'} remaining`;
    document.getElementById('statPanels').textContent = state.panels.length;
    document.getElementById('statPanelsMeta').textContent = `${limits.remainingPanels ?? '?'} remaining`;
    document.getElementById('statKeys').textContent = state.keys.length;
    document.getElementById('statHwids').textContent = state.bannedHWIDs.length;

    const sideScripts = document.getElementById('sideStatScripts');
    const sidePanels = document.getElementById('sideStatPanels');
    const sideKeys = document.getElementById('sideStatKeys');
    const sideHwids = document.getElementById('sideStatHwids');
    if (sideScripts) sideScripts.textContent = `${state.scripts.length}/${limits.maxScripts ?? '?'}`;
    if (sidePanels) sidePanels.textContent = `${state.panels.length}/${limits.maxPanels ?? '?'}`;
    if (sideKeys) sideKeys.textContent = state.keys.length;
    if (sideHwids) sideHwids.textContent = state.bannedHWIDs.length;
  }

  function renderScripts() {
    const list = document.getElementById('scriptsList');
    document.getElementById('scriptsCount').textContent = `${state.scripts.length} items`;

    if (!state.scripts.length) {
      list.innerHTML = '<div class="empty-state">No scripts hosted yet. Upload one above to get started.</div>';
      return;
    }

    list.innerHTML = state.scripts.map((script) => `
      <article class="panel resource-card" data-script="${script.id}">
        <div class="resource-card-header">
          <div>
            <div class="resource-title">${escapeHtml(script.name)}</div>
            <div class="resource-sub">${script.id}</div>
          </div>
          <span class="badge ${script.status === 'active' ? 'active' : 'disabled'}">${script.status === 'active' ? 'Active' : 'Disabled'}</span>
        </div>
        <div class="resource-meta">
          <span>${script.ffa_mode ? '🔓 FFA' : '🔒 Key required'}</span>
          <span>${script.obfuscated_code ? '🔮 Obfuscated' : '— Not obfuscated'}</span>
        </div>
        <div class="resource-actions">
          <button class="button secondary small" data-action="toggle-script" data-id="${script.id}">${script.status === 'active' ? 'Disable' : 'Enable'}</button>
          <button class="button secondary small" data-action="toggle-ffa" data-id="${script.id}">${script.ffa_mode ? 'Require key' : 'Set FFA'}</button>
          <button class="button secondary small" data-action="obfuscate-script" data-id="${script.id}">Obfuscate</button>
          <button class="button danger small" data-action="delete-script" data-id="${script.id}">Delete</button>
        </div>
      </article>
    `).join('');
  }

  function renderPanels() {
    const list = document.getElementById('panelsList');
    document.getElementById('panelsCount').textContent = `${state.panels.length} items`;

    const scriptSelect = document.getElementById('panelScriptId');
    const activeScriptId = scriptSelect.value;
    scriptSelect.innerHTML = '<option value="">Select script</option>' +
      state.scripts.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    scriptSelect.value = activeScriptId;

    const keyPanelSelect = document.getElementById('keyPanelId');
    const activePanelId = keyPanelSelect.value;
    keyPanelSelect.innerHTML = '<option value="">Select panel</option>' +
      state.panels.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    keyPanelSelect.value = activePanelId;

    if (!state.panels.length) {
      list.innerHTML = '<div class="empty-state">No panels yet. Create one above and send it to a Discord channel.</div>';
      return;
    }

    list.innerHTML = state.panels.map((panel) => {
      const script = state.scripts.find((s) => s.id === panel.script_id);
      return `
      <article class="panel resource-card" data-panel="${panel.id}">
        <div class="resource-card-header">
          <div>
            <div class="resource-title">${escapeHtml(panel.name)}</div>
            <div class="resource-sub">${panel.id}</div>
          </div>
          <span class="badge open">${script ? escapeHtml(script.name) : 'Unknown script'}</span>
        </div>
        ${panel.description ? `<p class="muted">${escapeHtml(panel.description)}</p>` : ''}
        <div class="resource-meta">
          <span>Channel: ${escapeHtml(panel.channel_id)}</span>
          <span>Cooldown: ${panel.hwid_cooldown}s</span>
        </div>
        <div class="resource-actions">
          <button class="button primary small" data-action="send-panel" data-id="${panel.id}">Send to Discord</button>
          <button class="button danger small" data-action="delete-panel" data-id="${panel.id}">Delete</button>
        </div>
      </article>`;
    }).join('');
  }

  function renderKeys() {
    const list = document.getElementById('keysList');
    document.getElementById('keysCount').textContent = `${state.keys.length} items`;

    if (!state.keys.length) {
      list.innerHTML = '<div class="empty-state">No license keys yet. Generate one above.</div>';
      return;
    }

    list.innerHTML = state.keys.map((keyRow) => {
      const expired = isExpired(keyRow.expires_at);
      const status = expired ? 'disabled' : keyRow.claimed_by ? 'locked' : 'active';
      const statusText = expired ? 'Expired' : keyRow.claimed_tag ? `Claimed by ${keyRow.claimed_tag}` : 'Available';
      return `
      <article class="panel resource-card" data-key="${escapeHtml(keyRow.key)}">
        <div class="resource-card-header">
          <div class="resource-title mono" style="font-family: var(--font-mono);">${escapeHtml(keyRow.key)}</div>
          <span class="badge ${status}">${statusText}</span>
        </div>
        ${keyRow.note ? `<p class="muted">${escapeHtml(keyRow.note)}</p>` : ''}
        <div class="resource-meta">
          <span>Expires: ${formatDate(keyRow.expires_at)}</span>
          <span>HWID: ${keyRow.hwid ? escapeHtml(keyRow.hwid).slice(0, 12) + '…' : 'Unbound'}</span>
        </div>
        <div class="resource-actions">
          <button class="button danger small" data-action="delete-key" data-key="${escapeHtml(keyRow.key)}">Delete</button>
        </div>
      </article>`;
    }).join('');
  }

  function renderHwids() {
    const list = document.getElementById('hwidList');
    document.getElementById('hwidsCount').textContent = `${state.bannedHWIDs.length} items`;

    if (!state.bannedHWIDs.length) {
      list.innerHTML = '<div class="empty-state">No HWIDs banned.</div>';
      return;
    }

    list.innerHTML = state.bannedHWIDs.map((row) => `
      <article class="panel resource-card">
        <div class="resource-card-header">
          <div class="resource-title" style="font-family: var(--font-mono); font-size: var(--fs-xs);">${escapeHtml(row.hwid)}</div>
        </div>
        ${row.reason ? `<p class="muted">${escapeHtml(row.reason)}</p>` : ''}
        <div class="resource-meta">
          <span>Banned: ${formatDate(row.created_at)}</span>
        </div>
        <div class="resource-actions">
          <button class="button danger small" data-action="unban-hwid" data-hwid="${escapeHtml(row.hwid)}">Unban</button>
        </div>
      </article>
    `).join('');
  }

  function renderAll() {
    renderStats();
    renderScripts();
    renderPanels();
    renderKeys();
    renderHwids();
  }

  // ---------- Data loading ----------

  async function loadData() {
    try {
      const data = await api('/api/data');
      state.scripts = data.scripts || [];
      state.panels = data.panels || [];
      state.keys = data.keys || [];
      state.bannedHWIDs = data.bannedHWIDs || [];
      state.limits = data.limits || null;
      renderAll();
    } catch (error) {
      toast(error.message || 'Failed to load dashboard data', 'error');
    }
  }

  document.getElementById('refreshButton').addEventListener('click', () => loadData());

  // ---------- Form actions ----------

  document.getElementById('saveScriptButton').addEventListener('click', async () => {
    const name = document.getElementById('scriptName').value.trim();
    const code = document.getElementById('scriptCode').value;
    const ffaMode = document.getElementById('ffaModeCheck').checked;
    const compressMode = document.getElementById('compressModeCheck').checked;

    if (!name || !code.trim()) {
      toast('Enter a script name and source code first.', 'error');
      return;
    }

    try {
      const result = await api('/api/create-script', {
        method: 'POST',
        body: JSON.stringify({ name, code, ffaMode, compressMode }),
      });

      if (compressMode && result.id) {
        await api('/api/obfuscate-script', {
          method: 'POST',
          body: JSON.stringify({ scriptId: result.id }),
        }).catch(() => toast('Script saved, but obfuscation failed.', 'error'));
      }

      document.getElementById('scriptName').value = '';
      document.getElementById('scriptCode').value = '';
      document.getElementById('ffaModeCheck').checked = false;
      document.getElementById('compressModeCheck').checked = false;

      toast('Script hosted successfully.', 'success');
      loadData();
    } catch (error) {
      toast(error.message || 'Failed to host script', 'error');
    }
  });

  document.getElementById('savePanelButton').addEventListener('click', async () => {
    const name = document.getElementById('panelName').value.trim();
    const description = document.getElementById('panelDescription').value.trim();
    const channelId = document.getElementById('panelChannelId').value.trim();
    const scriptId = document.getElementById('panelScriptId').value;
    const hwidCooldown = Number(document.getElementById('panelHwidCooldown').value) || 180;

    if (!name || !channelId || !scriptId) {
      toast('Panel name, channel ID, and script are required.', 'error');
      return;
    }

    try {
      await api('/api/create-panel', {
        method: 'POST',
        body: JSON.stringify({ name, description, channelId, scriptId, hwidCooldown }),
      });

      document.getElementById('panelName').value = '';
      document.getElementById('panelDescription').value = '';
      document.getElementById('panelChannelId').value = '';

      toast('Panel created.', 'success');
      loadData();
    } catch (error) {
      toast(error.message || 'Failed to create panel', 'error');
    }
  });

  document.getElementById('generateKeyButton').addEventListener('click', async () => {
    const panelId = document.getElementById('keyPanelId').value;
    const durationHours = Number(document.getElementById('keyDuration').value) || 0;
    const note = document.getElementById('keyNote').value.trim();

    if (!panelId) {
      toast('Select a panel first.', 'error');
      return;
    }

    try {
      const result = await api('/api/generate-key', {
        method: 'POST',
        body: JSON.stringify({ panelId, durationHours, note }),
      });

      document.getElementById('keyNote').value = '';
      toast(`Key generated: ${result.key}`, 'success');
      loadData();
    } catch (error) {
      toast(error.message || 'Failed to generate key', 'error');
    }
  });

  document.getElementById('banHwidButton').addEventListener('click', async () => {
    const hwid = document.getElementById('banHwidInput').value.trim();
    const reason = document.getElementById('banReason').value.trim();

    if (!hwid) {
      toast('Enter an HWID first.', 'error');
      return;
    }

    try {
      await api('/api/ban-hwid', {
        method: 'POST',
        body: JSON.stringify({ hwid, reason }),
      });

      document.getElementById('banHwidInput').value = '';
      document.getElementById('banReason').value = '';
      toast('HWID banned.', 'success');
      loadData();
    } catch (error) {
      toast(error.message || 'Failed to ban HWID', 'error');
    }
  });

  const adminGenerateBtn = document.getElementById('adminGenerateKeyButton');
  if (adminGenerateBtn) {
    adminGenerateBtn.addEventListener('click', async () => {
      const userId = document.getElementById('adminUserId').value.trim();
      const expiresInDays = Number(document.getElementById('adminExpiresDays').value) || 0;
      const maxScripts = Number(document.getElementById('adminMaxScripts').value) || undefined;
      const maxPanels = Number(document.getElementById('adminMaxPanels').value) || undefined;
      const notes = document.getElementById('adminNotes').value.trim();

      if (!userId) {
        toast('Enter a user ID or Discord ID.', 'error');
        return;
      }

      try {
        const result = await api('/api/admin/generate-key', {
          method: 'POST',
          body: JSON.stringify({ userId, expiresInDays, maxScripts, maxPanels, notes }),
        });

        document.getElementById('adminNotes').value = '';
        toast(`API key generated: ${result.apiKey}`, 'success');
        loadApiKeys();
      } catch (error) {
        toast(error.message || 'Failed to generate API key', 'error');
      }
    });
  }

  async function loadApiKeys() {
    const list = document.getElementById('apiKeysList');
    if (!list) return;

    try {
      const keys = await api('/api/admin/api-keys');
      document.getElementById('apiKeysCount').textContent = `${keys.length} items`;

      if (!keys.length) {
        list.innerHTML = '<div class="empty-state">No API keys issued yet.</div>';
        return;
      }

      list.innerHTML = keys.map((row) => `
        <article class="panel resource-card">
          <div class="resource-card-header">
            <div class="resource-title" style="font-family: var(--font-mono); font-size: var(--fs-xs);">${escapeHtml(row.key)}</div>
            <span class="badge ${row.is_active ? 'active' : 'disabled'}">${row.is_active ? 'Active' : 'Revoked'}</span>
          </div>
          <div class="resource-meta">
            <span>Owner: ${escapeHtml(row.owner_username || row.owner_id)}</span>
            <span>Scripts: ${row.max_scripts}</span>
            <span>Panels: ${row.max_panels}</span>
            <span>Expires: ${formatDate(row.expires_at)}</span>
          </div>
          <div class="resource-actions">
            <button class="button danger small" data-action="revoke-key" data-key="${escapeHtml(row.key)}">Revoke</button>
          </div>
        </article>
      `).join('');
    } catch (error) {
      toast(error.message || 'Failed to load API keys', 'error');
    }
  }

  // ---------- Delegated resource actions ----------

  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    try {
      if (action === 'toggle-script') {
        await api(`/api/scripts/${target.dataset.id}/toggle`, { method: 'PUT' });
        loadData();
      } else if (action === 'toggle-ffa') {
        await api(`/api/scripts/${target.dataset.id}/ffa`, { method: 'PUT' });
        loadData();
      } else if (action === 'obfuscate-script') {
        target.disabled = true;
        target.textContent = 'Working…';
        await api('/api/obfuscate-script', { method: 'POST', body: JSON.stringify({ scriptId: target.dataset.id }) });
        toast('Script obfuscated.', 'success');
        loadData();
      } else if (action === 'delete-script') {
        if (!confirm('Delete this script? This also removes linked panels and keys.')) return;
        await api('/api/delete-script', { method: 'POST', body: JSON.stringify({ id: target.dataset.id }) });
        loadData();
      } else if (action === 'send-panel') {
        target.disabled = true;
        target.textContent = 'Sending…';
        await api('/api/send-panel', { method: 'POST', body: JSON.stringify({ panelId: target.dataset.id }) });
        toast('Panel sent to Discord.', 'success');
      } else if (action === 'delete-panel') {
        if (!confirm('Delete this panel?')) return;
        await api('/api/delete-panel', { method: 'POST', body: JSON.stringify({ id: target.dataset.id }) });
        loadData();
      } else if (action === 'delete-key') {
        if (!confirm('Delete this license key?')) return;
        await api('/api/delete-key', { method: 'POST', body: JSON.stringify({ key: target.dataset.key }) });
        loadData();
      } else if (action === 'unban-hwid') {
        await api('/api/unban-hwid', { method: 'POST', body: JSON.stringify({ hwid: target.dataset.hwid }) });
        loadData();
      } else if (action === 'revoke-key') {
        if (!confirm('Revoke this API key?')) return;
        await api('/api/admin/revoke-key', { method: 'POST', body: JSON.stringify({ key: target.dataset.key }) });
        loadApiKeys();
      }
    } catch (error) {
      toast(error.message || 'Action failed', 'error');
      target.disabled = false;
    }
  });

  // ---------- Init ----------

  loadData();
  if (APP.user && APP.user.is_owner) loadApiKeys();
})();
