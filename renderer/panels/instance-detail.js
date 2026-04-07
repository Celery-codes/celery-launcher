let detailInstanceId = null;
let detailTab = 'mods';
let modViewLayout = 'card';
let modViewFilter = 'all';
let modViewSearch = '';
let detailModsCache = [];

async function openInstanceDetail(instanceId) {
  detailInstanceId = instanceId;
  detailTab = 'mods';
  const inst = instances.find(i => i.id === instanceId);
  if (!inst) return;

  ['instances','mods','modpacks','accounts','settings','console'].forEach(name => {
    const p = document.getElementById('panel-'+name);
    if (p) { p.style.display='none'; p.classList.remove('on'); }
  });
  document.querySelectorAll('.nav').forEach(n => n.classList.remove('on'));

  let detail = document.getElementById('panel-detail');
  if (!detail) {
    detail = document.createElement('div');
    detail.id = 'panel-detail';
    detail.className = 'panel';
    detail.style.display = 'block';
    document.getElementById('mainContent').appendChild(detail);
  } else { detail.style.display = 'block'; }

  const fmtPt = s => { if(!s||s<60)return''; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?h+'h '+m+'m':m+'m'; };
  const pt = fmtPt(inst.playtimeSeconds||0);

  detail.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <button class="btn" id="detailBackBtn">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Back
      </button>
      <div>
        <div class="pt" style="font-size:1em;margin-bottom:0;">${escHtml(inst.name)}</div>
        <div class="ps">${inst.mcVersion} · ${inst.loader}${inst.loaderVersion?' '+inst.loaderVersion:''}${pt?' · '+pt+' played':''}</div>
      </div>
      <button class="launch-btn" id="detailLaunchBtn" style="margin-left:auto;padding:6px 16px;font-size:12px;">▶ Launch</button>
    </div>
    <div class="mod-tabs" id="detailTabs">
      <div class="mtab on" data-tab="mods">Mods</div>
      <div class="mtab" data-tab="resourcepacks">Resource Packs</div>
      <div class="mtab" data-tab="shaderpacks">Shaders</div>
      <div class="mtab" data-tab="worlds">Worlds</div>
      <div class="mtab" data-tab="servers">Servers</div>
      <div class="mtab" data-tab="options">Options Profiles</div>
      <div class="mtab" data-tab="network">Network</div>
    </div>
    <div id="detailContent"></div>
  `;

  document.getElementById('detailBackBtn').addEventListener('click', closeInstanceDetail);
  document.getElementById('detailLaunchBtn').addEventListener('click', () => {
    closeInstanceDetail(); selectInstance(instanceId); launchGame();
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
  if (detail) { detail.style.display='none'; detail.classList.remove('on'); }
  ['instances','mods','modpacks','accounts','settings','console'].forEach(name => {
    const p = document.getElementById('panel-'+name); if (p) p.style.display='';
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
    if (tab==='mods')          await loadDetailMods(content);
    else if (tab==='resourcepacks') await loadDetailFiles(content,'resourcepacks','Resource Packs');
    else if (tab==='shaderpacks')   await loadDetailFiles(content,'shaderpacks','Shaders');
    else if (tab==='worlds')        await loadDetailWorlds(content);
    else if (tab==='servers')       await loadDetailServers(content);
    else if (tab==='options')       await loadDetailOptions(content);
    else if (tab==='network')       await loadDetailNetwork(content);
  } catch (e) {
    content.innerHTML = `<div class="err-row">Error: ${escHtml(e.message)}</div>`;
  }
}

// ── Performance mod recommendations ──────────────────────────────────────────
const PERF_MODS = {
  Fabric: [
    { id:'AANobbMI', slug:'sodium',        name:'Sodium',         desc:'Rendering engine rewrite — biggest FPS boost available' },
    { id:'gvQqBUqZ', slug:'lithium',       name:'Lithium',        desc:'Game logic and server-side optimizations' },
    { id:'uXXizFIs', slug:'ferritecore',   name:'FerriteCore',    desc:'Cuts memory usage significantly at runtime' },
    { id:'NNAgCjsB', slug:'entityculling', name:'Entity Culling', desc:'Skip rendering hidden entities and block entities' },
    { id:'5ZwThgaB', slug:'immediatelyfast', name:'ImmediatelyFast', desc:'Optimizes batch rendering in GUIs and world' },
    { id:'nmDcB62a', slug:'modernfix',     name:'ModernFix',      desc:'Faster startup, less memory, better overall perf' },
    { id:'fQEb0iXm', slug:'krypton',       name:'Krypton',        desc:'Minecraft networking stack optimization' },
    { id:'H8CaAYZC', slug:'starlight',     name:'Starlight',      desc:'Full rewrite of the light engine for large speedup' },
  ],
  Quilt: [
    { id:'AANobbMI', slug:'sodium',        name:'Sodium',         desc:'Rendering engine rewrite — biggest FPS boost available' },
    { id:'gvQqBUqZ', slug:'lithium',       name:'Lithium',        desc:'Game logic and server-side optimizations' },
    { id:'uXXizFIs', slug:'ferritecore',   name:'FerriteCore',    desc:'Cuts memory usage significantly at runtime' },
    { id:'NNAgCjsB', slug:'entityculling', name:'Entity Culling', desc:'Skip rendering hidden entities and block entities' },
    { id:'nmDcB62a', slug:'modernfix',     name:'ModernFix',      desc:'Faster startup, less memory, better overall perf' },
  ],
  Forge: [
    { id:'sk9rgefA', slug:'embeddium',     name:'Embeddium',      desc:'Sodium port for Forge — major rendering FPS boost' },
    { id:'uXXizFIs', slug:'ferritecore',   name:'FerriteCore',    desc:'Cuts memory usage significantly at runtime' },
    { id:'nmDcB62a', slug:'modernfix',     name:'ModernFix',      desc:'Faster startup, less memory, better overall perf' },
    { id:'NNAgCjsB', slug:'entityculling', name:'Entity Culling', desc:'Skip rendering hidden entities and block entities' },
  ],
  NeoForge: [
    { id:'sk9rgefA', slug:'embeddium',     name:'Embeddium',      desc:'Sodium port for NeoForge — major rendering FPS boost' },
    { id:'uXXizFIs', slug:'ferritecore',   name:'FerriteCore',    desc:'Cuts memory usage significantly at runtime' },
    { id:'nmDcB62a', slug:'modernfix',     name:'ModernFix',      desc:'Faster startup, less memory, better overall perf' },
    { id:'NNAgCjsB', slug:'entityculling', name:'Entity Culling', desc:'Skip rendering hidden entities and block entities' },
  ],
};

function getPerfRecommendations(installed, loader) {
  const candidates = PERF_MODS[loader] || [];
  const installedIds  = new Set(installed.map(m => m.id).filter(Boolean));
  const installedSlugs = new Set(installed.map(m => m.slug).filter(Boolean));
  // Also match by filename prefix (for manually-dropped jars)
  const installedFiles = installed.map(m => (m.filename||'').toLowerCase());
  return candidates.filter(p => {
    if (installedIds.has(p.id) || installedSlugs.has(p.slug)) return false;
    if (installedFiles.some(f => f.startsWith(p.slug+'-') || f.startsWith(p.slug+'_'))) return false;
    return true;
  });
}

// ── Mods tab ──────────────────────────────────────────────────────────────────
async function loadDetailMods(content) {
  const installed = await window.launcher.getInstalledMods(detailInstanceId);
  detailModsCache = installed;
  const inst = instances.find(i=>i.id===detailInstanceId);
  if (inst && inst.mods!==installed.length) { inst.mods=installed.length; await saveInstances(); }
  if (!installed.length) {
    content.innerHTML=`<div class="empty-state"><strong>No mods installed</strong>Go to Mods &amp; Resources to browse and install mods.</div>`;
    renderPerfRecommendations(content, [], inst?.loader || 'Fabric');
    return;
  }
  renderModsToolbar(content, installed);
  renderModsList(content, installed);
  // Auto-check for updates in background, silently apply
  autoUpdateMods(inst);
  // Show performance recommendations below mod list
  renderPerfRecommendations(content, installed, inst?.loader || 'Fabric');
}

async function autoUpdateMods(inst) {
  if (!inst) return;
  try {
    const r = await window.launcher.updateAllMods(inst.id);
    if (r.success) {
      const updated = (r.results||[]).filter(x=>x.status==='updated');
      if (updated.length>0) {
        toast('Auto-updated '+updated.length+' mod(s): '+updated.map(u=>u.mod).join(', '));
        await syncModCount(inst.id);
        const fresh = await window.launcher.getInstalledMods(inst.id);
        detailModsCache = fresh;
        renderModsList(null, fresh);
        renderPerfRecommendations(document.getElementById('detailContent'), fresh, inst.loader||'Fabric');
      }
    }
  } catch {}
}

function renderPerfRecommendations(content, installed, loader) {
  const recs = getPerfRecommendations(installed, loader);
  // Remove any previous recommendations section
  document.getElementById('perfRecsSection')?.remove();
  if (!recs.length) return;

  const inst = instances.find(i=>i.id===detailInstanceId);
  const section = document.createElement('div');
  section.id = 'perfRecsSection';
  section.style.cssText = 'margin-top:16px;';
  section.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;cursor:pointer;"
         onclick="this.parentElement.querySelector('.perf-list').classList.toggle('perf-collapsed');
                  this.querySelector('.perf-chevron').classList.toggle('perf-chevron-open');">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;font-weight:600;color:var(--green);text-transform:uppercase;letter-spacing:.8px;">
          Performance Recommendations
        </span>
        <span style="font-size:10px;background:var(--green-dim);color:var(--green);padding:1px 7px;border-radius:10px;border:1px solid rgba(74,222,128,.25);">
          ${recs.length} available
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button class="btn p" id="installAllPerf" style="font-size:10px;padding:3px 10px;" onclick="event.stopPropagation();installAllPerfMods()">
          Install All
        </button>
        <svg class="perf-chevron perf-chevron-open" width="12" height="12" viewBox="0 0 16 16" fill="none" style="transition:transform .2s;color:var(--text3);">
          <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </div>
    <div class="perf-list mlist">
      ${recs.map(m => `
        <div class="mrow" data-perf-slug="${escHtml(m.slug)}" style="padding:9px 14px;">
          <div class="micon" style="background:var(--green-dim);border:1px solid rgba(74,222,128,.2);">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L10 6H14L11 9L12 13L8 11L4 13L5 9L2 6H6L8 2Z" fill="currentColor" opacity=".7"/></svg>
          </div>
          <div class="minfo">
            <div class="mname">${escHtml(m.name)}</div>
            <div class="mdesc">${escHtml(m.desc)}</div>
          </div>
          <button class="ibtn p" data-perf-id="${escHtml(m.id)}" data-perf-name="${escHtml(m.name)}"
                  style="font-size:.72em;flex-shrink:0;" onclick="installPerfMod(this)">
            + Install
          </button>
        </div>`).join('')}
    </div>
  `;

  // Append after detailModList or directly into content
  const listEl = document.getElementById('detailModList');
  if (listEl) listEl.parentElement.appendChild(section);
  else content.appendChild(section);
}

