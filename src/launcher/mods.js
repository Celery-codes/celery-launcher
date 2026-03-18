const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { downloadFile } = require('./downloader');
const { getModrinthVersions } = require('../api/modrinth');

function syncModsWithFolder(instanceId) {
  const { INSTANCES_DIR } = global.paths;
  const modsDir  = path.join(INSTANCES_DIR, instanceId, 'mods');
  const metaDir  = path.join(INSTANCES_DIR, instanceId, '.celery');
  const metaFile = path.join(metaDir, 'mods.json');

  const filesOnDisk = fs.existsSync(modsDir)
    ? fs.readdirSync(modsDir).filter(f => f.endsWith('.jar') || f.endsWith('.zip'))
    : [];

  let meta = [];
  if (fs.existsSync(metaFile)) {
    try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch { meta = []; }
  }

  const tracked = new Set(meta.map(m => m.filename));
  let changed = false;

  for (const filename of filesOnDisk) {
    if (!tracked.has(filename)) {
      const title = filename
        .replace(/\.jar$/i, '').replace(/\.zip$/i, '')
        .replace(/[-_](?:mc)?1\.\d+[\d.]*[-+].*/i, '')
        .replace(/[-_]\d[\d.]*.*/,  '')
        .replace(/[-_]/g, ' ').trim();
      meta.push({
        id: 'manual-' + filename.replace(/[^a-z0-9]/gi, '-'),
        title: title || filename,
        filename, source: 'manual',
        installedAt: new Date().toISOString()
      });
      changed = true;
    }
  }

  const before = meta.length;
  meta = meta.filter(m => filesOnDisk.includes(m.filename));
  if (meta.length !== before) changed = true;

  if (changed) {
    if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  }

  return meta;
}

async function enrichModMetadata(mod) {
  try {
    const stem = mod.filename
      .replace(/\.jar$/i, '').replace(/\.zip$/i, '')
      .replace(/[-_](?:mc)?1\.\d[\d.]*[-+].*/i, '')
      .replace(/[-_]\d[\d.].*/,  '')
      .replace(/[-_]/g, ' ').trim();

    if (!stem || stem.length < 3) return mod;

    const params = new URLSearchParams({
      query: stem, limit: '5',
      facets: '[["project_type:mod"]]'
    });
    const res = await fetch(`https://api.modrinth.com/v2/search?${params}`, {
      headers: { 'User-Agent': 'CeleryLauncher/2.0.0' }
    });
    if (!res.ok) return mod;
    const data = await res.json();

    const stemNorm = stem.toLowerCase().replace(/\s/g, '');
    const hit = (data.hits || []).find(h =>
      h.title.toLowerCase().replace(/\s/g, '') === stemNorm ||
      mod.filename.toLowerCase().includes(h.slug.toLowerCase())
    );
    if (!hit) return mod;

    return {
      ...mod,
      id: hit.project_id, title: hit.title,
      description: hit.description, iconUrl: hit.icon_url,
      downloads: hit.downloads, follows: hit.follows,
      source: 'modrinth', slug: hit.slug, projectId: hit.project_id
    };
  } catch { return mod; }
}

async function syncAndEnrichMods(instanceId) {
  const { INSTANCES_DIR } = global.paths;
  const metaDir  = path.join(INSTANCES_DIR, instanceId, '.celery');
  const metaFile = path.join(metaDir, 'mods.json');

  let meta = syncModsWithFolder(instanceId);
  let changed = false;

  for (let i = 0; i < meta.length; i++) {
    const m = meta[i];
    if (m.source === 'manual' && !m._lookupAttempted) {
      meta[i]._lookupAttempted = true;
      const enriched = await enrichModMetadata(m);
      if (enriched !== m) { meta[i] = enriched; changed = true; }
    }
  }

  if (changed) {
    if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  }

  return meta;
}

async function getInstalledMods(instanceId) {
  return syncAndEnrichMods(instanceId);
}

function updateInstanceModCount(instanceId, count) {
  const Store = require('electron-store');
  const store = new Store();
  const instances = store.get('instances', []);
  const idx = instances.findIndex(i => i.id === instanceId);
  if (idx >= 0) { instances[idx].mods = count; store.set('instances', instances); }
}

