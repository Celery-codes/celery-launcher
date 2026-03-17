let modTab = 'mod';
let modSource = 'modrinth';
let modSearchTimer = null;
let modsInitialized = false;
let modOffset = 0;
let modTotalResults = 0;
let modCurrentQuery = '';
let modCurrentVersion = '';
let modCurrentCategory = '';

function initModsPanel() {
  if (modsInitialized) return;
  modsInitialized = true;
  renderModsPanel();
  searchMods('', true);
}

function renderModsPanel() {
  const panel = document.getElementById('panel-mods');
  panel.innerHTML = `
    <div class="ph"><div class="pt">Mods &amp; Resources</div><div class="ps">Browse and install from Modrinth and CurseForge</div></div>
    <div class="mod-tabs" id="modTypeTabs">
      <div class="mtab on" data-type="mod">Mods</div>
      <div class="mtab" data-type="resourcepack">Resource Packs</div>
      <div class="mtab" data-type="shader">Shaders</div>
      <div class="mtab" data-type="datapack">Data Packs</div>
    </div>
    <div class="toolbar">
      <div class="mod-tabs" style="margin-bottom:0;">
        <div class="mtab on" id="src-modrinth">Modrinth</div>
        <div class="mtab" id="src-curseforge">CurseForge</div>
      </div>
      <input class="sbox" id="modSearchInput" style="flex:1" placeholder="Search mods...">
      <select class="fsel" id="modVersionFilter">
        <option value="">Any MC version</option>
      </select>
      <select class="fsel" id="modCategoryFilter">
        <option value="">All categories</option>
        <option value="optimization">Optimization</option>
        <option value="library">Library</option>
        <option value="utility">Utility</option>
        <option value="storage">Storage</option>
        <option value="magic">Magic</option>
        <option value="technology">Technology</option>
        <option value="adventure">Adventure</option>
        <option value="decoration">Decoration</option>
      </select>
    </div>
    <div id="modsList" class="mlist"></div>
    <div id="modsLoadMore" style="text-align:center;padding:16px;display:none;">
      <button class="btn" id="loadMoreBtn">Load more</button>
    </div>
  `;

  // Type tabs
  document.querySelectorAll('#modTypeTabs .mtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#modTypeTabs .mtab').forEach(t => t.classList.remove('on'));
      tab.classList.add('on');
      modTab = tab.dataset.type;
      const si = document.getElementById('modSearchInput');
      if (si) si.placeholder = `Search ${modTab === 'resourcepack' ? 'resource packs' : modTab + 's'}...`;
      searchMods('', true);
    });
  });

  // Source tabs
  document.getElementById('src-modrinth').addEventListener('click', () => setModSource('modrinth'));
  document.getElementById('src-curseforge').addEventListener('click', () => setModSource('curseforge'));

  // Search input
  document.getElementById('modSearchInput').addEventListener('input', e => {
    clearTimeout(modSearchTimer);
    modSearchTimer = setTimeout(() => searchMods(e.target.value, true), 400);
  });

  // Filters
  document.getElementById('modVersionFilter').addEventListener('change', () => searchMods(document.getElementById('modSearchInput').value, true));
  document.getElementById('modCategoryFilter').addEventListener('change', () => searchMods(document.getElementById('modSearchInput').value, true));

  // Load more button
  document.getElementById('loadMoreBtn').addEventListener('click', loadMoreMods);

  // Populate version filter
  if (mcVersionData) {
    const sel = document.getElementById('modVersionFilter');
    mcVersionData.releases.slice(0, 12).forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.id + (i === 0 ? ' (latest)' : '');
      sel.appendChild(opt);
    });
    // Default to selected instance's MC version
    if (selectedInstanceId) {
      const inst = instances.find(i => i.id === selectedInstanceId);
      if (inst && inst.mcVersion) sel.value = inst.mcVersion;
    }
  }
}

function setModSource(src) {
  modSource = src;
  document.getElementById('src-modrinth').classList.toggle('on', src === 'modrinth');
  document.getElementById('src-curseforge').classList.toggle('on', src === 'curseforge');
  searchMods(document.getElementById('modSearchInput')?.value || '', true);
}