async function installPerfMod(btn) {
  const id   = btn.dataset.perfId;
  const name = btn.dataset.perfName;
  const row  = btn.closest('[data-perf-slug]');
  const slug = row?.dataset.perfSlug || id;
  btn.disabled = true; btn.textContent = '...';
  try {
    const r = await window.launcher.installMod({
      instanceId: detailInstanceId,
      mod: { id, slug, title: name, source: 'modrinth' },
      source: 'modrinth'
    });
    if (r.success) {
      toast('Installed '+name); row?.remove();
      await syncModCount(detailInstanceId);
      const fresh = await window.launcher.getInstalledMods(detailInstanceId);
      detailModsCache = fresh;
      renderModsList(null, fresh);
      // Remove section if no more recommendations
      const inst = instances.find(i=>i.id===detailInstanceId);
      renderPerfRecommendations(document.getElementById('detailContent'), fresh, inst?.loader||'Fabric');
    } else { toast('Install failed: '+(r.error||'unknown')); btn.disabled=false; btn.textContent='+ Install'; }
  } catch(e) { toast('Error: '+e.message); btn.disabled=false; btn.textContent='+ Install'; }
}

async function installAllPerfMods() {
  const btn = document.getElementById('installAllPerf');
  const inst = instances.find(i=>i.id===detailInstanceId);
  const recs = getPerfRecommendations(detailModsCache, inst?.loader||'Fabric');
  if (!recs.length) return;
  if (btn) { btn.disabled=true; btn.textContent='Installing...'; }
  let installed=0, failed=0;
  for (const m of recs) {
    try {
      const r = await window.launcher.installMod({
        instanceId: detailInstanceId,
        mod: { id: m.id, slug: m.slug, title: m.name, source: 'modrinth' },
        source: 'modrinth'
      });
      if (r.success) installed++; else failed++;
    } catch { failed++; }
  }
  toast('Installed '+installed+' mod(s)'+(failed?' ('+failed+' failed)':''));
  await syncModCount(detailInstanceId);
  loadDetailTab('mods');
}

