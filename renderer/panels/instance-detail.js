let detailInstanceId = null;
let detailTab = 'mods';

async function openInstanceDetail(instanceId) {
  detailInstanceId = instanceId;
  detailTab = 'mods';
  const inst = instances.find(i => i.id === instanceId);
  if (!inst) return;

  ['instances','mods','modpacks','accounts','settings','console'].forEach(name => {
    const p = document.getElementById('panel-' + name);
    if (p) { p.style.display = 'none'; p.classList.remove('on'); }
  });
  document.querySelectorAll('.nav').forEach(n => n.classList.remove('on'));

  let detail = document.getElementById('panel-detail');
  if (!detail) {
    detail = document.createElement('div');
    detail.id = 'panel-detail';
    detail.className = 'panel';
    detail.style.display = 'block';
    document.getElementById('mainContent').appendChild(detail);
  } else {
    detail.style.display = 'block';
  }

  const playtime = formatPlaytime(inst.playtimeSeconds || 0);

  detail.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <button class="btn" id="detailBackBtn">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Back
      </button>
      <div>
        <div class="pt" style="font-size:1em;margin-bottom:0;">${escHtml(inst.name)}</div>
        <div class="ps">${inst.mcVersion} &middot; ${inst.loader}${inst.loaderVersion ? ' ' + inst.loaderVersion : ''}${playtime ? ' &middot; ' + playtime + ' played' : ''}</div>
      </div>
      <button class="launch-btn" id="detailLaunchBtn" style="margin-left:auto;padding:6px 16px;font-size:0.8em;">&#9654; Launch</button>
    </div>
    <div class="mod-tabs" id="detailTabs">
      <div class="mtab on" data-tab="mods">Mods</div>
      <div class="mtab" data-tab="resourcepacks">Resource Packs</div>
      <div class="mtab" data-tab="shaderpacks">Shaders</div>
      <div class="mtab" data-tab="worlds">Worlds</div>
      <div class="mtab" data-tab="servers">Servers</div>
      <div class="mtab" data-tab="console">Console</div>
      <div class="mtab" data-tab="options">Options Profiles</div>
    </div>
    <div id="detailContent"></div>
  `;

  document.getElementById('detailBackBtn').addEventListener('click', closeInstanceDetail);
  document.getElementById('detailLaunchBtn').addEventListener('click', () => {
    closeInstanceDetail();
    selectInstance(instanceId);
    launchGame();
  });
  document.querySelectorAll('#detailTabs .mtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#detailTabs .mtab').forEach(t => t.classList.remove('on'));
      tab.classList.add('on');
      detailTab = tab.dataset.tab;
      loadDetailTab(detailTab);
    });
  });

  loadDetailTab('mods');
}

function closeInstanceDetail() {
  const detail = document.getElementById('panel-detail');
  if (detail) { detail.style.display = 'none'; detail.classList.remove('on'); }
  ['instances','mods','modpacks','accounts','settings','console'].forEach(name => {
    const p = document.getElementById('panel-' + name);
    if (p) p.style.display = '';
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  document.getElementById('panel-instances').classList.add('on');
  document.querySelectorAll('.nav').forEach(n => n.classList.remove('on'));
  document.getElementById('nav-instances').classList.add('on');
  renderInstanceGrid(instances);
}

async function loadDetailTab(tab) {
  const content = document.getElementById('detailContent');
  if (!content) return;
  content.innerHTML = '<div class="loading-row"><div class="spinner"></div>Loading...</div>';

  try {
    if (tab === 'mods')          await loadDetailMods(content);
    else if (tab === 'resourcepacks') await loadDetailFiles(content, 'resourcepacks', 'Resource Packs');
    else if (tab === 'shaderpacks')   await loadDetailFiles(content, 'shaderpacks', 'Shaders');
    else if (tab === 'worlds')        await loadDetailWorlds(content);
    else if (tab === 'servers')       await loadDetailServers(content);
    else if (tab === 'console')       loadDetailConsole(content);
    else if (tab === 'options')       await loadDetailOptions(content);
  } catch (e) {
    content.innerHTML = `<div class="err-row">Error: ${escHtml(e.message)}</div>`;
  }
}

function loadDetailConsole(content) {
  // Render inline console — live, auto-scrolling, filterable
  renderInlineConsole(content);
}

async function loadDetailMods(content) {
  const installed = await window.launcher.getInstalledMods(detailInstanceId);
  const inst = instances.find(i => i.id === detailInstanceId);
  if (inst && inst.mods !== installed.length) { inst.mods = installed.length; await saveInstances(); }

  if (!installed.length) {
    content.innerHTML = `<div class="empty-state"><strong>No mods installed</strong>Go to the Mods &amp; Resources tab to browse and install mods.</div>`;
    return;
  }

  content.innerHTML = `
    <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:0.8em;color:var(--text3);">${installed.length} mod${installed.length===1?'':'s'} installed</span>
      <button class="btn p" id="detailUpdateAllBtn" style="font-size:0.72em;padding:4px 10px;">&#8593; Update All</button>
    </div>
    <div class="mlist" id="detailModList">
      ${installed.map(m => `
        <div class="mrow" id="detailmod-${escHtml(m.id)}">
          <div class="micon">
            ${m.iconUrl ? `<img src="${escHtml(m.iconUrl)}" onerror="this.style.display='none'" alt="" loading="lazy">` : '<span style="font-size:18px;color:var(--text3);">&#128230;</span>'}
          </div>
          <div class="minfo">
            <div class="mname">${escHtml(m.title || m.filename)}</div>
            <div class="mdesc">${escHtml(m.filename || '')}</div>
            <div class="mstats">
              <div class="mstat">Source: <span>${escHtml(m.source || 'unknown')}</span></div>
              <div class="mstat">Added: <span>${m.installedAt ? new Date(m.installedAt).toLocaleDateString() : '?'}</span></div>
            </div>
          </div>
          <button class="ibtn inst" data-modid="${escHtml(m.id)}" data-modname="${escHtml(m.title || m.filename)}">Remove</button>
        </div>
      `).join('')}
    </div>`;

  document.getElementById('detailUpdateAllBtn').addEventListener('click', updateAllDetail);
  document.querySelectorAll('#detailModList .ibtn').forEach(btn => {
    btn.addEventListener('click', () => removeInstalledMod(btn.dataset.modid, btn.dataset.modname));
  });
}

async function removeInstalledMod(modId, name) {
  const result = await window.launcher.removeMod({ instanceId: detailInstanceId, modId });
  if (result.success) { toast('Removed ' + name); await syncModCount(detailInstanceId); loadDetailTab('mods'); }
  else toast('Remove failed: ' + result.error);
}

async function updateAllDetail() {
  const btn = document.getElementById('detailUpdateAllBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Checking...'; }
  const result = await window.launcher.updateAllMods(detailInstanceId);
  if (result.success) {
    const updated = (result.results || []).filter(r => r.status === 'updated').length;
    toast(updated > 0 ? 'Updated ' + updated + ' mod(s)' : 'All mods up to date');
    await syncModCount(detailInstanceId);
    loadDetailTab('mods');
  } else {
    toast('Update failed: ' + result.error);
    if (btn) { btn.disabled = false; btn.textContent = '&#8593; Update All'; }
  }
}

async function loadDetailFiles(content, folder, label) {
  const result = await window.launcher.listInstanceFolder({ instanceId: detailInstanceId, folder });
  const files = (result.files || []).filter(f => !f.isDir);

  content.innerHTML = `
    <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:0.8em;color:var(--text3);">${files.length} ${label.toLowerCase()}</span>
      <button class="btn" id="openFolderBtn" style="font-size:0.72em;">Open folder</button>
    </div>
    <div class="mlist">
      ${files.length === 0
        ? `<div class="empty-state"><strong>No ${label.toLowerCase()} installed</strong>Drop files into the folder to add them.</div>`
        : files.map(f => `
          <div class="mrow" style="padding:10px 14px;">
            <div class="micon"><span style="font-size:18px;color:var(--text3);">&#128450;</span></div>
            <div class="minfo"><div class="mname">${escHtml(f.name)}</div><div class="mdesc">${formatBytes(f.size)}</div></div>
            <button class="ibtn inst" data-filename="${escHtml(f.name)}" style="font-size:0.72em;">Remove</button>
          </div>`).join('')
      }
    </div>`;

  document.getElementById('openFolderBtn').addEventListener('click', () => {
    window.launcher.openInstanceSubfolder({ instanceId: detailInstanceId, folder });
  });
  content.querySelectorAll('.ibtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = await window.launcher.deleteInstanceFile({ instanceId: detailInstanceId, folder, filename: btn.dataset.filename });
      if (r.success) { toast('Removed ' + btn.dataset.filename); loadDetailTab(detailTab); }
      else toast('Failed: ' + r.error);
    });
  });
}

async function loadDetailWorlds(content) {
  const result = await window.launcher.listInstanceFolder({ instanceId: detailInstanceId, folder: 'saves' });
  const worlds = (result.files || []).filter(f => f.isDir);

  content.innerHTML = `
    <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:0.8em;color:var(--text3);">${worlds.length} world${worlds.length===1?'':'s'}</span>
      <button class="btn" id="openSavesBtn" style="font-size:0.72em;">Open saves folder</button>
    </div>
    <div class="mlist">
      ${worlds.length === 0
        ? `<div class="empty-state"><strong>No worlds yet</strong>Worlds appear here after you create them in-game.</div>`
        : worlds.map(w => `
          <div class="mrow" style="padding:10px 14px;">
            <div class="micon"><span style="font-size:20px;">&#127757;</span></div>
            <div class="minfo">
              <div class="mname">${escHtml(w.name)}</div>
              <div class="mdesc">Last modified: ${w.modified ? new Date(w.modified).toLocaleDateString() : 'Unknown'}</div>
            </div>
            <button class="btn" data-world="${escHtml(w.name)}" style="font-size:0.72em;">Open</button>
          </div>`).join('')
      }
    </div>`;

  document.getElementById('openSavesBtn').addEventListener('click', () => {
    window.launcher.openInstanceSubfolder({ instanceId: detailInstanceId, folder: 'saves' });
  });
  content.querySelectorAll('.mrow .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.launcher.openInstanceSubfolder({ instanceId: detailInstanceId, folder: 'saves/' + btn.dataset.world });
    });
  });
}

async function loadDetailServers(content) {
  const result = await window.launcher.readServersDat(detailInstanceId);
  const servers = result.servers || [];
  content.innerHTML = `
    <div style="margin-bottom:12px;">
      <span style="font-size:0.8em;color:var(--text3);">${servers.length} saved server${servers.length===1?'':'s'}</span>
    </div>
    <div class="mlist">
      ${servers.length === 0
        ? `<div class="empty-state"><strong>No servers saved</strong>Add servers in-game and they'll appear here.</div>`
        : servers.map(s => `
          <div class="mrow" style="padding:10px 14px;">
            <div class="micon"><span style="font-size:20px;">&#128421;</span></div>
            <div class="minfo">
              <div class="mname">${escHtml(s.name || 'Unnamed Server')}</div>
              <div class="mdesc" style="font-family:var(--mono);">${escHtml(s.ip || '')}</div>
            </div>
          </div>`).join('')
      }
    </div>`;
}

async function loadDetailOptions(content) {
  const profiles = await window.launcher.listOptionProfiles();
  content.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:0.85em;color:var(--text2);margin-bottom:10px;line-height:1.6;">
        Save this instance's current keybinds and settings as a reusable profile.
        <br><span style="color:var(--text3);font-size:0.85em;">Launch the game at least once to generate options.txt before saving.</span>
      </div>
      <button class="btn p" id="saveOptionsBtn">+ Save current options as profile</button>
    </div>
    <div id="optionProfilesList" class="mlist">
      ${profiles.length === 0
        ? `<div class="empty-state"><strong>No option profiles yet</strong>Save a profile from any instance to reuse its settings.</div>`
        : profiles.map(p => `
          <div class="mrow" style="padding:10px 14px;">
            <div class="micon"><span style="font-size:20px;">&#9881;</span></div>
            <div class="minfo">
              <div class="mname">${escHtml(p.name)}</div>
              <div class="mdesc">Saved ${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="ibtn" data-pid="${escHtml(p.id)}" data-pname="${escHtml(p.name)}">Apply</button>
              <button class="ibtn inst" data-pid="${escHtml(p.id)}" data-pname="${escHtml(p.name)}">Delete</button>
            </div>
          </div>`).join('')
      }
    </div>`;

  document.getElementById('saveOptionsBtn').addEventListener('click', async () => {
    const name = await window.launcher.showInputDialog({ title: 'Save Options Profile', label: 'Profile name', placeholder: 'e.g. PvP keybinds' });
    if (!name) return;
    const result = await window.launcher.captureOptionsProfile({ instanceId: detailInstanceId, name });
    if (result.success) { toast('Saved profile "' + name + '"'); loadDetailTab('options'); }
    else toast('Failed: ' + result.error);
  });

  content.querySelectorAll('.ibtn:not(.inst)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const result = await window.launcher.applyOptionsProfile({ instanceId: detailInstanceId, profileId: btn.dataset.pid });
      if (result.success) toast('Applied "' + btn.dataset.pname + '"');
      else toast('Failed: ' + result.error);
    });
  });
  content.querySelectorAll('.ibtn.inst').forEach(btn => {
    btn.addEventListener('click', async () => {
      const result = await window.launcher.deleteOptionsProfile(btn.dataset.pid);
      if (result.success) { toast('Deleted "' + btn.dataset.pname + '"'); loadDetailTab('options'); }
      else toast('Failed: ' + result.error);
    });
  });
}

function formatBytes(b) {
  if (!b) return '';
  if (b > 1048576) return (b/1048576).toFixed(1)+' MB';
  if (b > 1024) return (b/1024).toFixed(1)+' KB';
  return b+' B';
}

function formatPlaytime(seconds) {
  if (!seconds || seconds < 60) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}
