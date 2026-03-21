// ── Text size ─────────────────────────────────────────────────────────────────
function applyTextSize(size) {
  const sizes = { sm: '14px', md: '15px', lg: '17px', xl: '19px' };
  document.documentElement.style.fontSize = sizes[size] || '15px';
}

// ── Theme system ──────────────────────────────────────────────────────────────
const THEMES = {
  green: {
    label: 'Celery', emoji: '🌿',
    '--bg':'#0d0f0e','--bg2':'#131614','--bg3':'#191c1a','--bg4':'#1f2320','--bg5':'#252925',
    '--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)',
    '--accent':'#4ade80','--accent2':'#22c55e','--accent3':'#16a34a','--accent4':'#15803d',
    '--accent-dim':'rgba(74,222,128,0.08)','--accent-dim2':'rgba(74,222,128,0.15)','--accent-dim3':'rgba(74,222,128,0.22)',
    '--text':'#e8ede9','--text2':'#9aa89b','--text3':'#5e6b5f','--text4':'#3d4a3e',
    '--launch-btn-text':'#000'
  },
  blue: {
    label: 'Ocean', emoji: '🌊',
    '--bg':'#0d0f14','--bg2':'#111520','--bg3':'#171c2a','--bg4':'#1d2333','--bg5':'#232b3e',
    '--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)',
    '--accent':'#60a5fa','--accent2':'#3b82f6','--accent3':'#2563eb','--accent4':'#1d4ed8',
    '--accent-dim':'rgba(96,165,250,0.08)','--accent-dim2':'rgba(96,165,250,0.15)','--accent-dim3':'rgba(96,165,250,0.22)',
    '--text':'#e8edf5','--text2':'#8fa0bc','--text3':'#4a5a78','--text4':'#2e3a52',
    '--launch-btn-text':'#fff'
  },
  purple: {
    label: 'Nebula', emoji: '🔮',
    '--bg':'#0f0d14','--bg2':'#151220','--bg3':'#1b172a','--bg4':'#211d33','--bg5':'#27233e',
    '--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)',
    '--accent':'#a78bfa','--accent2':'#8b5cf6','--accent3':'#7c3aed','--accent4':'#6d28d9',
    '--accent-dim':'rgba(167,139,250,0.08)','--accent-dim2':'rgba(167,139,250,0.15)','--accent-dim3':'rgba(167,139,250,0.22)',
    '--text':'#ede8f5','--text2':'#9d8fbc','--text3':'#5a4a78','--text4':'#3a2e52',
    '--launch-btn-text':'#fff'
  },
  red: {
    label: 'Ember', emoji: '🔥',
    '--bg':'#140d0d','--bg2':'#1e1212','--bg3':'#261717','--bg4':'#2e1c1c','--bg5':'#362121',
    '--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)',
    '--accent':'#f87171','--accent2':'#ef4444','--accent3':'#dc2626','--accent4':'#b91c1c',
    '--accent-dim':'rgba(248,113,113,0.08)','--accent-dim2':'rgba(248,113,113,0.15)','--accent-dim3':'rgba(248,113,113,0.22)',
    '--text':'#f5e8e8','--text2':'#bc8f8f','--text3':'#785050','--text4':'#523030',
    '--launch-btn-text':'#fff'
  },
  slate: {
    label: 'Slate', emoji: '🪨',
    '--bg':'#0d0f12','--bg2':'#13151a','--bg3':'#191c22','--bg4':'#1f222a','--bg5':'#252832',
    '--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)',
    '--accent':'#94a3b8','--accent2':'#64748b','--accent3':'#475569','--accent4':'#334155',
    '--accent-dim':'rgba(148,163,184,0.08)','--accent-dim2':'rgba(148,163,184,0.15)','--accent-dim3':'rgba(148,163,184,0.22)',
    '--text':'#e8edf2','--text2':'#8d9aaa','--text3':'#4a5568','--text4':'#2d3748',
    '--launch-btn-text':'#fff'
  },
  light: {
    label: 'Light', emoji: '☀️',
    '--bg':'#f4f6f4','--bg2':'#ffffff','--bg3':'#eef1ee','--bg4':'#e4e8e4','--bg5':'#d8dcd8',
    '--border':'rgba(0,0,0,0.09)','--border2':'rgba(0,0,0,0.15)','--border3':'rgba(0,0,0,0.25)',
    '--accent':'#16a34a','--accent2':'#15803d','--accent3':'#166534','--accent4':'#14532d',
    '--accent-dim':'rgba(22,163,74,0.08)','--accent-dim2':'rgba(22,163,74,0.14)','--accent-dim3':'rgba(22,163,74,0.22)',
    '--text':'#1a2019','--text2':'#4a5a48','--text3':'#7a8a78','--text4':'#aab4a8',
    '--launch-btn-text':'#fff'
  }
};

function applyTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES.green;
  const root = document.documentElement;
  for (const [key, val] of Object.entries(theme)) {
    if (key.startsWith('--')) root.style.setProperty(key, val);
  }
  // Map accent vars to legacy var names used in style.css
  root.style.setProperty('--green',  theme['--accent']);
  root.style.setProperty('--green2', theme['--accent2']);
  root.style.setProperty('--green3', theme['--accent3']);
  root.style.setProperty('--green4', theme['--accent4']);
  root.style.setProperty('--green-dim',  theme['--accent-dim']);
  root.style.setProperty('--green-dim2', theme['--accent-dim2']);
  root.style.setProperty('--green-dim3', theme['--accent-dim3']);
  // Launch button text color
  root.style.setProperty('--launch-text', theme['--launch-btn-text'] || '#000');
  // Update launch button text color via inline style trick
  document.querySelectorAll('.launch-btn').forEach(btn => {
    btn.style.color = theme['--launch-btn-text'] || '#000';
  });
}

let currentSettings = {};

async function renderSettingsPanel() {
  const panel = document.getElementById('panel-settings');
  currentSettings = await window.launcher.getSettings();

  const ram      = currentSettings.ram || 4;
  const jvmArgs  = currentSettings.customJvmArgs || '';
  const javaPath = currentSettings.javaPath || '';
  const cfKey    = currentSettings.curseforgeKey || '';
  const textSize = currentSettings.textSize || 'md';
  const theme    = currentSettings.theme || 'green';

  panel.innerHTML = `
    <div class="ph"><div class="pt">Settings</div><div class="ps">Performance, appearance, and launcher preferences</div></div>

    <div class="pgrid">
      <div class="pcard">
        <div class="plabel">Allocated RAM</div>
        <div class="pval" id="ramDisplay">${ram} GB</div>
        <div class="psub">Adjust below</div>
      </div>
      <div class="pcard">
        <div class="plabel">Performance Profile</div>
        <div class="pval" style="font-size:13px;padding-top:4px;">${currentSettings.pvpFlags !== false ? 'PvP Optimized' : 'Default'}</div>
        <div class="psub">Aikars G1GC flags</div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Performance</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">JVM Memory (GB)</div><div class="s-ldesc">RAM allocated to Minecraft (recommended: 4–8 GB)</div></div>
        <div class="s-ctrl" style="display:flex;align-items:center;gap:10px;">
          <input type="range" min="1" max="32" value="${ram}" step="1" style="width:120px;"
            oninput="document.getElementById('ramDisplay').textContent=this.value+' GB';document.getElementById('ramVal').textContent=this.value+' GB';saveSetting('ram',parseInt(this.value))">
          <span style="font-size:12px;font-family:var(--mono);color:var(--text2);min-width:40px;" id="ramVal">${ram} GB</span>
        </div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">PvP / Performance JVM flags</div><div class="s-ldesc">Aikars G1GC flags — minimises GC pauses, improves FPS stability</div></div>
        <div class="s-ctrl"><div class="toggle ${currentSettings.pvpFlags !== false ? 'on' : ''}" onclick="toggleSetting(this,'pvpFlags')"></div></div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Close launcher on game launch</div><div class="s-ldesc">Hides Celery Launcher while Minecraft is running</div></div>
        <div class="s-ctrl"><div class="toggle ${currentSettings.closeOnLaunch ? 'on' : ''}" onclick="toggleSetting(this,'closeOnLaunch')"></div></div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Auto-update mods on launch</div><div class="s-ldesc">Check Modrinth for newer versions before starting</div></div>
        <div class="s-ctrl"><div class="toggle ${currentSettings.autoUpdateMods ? 'on' : ''}" onclick="toggleSetting(this,'autoUpdateMods')"></div></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Java</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Java path</div><div class="s-ldesc">${escHtml(javaPath) || 'Auto-detect (JAVA_HOME and common install paths)'}</div></div>
        <div class="s-ctrl" style="display:flex;gap:8px;">
          <input class="sinput" id="javaPathInput" value="${escHtml(javaPath)}" placeholder="Auto" style="width:160px" onchange="saveSetting('javaPath',this.value)">
        </div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Custom JVM arguments</div><div class="s-ldesc">Extra flags appended after the standard args</div></div>
        <div class="s-ctrl"><input class="sinput" value="${escHtml(jvmArgs)}" placeholder="-XX:+UseZGC" style="width:200px" onchange="saveSetting('customJvmArgs',this.value)"></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Appearance</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Color theme</div><div class="s-ldesc">Changes the accent color throughout the launcher</div></div>
        <div class="s-ctrl" style="display:flex;gap:6px;flex-wrap:wrap;">
          ${Object.entries(THEMES).map(([key, t]) => `
            <button class="theme-btn ${theme===key?'on':''}" id="theme-${key}"
              onclick="setTheme('${key}')" title="${t.label}"
              style="--tbg:${t['--accent']}">
              <span class="theme-swatch"></span>
              <span>${t.emoji} ${t.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Text size</div><div class="s-ldesc">Scales all text in the launcher</div></div>
        <div class="s-ctrl">
          <div style="display:flex;gap:6px;">
            ${['sm','md','lg','xl'].map(s => `
              <button class="btn ${textSize===s?'p':''}" id="tsize-${s}"
                style="padding:4px 10px;font-size:11px;" onclick="setTextSize('${s}')">
                ${{sm:'Normal',md:'Large',lg:'X-Large',xl:'Huge'}[s]}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Integrations</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">CurseForge API key</div><div class="s-ldesc">Required for CurseForge browsing — get one at console.curseforge.com</div></div>
        <div class="s-ctrl"><input class="sinput" type="password" value="${escHtml(cfKey)}" placeholder="Paste your key here" style="width:200px" onchange="saveSetting('curseforgeKey',this.value)"></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">System</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Create desktop shortcut</div><div class="s-ldesc">Launch Celery Launcher without opening a terminal window</div></div>
        <div class="s-ctrl"><button class="btn p" onclick="createShortcut()">Create shortcut</button></div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Launcher data directory</div><div class="s-ldesc">Where instances, versions, and assets are stored</div></div>
        <div class="s-ctrl"><button class="btn" onclick="window.launcher.openInstanceFolder('..')">Open folder</button></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Updates</div>
      <div class="s-row">
        <div class="s-lbl">
          <div class="s-lname">Celery Launcher updates</div>
          <div class="s-ldesc" id="updateStatusText">Check for the latest version from GitHub.</div>
        </div>
        <div class="s-ctrl" style="display:flex;gap:8px;" id="updateControls">
          <button class="btn" id="checkUpdateBtn" onclick="checkForUpdate()">Check for updates</button>
        </div>
      </div>
    </div>
  `;
}

async function saveSetting(key, value) {
  currentSettings[key] = value;
  await window.launcher.saveSettings(currentSettings);
}

async function toggleSetting(el, key) {
  el.classList.toggle('on');
  currentSettings[key] = el.classList.contains('on');
  await window.launcher.saveSettings(currentSettings);
}

async function setTextSize(size) {
  currentSettings.textSize = size;
  await window.launcher.saveSettings(currentSettings);
  applyTextSize(size);
  ['sm','md','lg','xl'].forEach(s => {
    document.getElementById('tsize-' + s)?.classList.toggle('p', s === size);
  });
  toast('Text size updated');
}

async function setTheme(key) {
  currentSettings.theme = key;
  await window.launcher.saveSettings(currentSettings);
  applyTheme(key);
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('on', b.id === 'theme-' + key);
  });
  toast('Theme changed to ' + THEMES[key].label);
}

async function createShortcut() {
  const result = await window.launcher.createShortcut();
  if (result.success) toast('Desktop shortcut created!');
  else toast('Shortcut failed: ' + (result.error || 'unknown'));
}

// ── In-app updater ────────────────────────────────────────────────────────────
let _updateReady = false;

if (window.launcher.onUpdateStatus) {
  window.launcher.onUpdateStatus((data) => {
    const statusEl = document.getElementById('updateStatusText');
    const ctrlEl   = document.getElementById('updateControls');
    if (!statusEl || !ctrlEl) return;

    statusEl.textContent = data.message;

    if (data.status === 'available') {
      ctrlEl.innerHTML = `
        <button class="btn p" onclick="downloadUpdate()">Download v${data.version}</button>
        <button class="btn" onclick="checkForUpdate()">Re-check</button>`;
    } else if (data.status === 'downloading') {
      ctrlEl.innerHTML = `<div class="progress-bar" style="width:180px;"><div class="progress-fill" style="width:${data.percent||0}%"></div></div>`;
    } else if (data.status === 'ready') {
      _updateReady = true;
      ctrlEl.innerHTML = `<button class="btn p" onclick="installUpdate()">Restart & install</button>`;
    } else if (data.status === 'latest') {
      ctrlEl.innerHTML = `<button class="btn" onclick="checkForUpdate()">Check again</button>`;
    } else if (data.status === 'error') {
      ctrlEl.innerHTML = `<button class="btn" onclick="checkForUpdate()">Retry</button>`;
    }
  });
}

async function checkForUpdate() {
  const btn = document.getElementById('checkUpdateBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Checking...'; }
  const result = await window.launcher.checkForUpdate();
  if (!result.success) {
    const statusEl = document.getElementById('updateStatusText');
    if (statusEl) statusEl.textContent = 'Could not check for updates: ' + result.error;
    if (btn) { btn.disabled = false; btn.textContent = 'Check for updates'; }
  }
}

async function downloadUpdate() {
  await window.launcher.downloadUpdate();
}

async function installUpdate() {
  await window.launcher.installUpdate();
}