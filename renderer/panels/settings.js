const THEMES = {
  red:    { label:'Ember',   emoji:'🔥', '--bg':'#140d0d','--bg2':'#1e1212','--bg3':'#261717','--bg4':'#2e1c1c','--bg5':'#362121','--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)','--accent':'#f87171','--accent2':'#ef4444','--accent3':'#dc2626','--accent4':'#b91c1c','--accent-dim':'rgba(248,113,113,0.08)','--accent-dim2':'rgba(248,113,113,0.15)','--accent-dim3':'rgba(248,113,113,0.22)','--text':'#f5e8e8','--text2':'#bc8f8f','--text3':'#785050','--text4':'#523030','--launch-btn-text':'#fff' },
  orange: { label:'Sunrise', emoji:'🔶', '--bg':'#0f0d0a','--bg2':'#151209','--bg3':'#1b180e','--bg4':'#211d13','--bg5':'#272318','--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)','--accent':'#fb923c','--accent2':'#ea7c2a','--accent3':'#d46618','--accent4':'#b85210','--accent-dim':'rgba(251,146,60,0.08)','--accent-dim2':'rgba(251,146,60,0.15)','--accent-dim3':'rgba(251,146,60,0.22)','--text':'#f5ede8','--text2':'#bc9080','--text3':'#786050','--text4':'#523040','--launch-btn-text':'#000' },
  yellow: { label:'Solar',   emoji:'🌟', '--bg':'#0f0e09','--bg2':'#15130b','--bg3':'#1b1910','--bg4':'#211f15','--bg5':'#27251a','--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)','--accent':'#facc15','--accent2':'#eab308','--accent3':'#ca9a04','--accent4':'#a37a00','--accent-dim':'rgba(250,204,21,0.08)','--accent-dim2':'rgba(250,204,21,0.15)','--accent-dim3':'rgba(250,204,21,0.22)','--text':'#f5f2e0','--text2':'#bcb080','--text3':'#788050','--text4':'#524830','--launch-btn-text':'#000' },
  green:  { label:'Celery',  emoji:'🌿', '--bg':'#0d0f0e','--bg2':'#131614','--bg3':'#191c1a','--bg4':'#1f2320','--bg5':'#252925','--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)','--accent':'#4ade80','--accent2':'#22c55e','--accent3':'#16a34a','--accent4':'#15803d','--accent-dim':'rgba(74,222,128,0.08)','--accent-dim2':'rgba(74,222,128,0.15)','--accent-dim3':'rgba(74,222,128,0.22)','--text':'#e8ede9','--text2':'#9aa89b','--text3':'#5e6b5f','--text4':'#3d4a3e','--launch-btn-text':'#000' },
  cyan:   { label:'Arctic',  emoji:'🔷', '--bg':'#090f10','--bg2':'#0d1416','--bg3':'#12191c','--bg4':'#171f22','--bg5':'#1c2528','--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)','--accent':'#22d3ee','--accent2':'#06b6d4','--accent3':'#0891b2','--accent4':'#0e7490','--accent-dim':'rgba(34,211,238,0.08)','--accent-dim2':'rgba(34,211,238,0.15)','--accent-dim3':'rgba(34,211,238,0.22)','--text':'#e8f5f5','--text2':'#90b8bc','--text3':'#507878','--text4':'#305252','--launch-btn-text':'#000' },
  blue:   { label:'Ocean',   emoji:'🌊', '--bg':'#0d0f14','--bg2':'#111520','--bg3':'#171c2a','--bg4':'#1d2333','--bg5':'#232b3e','--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)','--accent':'#60a5fa','--accent2':'#3b82f6','--accent3':'#2563eb','--accent4':'#1d4ed8','--accent-dim':'rgba(96,165,250,0.08)','--accent-dim2':'rgba(96,165,250,0.15)','--accent-dim3':'rgba(96,165,250,0.22)','--text':'#e8edf5','--text2':'#8fa0bc','--text3':'#4a5a78','--text4':'#2e3a52','--launch-btn-text':'#fff' },
  purple: { label:'Nebula',  emoji:'🔮', '--bg':'#0f0d14','--bg2':'#151220','--bg3':'#1b172a','--bg4':'#211d33','--bg5':'#27233e','--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)','--accent':'#a78bfa','--accent2':'#8b5cf6','--accent3':'#7c3aed','--accent4':'#6d28d9','--accent-dim':'rgba(167,139,250,0.08)','--accent-dim2':'rgba(167,139,250,0.15)','--accent-dim3':'rgba(167,139,250,0.22)','--text':'#ede8f5','--text2':'#9d8fbc','--text3':'#5a4a78','--text4':'#3a2e52','--launch-btn-text':'#fff' },
  pink:   { label:'Sakura',  emoji:'🌸', '--bg':'#100d0f','--bg2':'#161215','--bg3':'#1c171b','--bg4':'#221d21','--bg5':'#282327','--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)','--accent':'#f472b6','--accent2':'#ec4899','--accent3':'#db2777','--accent4':'#be185d','--accent-dim':'rgba(244,114,182,0.08)','--accent-dim2':'rgba(244,114,182,0.15)','--accent-dim3':'rgba(244,114,182,0.22)','--text':'#f5e8f2','--text2':'#bc90ac','--text3':'#785068','--text4':'#523048','--launch-btn-text':'#fff' },
  slate:  { label:'Slate',   emoji:'🪨', '--bg':'#0d0f12','--bg2':'#13151a','--bg3':'#191c22','--bg4':'#1f222a','--bg5':'#252832','--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)','--accent':'#94a3b8','--accent2':'#64748b','--accent3':'#475569','--accent4':'#334155','--accent-dim':'rgba(148,163,184,0.08)','--accent-dim2':'rgba(148,163,184,0.15)','--accent-dim3':'rgba(148,163,184,0.22)','--text':'#e8edf2','--text2':'#8d9aaa','--text3':'#4a5568','--text4':'#2d3748','--launch-btn-text':'#fff' },
  light:  { label:'Light',   emoji:'☀️', '--bg':'#f4f6f4','--bg2':'#ffffff','--bg3':'#eef1ee','--bg4':'#e4e8e4','--bg5':'#d8dcd8','--border':'rgba(0,0,0,0.09)','--border2':'rgba(0,0,0,0.15)','--border3':'rgba(0,0,0,0.25)','--accent':'#16a34a','--accent2':'#15803d','--accent3':'#166534','--accent4':'#14532d','--accent-dim':'rgba(22,163,74,0.08)','--accent-dim2':'rgba(22,163,74,0.14)','--accent-dim3':'rgba(22,163,74,0.22)','--text':'#1a2019','--text2':'#4a5a48','--text3':'#7a8a78','--text4':'#aab4a8','--launch-btn-text':'#fff' }
};