function renderModsToolbar(content, installed) {
  const enabled  = installed.filter(m=>m.enabled!==false).length;
  const disabled = installed.filter(m=>m.enabled===false).length;
  content.innerHTML = `
    <div class="mod-mgr-bar" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;align-items:center;gap:6px;">
        <input class="sbox" id="modSearch" placeholder="Search mods…" style="width:160px;"
          oninput="filterDetailMods(this.value)" value="${escHtml(modViewSearch)}">
        <div style="display:flex;gap:3px;">
          <button class="clf ${modViewFilter==='all'?'on':''}" onclick="setModFilter('all')">All (${installed.length})</button>
          <button class="clf ${modViewFilter==='enabled'?'on':''}" onclick="setModFilter('enabled')">Enabled (${enabled})</button>
          <button class="clf ${modViewFilter==='disabled'?'on':''}" onclick="setModFilter('disabled')">Disabled (${disabled})</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;">
        <button class="btn" onclick="selectAllMods()" title="Select all">&#9745;</button>
        <button class="btn" onclick="bulkToggle(true)">Enable</button>
        <button class="btn" onclick="bulkToggle(false)">Disable</button>
        <button class="btn p" id="detailUpdateAllBtn" onclick="updateAllDetail()">Update All</button>
        <button class="btn" onclick="window.launcher.openInstanceSubfolder({instanceId:detailInstanceId,folder:'mods'})" title="Open mods folder">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4.5C2 3.67 2.67 3 3.5 3H6L7.5 5H12.5C13.33 5 14 5.67 14 6.5V12.5C14 13.33 13.33 14 12.5 14H3.5C2.67 14 2 13.33 2 12.5V4.5Z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          Open Mods Folder
        </button>
        <div style="margin-left:auto;display:flex;gap:4px;">
          <button class="btn ${modViewLayout==='card'?'p':''}" id="btnCard" onclick="setModLayout('card')" title="Card view">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.2" fill="currentColor" opacity=".7"/><rect x="9" y="1" width="6" height="6" rx="1.2" fill="currentColor" opacity=".7"/><rect x="1" y="9" width="6" height="6" rx="1.2" fill="currentColor" opacity=".7"/><rect x="9" y="9" width="6" height="6" rx="1.2" fill="currentColor" opacity=".7"/></svg>
          </button>
          <button class="btn ${modViewLayout==='compact'?'p':''}" id="btnList" onclick="setModLayout('compact')" title="List view">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 4H13M3 8H13M3 12H13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div id="detailModList"></div>`;
}

