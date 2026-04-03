const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { downloadFile } = require('./downloader');
const { getModrinthVersions } = require('../api/modrinth');

function getInstanceDir(instanceId) {
  const Store = require('electron-store');
  const store = new Store();
  const inst = store.get('instances', []).find(i => i.id === instanceId);
  const folderName = inst?.folderName || instanceId;
  const dir = path.join(global.paths.INSTANCES_DIR, folderName);
  // Migration safety: if named dir doesn't exist but id-based does, use id-based
  if (!require('fs').existsSync(dir) && inst?.folderName) {
    const fallback = path.join(global.paths.INSTANCES_DIR, instanceId);
    if (require('fs').existsSync(fallback)) return fallback;
  }
  return dir;
}

function syncModsWithFolder(instanceId) {
  const instanceDir = getInstanceDir(instanceId);
  const modsDir  = path.join(instanceDir, 'mods');
  const metaDir  = path.join(instanceDir, '.celery');
  const metaFile = path.join(metaDir, 'mods.json');

  const allFiles = fs.existsSync(modsDir) ? fs.readdirSync(modsDir) : [];
  const filesOnDisk = new Map();
  for (const f of allFiles.filter(f => f.endsWith('.jar') || f.endsWith('.zip')))
    filesOnDisk.set(f, { actual: f, enabled: true });
  for (const f of allFiles.filter(f => f.endsWith('.jar.disabled') || f.endsWith('.zip.disabled'))) {
    const canonical = f.replace(/\.disabled$/, '');
    if (!filesOnDisk.has(canonical)) filesOnDisk.set(canonical, { actual: f, enabled: false });
  }

  let meta = [];
  if (fs.existsSync(metaFile)) {
    try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch { meta = []; }
  }

  const tracked = new Set(meta.map(m => m.filename));
  let changed = false;

  for (const [canonical, info] of filesOnDisk) {
    if (!tracked.has(canonical)) {
      const title = canonical.replace(/\.jar$/i,'').replace(/\.zip$/i,'')
        .replace(/[-_](?:mc)?1\.\d+[\d.]*[-+].*/i,'').replace(/[-_]\d[\d.]*.*/,'')
        .replace(/[-_]/g,' ').trim();
      meta.push({ id:'manual-'+canonical.replace(/[^a-z0-9]/gi,'-'), title:title||canonical,
        filename:canonical, source:'manual', enabled:info.enabled, installedAt:new Date().toISOString() });
      changed = true;
    } else {
      const m = meta.find(m => m.filename === canonical);
      if (m && m.enabled !== info.enabled) { m.enabled = info.enabled; changed = true; }
    }
  }

  const before = meta.length;
  meta = meta.filter(m => filesOnDisk.has(m.filename));
  if (meta.length !== before) changed = true;

  for (const m of meta) { if (m.enabled === undefined) { m.enabled = true; changed = true; } }

  if (changed) {
    if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  }

  return meta;
}

function toggleMod(instanceId, modId, enable) {
  const instanceDir = getInstanceDir(instanceId);
  const modsDir = path.join(instanceDir, 'mods');
  const metaDir = path.join(instanceDir, '.celery');
  const metaFile = path.join(metaDir, 'mods.json');

  const meta = syncModsWithFolder(instanceId);
  const mod = meta.find(m => m.id === modId);
  if (!mod) throw new Error('Mod not found: ' + modId);

  const ep = path.join(modsDir, mod.filename);
  const dp = path.join(modsDir, mod.filename + '.disabled');

  if (enable) { if (fs.existsSync(dp)) fs.renameSync(dp, ep); mod.enabled = true; }
  else        { if (fs.existsSync(ep)) fs.renameSync(ep, dp); mod.enabled = false; }

  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  return { success: true };
}

function toggleMods(instanceId, modIds, enable) {
  for (const id of modIds) { try { toggleMod(instanceId, id, enable); } catch {} }
  return { success: true };
}

