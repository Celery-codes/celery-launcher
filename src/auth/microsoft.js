const { BrowserWindow } = require('electron');
const fetch = require('node-fetch');

const MS_CLIENT_ID = '000000004C12AE6F';
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
const MS_AUTH_URL = 'https://login.live.com/oauth20_authorize.srf';
const MS_TOKEN_URL = 'https://login.live.com/oauth20_token.srf';
const XBL_AUTH_URL = 'https://user.auth.xboxlive.com/user/authenticate';
const XSTS_AUTH_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_AUTH_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile';
const MC_ENTITLEMENTS_URL = 'https://api.minecraftservices.com/entitlements/mcstore';

// Mojang profile API returns UUIDs WITHOUT dashes.
// Minecraft's session server requires them WITH dashes.
// Missing dashes = "Invalid session" even with a valid token.
function formatUuid(raw) {
  if (!raw) return raw;
  if (raw.includes('-')) return raw; // already formatted
  return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
}

async function authenticateMicrosoft(parentWindow) {
  const msCode = await getMicrosoftCode(parentWindow);
  const msTokens = await getMicrosoftTokens(msCode);
  return await getMinecraftAccount(msTokens);
}

function getMicrosoftCode(parentWindow) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      client_id: MS_CLIENT_ID, response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'service::user.auth.xboxlive.com::MBI_SSL',
      display: 'touch', locale: 'en'
    });

    const authWindow = new BrowserWindow({
      width: 520, height: 680, parent: parentWindow, modal: true, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, webSecurity: false }
    });

    let resolved = false;
    function tryResolveUrl(url) {
      if (resolved) return;
      try {
        if (url.startsWith('https://login.live.com/oauth20_desktop.srf') ||
            url.startsWith('ms-xal-') || url.includes('oauth20_desktop.srf')) {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');
          if (code || error) {
            resolved = true; authWindow.destroy();
            if (error) reject(new Error(urlObj.searchParams.get('error_description') || error));
            else resolve(code);
          }
        }
      } catch (e) {}
    }

    authWindow.webContents.on('will-redirect',       (_e, url) => tryResolveUrl(url));
    authWindow.webContents.on('will-navigate',        (_e, url) => tryResolveUrl(url));
    authWindow.webContents.on('did-navigate',         (_e, url) => tryResolveUrl(url));
    authWindow.webContents.on('did-navigate-in-page', (_e, url) => tryResolveUrl(url));
    authWindow.webContents.on('page-title-updated', (_e, title) => {
      if (resolved) return;
      if (title && title.startsWith('Success code=')) {
        resolved = true; authWindow.destroy();
        resolve(title.replace('Success code=', '').trim());
      }
    });
    authWindow.on('closed', () => {
      if (!resolved) reject(new Error('Login window was closed before completing sign-in'));
    });
    authWindow.loadURL(`${MS_AUTH_URL}?${params}`);
    authWindow.show();
  });
}

async function getMicrosoftTokens(code) {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID, code,
    grant_type: 'authorization_code', redirect_uri: REDIRECT_URI
  });
  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Token exchange failed: ${text}`); }
  if (data.error) throw new Error(data.error_description || data.error);
  if (!data.access_token) throw new Error('No access token in response');
  return data;
}

async function refreshToken(account) {
  if (!account.refreshToken) throw new Error('No refresh token — please log in again');
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    refresh_token: account.refreshToken,
    grant_type: 'refresh_token',
    redirect_uri: REDIRECT_URI
  });
  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return await getMinecraftAccount(data, account);
}

async function getMinecraftAccount(msTokens, existingAccount = null) {
  // XBL
  const xblRes = await fetch(XBL_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: msTokens.access_token },
      RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT'
    })
  });
  if (!xblRes.ok) throw new Error(`Xbox Live auth failed: ${xblRes.status} ${await xblRes.text()}`);
  const xblData = await xblRes.json();
  const xblToken = xblData.Token;
  const userHash = xblData.DisplayClaims?.xui?.[0]?.uhs;
  if (!xblToken || !userHash) throw new Error('Invalid Xbox Live response — missing token or user hash');

  // XSTS
  const xstsRes = await fetch(XSTS_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
      RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT'
    })
  });
  const xstsData = await xstsRes.json();
  if (xstsData.XErr) {
    const msgs = {
      2148916233: 'No Xbox profile found. Visit xbox.com and create one first.',
      2148916235: 'Xbox Live is unavailable in your region.',
      2148916238: 'Child account detected — parental consent required at xbox.com.'
    };
    throw new Error(msgs[xstsData.XErr] || `XSTS error code: ${xstsData.XErr}`);
  }
  const xstsToken = xstsData.Token;
  if (!xstsToken) throw new Error('No XSTS token received');

  // Minecraft auth
  const mcRes = await fetch(MC_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsToken}` })
  });
  if (!mcRes.ok) throw new Error(`Minecraft auth failed: ${mcRes.status} ${await mcRes.text()}`);
  const mcData = await mcRes.json();
  const mcToken = mcData.access_token;
  if (!mcToken) throw new Error('No Minecraft token received');

  // Entitlements
  const entRes = await fetch(MC_ENTITLEMENTS_URL, { headers: { Authorization: `Bearer ${mcToken}` } });
  const entData = await entRes.json();
  const ownsGame = (entData.items || []).some(i => i.name === 'product_minecraft' || i.name === 'game_minecraft');

  // Profile
  const profileRes = await fetch(MC_PROFILE_URL, { headers: { Authorization: `Bearer ${mcToken}` } });
  if (!profileRes.ok) {
    if (profileRes.status === 404) throw new Error("Account doesn't own Minecraft Java Edition or has no username set.");
    throw new Error(`Profile fetch failed: ${profileRes.status}`);
  }
  const profileData = await profileRes.json();
  if (!profileData.id || !profileData.name) throw new Error('Invalid profile response from Mojang');

  const account = {
    uuid: formatUuid(profileData.id), // Always store with dashes
    username: profileData.name,
    mcToken,
    refreshToken: msTokens.refresh_token || existingAccount?.refreshToken || '',
    tokenExpiry: Date.now() + ((msTokens.expires_in || 86400) * 1000),
    ownsGame,
    skin: profileData.skins?.find(s => s.state === 'ACTIVE')?.url || null,
    addedAt: existingAccount?.addedAt || new Date().toISOString()
  };

  const Store = require('electron-store');
  const store = new Store();
  const accounts = store.get('accounts', []);
  const idx = accounts.findIndex(a => a.uuid === account.uuid);
  if (idx >= 0) accounts[idx] = account;
  else accounts.push(account);
  store.set('accounts', accounts);
  if (!store.get('activeAccount')) store.set('activeAccount', account.uuid);

  return account;
}

async function logout(uuid) { return { success: true }; }

module.exports = { authenticateMicrosoft, refreshToken, logout, formatUuid };