function getVisibleMods() {
  let mods = detailModsCache;
  if (modViewFilter==='enabled')  mods=mods.filter(m=>m.enabled!==false);
  if (modViewFilter==='disabled') mods=mods.filter(m=>m.enabled===false);
  if (modViewSearch) { const q=modViewSearch.toLowerCase(); mods=mods.filter(m=>(m.title||m.filename).toLowerCase().includes(q)); }
  return mods;
}

function renderModsList(content, installed) {
  const listEl = document.getElementById('detailModList'); if (!listEl) return;
  const visible = getVisibleMods();
  if (!visible.length) { listEl.innerHTML=`<div class="empty-state"><strong>No mods match</strong>Try a different filter or search.</div>`; return; }
  if (modViewLayout==='compact') {
    listEl.innerHTML=`<table class="mod-table"><thead><tr>
      <th style="width:28px;"><input type="checkbox" id="checkAll" onchange="toggleCheckAll(this.checked)"></th>
      <th>Mod</th><th style="width:100px;">Version</th><th style="width:80px;">Status</th><th style="width:90px;"></th>
    </tr></thead><tbody>
    ${visible.map(m=>{
      const enabled=m.enabled!==false;
      const ver=(m.filename||'').match(/[-_]([\d.]+(?:[-+].+)?)\.jar/i)?.[1]||'—';
      return `<tr class="mod-row ${enabled?'':'mod-disabled'}" data-modid="${escHtml(m.id)}">
        <td><input type="checkbox" class="mod-check" data-modid="${escHtml(m.id)}"></td>
        <td><div style="display:flex;align-items:center;gap:8px;">
          ${m.iconUrl?`<img src="${escHtml(m.iconUrl)}" width="20" height="20" style="border-radius:3px;" onerror="this.style.display='none'">`:''}
          <span class="mname" style="font-size:.82em;">${escHtml(m.title||m.filename)}</span></div></td>
        <td style="font-size:.72em;color:var(--text3);font-family:var(--mono);">${escHtml(ver)}</td>
        <td><span class="mod-status-badge ${enabled?'mod-enabled':'mod-dis'}">${enabled?'Enabled':'Disabled'}</span></td>
        <td style="display:flex;gap:4px;justify-content:flex-end;">
          <button class="ibtn" style="font-size:.68em;padding:2px 8px;" onclick="toggleOneMod('${escHtml(m.id)}',${!enabled})">${enabled?'Disable':'Enable'}</button>
          <button class="ibtn inst" style="font-size:.68em;padding:2px 8px;" data-modid="${escHtml(m.id)}" data-modname="${escHtml(m.title||m.filename)}">Remove</button>
        </td></tr>`;
    }).join('')}
    </tbody></table>`;
  } else {
    listEl.innerHTML=`<div class="mlist">${visible.map(m=>{
      const enabled=m.enabled!==false;
      return `<div class="mrow ${enabled?'':'mod-disabled-row'}" data-modid="${escHtml(m.id)}">
        <input type="checkbox" class="mod-check" data-modid="${escHtml(m.id)}" style="margin-right:4px;flex-shrink:0;">
        <div class="micon">${m.iconUrl?`<img src="${escHtml(m.iconUrl)}" onerror="this.style.display='none'" alt="" loading="lazy">`:'<span style="font-size:18px;color:var(--text3);">📦</span>'}</div>
        <div class="minfo">
          <div class="mname">${escHtml(m.title||m.filename)}</div>
          <div class="mdesc">${escHtml(m.filename||'')}</div>
          <div class="mstats"><div class="mstat">Source: <span>${escHtml(m.source||'unknown')}</span></div><div class="mstat">Added: <span>${m.installedAt?new Date(m.installedAt).toLocaleDateString():'?'}</span></div></div>
        </div>
        <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
          <span class="mod-status-badge ${enabled?'mod-enabled':'mod-dis'}">${enabled?'Enabled':'Disabled'}</span>
          <button class="ibtn" style="font-size:.72em;" onclick="toggleOneMod('${escHtml(m.id)}',${!enabled})">${enabled?'Disable':'Enable'}</button>
          <button class="ibtn inst" data-modid="${escHtml(m.id)}" data-modname="${escHtml(m.title||m.filename)}" style="font-size:.72em;">Remove</button>
        </div></div>`;
    }).join('')}</div>`;
  }
  listEl.querySelectorAll('.ibtn.inst').forEach(btn => {
    btn.addEventListener('click', () => removeInstalledMod(btn.dataset.modid, btn.dataset.modname));
  });
}