async function searchMods(query, reset) {
  if (reset) {
    modOffset = 0;
    modTotalResults = 0;
  }
  modCurrentQuery = query !== undefined ? query : modCurrentQuery;
  modCurrentVersion = document.getElementById('modVersionFilter')?.value || '';
  modCurrentCategory = document.getElementById('modCategoryFilter')?.value || '';

  const list = document.getElementById('modsList');
  if (!list) return;

  if (reset) {
    list.innerHTML = `<div class="loading-row"><div class="spinner"></div>Searching ${modSource === 'modrinth' ? 'Modrinth' : 'CurseForge'}...</div>`;
  }

  const LIMIT = 20;
  let data;

  if (modSource === 'modrinth') {
    data = await window.launcher.searchModrinth({
      query: modCurrentQuery,
      version: modCurrentVersion,
      category: modCurrentCategory,
      type: modTab,
      limit: LIMIT,
      offset: modOffset
    });
  } else {
    data = await window.launcher.searchCurseForge({
      query: modCurrentQuery,
      version: modCurrentVersion,
      category: modCurrentCategory,
      type: modTab,
      limit: LIMIT
    });
    if (data.error === 'no_key') {
      list.innerHTML = `<div class="err-row">CurseForge API key not set. Add it in Settings.</div>`;
      return;
    }
    if (data.error === 'invalid_key') {
      list.innerHTML = `<div class="err-row">Invalid CurseForge API key. Check Settings.</div>`;
      return;
    }
  }

  if (data.error) {
    list.innerHTML = `<div class="err-row">Error: ${escHtml(data.error)}</div>`;
    return;
  }

  const hits = data.hits || [];
  modTotalResults = data.total || 0;
  modOffset += hits.length;

  if (reset) {
    list.innerHTML = '';
    if (!hits.length) {
      list.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 0;">No results found.</div>';
      document.getElementById('modsLoadMore').style.display = 'none';
      return;
    }
  }

  appendModResults(list, hits);

  // Show/hide load more
  const loadMoreDiv = document.getElementById('modsLoadMore');
  loadMoreDiv.style.display = modOffset < modTotalResults ? 'block' : 'none';
}

async function loadMoreMods() {
  const btn = document.getElementById('loadMoreBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

  const list = document.getElementById('modsList');
  if (!list) return;

  await searchMods(modCurrentQuery, false);  // false = append, don't reset

  if (btn) { btn.disabled = false; btn.textContent = 'Load more'; }
}

function appendModResults(list, mods) {
  mods.forEach(m => {
    const div = document.createElement('div');
    div.className = 'mrow';
    div.id = 'modrow-' + m.id;

    const icon = m.iconUrl
      ? `<img src="${escHtml(m.iconUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : `<span style="font-size:18px;color:var(--text3);">📦</span>`;

    div.innerHTML = `
      <div class="micon">${icon}</div>
      <div class="minfo">
        <div class="mname">${escHtml(m.title)}</div>
        <div class="mdesc">${escHtml(m.description || '')}</div>
        <div class="mstats">
          <div class="mstat">DL: <span>${fmtNum(m.downloads)}</span></div>
          <div class="mstat">Follows: <span>${fmtNum(m.follows)}</span></div>
          ${m.categories?.length ? `<div class="mstat">Tags: <span>${escHtml(m.categories.slice(0,3).join(', '))}</span></div>` : ''}
          ${m.gameVersions?.length ? `<div class="mstat">MC: <span>${escHtml(m.gameVersions[m.gameVersions.length-1] || '')}</span></div>` : ''}
        </div>
      </div>
      <button class="ibtn" data-modid="${escHtml(m.id)}" data-source="${escHtml(m.source || modSource)}">Install</button>
    `;

    // Store mod data on element so we don't need a global array
    div._modData = m;

    div.querySelector('.ibtn').addEventListener('click', function() {
      toggleModInstall(this, div._modData);
    });

    list.appendChild(div);
  });
}

async function toggleModInstall(btn, mod) {
  if (!selectedInstanceId) { toast('Select an instance first'); return; }

  if (btn.classList.contains('inst')) {
    btn.disabled = true;
    const result = await window.launcher.removeMod({ instanceId: selectedInstanceId, modId: mod.id });
    if (result.success) {
      btn.classList.remove('inst');
      btn.textContent = 'Install';
      btn.disabled = false;
      await syncModCount(selectedInstanceId);
      toast(`Removed ${mod.title}`);
    } else {
      btn.disabled = false;
      toast('Remove failed: ' + result.error);
    }
  } else {
    btn.disabled = true;
    btn.textContent = '0%';

    window.launcher.onModInstallProgress((progress) => {
      if (btn && !btn.classList.contains('inst')) {
        btn.textContent = progress.percent < 100 ? `${progress.percent}%` : 'Done!';
      }
    });

    const result = await window.launcher.installMod({
      instanceId: selectedInstanceId,
      mod,
      source: mod.source || modSource
    });

    if (result.success) {
      btn.classList.add('inst');
      btn.textContent = 'Installed';
      btn.disabled = false;
      await syncModCount(selectedInstanceId);
      toast(`Installed ${mod.title}`);
    } else {
      btn.disabled = false;
      btn.textContent = 'Install';
      toast('Install failed: ' + result.error);
    }
  }
}
