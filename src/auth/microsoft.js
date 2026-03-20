const { shell } = require('electron');
const fetch = require('node-fetch');

// ── Device Code Flow ──────────────────────────────────────────────────────────
// Uses microsoft.com/link — opens the user's real browser.
// Client ID: the official Minecraft launcher Azure app
// This ID supports device code flow without requiring a registered app.
const MS_CLIENT_ID    = '000000004C12AE6F';
const DEVICE_CODE_URL = 'https://login.live.com/oauth20_connect.srf';
const MS_TOKEN_URL    = 'https://login.live.com/oauth20_token.srf';
const XBL_AUTH_URL    = 'https://user.auth.xboxlive.com/user/authenticate';
const XSTS_AUTH_URL   = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_AUTH_URL     = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_PROFILE_URL  = 'https://api.minecraftservices.com/minecraft/profile';
const MC_ENTITLEMENTS_URL = 'https://api.minecraftservices.com/entitlements/mcstore';

const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';

function formatUuid(raw) {
  if (!raw) return raw;
  if (raw.includes('-')) return raw;
  return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
}

// ── Step 1: Request device code ───────────────────────────────────────────────
async function requestDeviceCode() {
  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      scope: SCOPE,
      response_type: 'device_code'
    }).toString()
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Device code request failed: ' + text); }
  if (data.error) throw new Error(data.error_description || data.error);
  if (!data.user_code) throw new Error('No device code returned from Microsoft');
  return data;
}

// ── Step 2: Poll until user completes sign-in ─────────────────────────────────
async function pollForToken(deviceCode, interval, expiresIn) {
  const deadline = Date.now() + (expiresIn || 900) * 1000;
  const pollMs   = ((interval || 5) + 1) * 1000; // +1s buffer to avoid slow_down

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollMs));

    const res = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode
      }).toString()
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { continue; }

    if (data.access_token) return data;
    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') { await new Promise(r => setTimeout(r, 5000)); continue; }
    if (data.error === 'authorization_declined') throw new Error('Sign-in was declined.');
    if (data.error === 'expired_token') throw new Error('Code expired. Please try again.');
    throw new Error(data.error_description || data.error || 'Unknown error during sign-in');
  }

  throw new Error('Sign-in timed out. Please try again.');
}

// ── Main entry point ──────────────────────────────────────────────────────────
async function authenticateMicrosoft(parentWindow, onStatus) {
  const deviceData = await requestDeviceCode();

  // Open browser to microsoft.com/link
  shell.openExternal(deviceData.verification_uri || 'https://microsoft.com/link');
  if (onStatus) onStatus(deviceData.user_code);

  const msTokens = await pollForToken(
    deviceData.device_code,
    deviceData.interval,
    deviceData.expires_in
  );

  return await getMinecraftAccount(msTokens);
}

// ── Token refresh ─────────────────────────────────────────────────────────────
async function refreshToken(account) {
  if (!account.refreshToken) throw new Error('No refresh token — please log in again');

  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken
    }).toString()
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return await getMinecraftAccount(data, account);
}

// ── Full Minecraft auth chain ─────────────────────────────────────────────────
async function getMinecraftAccount(msTokens, existingAccount = null) {
  // XBL — note: legacy client ID uses plain access_token, no 'd=' prefix
  const xblRes = await fetch(XBL_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: msTokens.access_token
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    })
  });
  if (!xblRes.ok) throw new Error(`Xbox Live auth failed: ${xblRes.status} ${await xblRes.text()}`);
  const xblData = await xblRes.json();
  const xblToken = xblData.Token;
  const userHash = xblData.DisplayClaims?.xui?.[0]?.uhs;
  if (!xblToken || !userHash) throw new Error('Xbox Live response missing token or user hash');

  // XSTS
  const xstsRes = await fetch(XSTS_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    })
  });
  const xstsData = await xstsRes.json();
  if (xstsData.XErr) {
    const msgs = {
      2148916233: 'No Xbox profile. Visit xbox.com and create one first.',
      2148916235: 'Xbox Live unavailable in your region.',
      2148916238: 'Child account — parental consent required at xbox.com.'
    };
    throw new Error(msgs[xstsData.XErr] || `XSTS error: ${xstsData.XErr}`);
  }
  const xstsToken = xstsData.Token;
  if (!xstsToken) throw new Error('No XSTS token received');

  // Minecraft
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
  const ownsGame = (entData.items || []).some(i =>
    i.name === 'product_minecraft' || i.name === 'game_minecraft'
  );

  // Profile
  const profileRes = await fetch(MC_PROFILE_URL, { headers: { Authorization: `Bearer ${mcToken}` } });
  if (!profileRes.ok) {
    if (profileRes.status === 404) throw new Error("Account doesn't own Minecraft Java Edition.");
    throw new Error(`Profile fetch failed: ${profileRes.status}`);
  }
  const profileData = await profileRes.json();
  if (!profileData.id || !profileData.name) throw new Error('Invalid profile response from Mojang');

  const account = {
    uuid: formatUuid(profileData.id),
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
