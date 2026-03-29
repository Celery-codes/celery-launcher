const fetch  = require('node-fetch');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

async function downloadVersion(instance, settings, onProgress) {
  const { VERSIONS_DIR, ASSETS_DIR, LIBRARIES_DIR } = global.paths;
  const { mcVersion, loader, loaderVersion } = instance;

  onProgress({ message: `Fetching version manifest for ${mcVersion}...`, percent: 5 });

  const { getVersionManifest } = require('../api/versions');
  const manifest = await getVersionManifest(mcVersion);

  const versionDir = path.join(VERSIONS_DIR, mcVersion);
  if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });

  // Client JAR
  const clientJar = path.join(versionDir, `${mcVersion}.jar`);
  if (!fs.existsSync(clientJar)) {
    onProgress({ message: 'Downloading Minecraft client...', percent: 10 });
    await downloadFile(manifest.downloads.client.url, clientJar,
      manifest.downloads.client.sha1, p =>
        onProgress({ message: 'Downloading Minecraft client...', percent: 10 + Math.floor(p * 20) }));
  }

  // Version JSON
  const versionJson = path.join(versionDir, `${mcVersion}.json`);
  if (!fs.existsSync(versionJson))
    fs.writeFileSync(versionJson, JSON.stringify(manifest, null, 2));

  // Libraries + natives (combined — natives are downloaded as classifier jars
  // then immediately extracted into the version's natives dir)
  const nativesDir = path.join(versionDir, 'natives');
  if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true });

  onProgress({ message: 'Downloading libraries...', percent: 30 });
  await downloadLibraries(manifest.libraries, LIBRARIES_DIR, nativesDir, p =>
    onProgress({ message: 'Downloading libraries...', percent: 30 + Math.floor(p * 20) }));

  // Assets
  onProgress({ message: 'Downloading assets...', percent: 50 });
  await downloadAssets(manifest.assetIndex, ASSETS_DIR, p =>
    onProgress({ message: 'Downloading assets...', percent: 50 + Math.floor(p * 20) }));

  // Loader
  if (loader === 'Fabric' && loaderVersion) {
    onProgress({ message: 'Setting up Fabric loader...', percent: 70 });
    await downloadFabric(mcVersion, loaderVersion, VERSIONS_DIR, LIBRARIES_DIR, p =>
      onProgress({ message: 'Setting up Fabric loader...', percent: 70 + Math.floor(p * 15) }));
  } else if (loader === 'Quilt' && loaderVersion) {
    onProgress({ message: 'Setting up Quilt loader...', percent: 70 });
    await downloadQuilt(mcVersion, loaderVersion, VERSIONS_DIR, LIBRARIES_DIR, p =>
      onProgress({ message: 'Setting up Quilt loader...', percent: 70 + Math.floor(p * 15) }));
  }

  onProgress({ message: 'Ready to launch!', percent: 100 });
}

async function downloadLibraries(libraries, librariesDir, nativesDir, onProgress) {
  const extract = require('extract-zip');
  const jobs    = [];

  for (const lib of libraries) {
    // Platform rules check
    if (lib.rules) {
      const allowed = lib.rules.every(rule => {
        const os = rule.os?.name;
        if (rule.action === 'allow')    return !os || os === 'windows';
        if (rule.action === 'disallow') return os && os !== 'windows';
        return true;
      });
      if (!allowed) continue;
    }

    // Main artifact
    if (lib.downloads?.artifact?.url) {
      jobs.push({
        url:  lib.downloads.artifact.url,
        sha1: lib.downloads.artifact.sha1,
        dest: path.join(librariesDir, lib.downloads.artifact.path),
        native: false
      });
    }

    // Native classifier jars — download AND extract
    // 1.16.1 and older use lib.natives[os] -> lib.downloads.classifiers[classifier]
    if (lib.natives?.windows && lib.downloads?.classifiers) {
      const classifierKey = lib.natives.windows.replace('${arch}', '64');
      const cl = lib.downloads.classifiers[classifierKey]
              || lib.downloads.classifiers['natives-windows-64']
              || lib.downloads.classifiers['natives-windows'];
      if (cl?.url) {
        jobs.push({
          url:  cl.url,
          sha1: cl.sha1,
          dest: path.join(librariesDir, cl.path),
          native: true   // flag for extraction
        });
      }
    }

    // 1.19+ style — natives listed as artifact with natives-windows classifier in name
    if (!lib.natives && lib.downloads?.classifiers) {
      for (const key of ['natives-windows', 'natives-windows-64']) {
        const cl = lib.downloads.classifiers[key];
        if (cl?.url) {
          jobs.push({
            url:  cl.url,
            sha1: cl.sha1,
            dest: path.join(librariesDir, cl.path),
            native: true
          });
        }
      }
    }
  }

  for (let i = 0; i < jobs.length; i++) {
    const { url, dest, sha1, native: isNative } = jobs[i];
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(dest)) {
      try { await downloadFile(url, dest, sha1); }
      catch (e) { console.error(`Library download failed: ${url} — ${e.message}`); }
    }

    // Extract native jars immediately after downloading
    if (isNative && fs.existsSync(dest) && nativesDir) {
      try {
        await extract(dest, {
          dir: nativesDir,
          onEntry: (entry, zipfile) => {
            const name = entry.fileName;
            const keep = name.endsWith('.dll') || name.endsWith('.so') ||
                         name.endsWith('.dylib') || name.endsWith('.jnilib');
            if (!keep) entry.autodrain();
          }
        });
      } catch (e) {
        console.error(`Native extraction failed for ${path.basename(dest)}: ${e.message}`);
      }
    }

    if (onProgress) onProgress(i / jobs.length);
  }
}

