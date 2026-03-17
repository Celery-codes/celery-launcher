// applyTextSize — sets the root font size that all em units scale from.
// Sizes are on the larger side as requested.
function applyTextSize(size) {
  const sizes = { sm: '14px', md: '16px', lg: '18px', xl: '21px' };
  document.documentElement.style.fontSize = sizes[size] || '16px';
}

let currentSettings = {};

async function renderSettingsPanel() {
  const panel = document.getElementById('panel-settings');
  panel.innerHTML = '<div style="padding:20px;color:var(--text3);font-size:0.85em;">Loading...</div>';

  try { currentSettings = await window.launcher.getSettings(); } catch(e) { currentSettings = {}; }

  const ram      = Number(currentSettings.ram) || 4;
  const jvmArgs  = currentSettings.customJvmArgs || '';
  const javaPath = currentSettings.javaPath || '';
  const cfKey    = currentSettings.curseforgeKey || '';
  const textSize = currentSettings.textSize || 'md';

  // Labels without pixel sizes — clean and simple
  const sizeLabels = { sm: 'Small', md: 'Normal', lg: 'Large', xl: 'Huge' };

  panel.innerHTML = `
    <div class="ph"><div class="pt">Settings</div><div class="ps">Performance, Java, and launcher preferences</div></div>

    <div class="pgrid">
      <div class="pcard">
        <div class="plabel">Allocated RAM</div>
        <div class="pval" id="ramDisplay">${ram} GB</div>
        <div class="psub">Adjust below</div>
      </div>
      <div class="pcard">
        <div class="plabel">Performance Profile</div>
        <div class="pval" style="font-size:0.85em;padding-top:4px;">${currentSettings.pvpFlags !== false ? 'PvP Optimized' : 'Default'}</div>
        <div class="psub">Aikars G1GC · Xms=Xmx</div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Performance</div>
      <div class="s-row">
        <div class="s-lbl">
          <div class="s-lname">JVM Memory (GB)</div>
          <div class="s-ldesc">RAM for Minecraft. Xms always equals Xmx — prevents heap resize stutters.</div>
        </div>
        <div class="s-ctrl">
          <input type="range" min="1" max="32" value="${ram}" step="1"
            style="width:120px;accent-color:var(--green)"
            oninput="updateRamDisplay(parseInt(this.value))">
          <span style="font-size:0.8em;font-family:var(--mono);color:var(--text2);min-width:44px;text-align:right;" id="ramVal">${ram} GB</span>
        </div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">PvP / Performance JVM flags</div><div class="s-ldesc">Aikars G1GC — minimises GC pauses, improves FPS stability</div></div>
        <div class="s-ctrl"><div class="toggle ${currentSettings.pvpFlags !== false ? 'on' : ''}" onclick="toggleSetting(this,'pvpFlags')"></div></div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Close launcher on game launch</div><div class="s-ldesc">Frees launcher RAM while Minecraft is running</div></div>
        <div class="s-ctrl"><div class="toggle ${currentSettings.closeOnLaunch !== false ? 'on' : ''}" onclick="toggleSetting(this,'closeOnLaunch')"></div></div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Auto-update mods on launch</div><div class="s-ldesc">Check Modrinth for newer versions before starting</div></div>
        <div class="s-ctrl"><div class="toggle ${currentSettings.autoUpdateMods ? 'on' : ''}" onclick="toggleSetting(this,'autoUpdateMods')"></div></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Java</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Java path</div><div class="s-ldesc">${javaPath ? 'Custom: ' + escHtml(javaPath) : 'Auto-detect — scans JAVA_HOME and common install paths'}</div></div>
        <div class="s-ctrl">
          <input class="sinput" id="javaPathInput" value="${escHtml(javaPath)}" placeholder="Auto" style="width:160px" onchange="saveSetting('javaPath',this.value)">
          <button class="btn" onclick="toast('Paste the full path to java.exe, or leave blank for auto-detect')">?</button>
        </div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Custom JVM arguments</div><div class="s-ldesc">Extra flags appended after standard args</div></div>
        <div class="s-ctrl"><input class="sinput" value="${escHtml(jvmArgs)}" placeholder="e.g. -XX:+UseZGC" style="width:200px" onchange="saveSetting('customJvmArgs',this.value)"></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Appearance</div>
      <div class="s-row">
        <div class="s-lbl">
          <div class="s-lname">Text size</div>
          <div class="s-ldesc">Scales all text in the launcher</div>
        </div>
        <div class="s-ctrl">
          <div style="display:flex;gap:6px;">
            ${['sm','md','lg','xl'].map(s =>
              `<button class="btn ${textSize === s ? 'p' : ''}" id="tsize-${s}"
                style="padding:5px 14px;" onclick="setTextSize('${s}')">
                ${sizeLabels[s]}
              </button>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Integrations</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">CurseForge API key</div><div class="s-ldesc">Required for CurseForge mod browsing — get one free at console.curseforge.com</div></div>
        <div class="s-ctrl"><input class="sinput" type="password" value="${escHtml(cfKey)}" placeholder="Paste key here" style="width:200px" onchange="saveSetting('curseforgeKey',this.value)"></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">System</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Create desktop shortcut</div><div class="s-ldesc">Launch Celery Launcher without opening PowerShell</div></div>
        <div class="s-ctrl"><button class="btn p" onclick="createShortcut()">Create shortcut</button></div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Open data directory</div><div class="s-ldesc">Where instances, versions, assets, and profiles are stored</div></div>
        <div class="s-ctrl"><button class="btn" onclick="window.launcher.openInstanceFolder('..')">Open folder</button></div>
      </div>
    </div>
  `;
}

function updateRamDisplay(val) {
  val = parseInt(val);
  document.getElementById('ramDisplay').textContent = val + ' GB';
  document.getElementById('ramVal').textContent = val + ' GB';
  saveSetting('ram', val);
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
    const btn = document.getElementById('tsize-' + s);
    if (btn) btn.classList.toggle('p', s === size);
  });
  toast('Text size updated');
}

async function createShortcut() {
  const result = await window.launcher.createShortcut();
  if (result && result.success) toast('Desktop shortcut created');
  else toast('Shortcut failed: ' + ((result && result.error) || 'unknown'));
}
