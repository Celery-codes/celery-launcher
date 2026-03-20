async function renderAccountsPanel() {
  const panel = document.getElementById('panel-accounts');
  const accounts = await window.launcher.getAccounts();

  panel.innerHTML = `
    <div class="ph"><div class="pt">Accounts</div><div class="ps">Manage your Microsoft / Minecraft accounts</div></div>
    <div id="accountsList"></div>
    <button class="btn p" id="addAccountBtn" onclick="addAccount()">+ Add Microsoft Account</button>
    <div id="deviceCodeBox" style="display:none;margin-top:16px;"></div>
    <div id="accountLoginStatus" style="margin-top:10px;font-size:12px;color:var(--text3);"></div>
  `;

  const list = document.getElementById('accountsList');
  if (accounts.length === 0) {
    list.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:16px 0 20px;">No accounts added yet. Click below to sign in with Microsoft.</div>`;
  } else {
    list.innerHTML = accounts.map(acc => `
      <div class="acc-row ${acc.uuid === activeAccountUuid ? 'active' : ''}">
        <div class="acc-av" style="width:36px;height:36px;border-radius:8px;font-size:13px;">${acc.username.substring(0,2).toUpperCase()}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:500;color:var(--text);">${escHtml(acc.username)}</div>
          <div style="font-size:11px;color:var(--text3);">Microsoft Account · Java Edition${acc.ownsGame === false ? ' · ⚠ No license' : ''}</div>
        </div>
        ${acc.uuid === activeAccountUuid
          ? '<span class="acc-badge">Active</span>'
          : `<button class="btn" style="font-size:11px;padding:4px 10px;" onclick="switchAccount('${acc.uuid}')">Switch</button>`
        }
        <button class="btn danger" style="font-size:11px;padding:4px 10px;margin-left:6px;" onclick="removeAccount('${acc.uuid}')">Remove</button>
      </div>
    `).join('');
  }
}

async function addAccount() {
  const btn = document.getElementById('addAccountBtn');
  const status = document.getElementById('accountLoginStatus');
  const codeBox = document.getElementById('deviceCodeBox');

  btn.disabled = true;
  btn.textContent = 'Opening browser...';
  status.textContent = '';
  codeBox.style.display = 'none';

  // Listen for the device code from main process
  window.launcher.onDeviceCode((userCode) => {
    // Show the code prominently in the UI
    codeBox.style.display = 'block';
    codeBox.innerHTML = `
      <div style="background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);padding:16px 20px;">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Sign-in code</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="font-size:28px;font-weight:700;font-family:var(--mono);color:var(--green);letter-spacing:4px;">${escHtml(userCode)}</div>
          <button class="btn" onclick="navigator.clipboard.writeText('${escHtml(userCode)}').then(()=>toast('Code copied!'))" style="font-size:11px;">Copy</button>
        </div>
        <div style="margin-top:10px;font-size:12px;color:var(--text2);line-height:1.6;">
          Your browser has opened <strong style="color:var(--text);">microsoft.com/link</strong><br>
          Type the code above and sign in with your Microsoft account.
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--text3);">
          Waiting for sign-in
          <span id="dotAnim">.</span>
        </div>
      </div>
    `;
    // Animate the waiting dots
    let dots = 0;
    const dotEl = document.getElementById('dotAnim');
    const dotTimer = setInterval(() => {
      if (!dotEl || !document.getElementById('deviceCodeBox')) { clearInterval(dotTimer); return; }
      dots = (dots + 1) % 4;
      dotEl.textContent = '.'.repeat(dots + 1);
    }, 500);
  });

  const result = await window.launcher.loginMicrosoft();

  btn.disabled = false;
  btn.textContent = '+ Add Microsoft Account';
  codeBox.style.display = 'none';

  if (result.success) {
    activeAccountUuid = result.account.uuid;
    await window.launcher.saveSettings({
      ...(await window.launcher.getSettings()),
      activeAccount: activeAccountUuid
    });
    updateSidebarAccount(result.account);
    status.style.color = 'var(--text3)';
    status.textContent = '';
    renderAccountsPanel();
    toast('Signed in as ' + result.account.username);
    loadAccountSkin(result.account);
  } else {
    codeBox.style.display = 'none';
    status.style.color = 'var(--red)';
    status.textContent = 'Login failed: ' + result.error;
    toast('Login failed');
  }
}

async function switchAccount(uuid) {
  activeAccountUuid = uuid;
  const settings = await window.launcher.getSettings();
  await window.launcher.saveSettings({ ...settings, activeAccount: uuid });
  const accounts = await window.launcher.getAccounts();
  updateSidebarAccount(accounts.find(a => a.uuid === uuid));
  renderAccountsPanel();
  const switched = accounts.find(a => a.uuid === uuid);
  if (switched) loadAccountSkin(switched);
  toast('Account switched');
}

async function removeAccount(uuid) {
  await window.launcher.logout(uuid);
  if (activeAccountUuid === uuid) {
    const accounts = await window.launcher.getAccounts();
    const remaining = accounts.filter(a => a.uuid !== uuid);
    activeAccountUuid = remaining[0]?.uuid || null;
    updateSidebarAccount(remaining[0] || null);
  }
  renderAccountsPanel();
  toast('Account removed');
}

async function loadAccountSkin(account) {
  if (!account?.uuid) return;
  try {
    const result = await window.launcher.getSkinHead({ uuid: account.uuid, username: account.username });
    if (result.success && result.dataUrl) {
      const av = document.getElementById('sidebarAvatar');
      if (av) {
        av.innerHTML = `<img src="${result.dataUrl}" style="width:28px;height:28px;border-radius:6px;image-rendering:pixelated;" alt="${account.username}">`;
      }
      await window.launcher.setSkinWindowIcon({ uuid: account.uuid, username: account.username });
      account._skinDataUrl = result.dataUrl;
    }
  } catch (e) {}
}

async function initSkinForAccount(account) {
  if (account) await loadAccountSkin(account);
}