async function checkDependencies(projectId) {
  try {
    const res = await fetch(`https://api.modrinth.com/v2/project/${projectId}/dependencies`,
      { headers: { 'User-Agent': 'CeleryLauncher/2.0.0' } });
    if (!res.ok) return { required: [], optional: [] };
    const data = await res.json();
    const required = [], optional = [];
    for (const dep of (data.projects || [])) {
      const depEntry = (data.versions || []).find(v => v.project_id === dep.id);
      const depType = depEntry?.dependency_type || 'required';
      const info = { id: dep.id, title: dep.title, slug: dep.slug, iconUrl: dep.icon_url };
      if (depType === 'required') required.push(info);
      else if (depType === 'optional') optional.push(info);
    }
    return { required, optional };
  } catch { return { required: [], optional: [] }; }
}

async function enrichModMetadata(mod) {
  try {
    const stem = mod.filename.replace(/\.jar$/i,'').replace(/\.zip$/i,'')
      .replace(/[-_](?:mc)?1\.\d[\d.]*[-+].*/i,'').replace(/[-_]\d[\d.].*/,'')
      .replace(/[-_]/g,' ').trim();
    if (!stem || stem.length < 3) return mod;
    const params = new URLSearchParams({ query: stem, limit: '5', facets: '[["project_type:mod"]]' });
    const res = await fetch(`https://api.modrinth.com/v2/search?${params}`, { headers: { 'User-Agent': 'CeleryLauncher/2.0.0' } });
    if (!res.ok) return mod;
    const data = await res.json();
    const stemNorm = stem.toLowerCase().replace(/\s/g,'');
    const hit = (data.hits||[]).find(h => h.title.toLowerCase().replace(/\s/g,'')===stemNorm || mod.filename.toLowerCase().includes(h.slug.toLowerCase()));
    if (!hit) return mod;
    return { ...mod, id:hit.project_id, title:hit.title, description:hit.description, iconUrl:hit.icon_url,
      downloads:hit.downloads, source:'modrinth', slug:hit.slug, projectId:hit.project_id };
  } catch { return mod; }
}

async function syncAndEnrichMods(instanceId) {
  const instanceDir = getInstanceDir(instanceId);
  const metaDir  = path.join(instanceDir, '.celery');
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

async function getInstalledMods(instanceId) { return syncAndEnrichMods(instanceId); }

function updateInstanceModCount(instanceId, count) {
  const Store = require('electron-store');
  const store = new Store();
  const instances = store.get('instances', []);
  const idx = instances.findIndex(i => i.id === instanceId);
  if (idx >= 0) { instances[idx].mods = count; store.set('instances', instances); }
}

async function installMod(instanceId, mod, source, onProgress) {
  const instanceDir = getInstanceDir(instanceId);
  const Store = require('electron-store');
  const instance = new Store().get('instances', []).find(i => i.id === instanceId);
  if (!instance) throw new Error('Instance not found');

  const modsDir = path.join(instanceDir, 'mods');
  if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });

  let downloadUrl, filename, deps = { required: [], optional: [] };

  if (source === 'modrinth') {
    deps = await checkDependencies(mod.id);
    const versions = await getModrinthVersions(mod.id, instance.mcVersion, instance.loader);
    const releases = versions.filter(v => v.version_type === 'release');
    const candidates = releases.length ? releases : versions;
    if (!candidates.length) throw new Error(`No compatible version of "${mod.title}" for ${instance.mcVersion} ${instance.loader}`);
    const pf = candidates[0].files.find(f => f.primary) || candidates[0].files[0];
    if (!pf) throw new Error('No downloadable file found');
    downloadUrl = pf.url; filename = pf.filename;
  } else if (source === 'curseforge') {
    if (!mod.downloadUrl) throw new Error('No download URL for this CurseForge mod');
    downloadUrl = mod.downloadUrl; filename = mod.filename || `${mod.id}.jar`;
  }

  onProgress({ status: 'downloading', message: `Downloading ${mod.title}...`, percent: 0 });
  await downloadFile(downloadUrl, path.join(modsDir, filename), null, p =>
    onProgress({ status: 'downloading', message: `Downloading ${mod.title}...`, percent: Math.floor(p*100) }));

  const meta    = syncModsWithFolder(instanceId);
  const idx     = meta.findIndex(m => m.filename === filename);
  const metaDir = path.join(instanceDir, '.celery');
  const metaFile= path.join(metaDir, 'mods.json');
  if (idx >= 0) {
    meta[idx] = { id:mod.id, slug:mod.slug, title:mod.title, filename, source, enabled:true,
      installedAt:new Date().toISOString(), iconUrl:mod.iconUrl, projectId:mod.id,
      dependencies: deps.required.map(d => d.id) };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  }

  updateInstanceModCount(instanceId, meta.length);
  onProgress({ status: 'done', message: 'Installed!', percent: 100 });
  return { deps };
}