// ── Color helpers ─────────────────────────────────────────────────────────────
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max===min) { h=s=0; } else {
    const d = max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h/=6;
  }
  return [h*360, s*100, l*100];
}

function hslToHex(h,s,l) {
  h/=360; s/=100; l/=100;
  let r,g,b;
  if (s===0) { r=g=b=l; } else {
    const hue2rgb=(p,q,t)=>{
      if(t<0)t+=1; if(t>1)t-=1;
      if(t<1/6)return p+(q-p)*6*t;
      if(t<1/2)return q;
      if(t<2/3)return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
    r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
  }
  return '#'+[r,g,b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
}

function deriveThemeFromAccent(hex) {
  const [h, s, l] = hexToHsl(hex);
  const bgS = Math.min(s*0.4, 12);
  const bg  = hslToHex(h, bgS, 5);
  const bg2 = hslToHex(h, bgS, 7.5);
  const bg3 = hslToHex(h, bgS, 10);
  const bg4 = hslToHex(h, bgS, 12.5);
  const bg5 = hslToHex(h, bgS, 15);
  const accent  = hex;
  const accent2 = hslToHex(h, s, Math.max(l-12, 28));
  const accent3 = hslToHex(h, s, Math.max(l-22, 22));
  const accent4 = hslToHex(h, s, Math.max(l-32, 16));
  const tS = Math.min(s*0.25, 8);
  const textL = hslToHex(h, tS, 92);
  const text2 = hslToHex(h, tS, 67);
  const text3 = hslToHex(h, tS, 43);
  const text4 = hslToHex(h, tS, 27);
  const btnText = l > 58 ? '#000' : '#fff';
  const rv = parseInt(hex.slice(1,3),16);
  const gv = parseInt(hex.slice(3,5),16);
  const bv = parseInt(hex.slice(5,7),16);
  return {
    '--bg':bg,'--bg2':bg2,'--bg3':bg3,'--bg4':bg4,'--bg5':bg5,
    '--border':'rgba(255,255,255,0.07)','--border2':'rgba(255,255,255,0.13)','--border3':'rgba(255,255,255,0.2)',
    '--accent':accent,'--accent2':accent2,'--accent3':accent3,'--accent4':accent4,
    '--accent-dim':`rgba(${rv},${gv},${bv},0.08)`,
    '--accent-dim2':`rgba(${rv},${gv},${bv},0.15)`,
    '--accent-dim3':`rgba(${rv},${gv},${bv},0.22)`,
    '--text':textL,'--text2':text2,'--text3':text3,'--text4':text4,
    '--launch-btn-text':btnText
  };
}

// ── Theme application ─────────────────────────────────────────────────────────
function applyThemeObject(vars) {
  const root = document.documentElement;
  for (const [k,v] of Object.entries(vars)) {
    if (k.startsWith('--')) root.style.setProperty(k, v);
  }
  root.style.setProperty('--green',      vars['--accent']      || '#4ade80');
  root.style.setProperty('--green2',     vars['--accent2']     || '#22c55e');
  root.style.setProperty('--green3',     vars['--accent3']     || '#16a34a');
  root.style.setProperty('--green4',     vars['--accent4']     || '#15803d');
  root.style.setProperty('--green-dim',  vars['--accent-dim']  || 'rgba(74,222,128,0.08)');
  root.style.setProperty('--green-dim2', vars['--accent-dim2'] || 'rgba(74,222,128,0.15)');
  root.style.setProperty('--green-dim3', vars['--accent-dim3'] || 'rgba(74,222,128,0.22)');
  root.style.setProperty('--launch-text',vars['--launch-btn-text'] || '#000');
  document.querySelectorAll('.launch-btn').forEach(b => b.style.color = vars['--launch-btn-text'] || '#000');
}

function applyTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES.green;
  applyThemeObject(theme);
}

function applyTextSize(size) {
  const sizes = { sm:'14px', md:'15px', lg:'17px', xl:'19px' };
  document.documentElement.style.fontSize = sizes[size] || '15px';
}

function applyAnimations(enabled) {
  document.documentElement.classList.toggle('reduce-motion', !enabled);
}

function applyGlassEffects(enabled) {
  document.documentElement.classList.toggle('glass-fx', enabled);
}

// ── Settings state ────────────────────────────────────────────────────────────
let currentSettings = {};

async function renderSettingsPanel() {
  const panel = document.getElementById('panel-settings');
  currentSettings = await window.launcher.getSettings();
  const ram        = currentSettings.ram || 4;
  const jvmArgs    = currentSettings.customJvmArgs || '';
  const javaPath   = currentSettings.javaPath || '';
  const cfKey      = currentSettings.curseforgeKey || '';
  const textSize   = currentSettings.textSize || 'md';
  const theme      = currentSettings.theme || 'green';
  const animations = currentSettings.animations !== false;
  const glassEffects = currentSettings.glassEffects === true;
  const customThemes    = currentSettings.customThemes    || [];
  const gradientEnabled = currentSettings.gradientEnabled  === true;
  const gradientColor1  = currentSettings.gradientColor1   || '#0d3320';
  const gradientColor2  = currentSettings.gradientColor2   || '#4ade80';
  const gradientColor3  = currentSettings.gradientColor3   || '#22c55e';
  const gradientSpeed   = Number(currentSettings.gradientSpeed  || 0.4);
  const gradientNoise   = Number(currentSettings.gradientNoise  || 0.12);
  const gradientScale   = Number(currentSettings.gradientScale  || 1.2);
  const particlesEnabled= currentSettings.particlesEnabled  === true;
  const particleCount   = currentSettings.particleCount     || 40;
  const particleSpeed   = Number(currentSettings.particleSpeed  || 0.5);
  const particleOpacity = Number(currentSettings.particleOpacity|| 0.5);
  const particleLines   = currentSettings.particleLines     !== false;
  const glowStrength    = currentSettings.glowStrength      !== undefined ? currentSettings.glowStrength : 8;
  const glowColor       = currentSettings.glowColor         || '';
  const particleColor   = currentSettings.particleColor     || '#4ade80';

  const currentAccent = (() => {
    if (theme.startsWith('custom_')) {
      const ct = customThemes.find(t => t.id === theme.slice(7));
      return ct ? ct.vars['--accent'] : '#4ade80';
    }
    return THEMES[theme]?.['--accent'] || '#4ade80';
  })();

  let javaOptions = [{ label:'Auto-detect', value:'' }];
  try { javaOptions = await window.launcher.findAllJava(); } catch {}

  panel.innerHTML = `
    <div class="ph"><div class="pt">Settings</div><div class="ps">Performance, appearance, and launcher preferences</div></div>

    <div class="pgrid">
      <div class="pcard"><div class="plabel">Allocated RAM</div><div class="pval" id="ramDisplay">${ram} GB</div><div class="psub">Adjust below</div></div>
      <div class="pcard"><div class="plabel">Performance Profile</div><div class="pval" style="font-size:13px;padding-top:4px;">${currentSettings.pvpFlags!==false?'PvP Optimized':'Default'}</div><div class="psub">Aikars G1GC flags</div></div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Performance</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">JVM Memory (GB)</div><div class="s-ldesc">RAM allocated to Minecraft (recommended: 4-8 GB)</div></div>
        <div class="s-ctrl" style="display:flex;align-items:center;gap:10px;">
          <input type="range" min="1" max="32" value="${ram}" step="1" style="width:120px;"
            oninput="document.getElementById('ramDisplay').textContent=this.value+' GB';document.getElementById('ramVal').textContent=this.value+' GB';saveSetting('ram',parseInt(this.value))">
          <span style="font-size:12px;font-family:var(--mono);color:var(--text2);min-width:40px;" id="ramVal">${ram} GB</span>
        </div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">PvP / Performance JVM flags</div><div class="s-ldesc">Aikars G1GC + extra tuning - minimises GC pauses, improves FPS</div></div>
        <div class="s-ctrl"><div class="toggle ${currentSettings.pvpFlags!==false?'on':''}" onclick="toggleSetting(this,'pvpFlags')"></div></div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Close launcher on game launch</div><div class="s-ldesc">Hides Celery Launcher while Minecraft is running</div></div>
        <div class="s-ctrl"><div class="toggle ${currentSettings.closeOnLaunch?'on':''}" onclick="toggleSetting(this,'closeOnLaunch')"></div></div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Auto-update mods on launch</div><div class="s-ldesc">Check Modrinth for newer versions before starting</div></div>
        <div class="s-ctrl"><div class="toggle ${currentSettings.autoUpdateMods?'on':''}" onclick="toggleSetting(this,'autoUpdateMods')"></div></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Java</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Java installation</div><div class="s-ldesc">Select a Java version or choose auto-detect</div></div>
        <div class="s-ctrl" style="display:flex;gap:8px;flex-wrap:wrap;">
          <select class="fsel" id="javaDropdown" onchange="onJavaDropdownChange(this.value)" style="min-width:200px;max-width:260px;">
            ${javaOptions.map(j=>`<option value="${escHtml(j.value)}" ${j.value===javaPath?'selected':''}>${escHtml(j.label)}</option>`).join('')}
            ${javaPath && !javaOptions.find(j=>j.value===javaPath) ? `<option value="${escHtml(javaPath)}" selected>Custom: ${escHtml(javaPath)}</option>` : ''}
          </select>
        </div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Custom Java path</div><div class="s-ldesc">Or paste a specific java.exe path directly</div></div>
        <div class="s-ctrl">
          <input class="sinput" id="javaPathInput" value="${escHtml(javaPath)}" placeholder="Leave blank for auto-detect"
            style="width:220px" onchange="saveSetting('javaPath',this.value);syncJavaDropdown(this.value)">
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
        <div class="s-lbl"><div class="s-lname">Color theme</div><div class="s-ldesc">Preset accent colors for the launcher</div></div>
        <div class="s-ctrl" style="gap:8px;">
          <span style="font-size:11px;color:var(--text3);white-space:nowrap;">Presets</span>
          <select class="fsel" id="themePresetSelect" style="min-width:140px;" onchange="onPresetChange(this.value)">
            ${theme.startsWith('custom_') ? '<option value="" disabled selected>Custom theme</option>' : ''}
            ${Object.entries(THEMES).map(([key,t])=>
              `<option value="${key}" ${!theme.startsWith('custom_')&&theme===key?'selected':''}>${escHtml(t.emoji)} ${escHtml(t.label)}</option>`
            ).join('')}
          </select>
          <div id="themeSwatchDisplay" style="width:18px;height:18px;border-radius:50%;border:2px solid var(--border2);background:${escHtml(currentAccent)};flex-shrink:0;transition:background 0.2s;"></div>
        </div>
      </div>

      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Custom color</div><div class="s-ldesc">Pick any accent color and save it as a named theme</div></div>
        <div class="s-ctrl" style="flex-wrap:wrap;gap:8px;justify-content:flex-end;">
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="color" id="customColorInput" value="${escHtml(currentAccent)}"
              style="width:34px;height:34px;border-radius:var(--radius-sm);border:1px solid var(--border2);padding:2px;background:var(--bg4);cursor:pointer;"
              oninput="document.getElementById('customColorPreview').style.background=this.value">
            <div id="customColorPreview" style="width:18px;height:18px;border-radius:50%;border:2px solid var(--border2);background:${escHtml(currentAccent)};flex-shrink:0;transition:background 0.1s;"></div>
          </div>
          <input class="sinput" id="customColorName" placeholder="Theme name" style="width:120px;min-width:80px;">
          <button class="btn p" onclick="saveCustomTheme()">Save theme</button>
        </div>
      </div>

      ${customThemes.length > 0 ? `
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Saved themes</div><div class="s-ldesc">Click to apply</div></div>
        <div class="s-ctrl" style="flex-wrap:wrap;gap:6px;justify-content:flex-end;max-width:280px;">
          ${customThemes.map(t=>`
            <div class="custom-chip ${theme==='custom_'+t.id?'active':''}"
              data-id="${escHtml(t.id)}" onclick="setTheme('custom_${escHtml(t.id)}')">
              <div class="custom-chip-dot" style="background:${escHtml(t.vars['--accent'])};"></div>
              ${escHtml(t.name)}
              <span class="custom-chip-del" onclick="event.stopPropagation();deleteCustomTheme('${escHtml(t.id)}')" title="Delete">&times;</span>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Text size</div><div class="s-ldesc">Scales all text in the launcher</div></div>
        <div class="s-ctrl">
          <div style="display:flex;gap:6px;">
            ${['sm','md','lg','xl'].map(s=>`
              <button class="btn ${textSize===s?'p':''}" id="tsize-${s}"
                style="padding:4px 10px;font-size:11px;" onclick="setTextSize('${s}')">
                ${{sm:'Normal',md:'Large',lg:'X-Large',xl:'Huge'}[s]}
              </button>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Design</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Animations</div><div class="s-ldesc">Panel transitions, hover effects, and motion throughout the UI</div></div>
        <div class="s-ctrl"><div class="toggle ${animations?'on':''}" onclick="toggleDesignSetting(this,'animations',applyAnimations)"></div></div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Glass effects</div><div class="s-ldesc">Frosted blur on modal overlays and context menus</div></div>
        <div class="s-ctrl"><div class="toggle ${glassEffects?'on':''}" onclick="toggleDesignSetting(this,'glassEffects',applyGlassEffects)"></div></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Background &amp; Effects</div>

      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Animated gradient</div><div class="s-ldesc">WebGL stripe gradient animates behind the launcher</div></div>
        <div class="s-ctrl"><div class="toggle ${gradientEnabled?'on':''}" onclick="toggleGradient(this)"></div></div>
      </div>

      <div id="gradientSettings" class="sfx-sub" style="display:${gradientEnabled?'block':'none'};">
        <div class="s-row">
          <div class="s-lbl"><div class="s-lname">Colors</div></div>
          <div class="s-ctrl" style="gap:14px;">
            <label style="display:flex;flex-direction:column;align-items:center;gap:3px;">
              <input type="color" class="sfx-color" value="${escHtml(gradientColor1)}" oninput="updateGradientColor(1,this.value)">
              <span style="font-size:10px;color:var(--text3);">Dark</span>
            </label>
            <label style="display:flex;flex-direction:column;align-items:center;gap:3px;">
              <input type="color" class="sfx-color" value="${escHtml(gradientColor2)}" oninput="updateGradientColor(2,this.value)">
              <span style="font-size:10px;color:var(--text3);">Mid</span>
            </label>
            <label style="display:flex;flex-direction:column;align-items:center;gap:3px;">
              <input type="color" class="sfx-color" value="${escHtml(gradientColor3)}" oninput="updateGradientColor(3,this.value)">
              <span style="font-size:10px;color:var(--text3);">Bright</span>
            </label>
          </div>
        </div>
        <div class="s-row">
          <div class="s-lbl"><div class="s-lname">Speed</div></div>
          <div class="s-ctrl" style="gap:8px;">
            <input type="range" min="0.05" max="2" step="0.05" value="${gradientSpeed}" style="width:100px;"
              oninput="updateGradientProp('gradientSpeed',parseFloat(this.value));document.getElementById('gSpeedVal').textContent=parseFloat(this.value).toFixed(2)">
            <span id="gSpeedVal" style="font-size:11px;font-family:var(--mono);color:var(--text2);min-width:32px;">${gradientSpeed.toFixed(2)}</span>
          </div>
        </div>
        <div class="s-row">
          <div class="s-lbl"><div class="s-lname">Noise</div></div>
          <div class="s-ctrl" style="gap:8px;">
            <input type="range" min="0" max="0.4" step="0.01" value="${gradientNoise}" style="width:100px;"
              oninput="updateGradientProp('gradientNoise',parseFloat(this.value));document.getElementById('gNoiseVal').textContent=parseFloat(this.value).toFixed(2)">
            <span id="gNoiseVal" style="font-size:11px;font-family:var(--mono);color:var(--text2);min-width:32px;">${gradientNoise.toFixed(2)}</span>
          </div>
        </div>
        <div class="s-row" style="border-bottom:none;">
          <div class="s-lbl"><div class="s-lname">Scale</div></div>
          <div class="s-ctrl" style="gap:8px;">
            <input type="range" min="0.5" max="3" step="0.1" value="${gradientScale}" style="width:100px;"
              oninput="updateGradientProp('gradientScale',parseFloat(this.value));document.getElementById('gScaleVal').textContent=parseFloat(this.value).toFixed(1)">
            <span id="gScaleVal" style="font-size:11px;font-family:var(--mono);color:var(--text2);min-width:32px;">${gradientScale.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Particle effects</div><div class="s-ldesc">Floating particles with optional connecting lines</div></div>
        <div class="s-ctrl"><div class="toggle ${particlesEnabled?'on':''}" onclick="toggleParticles(this)"></div></div>
      </div>

      <div id="particleSettings" class="sfx-sub" style="display:${particlesEnabled?'block':'none'};">
        <div class="s-row">
          <div class="s-lbl"><div class="s-lname">Density</div></div>
          <div class="s-ctrl" style="gap:8px;">
            <input type="range" min="5" max="120" step="5" value="${particleCount}" style="width:100px;"
              oninput="updateParticleProp('particleCount',parseInt(this.value));document.getElementById('pCountVal').textContent=this.value">
            <span id="pCountVal" style="font-size:11px;font-family:var(--mono);color:var(--text2);min-width:32px;">${particleCount}</span>
          </div>
        </div>
        <div class="s-row">
          <div class="s-lbl"><div class="s-lname">Speed</div></div>
          <div class="s-ctrl" style="gap:8px;">
            <input type="range" min="0.1" max="3" step="0.1" value="${particleSpeed}" style="width:100px;"
              oninput="updateParticleProp('particleSpeed',parseFloat(this.value));document.getElementById('pSpeedVal').textContent=parseFloat(this.value).toFixed(1)">
            <span id="pSpeedVal" style="font-size:11px;font-family:var(--mono);color:var(--text2);min-width:32px;">${particleSpeed.toFixed(1)}</span>
          </div>
        </div>
        <div class="s-row">
          <div class="s-lbl"><div class="s-lname">Opacity</div></div>
          <div class="s-ctrl" style="gap:8px;">
            <input type="range" min="0.05" max="1" step="0.05" value="${particleOpacity}" style="width:100px;"
              oninput="updateParticleProp('particleOpacity',parseFloat(this.value));document.getElementById('pOpacVal').textContent=parseFloat(this.value).toFixed(2)">
            <span id="pOpacVal" style="font-size:11px;font-family:var(--mono);color:var(--text2);min-width:32px;">${particleOpacity.toFixed(2)}</span>
          </div>
        </div>
        <div class="s-row">
          <div class="s-lbl"><div class="s-lname">Particle color</div><div class="s-ldesc">Color of floating particles and connecting lines</div></div>
          <div class="s-ctrl" style="gap:8px;">
            <input type="color" value="${escHtml(particleColor)}"
              style="width:34px;height:34px;border-radius:var(--radius-sm);border:1px solid var(--border2);padding:2px;background:var(--bg4);cursor:pointer;"
              oninput="updateParticleColor(this.value)">
          </div>
        </div>
        <div class="s-row" style="border-bottom:none;">
          <div class="s-lbl"><div class="s-lname">Connection lines</div><div class="s-ldesc">Draw lines between nearby particles</div></div>
          <div class="s-ctrl"><div class="toggle ${particleLines?'on':''}" onclick="toggleParticleLines(this)"></div></div>
        </div>
      </div>

      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Glow strength</div><div class="s-ldesc">Intensity of hover glow on buttons and interactive elements</div></div>
        <div class="s-ctrl" style="gap:8px;">
          <input type="range" min="0" max="24" step="1" value="${glowStrength}" style="width:110px;"
            oninput="updateGlowStrength(parseInt(this.value));document.getElementById('glowVal').textContent=this.value">
          <span id="glowVal" style="font-size:11px;font-family:var(--mono);color:var(--text2);min-width:24px;">${glowStrength}</span>
        </div>
      </div>
      <div class="s-row" style="border-bottom:none;">
        <div class="s-lbl"><div class="s-lname">Glow color</div><div class="s-ldesc">Color of glow effects on buttons, scrollbars, and icons (defaults to accent)</div></div>
        <div class="s-ctrl" style="gap:8px;">
          <input type="color" id="glowColorInput" value="${escHtml(glowColor || (currentAccent))}"
            style="width:34px;height:34px;border-radius:var(--radius-sm);border:1px solid var(--border2);padding:2px;background:var(--bg4);cursor:pointer;"
            oninput="updateGlowColor(this.value)">
          <button class="btn" style="padding:4px 8px;font-size:11px;" onclick="resetGlowColor()" title="Reset to accent color">Reset</button>
        </div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Integrations</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">CurseForge API key</div><div class="s-ldesc">Required for CurseForge mod browsing - get one at console.curseforge.com</div></div>
        <div class="s-ctrl"><input class="sinput" type="password" value="${escHtml(cfKey)}" placeholder="Paste your key here" style="width:200px" onchange="saveSetting('curseforgeKey',this.value)"></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Updates</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Celery Launcher updates</div><div class="s-ldesc" id="updateStatusText">Check for the latest version from GitHub.</div></div>
        <div class="s-ctrl" id="updateControls">
          <button class="btn" id="checkUpdateBtn" onclick="checkForUpdate()">Check for updates</button>
        </div>
      </div>
      <div id="updateProgressRow" style="display:none;padding:8px 0;">
        <div class="progress-bar"><div class="progress-fill" id="updateProgressFill" style="width:0%"></div></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">Network Optimizer</div>
      <div class="s-row">
        <div class="s-lbl">
          <div class="s-lname">Force IPv4</div>
          <div class="s-ldesc">Tells Java to skip IPv6 lookups — reduces connection delays on some networks</div>
        </div>
        <div class="s-ctrl"><div class="toggle ${currentSettings.ipv4Prefer?'on':''}" onclick="toggleSetting(this,'ipv4Prefer')"></div></div>
      </div>
      <div class="s-row">
        <div class="s-lbl">
          <div class="s-lname">High process priority</div>
          <div class="s-ldesc">Sets the Java process to High priority so the OS scheduler gives it more CPU time</div>
        </div>
        <div class="s-ctrl"><div class="toggle ${currentSettings.highPriority?'on':''}" onclick="toggleSetting(this,'highPriority')"></div></div>
      </div>
      <div class="s-row" style="border-bottom:none;">
        <div class="s-lbl">
          <div class="s-lname">Apply Cloudflare DNS</div>
          <div class="s-ldesc">Sets all active network adapters to use 1.1.1.1 &amp; 8.8.8.8 — requires admin. Flushes DNS cache after.</div>
        </div>
        <div class="s-ctrl"><button class="btn p" onclick="applyDnsOptimizer()">Apply DNS</button></div>
      </div>
    </div>

    <div class="s-section">
      <div class="s-stitle">System</div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Create desktop shortcut</div><div class="s-ldesc">Adds a shortcut to your desktop</div></div>
        <div class="s-ctrl"><button class="btn p" onclick="createShortcut()">Create shortcut</button></div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Launcher data directory</div><div class="s-ldesc">Where instances, versions, and assets are stored</div></div>
        <div class="s-ctrl"><button class="btn" onclick="window.launcher.openInstanceFolder('..')">Open folder</button></div>
      </div>
      <div class="s-row">
        <div class="s-lbl"><div class="s-lname">Clear game logs</div><div class="s-ldesc">Delete saved log files from previous sessions</div></div>
        <div class="s-ctrl"><button class="btn" onclick="clearLogs()">Clear logs</button></div>
      </div>
      <div class="s-row" style="border-bottom:none;">
        <div class="s-lbl"><div class="s-lname">Clean up orphaned folders</div><div class="s-ldesc">Delete instance folders on disk that no longer have a matching instance in the launcher</div></div>
        <div class="s-ctrl"><button class="btn" onclick="cleanupOrphans()">Clean up</button></div>
      </div>
    </div>
  `;

  if (window.launcher.onUpdateStatus) window.launcher.onUpdateStatus(handleUpdateStatus);
}

// ── Theme functions ───────────────────────────────────────────────────────────
function onPresetChange(key) {
  if (key) setTheme(key);
}

async function setTheme(key) {
  if (key.startsWith('custom_')) {
    const id = key.slice(7);
    const customThemes = currentSettings.customThemes || [];
    const custom = customThemes.find(t => t.id === id);
    if (!custom) return;
    currentSettings.theme = key;
    await window.launcher.saveSettings(currentSettings);
    applyThemeObject(custom.vars);
    toast('Theme: ' + custom.name);
    const sel = document.getElementById('themePresetSelect');
    if (sel) { const o=sel.querySelector('option[value=""]'); if(o)o.selected=true; }
    const swatch = document.getElementById('themeSwatchDisplay');
    if (swatch) swatch.style.background = custom.vars['--accent'];
    document.querySelectorAll('.custom-chip').forEach(c => c.classList.toggle('active', c.dataset.id === id));
  } else {
    currentSettings.theme = key;
    await window.launcher.saveSettings(currentSettings);
    applyTheme(key);
    toast('Theme: ' + (THEMES[key]?.label || key));
    const swatch = document.getElementById('themeSwatchDisplay');
    if (swatch) swatch.style.background = THEMES[key]?.['--accent'] || '';
    document.querySelectorAll('.custom-chip').forEach(c => c.classList.remove('active'));
    const sel = document.getElementById('themePresetSelect');
    if (sel) sel.value = key;
  }
  if (window.effects) window.effects.syncParticleColor();
}

async function saveCustomTheme() {
  const colorInput = document.getElementById('customColorInput');
  const nameInput  = document.getElementById('customColorName');
  if (!colorInput) return;
  const hex  = colorInput.value || '#4ade80';
  const raw  = (nameInput?.value || '').trim();
  const name = raw || ('Custom ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
  const id   = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const vars = deriveThemeFromAccent(hex);
  const customThemes = currentSettings.customThemes || [];
  customThemes.push({ id, name, vars });
  currentSettings.customThemes = customThemes;
  currentSettings.theme = 'custom_' + id;
  await window.launcher.saveSettings(currentSettings);
  applyThemeObject(vars);
  toast('Theme saved: ' + name);
  renderSettingsPanel();
}

async function deleteCustomTheme(id) {
  const customThemes = (currentSettings.customThemes || []).filter(t => t.id !== id);
  currentSettings.customThemes = customThemes;
  if (currentSettings.theme === 'custom_' + id) {
    currentSettings.theme = 'green';
    applyTheme('green');
  }
  await window.launcher.saveSettings(currentSettings);
  renderSettingsPanel();
  toast('Theme deleted');
}

// ── Design setting toggles ────────────────────────────────────────────────────
async function toggleDesignSetting(el, key, applyFn) {
  el.classList.toggle('on');
  const enabled = el.classList.contains('on');
  currentSettings[key] = enabled;
  await window.launcher.saveSettings(currentSettings);
  if (typeof applyFn === 'function') applyFn(enabled);
}

// ── Java helpers ──────────────────────────────────────────────────────────────
function onJavaDropdownChange(value) {
  saveSetting('javaPath', value);
  const input = document.getElementById('javaPathInput');
  if (input) input.value = value;
}

function syncJavaDropdown(value) {
  const sel = document.getElementById('javaDropdown');
  if (!sel) return;
  for (const opt of sel.options) { if (opt.value === value) { sel.value = value; return; } }
  const opt = document.createElement('option');
  opt.value = value; opt.textContent = 'Custom: ' + value; opt.selected = true;
  sel.appendChild(opt);
}

// ── Update handlers ───────────────────────────────────────────────────────────
function handleUpdateStatus(data) {
  const statusEl    = document.getElementById('updateStatusText');
  const ctrlEl      = document.getElementById('updateControls');
  const progressRow = document.getElementById('updateProgressRow');
  const progressFill= document.getElementById('updateProgressFill');
  if (!statusEl) return;
  statusEl.textContent = data.message;
  if (data.status==='checking') {
    ctrlEl.innerHTML=`<button class="btn" disabled>Checking...</button>`;
  } else if (data.status==='available') {
    ctrlEl.innerHTML=`<button class="btn p" onclick="downloadUpdate()">Download v${escHtml(data.version)}</button>`;
  } else if (data.status==='downloading') {
    if(progressRow)progressRow.style.display='block';
    if(progressFill)progressFill.style.width=(data.percent||0)+'%';
    ctrlEl.innerHTML=`<span style="font-size:11px;color:var(--text3);">${data.percent||0}%</span>`;
  } else if (data.status==='ready') {
    if(progressRow)progressRow.style.display='none';
    ctrlEl.innerHTML=`<button class="btn p" onclick="installUpdate()">Restart &amp; install</button>`;
  } else if (data.status==='latest') {
    ctrlEl.innerHTML=`<button class="btn" onclick="checkForUpdate()">Up to date</button>`;
  } else if (data.status==='error') {
    ctrlEl.innerHTML=`<button class="btn" onclick="checkForUpdate()">Retry</button>`;
  }
}

async function cleanupOrphans() {
  const r = await window.launcher.cleanupOrphanFolders();
  if (r.success) toast(r.removed > 0 ? 'Removed '+r.removed+' orphaned folder(s)' : 'Nothing to clean up');
  else toast('Cleanup failed: '+(r.error||'unknown'));
}

async function applyDnsOptimizer() {
  const btn = event.target;
  btn.disabled = true; btn.textContent = 'Applying...';
  try {
    const r = await window.launcher.setDnsOptimizer();
    if (r.success) toast('DNS change requested — accept the admin prompt to apply');
    else toast('DNS apply failed: ' + (r.error || 'Unknown error'));
  } catch(e) { toast('Error: ' + e.message); }
  btn.disabled = false; btn.textContent = 'Apply DNS';
}

async function checkForUpdate() {
  const s=document.getElementById('updateStatusText');
  const c=document.getElementById('updateControls');
  if(s)s.textContent='Checking...';
  if(c)c.innerHTML=`<button class="btn" disabled>Checking...</button>`;
  const r=await window.launcher.checkForUpdate();
  if(!r.success&&s){s.textContent=r.error||'Could not check for updates.';if(c)c.innerHTML=`<button class="btn" onclick="checkForUpdate()">Retry</button>`;}
}
async function downloadUpdate() { await window.launcher.downloadUpdate(); }
async function installUpdate()  { await window.launcher.installUpdate();  }

// ── Persist settings ──────────────────────────────────────────────────────────
async function saveSetting(key, value) { currentSettings[key]=value; await window.launcher.saveSettings(currentSettings); }
async function toggleSetting(el, key)  { el.classList.toggle('on'); currentSettings[key]=el.classList.contains('on'); await window.launcher.saveSettings(currentSettings); }

async function setTextSize(size) {
  currentSettings.textSize=size; await window.launcher.saveSettings(currentSettings); applyTextSize(size);
  ['sm','md','lg','xl'].forEach(s=>document.getElementById('tsize-'+s)?.classList.toggle('p',s===size));
  toast('Text size updated');
}

async function createShortcut() {
  const r=await window.launcher.createShortcut();
  if(r.success)toast('Desktop shortcut created!'); else toast('Failed: '+(r.error||'unknown'));
}

async function clearLogs() {
  const r=await window.launcher.clearLogFolder();
  if(r.success)toast('Cleared '+(r.cleared||0)+' log file(s)'); else toast('Failed to clear logs');
}

// ── Background & Effects ──────────────────────────────────────────────────────
async function toggleGradient(el) {
  el.classList.toggle('on');
  const enabled = el.classList.contains('on');
  currentSettings.gradientEnabled = enabled;
  await window.launcher.saveSettings(currentSettings);
  const sub = document.getElementById('gradientSettings');
  if (sub) sub.style.display = enabled ? 'block' : 'none';
  if (window.effects) window.effects.updateGradient(currentSettings);
}

async function updateGradientColor(num, hex) {
  currentSettings['gradientColor' + num] = hex;
  await window.launcher.saveSettings(currentSettings);
  if (window.effects) window.effects.updateGradient(currentSettings);
}

async function updateGradientProp(key, val) {
  currentSettings[key] = val;
  await window.launcher.saveSettings(currentSettings);
  if (window.effects) window.effects.updateGradient(currentSettings);
}

async function toggleParticles(el) {
  el.classList.toggle('on');
  const enabled = el.classList.contains('on');
  currentSettings.particlesEnabled = enabled;
  await window.launcher.saveSettings(currentSettings);
  const sub = document.getElementById('particleSettings');
  if (sub) sub.style.display = enabled ? 'block' : 'none';
  if (window.effects) window.effects.updateParticles(currentSettings);
}

async function updateParticleProp(key, val) {
  currentSettings[key] = val;
  await window.launcher.saveSettings(currentSettings);
  if (window.effects) window.effects.updateParticles(currentSettings);
}

async function toggleParticleLines(el) {
  el.classList.toggle('on');
  currentSettings.particleLines = el.classList.contains('on');
  await window.launcher.saveSettings(currentSettings);
  if (window.effects) window.effects.updateParticles(currentSettings);
}

async function updateGlowStrength(val) {
  currentSettings.glowStrength = val;
  await window.launcher.saveSettings(currentSettings);
  document.documentElement.style.setProperty('--glow-strength', val);
}

async function updateGlowColor(val) {
  currentSettings.glowColor = val;
  await window.launcher.saveSettings(currentSettings);
  document.documentElement.style.setProperty('--glow-color', val);
}

async function resetGlowColor() {
  delete currentSettings.glowColor;
  await window.launcher.saveSettings(currentSettings);
  document.documentElement.style.removeProperty('--glow-color');
  const accent = document.documentElement.style.getPropertyValue('--accent') ||
    getComputedStyle(document.documentElement).getPropertyValue('--green').trim() || '#4ade80';
  const inp = document.getElementById('glowColorInput');
  if (inp) inp.value = accent;
}

function updateParticleColor(val) {
  currentSettings.particleColor = val;
  if (window.effects && window.effects._part) window.effects._part.config.color = val;
  window.launcher.saveSettings(currentSettings);
}