function filterDetailMods(val) { modViewSearch=val; renderModsList(null,detailModsCache); }
function setModFilter(f) { modViewFilter=f; loadDetailTab('mods'); }
function setModLayout(l) {
  modViewLayout=l; renderModsList(null,detailModsCache);
  document.getElementById('btnCard')?.classList.toggle('p',l==='card');
  document.getElementById('btnList')?.classList.toggle('p',l==='compact');
}
function getSelectedModIds() { return [...document.querySelectorAll('.mod-check:checked')].map(el=>el.dataset.modid); }
function selectAllMods() { const c=document.querySelectorAll('.mod-check'); const all=[...c].every(x=>x.checked); c.forEach(x=>x.checked=!all); }
function toggleCheckAll(checked) { document.querySelectorAll('.mod-check').forEach(c=>c.checked=checked); }

async function toggleOneMod(modId,enable) {
  await window.launcher.toggleMod({instanceId:detailInstanceId,modId,enable});
  const m=detailModsCache.find(m=>m.id===modId); if(m) m.enabled=enable;
  renderModsList(null,detailModsCache);
}
async function bulkToggle(enable) {
  const ids=getSelectedModIds(); if(!ids.length){toast('Select mods first');return;}
  await window.launcher.toggleMods({instanceId:detailInstanceId,modIds:ids,enable});
  for(const id of ids){const m=detailModsCache.find(m=>m.id===id);if(m)m.enabled=enable;}
  renderModsList(null,detailModsCache);
  toast((enable?'Enabled ':'Disabled ')+ids.length+' mod(s)');
}
async function removeInstalledMod(modId,name) {
  const r=await window.launcher.removeMod({instanceId:detailInstanceId,modId});
  if(r.success){toast('Removed '+name);await syncModCount(detailInstanceId);loadDetailTab('mods');}
  else toast('Remove failed: '+r.error);
}
async function updateAllDetail() {
  const btn=document.getElementById('detailUpdateAllBtn');
  if(btn){btn.disabled=true;btn.textContent='Checking...';}
  const r=await window.launcher.updateAllMods(detailInstanceId);
  if(r.success){const n=(r.results||[]).filter(x=>x.status==='updated').length;toast(n>0?'Updated '+n+' mod(s)':'All mods up to date');await syncModCount(detailInstanceId);loadDetailTab('mods');}
  else{toast('Update failed: '+r.error);if(btn){btn.disabled=false;btn.textContent='↑ Update All';}}
}

