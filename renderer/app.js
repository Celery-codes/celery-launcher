let selectedInstanceId = null;
let instances = [];
let activeAccountUuid = null;
let mcVersionData = null;
let fabricData = null;
let editingInstanceId = null;
let launchRunning = false;
let toastTimer = null;
let openMenuId = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const s = await window.launcher.getSettings();
    applyTextSize(s.textSize || 'md');
    if (typeof applyTheme === 'function') applyTheme(s.theme || 'green');
  } catch { applyTextSize('md'); }

  // Dynamic version from package.json
  try {
  const ver = await window.launcher.getAppVersion();
  const el = document.querySelector('.app-ver');
  if (el) el.textContent = 'v' + ver;
} catch {}

  await loadAccounts();
  await loadInstances();
  renderInstancesPanel();
  renderAccountsPanel();
  renderSettingsPanel();
  initConsole();

  window.launcher.onLaunchStatus((data) => {
    const el = document.getElementById('launchStatus');
    el.className = 'launch-status ' + (data.status==='running'?'running':data.status==='error'?'error':'');
    el.innerHTML = data.message + (data.percent!==undefined && data.percent<100
      ? `<div class="progress-bar"><div class="progress-fill" style="width:${data.percent}%"></div></div>` : '');
    if (data.status === 'running') launchRunning = true;
    if (data.status === 'error') { launchRunning = false; setLaunchBtnState(false); }
    if (data.message && data.status !== 'running') appendConsoleLine('[Celery] ' + data.message, 'system');
  });

  window.launcher.onGameClosed(() => {
    launchRunning = false;
    setLaunchBtnState(false);
    document.getElementById('launchStatus').textContent = '';
    if (selectedInstanceId) syncModCount(selectedInstanceId);
  });

  window.launcher.onPlaytimeUpdate && window.launcher.onPlaytimeUpdate(({ instanceId, sessionSeconds }) => {
    const inst = instances.find(i => i.id === instanceId);
    if (inst) {
      inst.playtimeSeconds = (inst.playtimeSeconds || 0) + sessionSeconds;
      saveInstances();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tdot-btn') && !e.target.closest('.ctx-menu')) {
      document.querySelectorAll('.ctx-menu.open').forEach(m => m.classList.remove('open'));
      openMenuId = null;
    }
  });
});

