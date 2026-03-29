let modpackSearchTimer = null;

async function initModpacksPanel() {
  const panel = document.getElementById('panel-modpacks');
  panel.innerHTML = `
    <div class="ph">
      <div class="pt">Modpacks</div>
      <div class="ps">Install from Modrinth, paste a link, or import a local file</div>
    </div>

    <div class="mp-import-box">
      <div class="mp-import-title">Import a modpack</div>
      <div class="mp-import-row">
        <div class="mp-import-col">
          <div class="mp-input-label">Paste a link</div>
          <div style="display:flex;gap:8px;">
            <input class="sbox" id="modpackUrlInput" style="flex:1;"
              placeholder="https://modrinth.com/modpack/... or direct .mrpack URL"
              onkeydown="if(event.key==='Enter')importModpackFromUrl()">
            <button class="btn p" onclick="importModpackFromUrl()">↑ Import</button>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:5px;">
            Supports modrinth.com/modpack/ links and direct .mrpack download URLs
          </div>
        </div>
        <div style="display:flex;align-items:center;padding:0 14px;color:var(--text4);font-size:12px;flex-shrink:0;">or</div>
        <div style="flex-shrink:0;">
          <div class="mp-input-label">Local file</div>
          <button class="btn" onclick="triggerImport()">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2V10M4 7L8 11L12 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 13H14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            Browse .mrpack / .zip
          </button>
        </div>
      </div>

      <div id="mpProgress" style="display:none;margin-top:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span style="font-size:12px;color:var(--text2);" id="mpProgressMsg">Importing...</span>
          <span style="font-size:11px;color:var(--text3);font-family:var(--mono);" id="mpProgressPct"></span>
        </div>
        <div class="progress-bar"><div class="progress-fill" id="mpProgressBar" style="width:0%"></div></div>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;white-space:nowrap;">Browse Modrinth</span>
      <input class="sbox" id="modpackSearch" style="flex:1;" placeholder="Search modpacks…"
        oninput="onModpackSearch(this.value)">
    </div>
    <div id="modpacksList" class="mlist">
      <div class="loading-row"><div class="spinner"></div>Loading from Modrinth...</div>
    </div>
  `;

  window.launcher.onImportProgress(p => setMpProgress(p.message, p.percent));
  loadModpacks('');
}

function setMpProgress(msg, pct) {
  const el  = document.getElementById('mpProgress');
  const msg2= document.getElementById('mpProgressMsg');
  const pct2= document.getElementById('mpProgressPct');
  const bar = document.getElementById('mpProgressBar');
  if (!el) return;
  el.style.display = 'block';
  if (msg2) msg2.textContent = msg || 'Working...';
  if (pct2) pct2.textContent = pct != null ? Math.round(pct) + '%' : '';
  if (bar)  bar.style.width  = (pct || 0) + '%';
  if (pct >= 100) setTimeout(() => { if(el) el.style.display='none'; }, 2500);
}

function onModpackSearch(val) {
  clearTimeout(modpackSearchTimer);
  modpackSearchTimer = setTimeout(() => loadModpacks(val), 400);
}

async function loadModpacks(query = '') {
  const list = document.getElementById('modpacksList');
  if (!list) return;
  list.innerHTML = `<div class="loading-row"><div class="spinner"></div>Searching...</div>`;
  const data = await window.launcher.searchModrinth({ query, type: 'modpack', limit: 20 });
  if (data.error) { list.innerHTML = `<div class="err-row">Failed: ${escHtml(data.error)}</div>`; return; }
  const packs = data.hits || [];
  if (!packs.length) { list.innerHTML = '<div style="color:var(--text3);padding:16px 0;">No modpacks found.</div>'; return; }
  list.innerHTML = packs.map(p => {
    const icon = p.iconUrl
      ? `<img src="${escHtml(p.iconUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : `<span style="font-size:18px;color:var(--text3);">📦</span>`;
    const ver = p.gameVersions?.slice(-1)[0] || '';
    return `
    <div class="mrow">
      <div class="micon">${icon}</div>
      <div class="minfo">
        <div class="mname">${escHtml(p.title)}</div>
        <div class="mdesc">${escHtml(p.description||'')}</div>
        <div class="mstats">
          <div class="mstat">DL: <span>${fmtNum(p.downloads)}</span></div>
          <div class="mstat">Follows: <span>${fmtNum(p.follows)}</span></div>
          ${ver?`<div class="mstat">MC: <span>${escHtml(ver)}</span></div>`:''}
          ${p.categories?.length?`<div class="mstat">Tags: <span>${escHtml(p.categories.slice(0,2).join(', '))}</span></div>`:''}
        </div>
      </div>
      <button class="ibtn" onclick="installModpackById('${escHtml(p.id)}','${escHtml(p.title)}')">Install</button>
    </div>`;
  }).join('');
}

async function importModpackFromUrl() {
  const raw = (document.getElementById('modpackUrlInput')?.value || '').trim();
  if (!raw) { toast('Paste a modpack link first'); return; }
  setMpProgress('Starting import...', 2);
  try {
    let result;
    const mrMatch = raw.match(/modrinth\.com\/modpack\/([a-zA-Z0-9_-]+)/);
    if (mrMatch) {
      result = await window.launcher.importModpackFromModrinth({ slug: mrMatch[1] });
    } else {
      result = await window.launcher.importModpackFromUrl({ url: raw });
    }
    if (result.success) {
      instances.push(result.instance);
      await saveInstances();
      renderInstancesPanel();
      document.getElementById('modpackUrlInput').value = '';
      setMpProgress(`✓ Imported "${result.instance.name}"`, 100);
      toast(`Imported "${result.instance.name}" (${result.instance.mods} mods)`);
    } else {
      setMpProgress('Failed: ' + (result.error||'Unknown'), 0);
      toast('Import failed: ' + result.error);
    }
  } catch (e) {
    setMpProgress('Error: ' + e.message, 0);
    toast('Error: ' + e.message);
  }
}

async function installModpackById(id, title) {
  setMpProgress(`Fetching ${title}...`, 3);
  try {
    const result = await window.launcher.importModpackFromModrinth({ slug: id });
    if (result.success) {
      instances.push(result.instance);
      await saveInstances();
      renderInstancesPanel();
      setMpProgress(`✓ Installed "${result.instance.name}"`, 100);
      toast(`Installed "${result.instance.name}" (${result.instance.mods} mods)`);
    } else {
      setMpProgress('Failed: ' + (result.error||'Unknown'), 0);
      toast('Install failed: ' + result.error);
    }
  } catch (e) {
    setMpProgress('Error: ' + e.message, 0);
    toast('Error: ' + e.message);
  }
}

// Keep triggerImport working for file picker (defined in app.js)
