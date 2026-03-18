let consoleLines = [];
let consoleFilter = 'all';
let consoleSearch = '';
let consoleAutoScroll = true;
let consoleLineLimit = 5000;

function initConsole() {
  if (window._consoleListenerAttached) return;
  window._consoleListenerAttached = true;
  window.launcher.onGameLog(raw => appendConsoleLine(raw));
  window.launcher.onGameClosed(() => {
    appendConsoleLine('[Celery] Game process exited.', 'system');
    const badge = document.getElementById('consoleBadge');
    if (badge) badge.style.display = 'none';
  });
  window.launcher.onLaunchStatus(data => {
    if (data.status === 'running') {
      const badge = document.getElementById('consoleBadge');
      if (badge) badge.style.display = 'inline-block';
    }
    if (data.message && data.status !== 'running') {
      appendConsoleLine('[Celery] ' + data.message, 'system');
    }
  });
}

function appendConsoleLine(raw, forceLevel) {
  if (!raw) return;
  const newParsed = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parsed = parseLogLine(line, forceLevel);
    consoleLines.push(parsed);
    newParsed.push(parsed);
  }
  if (!newParsed.length) return;
  if (consoleLines.length > consoleLineLimit) consoleLines = consoleLines.slice(-consoleLineLimit);

  const countEl = document.getElementById('consoleLineCount');
  if (countEl) countEl.textContent = consoleLines.length + ' lines';

  // Append to DOM directly — never rebuild, never lose scroll position
  _domAppend('conOut', newParsed);
}

function _domAppend(id, lines) {
  const out = document.getElementById(id);
  if (!out) return;
  // Remove empty placeholder if present
  const empty = out.querySelector('.con-empty');
  if (empty) out.innerHTML = '';

  const sq = consoleSearch ? consoleSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
  const frag = document.createDocumentFragment();
  let added = 0;
  for (const line of lines) {
    if (consoleFilter !== 'all' && line.level !== consoleFilter) continue;
    if (consoleSearch && !line.raw.toLowerCase().includes(consoleSearch.toLowerCase())) continue;
    frag.appendChild(_buildEl(line, sq));
    added++;
  }
  if (added) {
    out.appendChild(frag);
    if (consoleAutoScroll) requestAnimationFrame(() => { out.scrollTop = out.scrollHeight; });
  }
}

function _buildEl(line, sq) {
  const div = document.createElement('div');
  div.className = 'con-line con-' + line.level;
  const ts = document.createElement('span');
  ts.className = 'con-ts';
  ts.textContent = line.ts;
  div.appendChild(ts);
  const body = document.createElement('span');
  body.innerHTML = sq
    ? line.html.replace(new RegExp(`(${sq})`, 'gi'), '<mark class="con-mark">$1</mark>')
    : line.html;
  div.appendChild(body);
  return div;
}

function _rebuild(id) {
  const out = document.getElementById(id);
  if (!out) return;
  out.innerHTML = '';
  const lines = filteredLines();
  if (!lines.length) {
    out.innerHTML = `<div class="con-empty">${consoleLines.length === 0
      ? 'No output yet — launch a game to see logs here.'
      : 'No lines match the current filter.'}</div>`;
    return;
  }
  const sq = consoleSearch ? consoleSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
  const frag = document.createDocumentFragment();
  for (const line of lines) frag.appendChild(_buildEl(line, sq));
  out.appendChild(frag);
  requestAnimationFrame(() => { out.scrollTop = out.scrollHeight; });
}

function parseLogLine(raw, forceLevel) {
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  let level = forceLevel || 'info';
  const mcMatch = raw.match(/\[(FATAL|ERROR|WARN|INFO|DEBUG|TRACE)\]/i);
  if (mcMatch) {
    const lvl = mcMatch[1].toUpperCase();
    if (lvl === 'ERROR' || lvl === 'FATAL') level = 'error';
    else if (lvl === 'WARN') level = 'warn';
    else if (lvl === 'DEBUG' || lvl === 'TRACE') level = 'debug';
    else level = 'info';
  }
  if (/\[CHAT\]/i.test(raw) || /\[\d{2}:\d{2}:\d{2}\].*<[A-Za-z0-9_]{1,16}>/.test(raw)) level = 'chat';
  if (/^\[Celery(?:Launcher)?\]/.test(raw)) level = 'system';
  if (/^\s+(at |Caused by:|\.{3}\s*\d)/.test(raw)) level = 'trace';
  return { raw, html: colorize(escHtml(raw), level), level, ts };
}

