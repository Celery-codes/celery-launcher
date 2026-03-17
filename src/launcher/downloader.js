const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FABRIC_META = 'https://meta.fabricmc.net/v2/versions/loader';

async function downloadVersion(instance, settings, onProgress) {
  const { VERSIONS_DIR, ASSETS_DIR, LIBRARIES_DIR } = global.paths;
  const { mcVersion, loader, loaderVersion } = instance;

  onProgress({ message: `Fetching version manifest for ${mcVersion}...`, percent: 5 });

  const { getVersionManifest } = require('../api/versions');
  const manifest = await getVersionManifest(mcVersion);

  const versionDir = path.join(VERSIONS_DIR, mcVersion);
  if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });

  // Download client JAR
  const clientJar = path.join(versionDir, `${mcVersion}.jar`);
  if (!fs.existsSync(clientJar)) {
    onProgress({ message: 'Downloading Minecraft client...', percent: 10 });
    await downloadFile(manifest.downloads.client.url, clientJar, manifest.downloads.client.sha1, (p) => {
      onProgress({ message: 'Downloading Minecraft client...', percent: 10 + Math.floor(p * 0.2) });
    });
  }

  // Save version JSON
  const versionJson = path.join(versionDir, `${mcVersion}.json`);
  if (!fs.existsSync(versionJson)) {
    fs.writeFileSync(versionJson, JSON.stringify(manifest, null, 2));
  }

  // Download libraries
  onProgress({ message: 'Downloading libraries...', percent: 30 });
  await downloadLibraries(manifest.libraries, LIBRARIES_DIR, (p) => {
    onProgress({ message: 'Downloading libraries...', percent: 30 + Math.floor(p * 0.2) });
  });

  // Download assets
  onProgress({ message: 'Downloading assets...', percent: 50 });
  await downloadAssets(manifest.assetIndex, ASSETS_DIR, (p) => {
    onProgress({ message: 'Downloading assets...', percent: 50 + Math.floor(p * 0.2) });
  });

  // Download Fabric if needed
  if (loader === 'Fabric' && loaderVersion) {
    onProgress({ message: 'Setting up Fabric loader...', percent: 70 });
    await downloadFabric(mcVersion, loaderVersion, VERSIONS_DIR, LIBRARIES_DIR, (p) => {
      onProgress({ message: 'Setting up Fabric loader...', percent: 70 + Math.floor(p * 0.15) });
    });
  }

  onProgress({ message: 'Ready to launch!', percent: 100 });
}

async function downloadLibraries(libraries, librariesDir, onProgress) {
  const toDownload = libraries.filter(lib => {
    if (!lib.downloads?.artifact) return false;
    if (lib.rules) {
      const allowed = lib.rules.every(rule => {
        const os = rule.os?.name;
        if (rule.action === 'allow') return !os || os === 'windows';
        if (rule.action === 'disallow') return os && os !== 'windows';
        return true;
      });
      if (!allowed) return false;
    }
    return true;
  });

  for (let i = 0; i < toDownload.length; i++) {
    const lib = toDownload[i];
    const artifact = lib.downloads.artifact;
    const libPath = path.join(librariesDir, artifact.path);
    const libDir = path.dirname(libPath);

    if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
    if (!fs.existsSync(libPath)) {
      await downloadFile(artifact.url, libPath, artifact.sha1);
    }
    onProgress(i / toDownload.length);
  }
}

async function downloadAssets(assetIndex, assetsDir, onProgress) {
  const indexDir = path.join(assetsDir, 'indexes');
  if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true });

  const indexFile = path.join(indexDir, `${assetIndex.id}.json`);
  if (!fs.existsSync(indexFile)) {
    await downloadFile(assetIndex.url, indexFile, assetIndex.sha1);
  }

  const indexData = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  const objects = Object.values(indexData.objects);
  const objectsDir = path.join(assetsDir, 'objects');

  let done = 0;
  const batch = 20;
  for (let i = 0; i < objects.length; i += batch) {
    const chunk = objects.slice(i, i + batch);
    await Promise.all(chunk.map(async obj => {
      const prefix = obj.hash.substring(0, 2);
      const objDir = path.join(objectsDir, prefix);
      const objFile = path.join(objDir, obj.hash);
      if (!fs.existsSync(objFile)) {
        if (!fs.existsSync(objDir)) fs.mkdirSync(objDir, { recursive: true });
        await downloadFile(`https://resources.download.minecraft.net/${prefix}/${obj.hash}`, objFile, obj.hash);
      }
      done++;
    }));
    onProgress(done / objects.length);
  }
}

async function downloadFabric(mcVersion, loaderVersion, versionsDir, librariesDir, onProgress) {
  const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;
  const res = await fetch(profileUrl);
  if (!res.ok) throw new Error(`Failed to fetch Fabric profile: ${res.status}`);
  const profile = await res.json();

  const fabricId = `${mcVersion}-fabric-${loaderVersion}`;
  const fabricDir = path.join(versionsDir, fabricId);
  if (!fs.existsSync(fabricDir)) fs.mkdirSync(fabricDir, { recursive: true });
  fs.writeFileSync(path.join(fabricDir, `${fabricId}.json`), JSON.stringify(profile, null, 2));

  // Download Fabric libraries
  const fabricLibs = profile.libraries || [];
  let done = 0;
  for (const lib of fabricLibs) {
    if (lib.url) {
      const parts = lib.name.split(':');
      const group = parts[0].replace(/\./g, '/');
      const artifact = parts[1];
      const version = parts[2];
      const filename = `${artifact}-${version}.jar`;
      const relPath = `${group}/${artifact}/${version}/${filename}`;
      const libPath = path.join(librariesDir, relPath);
      const libDir = path.dirname(libPath);
      if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
      if (!fs.existsSync(libPath)) {
        const url = `${lib.url}${relPath}`;
        try { await downloadFile(url, libPath); } catch {}
      }
    }
    done++;
    onProgress(done / fabricLibs.length);
  }
}

async function downloadFile(url, dest, expectedSha1 = null, onProgress = null) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);

  const total = parseInt(res.headers.get('content-length') || '0');
  let downloaded = 0;
  const chunks = [];

  for await (const chunk of res.body) {
    chunks.push(chunk);
    downloaded += chunk.length;
    if (onProgress && total > 0) onProgress(downloaded / total);
  }

  const buffer = Buffer.concat(chunks);

  if (expectedSha1) {
    const hash = crypto.createHash('sha1').update(buffer).digest('hex');
    if (hash !== expectedSha1) throw new Error(`SHA1 mismatch for ${path.basename(dest)}`);
  }

  fs.writeFileSync(dest, buffer);
}

function getInstalledVersions() {
  const { VERSIONS_DIR } = global.paths;
  if (!fs.existsSync(VERSIONS_DIR)) return [];
  return fs.readdirSync(VERSIONS_DIR).filter(d => {
    return fs.existsSync(path.join(VERSIONS_DIR, d, `${d}.jar`));
  });
}

module.exports = { downloadVersion, downloadFile, getInstalledVersions };
