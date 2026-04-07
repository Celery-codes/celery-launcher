const { BrowserWindow, session } = require('electron');
const fetch = require('node-fetch');

const MS_CLIENT_ID  = '000000004C12AE6F';
const REDIRECT_URI  = 'https://login.live.com/oauth20_desktop.srf';
const MS_AUTH_URL   = 'https://login.live.com/oauth20_authorize.srf';
const MS_TOKEN_URL  = 'https://login.live.com/oauth20_token.srf';
const XBL_AUTH_URL  = 'https://user.auth.xboxlive.com/user/authenticate';
const XSTS_AUTH_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_AUTH_URL   = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_PROFILE_URL= 'https://api.minecraftservices.com/minecraft/profile';
const MC_ENT_URL    = 'https://api.minecraftservices.com/entitlements/mcstore';

function formatUuid(raw) {
  if (!raw) return raw;
  if (raw.includes('-')) return raw;
  return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
}

async function authenticateMicrosoft(parentWindow) {
  const msCode   = await getMicrosoftCode(parentWindow);
  const msTokens = await getMicrosoftTokens(msCode);
  return await getMinecraftAccount(msTokens);
}

function getMicrosoftCode(parentWindow) {
  return new Promise(async (resolve, reject) => {
    // Fresh isolated session every time — no saved cookies, forces account picker
    const partition  = 'ms-auth-' + Date.now();
    const authSession = session.fromPartition(partition, { cache: false });
    await authSession.clearStorageData();

    const params = new URLSearchParams({
      client_id:     MS_CLIENT_ID,
      response_type: 'code',
      redirect_uri:  REDIRECT_URI,
      scope:         'service::user.auth.xboxlive.com::MBI_SSL',
      display:       'touch',
      locale:        'en',
      prompt:        'select_account'   // show account picker, not email field
    });

    const authWindow = new BrowserWindow({
      width:  520,
      height: 680,
      parent: parentWindow,
      modal:  true,
      show:   false,
      title:  'Sign in to Microsoft',
      webPreferences: {
        nodeIntegration:  false,
        contextIsolation: true,
        webSecurity:      false,
        partition
      }
    });

    // Remove menu bar
    authWindow.setMenuBarVisibility(false);

    let resolved = false;

    function tryResolveUrl(url) {
      if (resolved) return;
      try {
        if (
          url.startsWith('https://login.live.com/oauth20_desktop.srf') ||
          url.includes('oauth20_desktop.srf')
        ) {
          const u     = new URL(url);
          const code  = u.searchParams.get('code');
          const error = u.searchParams.get('error');
          if (code || error) {
            resolved = true;
            authWindow.destroy();
            if (error) reject(new Error(u.searchParams.get('error_description') || error));
            else       resolve(code);
          }
        }
      } catch {}
    }

    authWindow.webContents.on('will-redirect',        (_, url) => tryResolveUrl(url));
    authWindow.webContents.on('will-navigate',         (_, url) => tryResolveUrl(url));
    authWindow.webContents.on('did-navigate',          (_, url) => tryResolveUrl(url));
    authWindow.webContents.on('did-navigate-in-page',  (_, url) => tryResolveUrl(url));

    authWindow.webContents.on('page-title-updated', (_, title) => {
      if (resolved) return;
      if (title?.startsWith('Success code=')) {
        resolved = true;
        authWindow.destroy();
        resolve(title.replace('Success code=', '').trim());
      }
    });

    // Intercept the redirect before the page even loads
    authSession.webRequest.onBeforeRequest(
      { urls: ['https://login.live.com/oauth20_desktop.srf*'] },
      (details, callback) => {
        tryResolveUrl(details.url);
        callback({});
      }
    );

    authWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    authWindow.on('closed', () => {
      if (!resolved) reject(new Error('Sign-in window was closed'));
    });

    authWindow.loadURL(`${MS_AUTH_URL}?${params}`);
    authWindow.show();
  });
}

