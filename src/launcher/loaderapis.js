const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { downloadFile } = require('./downloader');

// Modrinth project IDs for loader APIs
const LOADER_API_IDS = {
  Fabric:   'P7dR8mSH',  // Fabric API
  Quilt:    'qvIfYCYJ',  // Quilted Fabric API
  NeoForge: null,        // NeoForge bundles its own API
  Forge:    null,        // Forge bundles its own API
};

async function installLoaderApi(instanceId, instance, onProgress) {
  const { INSTANCES_DIR } = global.paths;
  const modrinthId = LOADER_API_IDS[instance.loader];
  if (!modrinthId) return { skipped: true, reason: `${instance.loader} does not need a separate API mod` };

  onProgress({ message: `Finding ${instance.loader} API for ${instance.mcVersion}...` });

  // Search Modrinth for compatible version
  const params = new URLSearchParams({
    game_versions: JSON.stringify([instance.mcVersion]),
    loaders: JSON.stringify([instance.loader.toLowerCase()])
  });
  const res = await fetch(`https://api.modrinth.com/v2/project/${modrinthId}/version?${params}`, {
    headers: { 'User-Agent': 'CeleryLauncher/2.0.0' }
  });

  if (!res.ok) throw new Error(`Failed to fetch ${instance.loader} API versions: ${res.status}`);
  const versions = await res.json();
  if (!versions.length) return { skipped: true, reason: `No ${instance.loader} API found for ${instance.mcVersion}` };

  const latest = versions[0];
  const primaryFile = latest.files.find(f => f.primary) || latest.files[0];
  if (!primaryFile) return { skipped: true, reason: 'No file found' };

  const folderName = instance.folderName || instanceId;
  const modsDir = path.join(INSTANCES_DIR, folderName, 'mods');
  if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });

  const destPath = path.join(modsDir, primaryFile.filename);

  // Skip if already installed
  if (fs.existsSync(destPath)) return { skipped: true, reason: 'Already installed' };

  onProgress({ message: `Downloading ${instance.loader} API ${latest.version_number}...` });
  await downloadFile(primaryFile.url, destPath);

  // Add to mods.json
  const { syncModsWithFolder } = require('./mods');
  const metaDir = path.join(INSTANCES_DIR, folderName, '.celery');
  if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
  const modsMetaFile = path.join(metaDir, 'mods.json');

  let modsMeta = [];
  if (fs.existsSync(modsMetaFile)) {
    try { modsMeta = JSON.parse(fs.readFileSync(modsMetaFile, 'utf8')); } catch {}
  }

  // Add API entry if not already tracked
  if (!modsMeta.find(m => m.id === modrinthId)) {
    modsMeta.push({
      id: modrinthId,
      slug: instance.loader.toLowerCase() + '-api',
      title: `${instance.loader} API`,
      filename: primaryFile.filename,
      source: 'modrinth',
      installedAt: new Date().toISOString(),
      iconUrl: null,
      projectId: modrinthId,
      isLoaderApi: true
    });
    fs.writeFileSync(modsMetaFile, JSON.stringify(modsMeta, null, 2));
  }

  return { success: true, filename: primaryFile.filename, version: latest.version_number };
}

module.exports = { installLoaderApi };
