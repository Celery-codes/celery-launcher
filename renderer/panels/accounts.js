async function renderAccountsPanel() {
  const panel = document.getElementById('panel-accounts');
  const accounts = await window.launcher.getAccounts();

  panel.innerHTML = `
    <div class="ph"><div class="pt">Accounts</div><div class="ps">Manage your Microsoft / Minecraft accounts</div></div>
    <div id="accountsList"></div>
    <button class="btn p" id="addAccountBtn" onclick="addAccount()">+ Add Microsoft Account</button>
    <div id="accountLoginStatus" style="margin-top:12px;font-size:12px;color:var(--text3);"></div>
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
  btn.disabled = true;
  btn.textContent = 'Opening sign-in...';
  status.textContent = 'A Microsoft login window will open. Sign in with your Minecraft account.';

  const result = await window.launcher.loginMicrosoft();

  btn.disabled = false;
  btn.textContent = '+ Add Microsoft Account';

  if (result.success) {
    activeAccountUuid = result.account.uuid;
    await window.launcher.saveSettings({ ...(await window.launcher.getSettings()), activeAccount: activeAccountUuid });
    updateSidebarAccount(result.account);
    status.textContent = '';
    renderAccountsPanel();
    toast(`Signed in as ${result.account.username}`);
    // Fetch skin and update sidebar avatar + window icon
    loadAccountSkin(result.account);
  } else {
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
  const accounts2 = await window.launcher.getAccounts();
  const switched = accounts2.find(a => a.uuid === uuid);
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
      // Update sidebar avatar with skin head
      const av = document.getElementById('sidebarAvatar');
      if (av) {
        av.innerHTML = `<img src="${result.dataUrl}" style="width:28px;height:28px;border-radius:6px;image-rendering:pixelated;" alt="${account.username}">`;
      }
      // Update window icon
      await window.launcher.setSkinWindowIcon({ uuid: account.uuid, username: account.username });
      // Store the dataUrl for use in account rows
      account._skinDataUrl = result.dataUrl;
    }
  } catch (e) {
    console.error('Skin load error:', e);
  }
}

// Called from app.js on startup if account already logged in
async function initSkinForAccount(account) {
  if (account) await loadAccountSkin(account);
}