async function removeMod(instanceId, modId) {
  const instanceDir = getInstanceDir(instanceId);
  const modsDir = path.join(instanceDir, 'mods');
  const meta = syncModsWithFolder(instanceId);
  const mod  = meta.find(m => m.id === modId);
  if (!mod) return;
  const ep = path.join(modsDir, mod.filename);
  const dp = path.join(modsDir, mod.filename + '.disabled');
  if (fs.existsSync(ep)) fs.unlinkSync(ep);
  if (fs.existsSync(dp)) fs.unlinkSync(dp);
  updateInstanceModCount(instanceId, syncModsWithFolder(instanceId).length);
}

async function updateAllMods(instanceId, onProgress) {
  const instanceDir = getInstanceDir(instanceId);
  const instance = new (require('electron-store'))().get('instances', []).find(i => i.id === instanceId);
  if (!instance) throw new Error('Instance not found');

  const meta = syncModsWithFolder(instanceId);
  const results = [];

  for (let i = 0; i < meta.length; i++) {
    const mod = meta[i];
    onProgress({ message: `Checking ${mod.title}...`, current: i+1, total: meta.length });
    if (!mod.id || mod.id.startsWith('manual-') || mod.source === 'manual') { results.push({ mod:mod.title, status:'skipped' }); continue; }

    try {
      if (mod.source === 'modrinth') {
        const versions = await getModrinthVersions(mod.id, instance.mcVersion, instance.loader);
        const releases = versions.filter(v => v.version_type === 'release');
        if (!releases.length) { results.push({ mod:mod.title, status:'no_release' }); continue; }
        const pf = releases[0].files.find(f => f.primary) || releases[0].files[0];
        if (!pf || pf.filename === mod.filename) { results.push({ mod:mod.title, status:'up_to_date' }); continue; }
        const modsDir = path.join(instanceDir, 'mods');
        const wasDisabled = !mod.enabled;
        [path.join(modsDir,mod.filename), path.join(modsDir,mod.filename+'.disabled')]
          .forEach(p => { if(fs.existsSync(p)) fs.unlinkSync(p); });
        onProgress({ message:`Updating ${mod.title}...`, current:i+1, total:meta.length });
        await downloadFile(pf.url, path.join(modsDir, wasDisabled ? pf.filename+'.disabled' : pf.filename));
        mod.filename = pf.filename; mod.updatedAt = new Date().toISOString();
        results.push({ mod:mod.title, status:'updated' });
      }
    } catch (e) { results.push({ mod:mod.title, status:'error', error:e.message }); }
  }

  const metaDir  = path.join(instanceDir, '.celery');
  const metaFile = path.join(metaDir, 'mods.json');
  if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  updateInstanceModCount(instanceId, syncModsWithFolder(instanceId).length);
  return results;
}

async function checkMissingDependencies(instanceId) {
  const meta = await syncAndEnrichMods(instanceId);
  const installedIds = new Set(meta.map(m => m.projectId || m.id).filter(Boolean));
  const missing = [];
  for (const mod of meta) {
    if (!mod.enabled) continue;
    if (!mod.dependencies?.length) continue;
    for (const depId of mod.dependencies) {
      if (!installedIds.has(depId)) missing.push({ mod: mod.title, missingDep: depId });
    }
  }
  return missing;
}

module.exports = {
  installMod, removeMod, getInstalledMods, updateAllMods,
  syncModsWithFolder, syncAndEnrichMods, toggleMod, toggleMods,
  checkDependencies, checkMissingDependencies
};
