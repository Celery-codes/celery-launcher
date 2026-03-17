let consoleLines = [];
let consoleFilter = 'all';
let consoleSearch = '';
let consoleAutoScroll = true;
let consoleLineLimit = 5000;

function initConsole() {
  if (window._consoleListenerAttached) return;
  window._consoleListenerAttached = true;

  window.launcher.onGameLog((raw) => { appendConsoleLine(raw); });

  window.launcher.onGameClosed(() => {
    appendConsoleLine('[CeleryLauncher] Game process exited.\n', 'system');
    const badge = document.getElementById('consoleBadge');
    if (badge) badge.style.display = 'none';
  });

  window.launcher.onLaunchStatus((data) => {
    if (data.status === 'running') {
      const badge = document.getElementById('consoleBadge');
      if (badge) badge.style.display = 'inline-block';
    }
  });
}

function appendConsoleLine(raw, forceLevel) {
  if (!raw) return;
  const lines = raw.split(/\r?\n/);
  let changed = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    consoleLines.push(parseLogLine(line, forceLevel));
    changed = true;
  }
  if (!changed) return;
  if (consoleLines.length > consoleLineLimit) {
    consoleLines = consoleLines.slice(-consoleLineLimit);
  }
  flushConsoleToDOM();
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
  html = html.replace(/(\b\w+Exception\b)/g,  '<span class="cl-error">$1</span>');
  html = html.replace(/(&lt;[A-Za-z0-9_]{1,16}&gt;)/g, '<span class="cl-chat">$1</span>');
  html = html.replace(/\b(Loading|Loaded|Starting|Started|Done|Initialized)\b/g, '<span class="cl-ok">$1</span>');
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
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <div style="display:flex;gap:3px;" id="conFilterBtns">
          ${['all','info','warn','error','debug','chat','system'].map(f => `
            <button class="clf ${consoleFilter===f?'on':''}" data-f="${f}" onclick="setConFilter('${f}')">${
              {all:'All',info:'Info',warn:'Warn',error:'Error',debug:'Debug',chat:'Chat',system:'System'}[f]
            }</button>
          `).join('')}
        </div>
        <input class="sbox" id="conSearch" placeholder="Search…" value="${escHtml(consoleSearch)}"
          oninput="setConSearch(this.value)" style="width:150px;">
        <button class="btn ${consoleAutoScroll?'p':''}" id="conScrollBtn" onclick="toggleConScroll()" title="Auto-scroll">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 2V11M4 8L8 12L12 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn" onclick="clearConsole()" title="Clear">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 3L13 13M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <button class="btn" onclick="copyConsole()" title="Copy all">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M3 11V3C3 2.45 3.45 2 4 2H11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        </button>
        <button class="btn" onclick="openLogFolder ? openLogFolder() : saveConsoleLog()" title="Logs folder">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4.5C2 3.67 2.67 3 3.5 3H6L7.5 5H12.5C13.33 5 14 5.67 14 6.5V12.5C14 13.33 13.33 14 12.5 14H3.5C2.67 14 2 13.33 2 12.5V4.5Z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
        </button>
      </div>
    </div>
    <div class="con-out" id="conOut"></div>
  `;

  flushConsoleToDOM();
  initConsole();
}

function flushConsoleToDOM() {
  const out = document.getElementById('conOut');
  if (!out) return;

  const el = document.getElementById('consoleLineCount');
  if (el) el.textContent = consoleLines.length + ' lines';

  const filtered = filteredLines();

  if (filtered.length === 0) {
    out.innerHTML = `<div class="con-empty">${
      consoleLines.length === 0
        ? 'No output yet — launch a game to see logs here.'
        : 'No lines match the current filter.'
    }</div>`;
    return;
  }

  const sq = consoleSearch ? consoleSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;

  out.innerHTML = filtered.map(line => {
    let content = line.html;
    if (sq) content = content.replace(new RegExp(`(${sq})`, 'gi'), '<mark class="con-mark">$1</mark>');
    return `<div class="con-line con-${line.level}"><span class="con-ts">${line.ts}</span>${content}</div>`;
  }).join('');

  // Use requestAnimationFrame so scroll happens after the DOM has painted
  if (consoleAutoScroll) {
    requestAnimationFrame(() => { out.scrollTop = out.scrollHeight; });
  }
}

function filteredLines() {
  let lines = consoleLines;
  if (consoleFilter !== 'all') lines = lines.filter(l => l.level === consoleFilter);
  if (consoleSearch) {
    const q = consoleSearch.toLowerCase();
    lines = lines.filter(l => l.raw.toLowerCase().includes(q));
  }
  return lines;
}

function setConFilter(f) {
  consoleFilter = f;
  document.querySelectorAll('.clf').forEach(b => b.classList.toggle('on', b.dataset.f === f));
  flushConsoleToDOM();
}

function setConSearch(val) {
  consoleSearch = val;
  flushConsoleToDOM();
}

function toggleConScroll() {
  consoleAutoScroll = !consoleAutoScroll;
  const btn = document.getElementById('conScrollBtn');
  if (btn) btn.classList.toggle('p', consoleAutoScroll);
  if (consoleAutoScroll) {
    const out = document.getElementById('conOut');
    if (out) requestAnimationFrame(() => { out.scrollTop = out.scrollHeight; });
  }
}

function clearConsole() { consoleLines = []; flushConsoleToDOM(); }

function copyConsole() {
  const text = filteredLines().map(l => `[${l.ts}] ${l.raw}`).join('\n');
  navigator.clipboard.writeText(text).then(() => toast('Copied ' + filteredLines().length + ' lines')).catch(() => toast('Copy failed'));
}

async function saveConsoleLog() {
  const text = consoleLines.map(l => `[${l.ts}] ${l.raw}`).join('\n');
  const result = await window.launcher.saveLogFile(text);
  if (result && result.success) toast('Log saved: ' + result.path);
  else toast('Save failed: ' + ((result && result.error) || 'unknown'));
}

async function openLogFolder() {
  if (window.launcher.openLogFolder) await window.launcher.openLogFolder();
}

function openConsolePanel() {
  showPanel('console', document.getElementById('nav-console'));
}
