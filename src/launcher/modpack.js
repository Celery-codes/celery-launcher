const fs   = require('fs');
const path = require('path');
const extract = require('extract-zip');
const { v4: uuidv4 } = require('uuid');
const { downloadFile } = require('./downloader');

// ── Public API ────────────────────────────────────────────────────────────────
// filePath can be a local path OR an https:// URL
async function importModpack(filePath, onProgress) {
  const { INSTANCES_DIR } = global.paths;
  const tmpDir = path.join(INSTANCES_DIR, '_import_tmp_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    let localPath = filePath;

    // If it's a URL, download it first
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      onProgress({ message: 'Downloading modpack...', percent: 5 });
      const filename = decodeURIComponent(filePath.split('/').pop().split('?')[0]) || 'modpack.mrpack';
      localPath = path.join(tmpDir, filename);
      await downloadFile(filePath, localPath, null, p =>
        onProgress({ message: 'Downloading modpack...', percent: Math.floor(p * 20) })
      );
    }

    onProgress({ message: 'Extracting modpack...', percent: 22 });
    await extract(localPath, { dir: tmpDir });

    const mrIndex  = path.join(tmpDir, 'modrinth.index.json');
    const cfManifest = path.join(tmpDir, 'manifest.json');

    if (fs.existsSync(mrIndex))    return await importMrpack(tmpDir, mrIndex, onProgress);
    if (fs.existsSync(cfManifest)) return await importCurseForgeZip(tmpDir, cfManifest, onProgress);

    throw new Error('Unrecognized modpack format. Expected modrinth.index.json or manifest.json.');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ── Download .mrpack directly from Modrinth project ID ───────────────────────
async function importModpackFromModrinth(projectId, versionId, onProgress) {
  const fetch = require('node-fetch');

  onProgress({ message: 'Fetching version info from Modrinth...', percent: 3 });

  let url;
  if (versionId) {
    const res  = await fetch(`https://api.modrinth.com/v2/version/${versionId}`,
      { headers: { 'User-Agent': 'CeleryLauncher/2.0.0' } });
    const data = await res.json();
    const file = data.files?.find(f => f.primary) || data.files?.[0];
    if (!file) throw new Error('No downloadable file found for this version');
    url = file.url;
  } else {
    // Get latest version
    const res  = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`,
      { headers: { 'User-Agent': 'CeleryLauncher/2.0.0' } });
    const versions = await res.json();
    const latest = versions?.[0];
    if (!latest) throw new Error('No versions found for this modpack');
    const file = latest.files?.find(f => f.primary) || latest.files?.[0];
    if (!file) throw new Error('No downloadable file found');
    url = file.url;
  }

  return await importModpack(url, onProgress);
}

// ── Modrinth .mrpack ──────────────────────────────────────────────────────────
async function importMrpack(tmpDir, indexPath, onProgress) {
  const { INSTANCES_DIR } = global.paths;
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  const name          = index.name || 'Imported Pack';
  const mcVersion     = index.dependencies?.minecraft;
  const fabricVersion = index.dependencies?.['fabric-loader'];
  const forgeVersion  = index.dependencies?.forge;
  const quiltVersion  = index.dependencies?.['quilt-loader'];
  const loader        = quiltVersion ? 'Quilt' : fabricVersion ? 'Fabric' : forgeVersion ? 'Forge' : 'Vanilla';
  const loaderVersion = quiltVersion || fabricVersion || forgeVersion || '';

  const instanceId  = uuidv4();
  const folderName  = name.replace(/[^a-zA-Z0-9 _-]/g,'').replace(/\s+/g,'_').slice(0,40) || instanceId;
  const instanceDir = path.join(INSTANCES_DIR, folderName);
  const modsDir     = path.join(instanceDir, 'mods');
  fs.mkdirSync(modsDir, { recursive: true });

  // Copy overrides
  for (const folder of ['overrides', 'client-overrides']) {
    const src = path.join(tmpDir, folder);
    if (fs.existsSync(src)) {
      onProgress({ message: `Copying ${folder}...`, percent: 25 });
      copyDir(src, instanceDir);
    }
  }

  // Download files
  const files = index.files || [];
  onProgress({ message: `Downloading ${files.length} files...`, percent: 30 });

  const metaDir = path.join(instanceDir, '.celery');
  fs.mkdirSync(metaDir, { recursive: true });
  const modsMeta = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // Skip server-only files
    if (file.env?.client === 'unsupported') continue;

    const destRelative = file.path.replace(/^\//, '');
    const destPath     = path.join(instanceDir, destRelative);
    if (!fs.existsSync(path.dirname(destPath))) fs.mkdirSync(path.dirname(destPath), { recursive: true });

    const downloadUrl = file.downloads?.[0];
    if (downloadUrl) {
      try {
        await downloadFile(downloadUrl, destPath, file.hashes?.sha1);
        if (destRelative.startsWith('mods/')) {
          modsMeta.push({
            id: 'mrpack-' + path.basename(destPath, '.jar'),
            title: path.basename(destPath, '.jar')
              .replace(/[-_](?:mc)?1\.\d+[\d.]*[-+].*/i, '')
              .replace(/[-_]/g, ' ').trim(),
            filename: path.basename(destPath),
            source: 'mrpack',
            enabled: true,
            installedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error(`Failed to download ${file.path}: ${e.message}`);
      }
    }

    onProgress({
      message: `Downloading files... (${i+1}/${files.length})`,
      percent: 30 + Math.floor((i / files.length) * 65)
    });
  }

  fs.writeFileSync(path.join(metaDir, 'mods.json'), JSON.stringify(modsMeta, null, 2));
  onProgress({ message: 'Modpack imported!', percent: 100 });

  return { id: instanceId, name, mcVersion, loader, loaderVersion, folderName,
    mods: modsMeta.length, importedFrom: 'mrpack', createdAt: new Date().toISOString() };
}

// ── CurseForge zip ────────────────────────────────────────────────────────────
async function importCurseForgeZip(tmpDir, manifestPath, onProgress) {
  const { INSTANCES_DIR } = global.paths;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const name        = manifest.name || 'Imported Pack';
  const mcVersion   = manifest.minecraft?.version;
  const loaderInfo  = manifest.minecraft?.modLoaders?.[0];
  const loader      = loaderInfo?.id?.startsWith('fabric') ? 'Fabric' : loaderInfo?.id?.startsWith('forge') ? 'Forge' : 'Vanilla';
  const loaderVersion = loaderInfo?.id?.split('-')[1] || '';

  const instanceId  = uuidv4();
  const folderName  = name.replace(/[^a-zA-Z0-9 _-]/g,'').replace(/\s+/g,'_').slice(0,40) || instanceId;
  const instanceDir = path.join(INSTANCES_DIR, folderName);
  fs.mkdirSync(path.join(instanceDir, 'mods'), { recursive: true });

  const overridesDir = path.join(tmpDir, manifest.overrides || 'overrides');
  if (fs.existsSync(overridesDir)) {
    onProgress({ message: 'Copying config files...', percent: 30 });
    copyDir(overridesDir, instanceDir);
  }

  const metaDir = path.join(instanceDir, '.celery');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(path.join(metaDir, 'cf-manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(metaDir, 'mods.json'), JSON.stringify([], null, 2));

  onProgress({ message: 'CurseForge pack imported (mods require CurseForge API key)', percent: 100 });

  return { id: instanceId, name, mcVersion, loader, loaderVersion, folderName,
    mods: 0, importedFrom: 'curseforge-zip',
    pendingCfMods: manifest.files?.length || 0, createdAt: new Date().toISOString() };
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

module.exports = { importModpack, importModpackFromModrinth };