// ── Other tabs ────────────────────────────────────────────────────────────────
async function loadDetailFiles(content,folder,label) {
  const result=await window.launcher.listInstanceFolder({instanceId:detailInstanceId,folder});
  const files=(result.files||[]).filter(f=>!f.isDir);
  content.innerHTML=`
    <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:12px;color:var(--text3);">${files.length} ${label.toLowerCase()}</span>
      <button class="btn" id="openFolderBtn" style="font-size:11px;">Open folder</button>
    </div>
    <div class="mlist">${files.length===0
      ?`<div class="empty-state"><strong>No ${label.toLowerCase()}</strong>Drop files into the folder to add them.</div>`
      :files.map(f=>`<div class="mrow" style="padding:10px 14px;">
        <div class="micon"><span style="font-size:18px;color:var(--text3);">🗂️</span></div>
        <div class="minfo"><div class="mname">${escHtml(f.name)}</div><div class="mdesc">${formatBytes(f.size)}</div></div>
        <button class="ibtn inst" data-filename="${escHtml(f.name)}" style="font-size:11px;">Remove</button>
      </div>`).join('')}
    </div>`;
  document.getElementById('openFolderBtn').addEventListener('click',()=>window.launcher.openInstanceSubfolder({instanceId:detailInstanceId,folder}));
  content.querySelectorAll('.ibtn').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const r=await window.launcher.deleteInstanceFile({instanceId:detailInstanceId,folder,filename:btn.dataset.filename});
      if(r.success){toast('Removed '+btn.dataset.filename);loadDetailTab(detailTab);}else toast('Failed: '+r.error);
    });
  });
}

async function loadDetailWorlds(content) {
  const result=await window.launcher.listInstanceFolder({instanceId:detailInstanceId,folder:'saves'});
  const worlds=(result.files||[]).filter(f=>f.isDir);
  content.innerHTML=`
    <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:12px;color:var(--text3);">${worlds.length} world${worlds.length===1?'':'s'}</span>
      <button class="btn" id="openSavesBtn" style="font-size:11px;">Open saves folder</button>
    </div>
    <div class="mlist">${worlds.length===0
      ?`<div class="empty-state"><strong>No worlds yet</strong>Worlds appear here after you create them in-game.</div>`
      :worlds.map(w=>`<div class="mrow" style="padding:10px 14px;">
        <div class="micon"><span style="font-size:20px;">🌍</span></div>
        <div class="minfo"><div class="mname">${escHtml(w.name)}</div><div class="mdesc">Modified: ${w.modified?new Date(w.modified).toLocaleDateString():'Unknown'}</div></div>
        <button class="btn" data-world="${escHtml(w.name)}" style="font-size:11px;">Open</button>
      </div>`).join('')}
    </div>`;
  document.getElementById('openSavesBtn').addEventListener('click',()=>window.launcher.openInstanceSubfolder({instanceId:detailInstanceId,folder:'saves'}));
  content.querySelectorAll('.mrow .btn').forEach(btn=>btn.addEventListener('click',()=>window.launcher.openInstanceSubfolder({instanceId:detailInstanceId,folder:'saves/'+btn.dataset.world})));
}