async function downloadAssets(assetIndex, assetsDir, onProgress) {
  const indexDir = path.join(assetsDir, 'indexes');
  if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true });

  const indexFile = path.join(indexDir, `${assetIndex.id}.json`);
  if (!fs.existsSync(indexFile))
    await downloadFile(assetIndex.url, indexFile, assetIndex.sha1);

  const objects    = Object.values(JSON.parse(fs.readFileSync(indexFile, 'utf8')).objects);
  const objectsDir = path.join(assetsDir, 'objects');
  let done = 0;

  for (let i = 0; i < objects.length; i += 20) {
    await Promise.all(objects.slice(i, i + 20).map(async obj => {
      const prefix  = obj.hash.substring(0, 2);
      const objDir  = path.join(objectsDir, prefix);
      const objFile = path.join(objDir, obj.hash);
      if (!fs.existsSync(objFile)) {
        if (!fs.existsSync(objDir)) fs.mkdirSync(objDir, { recursive: true });
        try {
          await downloadFile(
            `https://resources.download.minecraft.net/${prefix}/${obj.hash}`,
            objFile, obj.hash);
        } catch {}
      }
      done++;
    }));
    onProgress(done / objects.length);
  }
}

async function downloadFabric(mcVersion, loaderVersion, versionsDir, librariesDir, onProgress) {
  const res = await fetch(
    `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`);
  if (!res.ok) throw new Error(`Failed to fetch Fabric profile: ${res.status}`);
  const profile = await res.json();

  const fabricId  = `${mcVersion}-fabric-${loaderVersion}`;
  const fabricDir = path.join(versionsDir, fabricId);
  if (!fs.existsSync(fabricDir)) fs.mkdirSync(fabricDir, { recursive: true });
  fs.writeFileSync(path.join(fabricDir, `${fabricId}.json`), JSON.stringify(profile, null, 2));

  const libs = profile.libraries || [];
  let done   = 0;
  for (const lib of libs) {
    if (lib.url && lib.name) {
      const [g, a, v] = lib.name.split(':');
      const rel     = `${g.replace(/\./g,'/')}/${a}/${v}/${a}-${v}.jar`;
      const libPath = path.join(librariesDir, rel);
      if (!fs.existsSync(libPath)) {
        if (!fs.existsSync(path.dirname(libPath)))
          fs.mkdirSync(path.dirname(libPath), { recursive: true });
        try { await downloadFile(`${lib.url}${rel}`, libPath); } catch {}
      }
    }
    onProgress(++done / libs.length);
  }
}

async function downloadQuilt(mcVersion, loaderVersion, versionsDir, librariesDir, onProgress) {
  const res = await fetch(
    `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}/${loaderVersion}/profile/json`);
  if (!res.ok) throw new Error(`Failed to fetch Quilt profile: ${res.status}`);
  const profile = await res.json();

  const quiltId  = `${mcVersion}-quilt-${loaderVersion}`;
  const quiltDir = path.join(versionsDir, quiltId);
  if (!fs.existsSync(quiltDir)) fs.mkdirSync(quiltDir, { recursive: true });
  fs.writeFileSync(path.join(quiltDir, `${quiltId}.json`), JSON.stringify(profile, null, 2));

  const libs = profile.libraries || [];
  let done   = 0;
  for (const lib of libs) {
    const baseUrl = lib.url || 'https://maven.quiltmc.org/repository/release/';
    if (lib.name) {
      const [g, a, v] = lib.name.split(':');
      const rel     = `${g.replace(/\./g,'/')}/${a}/${v}/${a}-${v}.jar`;
      const libPath = path.join(librariesDir, rel);
      if (!fs.existsSync(libPath)) {
        if (!fs.existsSync(path.dirname(libPath)))
          fs.mkdirSync(path.dirname(libPath), { recursive: true });
        try { await downloadFile(`${baseUrl}${rel}`, libPath); } catch {}
      }
    }
    onProgress(++done / libs.length);
  }
}

async function downloadFile(url, dest, expectedSha1 = null, onProgress = null) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const total  = parseInt(res.headers.get('content-length') || '0');
  let downloaded = 0;
  const chunks   = [];

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
  return fs.readdirSync(VERSIONS_DIR)
    .filter(d => fs.existsSync(path.join(VERSIONS_DIR, d, `${d}.jar`)));
}

module.exports = { downloadVersion, downloadFile, getInstalledVersions };