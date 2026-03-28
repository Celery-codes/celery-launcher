let modpacksInitialized = false;
let modpackSearchTimer  = null;

async function initModpacksPanel() {
  modpacksInitialized = false; // always re-render so URL box is fresh
  const panel = document.getElementById('panel-modpacks');
  panel.innerHTML = `
    <div class="ph"><div class="pt">Modpacks</div><div class="ps">Browse Modrinth modpacks, import a file, or paste a link</div></div>

    <!-- Import bar -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;">Import modpack</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <input class="sbox" id="modpackUrlInput" style="flex:1;min-width:220px;"
          placeholder="Paste a Modrinth URL, direct .mrpack link, or leave blank to browse files…">
        <button class="btn p" onclick="importFromInput()">↑ Import</button>
        <button class="btn"   onclick="triggerImport()">Browse file…</button>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:8px;">
        Supported: modrinth.com/modpack links · direct .mrpack URLs · local .mrpack / .zip files
      </div>
    </div>

    <!-- Progress -->
    <div id="modpackImportStatus" style="display:none;margin-bottom:12px;">
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px;" id="modpackImportMsg">Importing...</div>
      <div class="progress-bar"><div class="progress-fill" id="modpackImportBar" style="width:0%"></div></div>
    </div>

    <!-- Modrinth browser -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;">Browse Modrinth</span>
      <input class="sbox" id="modpackSearch" style="flex:1;"
        placeholder="Search modpacks…" oninput="onModpackSearch(this.value)">
    </div>
    <div id="modpacksList" class="mlist">
      <div class="loading-row"><div class="spinner"></div>Loading from Modrinth...</div>
    </div>
  `;

  window.launcher.onImportProgress(p => {
    const statusEl = document.getElementById('modpackImportStatus');
    const msgEl    = document.getElementById('modpackImportMsg');
    const barEl    = document.getElementById('modpackImportBar');
    if (!statusEl) return;
    statusEl.style.display = 'block';
    if (msgEl) msgEl.textContent = p.message || 'Importing...';
    if (barEl) barEl.style.width = (p.percent || 0) + '%';
    if (p.percent >= 100) setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 2000);
  });

  loadModpacks('');
}

function onModpackSearch(val) {
  clearTimeout(modpackSearchTimer);
  modpackSearchTimer = setTimeout(() => loadModpacks(val), 400);
}

async function loadModpacks(query = '') {
  const list = document.getElementById('modpacksList');
  if (!list) return;
  list.innerHTML = `<div class="loading-row"><div class="spinner"></div>Searching modpacks...</div>`;

  const data = await window.launcher.searchModrinth({ query, type: 'modpack', limit: 20, offset: 0 });
  if (data.error) { list.innerHTML = `<div class="err-row">Failed to load: ${escHtml(data.error)}</div>`; return; }

  const packs = data.hits || [];
  if (!packs.length) { list.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 0;">No modpacks found.</div>'; return; }

  list.innerHTML = packs.map(p => {
    const icon = p.iconUrl
      ? `<img src="${escHtml(p.iconUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : `<span style="font-size:18px;color:var(--text3);">📦</span>`;
    const latestVer = p.gameVersions?.slice(-1)[0] || '';
    return `
    <div class="mrow">
      <div class="micon">${icon}</div>
      <div class="minfo">
        <div class="mname">${escHtml(p.title)}</div>
        <div class="mdesc">${escHtml(p.description||'')}</div>
        <div class="mstats">
          <div class="mstat">DL: <span>${fmtNum(p.downloads)}</span></div>
          <div class="mstat">Follows: <span>${fmtNum(p.follows)}</span></div>
          ${latestVer?`<div class="mstat">MC: <span>${escHtml(latestVer)}</span></div>`:''}
          ${p.categories?.length?`<div class="mstat">Tags: <span>${escHtml(p.categories.slice(0,2).join(', '))}</span></div>`:''}
        </div>
      </div>
      <button class="ibtn" onclick="installModpackFromModrinth('${escHtml(p.id)}','${escHtml(p.slug)}','${escHtml(p.title)}')">Install</button>
    </div>`;
  }).join('');
}

// ── Import from the URL input box ─────────────────────────────────────────────
async function importFromInput() {
  const raw = (document.getElementById('modpackUrlInput')?.value || '').trim();

  if (!raw) {
    // No URL — fall back to file picker
    triggerImport();
    return;
  }

  // Resolve Modrinth page URLs → project ID
  // e.g. https://modrinth.com/modpack/fabulously-optimized
  let importArg = raw;
  let isModrinthPage = false;
  const mrPageMatch = raw.match(/modrinth\.com\/modpack\/([a-zA-Z0-9_-]+)/);
  if (mrPageMatch) {
    isModrinthPage = true;
    importArg = mrPageMatch[1]; // slug or project ID
  }

  showModpackProgress('Starting import...', 0);

  try {
    let result;
    if (isModrinthPage) {
      result = await window.launcher.importModpackFromModrinth({ slug: importArg });
    } else {
      // Direct URL (.mrpack link) — pass straight through
      result = await window.launcher.importModpackFromUrl({ url: importArg });
    }

    if (result.success) {
      instances.push(result.instance);
      await saveInstances();
      renderInstancesPanel();
      showModpackProgress('Imported "' + result.instance.name + '" successfully!', 100);
      document.getElementById('modpackUrlInput').value = '';
      toast(`Imported "${result.instance.name}" (${result.instance.mods} mods)`);
    } else {
      showModpackProgress('Import failed: ' + (result.error || 'Unknown error'), 0);
      toast('Import failed: ' + result.error);
    }
  } catch (e) {
    showModpackProgress('Error: ' + e.message, 0);
    toast('Import error: ' + e.message);
  }
}

function showModpackProgress(msg, percent) {
  const statusEl = document.getElementById('modpackImportStatus');
  const msgEl    = document.getElementById('modpackImportMsg');
  const barEl    = document.getElementById('modpackImportBar');
  if (statusEl) statusEl.style.display = 'block';
  if (msgEl)    msgEl.textContent = msg;
  if (barEl)    barEl.style.width = percent + '%';
  if (percent >= 100) setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 2500);
}

// ── Direct install from Modrinth browser ─────────────────────────────────────
async function installModpackFromModrinth(id, slug, title) {
  showModpackProgress(`Installing ${title}...`, 5);
  try {
    const result = await window.launcher.importModpackFromModrinth({ slug: id });
    if (result.success) {
      instances.push(result.instance);
      await saveInstances();
      renderInstancesPanel();
      showModpackProgress(`Imported "${result.instance.name}"!`, 100);
      toast(`Installed "${result.instance.name}" (${result.instance.mods} mods)`);
    } else {
      showModpackProgress('Failed: ' + (result.error || 'Unknown error'), 0);
      toast('Install failed: ' + result.error);
    }
  } catch (e) {
    showModpackProgress('Error: ' + e.message, 0);
    toast('Error: ' + e.message);
  }
}