async function loadDetailServers(content) {
  const result=await window.launcher.readServersDat(detailInstanceId);
  const servers=result.servers||[];
  content.innerHTML=`
    <div style="margin-bottom:12px;"><span style="font-size:12px;color:var(--text3);">${servers.length} server${servers.length===1?'':'s'}</span></div>
    <div class="mlist">${servers.length===0
      ?`<div class="empty-state"><strong>No servers saved</strong>Add servers in-game and they'll appear here.</div>`
      :servers.map(s=>`<div class="mrow" style="padding:10px 14px;">
        <div class="micon"><span style="font-size:20px;">🖥️</span></div>
        <div class="minfo"><div class="mname">${escHtml(s.name||'Unnamed')}</div><div class="mdesc" style="font-family:var(--mono);">${escHtml(s.ip||'')}</div></div>
      </div>`).join('')}
    </div>`;
}

async function loadDetailOptions(content) {
  const profiles = await window.launcher.listOptionProfiles();
  content.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:13px;color:var(--text2);margin-bottom:10px;line-height:1.6;">
        Save this instance's current settings as a reusable profile, then apply it to any instance.
        <br><span style="color:var(--text3);font-size:12px;">Launch the game and change your settings before saving.</span>
      </div>
      <button class="btn p" id="saveOptionsBtn">+ Save current options as profile</button>
    </div>
    <div id="optionProfilesList" class="mlist">
      ${profiles.length===0
        ?`<div class="empty-state"><strong>No option profiles yet</strong>Save a profile from any instance to reuse its settings.</div>`
        :profiles.map(p=>`
          <div class="mrow" style="padding:10px 14px;">
            <div class="micon"><span style="font-size:20px;">⚙️</span></div>
            <div class="minfo">
              <div class="mname">${escHtml(p.name)}</div>
              <div class="mdesc">Saved ${p.createdAt?new Date(p.createdAt).toLocaleDateString():''} · ${p.hasOptions?'has settings':'no settings yet'}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="ibtn" data-pid="${escHtml(p.id)}" data-pname="${escHtml(p.name)}">Apply</button>
              <button class="ibtn inst" data-pid="${escHtml(p.id)}" data-pname="${escHtml(p.name)}">Delete</button>
            </div>
          </div>`).join('')}
    </div>`;

  document.getElementById('saveOptionsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveOptionsBtn');
    const name = await window.launcher.showInputDialog({
      title: 'Save Options Profile', label: 'Profile name', placeholder: 'e.g. PvP keybinds'
    });
    if (!name) return;

    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      const result = await window.launcher.captureOptionsProfile({ instanceId: detailInstanceId, name });
      if (result.success) {
        if (!result.profile.hasOptions) {
          toast(`Profile "${name}" saved (no options.txt found — launch the game first to capture settings)`);
        } else {
          toast(`Saved profile "${name}"`);
        }
        loadDetailTab('options');
      } else {
        toast('Failed: ' + (result.error || 'Unknown error'));
      }
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = '+ Save current options as profile';
    }
  });

  content.querySelectorAll('.ibtn:not(.inst)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = await window.launcher.applyOptionsProfile({instanceId:detailInstanceId,profileId:btn.dataset.pid});
      if (r.success) toast(`Applied "${btn.dataset.pname}"`); else toast('Failed: '+r.error);
    });
  });
  content.querySelectorAll('.ibtn.inst').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = await window.launcher.deleteOptionsProfile(btn.dataset.pid);
      if (r.success) { toast(`Deleted "${btn.dataset.pname}"`); loadDetailTab('options'); }
      else toast('Failed: '+r.error);
    });
  });
}

