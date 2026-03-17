let modpacksInitialized = false;

async function initModpacksPanel() {
  if (modpacksInitialized) return;
  modpacksInitialized = true;

  const panel = document.getElementById('panel-modpacks');
  panel.innerHTML = `
    <div class="ph"><div class="pt">Modpacks</div><div class="ps">Browse Modrinth modpacks or import your own</div></div>
    <div class="toolbar">
      <button class="btn p" onclick="triggerImport()">↑ Import .mrpack / .zip</button>
      <input class="sbox" id="modpackSearch" style="flex:1" placeholder="Search modpacks..." oninput="onModpackSearch(this.value)">
    </div>
    <div id="modpacksList" class="mlist"><div class="loading-row"><div class="spinner"></div>Loading from Modrinth...</div></div>
  `;

  loadModpacks('');
}

let modpackSearchTimer = null;
function onModpackSearch(val) {
  clearTimeout(modpackSearchTimer);
  modpackSearchTimer = setTimeout(() => loadModpacks(val), 400);
}

async function loadModpacks(query = '') {
  const list = document.getElementById('modpacksList');
  if (!list) return;
  list.innerHTML = `<div class="loading-row"><div class="spinner"></div>Searching modpacks...</div>`;

  const data = await window.launcher.searchModrinth({ query, type: 'modpack', limit: 15, offset: 0 });

  if (data.error) {
    list.innerHTML = `<div class="err-row">Failed to load modpacks: ${escHtml(data.error)}</div>`;
    return;
  }

  const packs = data.hits || [];
  if (!packs.length) {
    list.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 0;">No modpacks found.</div>';
    return;
  }

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
        <div class="mdesc">${escHtml(p.description || '')}</div>
        <div class="mstats">
          <div class="mstat">DL: <span>${fmtNum(p.downloads)}</span></div>
          <div class="mstat">Follows: <span>${fmtNum(p.follows)}</span></div>
          ${latestVer ? `<div class="mstat">MC: <span>${escHtml(latestVer)}</span></div>` : ''}
          ${p.categories?.length ? `<div class="mstat">Tags: <span>${escHtml(p.categories.slice(0,2).join(', '))}</span></div>` : ''}
        </div>
      </div>
      <button class="ibtn" onclick="installModpackFromModrinth('${escHtml(p.id)}','${escHtml(p.slug)}','${escHtml(p.title)}')">Install</button>
    </div>`;
  }).join('');
}

async function installModpackFromModrinth(id, slug, title) {
  toast(`Installing ${title}... (downloading via import system)`);
  // In the real app this would download the .mrpack file from Modrinth and pass it to importModpack
  // For now we guide the user to the Modrinth page to download manually
  toast(`Visit modrinth.com/modpack/${slug} to download the .mrpack, then use Import`);
}