async function installMod(instanceId, mod, source, onProgress) {
  const { INSTANCES_DIR } = global.paths;
  const Store = require('electron-store');
  const store = new Store();
  const instance = store.get('instances', []).find(i => i.id === instanceId);
  if (!instance) throw new Error('Instance not found');

  const modsDir = path.join(INSTANCES_DIR, instanceId, 'mods');
  if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });

  let downloadUrl, filename;

  if (source === 'modrinth') {
    // Only use release versions — filter out alpha/beta
    const versions = await getModrinthVersions(mod.id, instance.mcVersion, instance.loader);
    const releaseVersions = versions.filter(v => v.version_type === 'release');
    const candidates = releaseVersions.length ? releaseVersions : versions;
    if (!candidates.length) throw new Error(`No compatible version of "${mod.title}" for ${instance.mcVersion} ${instance.loader}`);
    const latest = candidates[0];
    const primaryFile = latest.files.find(f => f.primary) || latest.files[0];
    if (!primaryFile) throw new Error('No downloadable file found');
    downloadUrl = primaryFile.url;
    filename    = primaryFile.filename;
  } else if (source === 'curseforge') {
    if (!mod.downloadUrl) throw new Error('No download URL for this CurseForge mod');
    downloadUrl = mod.downloadUrl;
    filename    = mod.filename || `${mod.id}.jar`;
  }

  onProgress({ status: 'downloading', message: `Downloading ${mod.title}...`, percent: 0 });
  await downloadFile(downloadUrl, path.join(modsDir, filename), null, p => {
    onProgress({ status: 'downloading', message: `Downloading ${mod.title}...`, percent: Math.floor(p * 100) });
  });

  const meta    = syncModsWithFolder(instanceId);
  const idx     = meta.findIndex(m => m.filename === filename);
  const metaDir = path.join(INSTANCES_DIR, instanceId, '.celery');
  const metaFile= path.join(metaDir, 'mods.json');
  if (idx >= 0) {
    meta[idx] = {
      id: mod.id, slug: mod.slug, title: mod.title, filename,
      source, installedAt: new Date().toISOString(),
      iconUrl: mod.iconUrl, projectId: mod.id
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  }

  updateInstanceModCount(instanceId, meta.length);
  onProgress({ status: 'done', message: 'Installed!', percent: 100 });
}

async function removeMod(instanceId, modId) {
  const { INSTANCES_DIR } = global.paths;
  const meta = syncModsWithFolder(instanceId);
  const mod  = meta.find(m => m.id === modId);
  if (!mod) return;
  const modFile = path.join(INSTANCES_DIR, instanceId, 'mods', mod.filename);
  if (fs.existsSync(modFile)) fs.unlinkSync(modFile);
  const updated = syncModsWithFolder(instanceId);
  updateInstanceModCount(instanceId, updated.length);
}

async function updateAllMods(instanceId, onProgress) {
  const { INSTANCES_DIR } = global.paths;
  const Store = require('electron-store');
  const store = new Store();
  const instance = store.get('instances', []).find(i => i.id === instanceId);
  if (!instance) throw new Error('Instance not found');

  const meta    = syncModsWithFolder(instanceId);
  const results = [];

  for (let i = 0; i < meta.length; i++) {
    const mod = meta[i];
    onProgress({ message: `Checking ${mod.title}...`, current: i + 1, total: meta.length });

    if (!mod.id || mod.id.startsWith('manual-') || mod.source === 'manual') {
      results.push({ mod: mod.title, status: 'skipped' }); continue;
    }

    try {
      if (mod.source === 'modrinth') {
        const versions = await getModrinthVersions(mod.id, instance.mcVersion, instance.loader);

        // Only update to official releases — skip alpha and beta
        const releaseVersions = versions.filter(v => v.version_type === 'release');
        const candidates = releaseVersions.length ? releaseVersions : [];

        if (!candidates.length) {
          results.push({ mod: mod.title, status: 'no_release' }); continue;
        }

        const latest = candidates[0];
        const pf = latest.files.find(f => f.primary) || latest.files[0];
        if (!pf || pf.filename === mod.filename) {
          results.push({ mod: mod.title, status: 'up_to_date' }); continue;
        }

        const modsDir = path.join(INSTANCES_DIR, instanceId, 'mods');
        const oldFile = path.join(modsDir, mod.filename);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        onProgress({ message: `Updating ${mod.title}...`, current: i + 1, total: meta.length });
        await downloadFile(pf.url, path.join(modsDir, pf.filename));
        mod.filename  = pf.filename;
        mod.updatedAt = new Date().toISOString();
        results.push({ mod: mod.title, status: 'updated' });
      }
    } catch (e) {
      results.push({ mod: mod.title, status: 'error', error: e.message });
    }
  }

  const metaDir  = path.join(INSTANCES_DIR, instanceId, '.celery');
  const metaFile = path.join(metaDir, 'mods.json');
  if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  const final = syncModsWithFolder(instanceId);
  updateInstanceModCount(instanceId, final.length);
  return results;
}

module.exports = {
  installMod, removeMod, getInstalledMods,
  updateAllMods, syncModsWithFolder, syncAndEnrichMods
};
