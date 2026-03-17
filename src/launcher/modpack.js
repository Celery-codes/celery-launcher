const fs = require('fs');
const path = require('path');
const extract = require('extract-zip');
const { v4: uuidv4 } = require('uuid');
const { downloadFile } = require('./downloader');

async function importModpack(filePath, onProgress) {
  const { INSTANCES_DIR } = global.paths;
  const ext = path.extname(filePath).toLowerCase();
  const tmpDir = path.join(INSTANCES_DIR, '_import_tmp_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    onProgress({ message: 'Extracting modpack...', percent: 10 });
    await extract(filePath, { dir: tmpDir });

    // Check for modrinth index
    const mrIndex = path.join(tmpDir, 'modrinth.index.json');
    if (fs.existsSync(mrIndex)) {
      return await importMrpack(tmpDir, mrIndex, onProgress);
    }

    // Check for manifest.json (CurseForge)
    const cfManifest = path.join(tmpDir, 'manifest.json');
    if (fs.existsSync(cfManifest)) {
      return await importCurseForgeZip(tmpDir, cfManifest, onProgress);
    }

    throw new Error('Unrecognized modpack format. Expected modrinth.index.json or manifest.json');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function importMrpack(tmpDir, indexPath, onProgress) {
  const { INSTANCES_DIR } = global.paths;
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  const name = index.name || 'Imported Pack';
  const mcVersion = index.dependencies?.minecraft;
  const fabricVersion = index.dependencies?.['fabric-loader'];
  const forgeVersion = index.dependencies?.forge;

  const loader = fabricVersion ? 'Fabric' : forgeVersion ? 'Forge' : 'Vanilla';
  const loaderVersion = fabricVersion || forgeVersion || '';

  const instanceId = uuidv4();
  const instanceDir = path.join(INSTANCES_DIR, instanceId);
  const modsDir = path.join(instanceDir, 'mods');
  fs.mkdirSync(modsDir, { recursive: true });

  // Copy overrides
  const overridesDir = path.join(tmpDir, 'overrides');
  if (fs.existsSync(overridesDir)) {
    onProgress({ message: 'Copying config files...', percent: 20 });
    copyDir(overridesDir, instanceDir);
  }

  // Download files
  const files = index.files || [];
  onProgress({ message: `Downloading ${files.length} mods...`, percent: 30 });

  const metaDir = path.join(instanceDir, '.celery');
  fs.mkdirSync(metaDir, { recursive: true });
  const modsMeta = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const destRelative = file.path.replace(/^\//, '');
    const destPath = path.join(instanceDir, destRelative);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const downloadUrl = file.downloads?.[0];
    if (downloadUrl) {
      try {
        await downloadFile(downloadUrl, destPath, file.hashes?.sha1);
        if (destRelative.startsWith('mods/')) {
          modsMeta.push({
            id: file['env']?.client || path.basename(destPath, '.jar'),
            title: path.basename(destPath, '.jar'),
            filename: path.basename(destPath),
            source: 'mrpack',
            installedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error(`Failed to download ${file.path}: ${e.message}`);
      }
    }

    onProgress({
      message: `Downloading mods... (${i + 1}/${files.length})`,
      percent: 30 + Math.floor((i / files.length) * 60)
    });
  }

  fs.writeFileSync(path.join(metaDir, 'mods.json'), JSON.stringify(modsMeta, null, 2));

  onProgress({ message: 'Modpack imported!', percent: 100 });

  return {
    id: instanceId,
    name,
    mcVersion,
    loader,
    loaderVersion,
    mods: modsMeta.length,
    importedFrom: 'mrpack',
    createdAt: new Date().toISOString()
  };
}

async function importCurseForgeZip(tmpDir, manifestPath, onProgress) {
  const { INSTANCES_DIR } = global.paths;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const name = manifest.name || 'Imported Pack';
  const mcVersion = manifest.minecraft?.version;
  const loaderInfo = manifest.minecraft?.modLoaders?.[0];
  const loader = loaderInfo?.id?.startsWith('fabric') ? 'Fabric' : loaderInfo?.id?.startsWith('forge') ? 'Forge' : 'Vanilla';
  const loaderVersion = loaderInfo?.id?.split('-')[1] || '';

  const instanceId = uuidv4();
  const instanceDir = path.join(INSTANCES_DIR, instanceId);
  const modsDir = path.join(instanceDir, 'mods');
  fs.mkdirSync(modsDir, { recursive: true });

  const overridesDir = path.join(tmpDir, manifest.overrides || 'overrides');
  if (fs.existsSync(overridesDir)) {
    onProgress({ message: 'Copying config files...', percent: 20 });
    copyDir(overridesDir, instanceDir);
  }

  onProgress({ message: 'CurseForge mods require API key to download. Saving manifest...', percent: 80 });

  const metaDir = path.join(instanceDir, '.celery');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(path.join(metaDir, 'cf-manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(metaDir, 'mods.json'), JSON.stringify([], null, 2));

  onProgress({ message: 'Modpack imported (mods need CurseForge API key to install)', percent: 100 });

  return {
    id: instanceId,
    name,
    mcVersion,
    loader,
    loaderVersion,
    mods: 0,
    importedFrom: 'curseforge-zip',
    pendingCfMods: manifest.files?.length || 0,
    createdAt: new Date().toISOString()
  };
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

module.exports = { importModpack };