async function getMicrosoftTokens(code) {
  const res = await fetch(MS_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:    MS_CLIENT_ID,
      code,
      grant_type:   'authorization_code',
      redirect_uri: REDIRECT_URI
    }).toString()
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Token exchange failed: ${text}`); }
  if (data.error) throw new Error(data.error_description || data.error);
  if (!data.access_token) throw new Error('No access token in response');
  return data;
}

async function refreshToken(account) {
  if (!account.refreshToken) throw new Error('No refresh token -- please log in again');
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 2000));
      const res = await fetch(MS_TOKEN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     MS_CLIENT_ID,
          refresh_token: account.refreshToken,
          grant_type:    'refresh_token',
          redirect_uri:  REDIRECT_URI
        }).toString()
      });
      const data = await res.json();
      if (data.error) {
        // Auth errors (invalid/expired refresh token) are permanent — don't retry
        const permanent = ['invalid_grant','interaction_required','consent_required'];
        if (permanent.some(e => data.error === e || (data.error_description||'').includes(e))) {
          throw new Error(data.error_description || data.error);
        }
        throw new Error(data.error_description || data.error);
      }
      return await getMinecraftAccount(data, account);
    } catch(e) {
      lastError = e;
      // Don't retry permanent auth failures
      if (e.message && (e.message.includes('invalid_grant') || e.message.includes('please log in'))) throw e;
    }
  }
  throw lastError;
}

async function getMinecraftAccount(msTokens, existingAccount = null) {
  // XBL
  const xblRes = await fetch(XBL_AUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      Properties:   { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: msTokens.access_token },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType:    'JWT'
    })
  });
  if (!xblRes.ok) throw new Error(`Xbox Live auth failed: ${xblRes.status} ${await xblRes.text()}`);
  const xblData  = await xblRes.json();
  const xblToken = xblData.Token;
  const userHash = xblData.DisplayClaims?.xui?.[0]?.uhs;
  if (!xblToken || !userHash) throw new Error('Invalid Xbox Live response');

  // XSTS
  const xstsRes = await fetch(XSTS_AUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      Properties:   { SandboxId: 'RETAIL', UserTokens: [xblToken] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType:    'JWT'
    })
  });
  const xstsData = await xstsRes.json();
  if (xstsData.XErr) {
    const msgs = {
      2148916233: 'No Xbox profile found. Visit xbox.com and create one first.',
      2148916235: 'Xbox Live is unavailable in your region.',
      2148916238: 'Child account — parental consent required at xbox.com.'
    };
    throw new Error(msgs[xstsData.XErr] || `XSTS error: ${xstsData.XErr}`);
  }
  if (!xstsData.Token) throw new Error('No XSTS token received');

  // MC auth
  const mcRes = await fetch(MC_AUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsData.Token}` })
  });
  if (!mcRes.ok) throw new Error(`Minecraft auth failed: ${mcRes.status} ${await mcRes.text()}`);
  const mcData = await mcRes.json();
  if (!mcData.access_token) throw new Error('No Minecraft token received');

  // Entitlements
  const entData = await (await fetch(MC_ENT_URL, {
    headers: { Authorization: `Bearer ${mcData.access_token}` }
  })).json();
  const ownsGame = (entData.items || []).some(i =>
    i.name === 'product_minecraft' || i.name === 'game_minecraft'
  );

  // Profile
  const profRes = await fetch(MC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${mcData.access_token}` }
  });
  if (!profRes.ok) {
    if (profRes.status === 404) throw new Error("Account doesn't own Minecraft Java Edition.");
    throw new Error(`Profile fetch failed: ${profRes.status}`);
  }
  const profData = await profRes.json();
  if (!profData.id || !profData.name) throw new Error('Invalid profile response from Mojang');

  const account = {
    uuid:         formatUuid(profData.id),
    username:     profData.name,
    mcToken:      mcData.access_token,
    refreshToken: msTokens.refresh_token || existingAccount?.refreshToken || '',
    tokenExpiry:  Date.now() + ((mcData.expires_in || 86400) * 1000),
    ownsGame,
    skin:         profData.skins?.find(s => s.state === 'ACTIVE')?.url || null,
    addedAt:      existingAccount?.addedAt || new Date().toISOString()
  };

  const Store    = require('electron-store');
  const store    = new Store();
  const accounts = store.get('accounts', []);
  const idx      = accounts.findIndex(a => a.uuid === account.uuid);
  if (idx >= 0) accounts[idx] = account;
  else accounts.push(account);
  store.set('accounts', accounts);
  if (!store.get('activeAccount')) store.set('activeAccount', account.uuid);

  return account;
}

async function logout(uuid) { return { success: true }; }

module.exports = { authenticateMicrosoft, refreshToken, logout, formatUuid };