// ── Network tab ───────────────────────────────────────────────────────────────
async function loadDetailNetwork(content) {
  const inst = instances.find(i=>i.id===detailInstanceId);
  const settings = await window.launcher.getSettings();

  content.innerHTML = `
    <div style="margin-bottom:14px;">
      <div style="font-size:11px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;">
        Network Optimizer
      </div>
      <div class="mlist" style="margin-bottom:0;">
        <div class="mrow" style="padding:10px 14px;">
          <div class="minfo">
            <div class="mname">Force IPv4</div>
            <div class="mdesc">Skips IPv6 lookups — reduces connection delays on some networks</div>
          </div>
          <div class="toggle ${settings.ipv4Prefer?'on':''}" id="netIpv4Toggle"
               onclick="this.classList.toggle('on');window.launcher.saveSettings({...arguments[0]});"
               style="flex-shrink:0;"></div>
        </div>
        <div class="mrow" style="padding:10px 14px;">
          <div class="minfo">
            <div class="mname">High process priority</div>
            <div class="mdesc">Gives the Java process more CPU time — reduces micro-stutters and input lag</div>
          </div>
          <div class="toggle ${settings.highPriority?'on':''}" id="netPrioToggle"
               style="flex-shrink:0;"></div>
        </div>
        <div class="mrow" style="padding:10px 14px;border-bottom:none;">
          <div class="minfo">
            <div class="mname">DNS — Cloudflare 1.1.1.1 &amp; Google 8.8.8.8</div>
            <div class="mdesc">Sets all active network adapters to the fastest public DNS servers. Requires admin.</div>
          </div>
          <button class="btn p" id="netDnsBtn" style="font-size:11px;flex-shrink:0;" onclick="applyNetDns()">Apply DNS</button>
        </div>
      </div>
    </div>

    <div>
      <div style="font-size:11px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;">
        Server Ping
      </div>
      <div id="pingList" class="mlist">
        <div class="loading-row"><div class="spinner"></div>Pinging servers...</div>
      </div>
    </div>
  `;

  // Wire up the two toggles properly
  document.getElementById('netIpv4Toggle').addEventListener('click', async function() {
    this.classList.toggle('on');
    const s = await window.launcher.getSettings();
    s.ipv4Prefer = this.classList.contains('on');
    await window.launcher.saveSettings(s);
  });
  document.getElementById('netPrioToggle').addEventListener('click', async function() {
    this.classList.toggle('on');
    const s = await window.launcher.getSettings();
    s.highPriority = this.classList.contains('on');
    await window.launcher.saveSettings(s);
  });

  // Ping all saved servers
  const serverResult = await window.launcher.readServersDat(detailInstanceId);
  const servers = serverResult.servers || [];
  const pingListEl = document.getElementById('pingList');
  if (!pingListEl) return;

  if (!servers.length) {
    pingListEl.innerHTML = `<div class="empty-state"><strong>No servers saved</strong>Add servers in-game and their ping will show here.</div>`;
    return;
  }

  // Render placeholders
  pingListEl.innerHTML = servers.map((s,i) => `
    <div class="mrow" style="padding:10px 14px;" id="ping-row-${i}">
      <div class="micon"><span style="font-size:18px;">🖥️</span></div>
      <div class="minfo">
        <div class="mname">${escHtml(s.name||'Unnamed')}</div>
        <div class="mdesc" style="font-family:var(--mono);">${escHtml(s.ip||'')}</div>
      </div>
      <span id="ping-badge-${i}" class="mod-status-badge" style="flex-shrink:0;font-family:var(--mono);">...</span>
    </div>`).join('');

  // Ping each server concurrently
  servers.forEach(async (srv, i) => {
    const badge = document.getElementById('ping-badge-'+i);
    if (!badge) return;
    const [host, portStr] = (srv.ip||'').split(':');
    const port = portStr ? parseInt(portStr) : 25565;
    try {
      const r = await window.launcher.pingServer({ host, port });
      if (!badge.isConnected) return;
      if (r.ms === null) {
        badge.textContent = 'Offline';
        badge.style.cssText = 'flex-shrink:0;font-family:var(--mono);background:rgba(248,113,113,.12);color:#f87171;border:1px solid rgba(248,113,113,.3);';
      } else {
        const color = r.ms < 60 ? 'var(--green)' : r.ms < 120 ? '#facc15' : '#f87171';
        badge.textContent = r.ms + 'ms';
        badge.style.cssText = `flex-shrink:0;font-family:var(--mono);color:${color};background:rgba(0,0,0,.15);border:1px solid ${color}44;`;
      }
    } catch {
      if (badge.isConnected) { badge.textContent = '?'; }
    }
  });
}

async function applyNetDns() {
  const btn = document.getElementById('netDnsBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Applying...'; }
  try {
    const r = await window.launcher.setDnsOptimizer();
    toast(r.success ? 'DNS change requested — accept the admin prompt' : 'Failed: '+(r.error||'unknown'));
  } catch(e) { toast('Error: '+e.message); }
  if (btn) { btn.disabled = false; btn.textContent = 'Apply DNS'; }
}

function formatBytes(b) {
  if (!b) return '';
  if (b>1048576) return (b/1048576).toFixed(1)+' MB';
  if (b>1024) return (b/1024).toFixed(1)+' KB';
  return b+' B';
}
