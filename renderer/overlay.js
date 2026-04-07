let allMods = [];
let currentFilter = 'all';
let searchQuery = '';

async function loadState() {
  const state = await window.overlay.getState();
  if (!state) return;

  const { instance, mods } = state;
  document.getElementById('overlay-instance').textContent =
    instance.name + ' \u00b7 ' + instance.mcVersion + ' \u00b7 ' + instance.loader;

  allMods = mods || [];
  renderMods();
}

function renderMods() {
  const list = document.getElementById('overlay-mod-list');
  const q = searchQuery.toLowerCase();

  let filtered = allMods.filter(m => {
    if (currentFilter === 'enabled'  && !m.enabled) return false;
    if (currentFilter === 'disabled' &&  m.enabled) return false;
    if (q && !m.title.toLowerCase().includes(q) && !m.filename.toLowerCase().includes(q)) return false;
    return true;
  });

  document.getElementById('overlay-count').textContent = filtered.length + ' mod' + (filtered.length !== 1 ? 's' : '');

  if (filtered.length === 0) {
    list.innerHTML = '<div id="overlay-empty">No mods found</div>';
    return;
  }

  list.innerHTML = filtered.map(m => {
    const ver = extractVersion(m.filename);
    const iconHtml = m.iconUrl
      ? `<img src="${escAttr(m.iconUrl)}" onerror="this.parentElement.textContent='\uD83E\uDDE9'">`
      : '\uD83E\uDDE9';

    return `
    <div class="overlay-mod">
      <div class="overlay-mod-icon">${iconHtml}</div>
      <div class="overlay-mod-info">
        <div class="overlay-mod-name">${escHtml(m.title)}</div>
        <div class="overlay-mod-sub">${ver ? escHtml(ver) : escHtml(m.source || 'manual')}</div>
      </div>
      <label class="overlay-toggle" title="${m.enabled ? 'Disable' : 'Enable'} ${escAttr(m.title)}">
        <input type="checkbox" ${m.enabled ? 'checked' : ''} data-id="${escAttr(m.id)}" data-enabled="${m.enabled}">
        <div class="overlay-toggle-track"></div>
        <div class="overlay-toggle-thumb"></div>
      </label>
    </div>`;
  }).join('');

  list.querySelectorAll('.overlay-toggle input').forEach(cb => {
    cb.addEventListener('change', async e => {
      const modId  = e.target.dataset.id;
      const enable = e.target.checked;
      e.target.disabled = true;
      await window.overlay.toggleMod({ modId, enable });
      const mod = allMods.find(m => m.id === modId);
      if (mod) mod.enabled = enable;
      e.target.dataset.enabled = enable;
      e.target.disabled = false;
    });
  });
}

function extractVersion(filename) {
  if (!filename) return '';
  const m = filename.match(/[-_](\d+[\d.]+\d+)/);
  return m ? m[1] : '';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(s) {
  return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Filter tabs
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderMods();
  });
});

// Search
document.getElementById('overlay-search').addEventListener('input', e => {
  searchQuery = e.target.value;
  renderMods();
});

// Close button
document.getElementById('overlay-close').addEventListener('click', () => {
  window.overlay.close();
});

// Keyboard shortcut to close
document.addEventListener('keydown', e => {
  if (e.key === 'F8' || e.key === 'Escape') window.overlay.close();
});

// Refresh when shown again
window.overlay.onRefresh(() => loadState());

// Initial load
loadState();