function colorize(html, level) {
  html = html.replace(/\[(FATAL|ERROR)\]/g,  '<span class="cl-error">[$1]</span>');
  html = html.replace(/\[(WARN)\]/g,          '<span class="cl-warn">[$1]</span>');
  html = html.replace(/\[(INFO)\]/g,          '<span class="cl-info">[$1]</span>');
  html = html.replace(/\[(DEBUG|TRACE)\]/g,   '<span class="cl-debug">[$1]</span>');
  html = html.replace(/^(\[\d{2}:\d{2}:\d{2}\])/g, '<span class="cl-ts">$1</span>');
  html = html.replace(/(\[[^\]]+?\/(?:INFO|WARN|ERROR|DEBUG|TRACE|FATAL)\])/g, '<span class="cl-thread">$1</span>');
  html = html.replace(/(\b\w+Exception\b)/g,  '<span class="cl-error">$1</span>');
  html = html.replace(/(&lt;[A-Za-z0-9_]{1,16}&gt;)/g, '<span class="cl-chat">$1</span>');
  html = html.replace(/\b(Loading|Loaded|Starting|Started|Done|Initialized|Preparing)\b/g, '<span class="cl-ok">$1</span>');
  html = html.replace(/(\[Celery(?:Launcher)?\])/g, '<span class="cl-launcher">$1</span>');
  return html;
}

function renderConsolePanel() {
  const panel = document.getElementById('panel-console');
  if (!panel) return;
  panel.innerHTML = `
    <div class="con-bar">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
        <span class="con-title">Console</span>
        <span class="con-count" id="consoleLineCount">${consoleLines.length} lines</span>
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
        <div style="display:flex;gap:3px;">
          ${['all','info','warn','error','debug','chat','system'].map(f => `
            <button class="clf ${consoleFilter===f?'on':''}" data-f="${f}" onclick="setConFilter('${f}')">${
              {all:'All',info:'Info',warn:'Warn',error:'Error',debug:'Debug',chat:'Chat',system:'System'}[f]
            }</button>`).join('')}
        </div>
        <input class="sbox" id="conSearch" placeholder="Search…" value="${escHtml(consoleSearch)}"
          oninput="setConSearch(this.value)" style="width:140px;">
        <button class="btn ${consoleAutoScroll?'p':''}" id="conScrollBtn" onclick="toggleConScroll()" title="Auto-scroll to bottom">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 2V11M4 8L8 12L12 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn" onclick="clearConsole()">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 3L13 13M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Clear
        </button>
        <button class="btn" onclick="copyConsole()">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M3 11V3C3 2.45 3.45 2 4 2H11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          Copy
        </button>
        <button class="btn" onclick="openLogFolder()">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4.5C2 3.67 2.67 3 3.5 3H6L7.5 5H12.5C13.33 5 14 5.67 14 6.5V12.5C14 13.33 13.33 14 12.5 14H3.5C2.67 14 2 13.33 2 12.5V4.5Z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          Logs
        </button>
        <button class="btn" onclick="clearLogFolder()">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 4H13M5 4V3H11V4M6 7V12M10 7V12M4 4L5 13H11L12 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          Clear logs
        </button>
      </div>
    </div>
    <div class="con-out" id="conOut"></div>
  `;
  _rebuild('conOut');
  initConsole();
}

function filteredLines() {
  let lines = consoleLines;
  if (consoleFilter !== 'all') lines = lines.filter(l => l.level === consoleFilter);
  if (consoleSearch) { const q = consoleSearch.toLowerCase(); lines = lines.filter(l => l.raw.toLowerCase().includes(q)); }
  return lines;
}

function setConFilter(f) {
  consoleFilter = f;
  document.querySelectorAll('.clf').forEach(b => b.classList.toggle('on', b.dataset.f === f));
  _rebuild('conOut');
}

function setConSearch(val) { consoleSearch = val; _rebuild('conOut'); }

function toggleConScroll() {
  consoleAutoScroll = !consoleAutoScroll;
  document.getElementById('conScrollBtn')?.classList.toggle('p', consoleAutoScroll);
  if (consoleAutoScroll) {
    requestAnimationFrame(() => {
      const o = document.getElementById('conOut'); if (o) o.scrollTop = o.scrollHeight;
    });
  }
}

function clearConsole() {
  consoleLines = [];
  _rebuild('conOut');
  const c = document.getElementById('consoleLineCount'); if (c) c.textContent = '0 lines';
}

function copyConsole() {
  const text = filteredLines().map(l => `[${l.ts}] ${l.raw}`).join('\n');
  navigator.clipboard.writeText(text)
    .then(() => toast('Copied ' + filteredLines().length + ' lines'))
    .catch(() => toast('Copy failed'));
}

async function openLogFolder() {
  if (window.launcher.openLogFolder) await window.launcher.openLogFolder();
}

async function clearLogFolder() {
  if (!window.launcher.clearLogFolder) return;
  const result = await window.launcher.clearLogFolder();
  if (result && result.success) toast('Log files cleared');
  else toast('Failed: ' + ((result && result.error) || 'unknown'));
}

function openConsolePanel() {
  showPanel('console', document.getElementById('nav-console'));
}