function showPanel(name, el) {
  const detail = document.getElementById('panel-detail');
  if (detail) { detail.style.display = 'none'; detail.classList.remove('on'); }
  ['instances','mods','modpacks','accounts','settings','console'].forEach(n => {
    const p = document.getElementById('panel-' + n); if (p) p.style.display = '';
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.nav').forEach(n => n.classList.remove('on'));
  const target = document.getElementById('panel-' + name);
  if (target) target.classList.add('on');
  if (el) el.classList.add('on');
  if (name === 'mods')      initModsPanel();
  if (name === 'modpacks')  initModpacksPanel();
  if (name === 'accounts')  renderAccountsPanel();
  if (name === 'settings')  renderSettingsPanel();
  if (name === 'console')   renderConsolePanel();
}

async function loadInstances() { instances = await window.launcher.getInstances(); }
async function saveInstances() { await window.launcher.saveInstances(instances); }

async function syncModCount(instanceId) {
  const result = await window.launcher.syncModCount(instanceId);
  if (result.success) {
    const inst = instances.find(i => i.id === instanceId);
    if (inst) { inst.mods = result.count; await saveInstances(); renderInstanceGrid(instances); updateStrip(); }
  }
}

async function refreshAllModCounts() {
  let changed = false;
  for (const inst of instances) {
    const result = await window.launcher.syncModCount(inst.id);
    if (result.success && inst.mods !== result.count) { inst.mods = result.count; changed = true; }
  }
  if (changed) { await saveInstances(); renderInstanceGrid(instances); }
}

function renderInstancesPanel() {
  const panel = document.getElementById('panel-instances');
  panel.innerHTML = `
    <div class="ph"><div class="pt">Instances</div><div class="ps">Your Minecraft profiles</div></div>
    <div class="toolbar">
      <button class="btn p" onclick="openNewModal()">+ New Instance</button>
      <button class="btn" onclick="triggerImport()">↑ Import Modpack</button>
      <input class="sbox" style="flex:1" placeholder="Search instances..." oninput="filterInstances(this.value)">
      <select class="fsel" onchange="filterInstances('',this.value)">
        <option value="all">All loaders</option>
        <option value="Fabric">Fabric</option>
        <option value="Forge">Forge</option>
        <option value="Vanilla">Vanilla</option>
      </select>
    </div>
    <div class="igrid" id="instancesGrid"></div>
  `;
  renderInstanceGrid(instances);
  refreshAllModCounts();
}

function renderInstanceGrid(list, search='', loaderFilter='all') {
  const grid = document.getElementById('instancesGrid');
  if (!grid) return;
  let filtered = list;
  if (search) filtered = filtered.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  if (loaderFilter !== 'all') filtered = filtered.filter(i => i.loader === loaderFilter);
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><strong>${list.length===0?'No instances yet':'No results'}</strong>${list.length===0?'Create your first instance to get started.':'Try a different search or filter.'}</div>`;
    return;
  }
  const loaderTag = l => l==='Vanilla'?'tv':(l==='Forge'||l==='NeoForge')?'tfo':'tf';
  const fmtPlaytime = s => { if(!s||s<60) return ''; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?h+'h '+m+'m':m+'m'; };
  grid.innerHTML = filtered.map(inst => {
    const pt = fmtPlaytime(inst.playtimeSeconds||0);
    return `
    <div class="icard ${inst.id===selectedInstanceId?'sel':''}" onclick="selectInstance('${inst.id}')" id="icard-${inst.id}">
      <div class="iicon">🎮</div>
      <div class="iname">${escHtml(inst.name)}</div>
      <div class="imeta">${inst.mcVersion} · ${inst.loader}${inst.mods>0?' · '+inst.mods+' mods':''}</div>
      <div class="itags">
        <span class="tag ${loaderTag(inst.loader)}">${inst.loader}</span>
        ${pt?`<span class="tag tv">${pt}</span>`:''}
      </div>
      <div class="tdot-btn" onclick="event.stopPropagation();toggleCtxMenu('${inst.id}')">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
      <div class="ctx-menu" id="ctx-${inst.id}">
        <div class="ctx-item" onclick="event.stopPropagation();closeMenus();openInstanceDetail('${inst.id}')">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M5 6H11M5 9H9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          View contents
        </div>
        <div class="ctx-item" onclick="event.stopPropagation();openFolder('${inst.id}')">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4.5C2 3.67 2.67 3 3.5 3H6L7.5 5H12.5C13.33 5 14 5.67 14 6.5V12.5C14 13.33 13.33 14 12.5 14H3.5C2.67 14 2 13.33 2 12.5V4.5Z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          Open folder
        </div>
        <div class="ctx-item" onclick="event.stopPropagation();openEditModal('${inst.id}')">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          Edit instance
        </div>
        <div class="ctx-item" onclick="event.stopPropagation();closeMenus();updateInstanceMods('${inst.id}')">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 8C2 4.69 4.69 2 8 2C10.07 2 11.9 3.06 12.96 4.67M14 8C14 11.31 11.31 14 8 14C5.93 14 4.1 12.94 3.04 11.33" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M13 2V5H10M3 14V11H6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Update all mods
        </div>
        <div class="ctx-sep"></div>
        <div class="ctx-item del" onclick="event.stopPropagation();closeMenus();removeInstance('${inst.id}')">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 4H13M5 4V3H11V4M6 7V12M10 7V12M4 4L5 13H11L12 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          Remove instance
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterInstances(search, loaderFilter) {
  if (loaderFilter===undefined) loaderFilter = document.querySelector('#panel-instances .fsel')?.value||'all';
  renderInstanceGrid(instances, search, loaderFilter);
}

function selectInstance(id) {
  selectedInstanceId = id;
  renderInstanceGrid(instances, document.querySelector('#panel-instances .sbox')?.value||'');
  updateStrip();
}

function updateStrip() {
  const inst = instances.find(i => i.id===selectedInstanceId);
  if (inst) {
    document.getElementById('stripName').textContent = inst.name + ' — ' + inst.loader;
    document.getElementById('stripDetail').textContent = inst.mcVersion
      + (inst.loaderVersion?' · '+inst.loader+' '+inst.loaderVersion:'')
      + (inst.mods>0?' · '+inst.mods+' mods':'');
  } else {
    document.getElementById('stripName').textContent = 'No instance selected';
    document.getElementById('stripDetail').textContent = 'Create or select an instance above';
  }
}

function toggleCtxMenu(id) {
  const menu = document.getElementById('ctx-'+id);
  if (!menu) return;
  if (openMenuId && openMenuId!==id) {
    const old = document.getElementById('ctx-'+openMenuId); if (old) old.classList.remove('open');
  }
  menu.classList.toggle('open');
  openMenuId = menu.classList.contains('open') ? id : null;
}

async function openFolder(id) { closeMenus(); await window.launcher.openInstanceFolder(id); }

async function removeInstance(id) {
  instances = instances.filter(i => i.id!==id);
  if (selectedInstanceId===id) { selectedInstanceId=null; updateStrip(); }
  await saveInstances(); renderInstanceGrid(instances); toast('Instance removed');
}

async function updateInstanceMods(id) {
  const inst = instances.find(i => i.id===id);
  toast('Checking for updates on '+(inst?.name||id)+'...');
  const result = await window.launcher.updateAllMods(id);
  if (result.success) {
    const updated = (result.results||[]).filter(r=>r.status==='updated').length;
    toast(updated>0?'Updated '+updated+' mod(s)':'All mods are up to date');
    await syncModCount(id);
  } else toast('Update failed: '+result.error);
}

function closeMenus() {
  document.querySelectorAll('.ctx-menu.open').forEach(m => m.classList.remove('open'));
  openMenuId = null;
}

// ── New instance modal ────────────────────────────────────────────────────────
async function openNewModal() {
  document.getElementById('newName').value = '';
  showModal('newInstanceModal');
  if (!mcVersionData) mcVersionData = await window.launcher.getMcVersions();
  populateVersionSelect('newMcVer', mcVersionData.releases);
  document.getElementById('snapshotRow').style.display = 'block';
  if (!fabricData) fabricData = await window.launcher.getFabricVersions();
  populateLoaderVersionSelect('newLoaderVer', fabricData.loaders);
}

function populateVersionSelect(selectId, releases) {
  const sel = document.getElementById(selectId); if (!sel) return;
  sel.innerHTML = releases.map((v,i) => `<option value="${v.id}">${v.id}${i===0?' (latest)':''}</option>`).join('');
}
function populateLoaderVersionSelect(selectId, loaders) {
  const sel = document.getElementById(selectId); if (!sel) return;
  sel.innerHTML = loaders.map((l,i) => `<option value="${l.version}">${l.version}${!l.stable?' (unstable)':''}${i===0?' (latest)':''}</option>`).join('');
}
function toggleSnapshots() {
  if (!mcVersionData) return;
  const show = document.getElementById('showSnapshots').checked;
  const sel  = document.getElementById('newMcVer');
  sel.innerHTML = mcVersionData.releases.map((v,i) => `<option value="${v.id}">${v.id}${i===0?' (latest)':''}</option>`).join('')
    + (show ? mcVersionData.snapshots.map(v => `<option value="${v.id}">${v.id} (snapshot)</option>`).join('') : '');
}

async function onLoaderChange() {
  const loader = document.getElementById('newLoader').value;
  const field  = document.getElementById('loaderVerField');
  const label  = document.getElementById('loaderVerLabel');
  if (loader==='Vanilla') { field.style.display='none'; return; }
  field.style.display = 'block'; label.textContent = loader+' Loader Version';
  if (loader==='Fabric') {
    if (!fabricData) fabricData = await window.launcher.getFabricVersions();
    populateLoaderVersionSelect('newLoaderVer', fabricData.loaders);
  } else if (loader==='Forge') {
    const mcVer = document.getElementById('newMcVer').value;
    const data  = await window.launcher.getForgeVersions(mcVer);
    document.getElementById('newLoaderVer').innerHTML = (data.versions||[]).map((v,i) =>
      `<option value="${v}">${v}${i===0?' (latest)':''}</option>`).join('')||'<option value="latest">Latest</option>';
  } else {
    document.getElementById('newLoaderVer').innerHTML = '<option value="latest">Latest</option>';
  }
}

async function createInstance() {
  const name = document.getElementById('newName').value.trim();
  if (!name) { document.getElementById('newName').focus(); return; }
  const mcVersion    = document.getElementById('newMcVer').value;
  const loader       = document.getElementById('newLoader').value;
  const loaderVersion= loader!=='Vanilla' ? document.getElementById('newLoaderVer').value : '';
  const instance = {
    id: Date.now().toString(36)+Math.random().toString(36).substr(2),
    name, mcVersion, loader, loaderVersion, mods: 0, createdAt: new Date().toISOString()
  };
  instances.push(instance);
  await saveInstances();
  closeAllModals();
  renderInstancesPanel();
  selectInstance(instance.id);
  toast(`Instance "${name}" created`);
  if (loader!=='Vanilla'&&loader!=='Forge'&&loader!=='NeoForge') {
    window.launcher.onLoaderApiProgress(p => { document.getElementById('launchStatus').textContent = p.message||''; });
    const apiResult = await window.launcher.installLoaderApi({ instanceId: instance.id });
    if (apiResult.success && !apiResult.skipped) {
      toast(loader+' API installed automatically');
      await syncModCount(instance.id);
      renderInstanceGrid(instances);
    }
    document.getElementById('launchStatus').textContent = '';
  }
}

async function openEditModal(id) {
  closeMenus(); editingInstanceId = id;
  const inst = instances.find(i => i.id===id); if (!inst) return;
  document.getElementById('editName').value = inst.name;
  if (!mcVersionData) mcVersionData = await window.launcher.getMcVersions();
  populateVersionSelect('editMcVer', mcVersionData.releases);
  document.getElementById('editMcVer').value = inst.mcVersion;
  document.getElementById('editLoader').value = inst.loader;
  showModal('editInstanceModal');
}

async function saveEdit() {
  const inst = instances.find(i => i.id===editingInstanceId); if (!inst) return;
  inst.name      = document.getElementById('editName').value.trim()||inst.name;
  inst.mcVersion = document.getElementById('editMcVer').value;
  inst.loader    = document.getElementById('editLoader').value;
  await saveInstances(); closeAllModals(); renderInstancesPanel();
  if (selectedInstanceId===editingInstanceId) updateStrip();
  toast('Instance updated');
}

async function triggerImport() {
  const result = await window.launcher.importModpack();
  if (result.cancelled) return;
  if (result.success) {
    instances.push(result.instance); await saveInstances(); renderInstancesPanel();
    toast(`Imported "${result.instance.name}" (${result.instance.mods} mods)`);
  } else toast('Import failed: '+result.error);
}

// ── Launch ────────────────────────────────────────────────────────────────────
async function launchGame() {
  if (launchRunning) return;
  if (!selectedInstanceId) { toast('Select an instance first'); return; }
  if (!activeAccountUuid) { toast('Please log in first'); showPanel('accounts',document.getElementById('nav-accounts')); return; }
  const inst = instances.find(i => i.id===selectedInstanceId);
  appendConsoleLine('[Celery] Launching '+(inst?inst.name+' ('+inst.mcVersion+' '+inst.loader+')':''), 'system');
  launchRunning = true; setLaunchBtnState(true);
  const result = await window.launcher.launch({ instanceId: selectedInstanceId, accountUuid: activeAccountUuid });
  if (!result.success) {
    launchRunning = false; setLaunchBtnState(false);
    appendConsoleLine('[Celery] Launch failed: '+result.error, 'system');
    toast('Launch failed: '+result.error);
  } else {
    openConsolePanel();
  }
}

function setLaunchBtnState(running) {
  const btn = document.getElementById('launchBtn'); if (!btn) return;
  btn.disabled    = running;
  btn.textContent = running ? '⏳ Running...' : '▶ Launch';
}

// ── Accounts ──────────────────────────────────────────────────────────────────
async function loadAccounts() {
  const accounts = await window.launcher.getAccounts();
  const settings = await window.launcher.getSettings();
  activeAccountUuid = settings.activeAccount||accounts[0]?.uuid||null;
  const activeAcc   = accounts.find(a => a.uuid===activeAccountUuid);
  updateSidebarAccount(activeAcc);
  if (activeAcc && typeof initSkinForAccount==='function') initSkinForAccount(activeAcc).catch(()=>{});
}

function updateSidebarAccount(account) {
  const av   = document.getElementById('sidebarAvatar');
  const name = document.getElementById('sidebarUsername');
  const type = document.getElementById('sidebarAccountType');
  if (account) {
    if (!av.querySelector('img')) av.textContent = account.username.substring(0,2).toUpperCase();
    name.textContent = account.username;
    type.textContent = 'Microsoft · Java Edition';
  } else {
    av.innerHTML     = '?';
    name.textContent = 'Not logged in';
    type.textContent = 'Click to add account';
  }
}

// ── Modals ────────────────────────────────────────────────────────────────────
function showModal(id) {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}
function closeAllModals() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtNum(n) {
  if (!n) return '0';
  if (n>=1000000) return (n/1000000).toFixed(1)+'M';
  if (n>=1000)    return (n/1000).toFixed(1)+'K';
  return String(n);
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
