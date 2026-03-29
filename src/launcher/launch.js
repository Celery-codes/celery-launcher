const { spawn } = require('child_process');
const path = require('path');
const fs   = require('fs');

const G1GC_FLAGS = [
  '-XX:+UnlockExperimentalVMOptions','-XX:+UnlockDiagnosticVMOptions',
  '-XX:+UseG1GC','-XX:+ParallelRefProcEnabled','-XX:MaxGCPauseMillis=200',
  '-XX:+DisableExplicitGC','-XX:+AlwaysPreTouch',
  '-XX:G1NewSizePercent=30','-XX:G1MaxNewSizePercent=40','-XX:G1HeapRegionSize=32M',
  '-XX:G1ReservePercent=20','-XX:G1HeapWastePercent=5','-XX:G1MixedGCCountTarget=3',
  '-XX:InitiatingHeapOccupancyPercent=15','-XX:G1MixedGCLiveThresholdPercent=90',
  '-XX:G1RSetUpdatingPauseTimePercent=5','-XX:SurvivorRatio=32',
  '-XX:+PerfDisableSharedMem','-XX:MaxTenuringThreshold=1',
  '-XX:+UseStringDeduplication','-XX:+OptimizeStringConcat',
  '-XX:-DontCompileHugeMethods','-XX:+UseNUMA',
  '-Dusing.aikars.flags=https://mcflags.emc.gs','-Daikars.new.flags=true',
  '-Dlog4j2.formatMsgNoLookups=true',
  '-Dfml.ignorePatchDiscrepancies=true','-Dfml.ignoreInvalidMinecraftCertificates=true',
];

const ZGC_FLAGS = [
  '-XX:+UnlockExperimentalVMOptions','-XX:+UnlockDiagnosticVMOptions',
  '-XX:+UseZGC','-XX:+ZGenerational','-XX:+DisableExplicitGC','-XX:+AlwaysPreTouch',
  '-XX:+PerfDisableSharedMem','-XX:+UseStringDeduplication',
  '-XX:-DontCompileHugeMethods','-XX:+UseNUMA',
  '-Dlog4j2.formatMsgNoLookups=true',
  '-Dfml.ignorePatchDiscrepancies=true','-Dfml.ignoreInvalidMinecraftCertificates=true',
];

async function launchMinecraft(instance, account, settings, onLog, onClose) {
  const { VERSIONS_DIR, ASSETS_DIR, LIBRARIES_DIR, INSTANCES_DIR } = global.paths;
  const { mcVersion, loader, loaderVersion, id: instanceId } = instance;

  const instanceDir = path.join(INSTANCES_DIR, instanceId);
  const modsDir     = path.join(instanceDir, 'mods');
  [instanceDir, modsDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const versionJson = path.join(VERSIONS_DIR, mcVersion, `${mcVersion}.json`);
  if (!fs.existsSync(versionJson)) throw new Error(`Version ${mcVersion} not downloaded.`);
  const manifest = JSON.parse(fs.readFileSync(versionJson, 'utf8'));

  let fabricProfile = null;
  if ((loader === 'Fabric' || loader === 'Quilt') && loaderVersion) {
    const fabricId   = `${mcVersion}-fabric-${loaderVersion}`;
    const fabricJson = path.join(VERSIONS_DIR, fabricId, `${fabricId}.json`);
    if (fs.existsSync(fabricJson))
      fabricProfile = JSON.parse(fs.readFileSync(fabricJson, 'utf8'));
  }

  // Natives directory — use the one pre-extracted during download (in version dir)
  // This is where downloader.js puts them, keeping them per-version not per-instance
  const nativesDir = path.join(VERSIONS_DIR, mcVersion, 'natives');
  if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true });

  const classpath = buildClasspath(manifest, fabricProfile, VERSIONS_DIR, LIBRARIES_DIR, mcVersion);

  const mainClass  = fabricProfile?.mainClass || manifest.mainClass;
  const assetIndex = manifest.assetIndex.id;
  const ram        = settings.ram || 4;
  const javaPath   = (settings.javaPath && settings.javaPath.trim()) || findJava();
  const javaVer    = detectJavaVersion(javaPath);

  const { formatUuid } = require('../auth/microsoft');
  const safeAccount = { ...account, uuid: formatUuid(account.uuid) };

  const jvmArgs = [`-Xmx${ram}G`, `-Xms${ram}G`];

  if (settings.pvpFlags !== false) {
    const useZGC = javaVer >= 21 && ram >= 12;
    if (useZGC) {
      jvmArgs.push(...ZGC_FLAGS);
      onLog(`[Celery] GC: ZGC (Generational) — ${ram}GB on Java ${javaVer}\n`);
    } else {
      jvmArgs.push(...G1GC_FLAGS);
      if (javaVer < 20) jvmArgs.push('-XX:+AggressiveHeap');
      onLog(`[Celery] GC: G1GC — ${ram}GB on Java ${javaVer}\n`);
    }
  }

  jvmArgs.push(
    `-Djava.library.path=${nativesDir}`,
    `-Dorg.lwjgl.librarypath=${nativesDir}`,
    `-Dnet.java.games.input.librarypath=${nativesDir}`,
    `-Dminecraft.launcher.brand=CeleryLauncher`,
    `-Dminecraft.launcher.version=2.4.3`,
    `-Dfile.encoding=UTF-8`
  );

  if (settings.customJvmArgs) {
    jvmArgs.push(...settings.customJvmArgs.split(/\s+/).filter(Boolean));
  }

  const gameArgs = buildGameArgs(manifest, safeAccount, instanceDir, assetIndex, ASSETS_DIR, mcVersion);

  // Replace ${natives_directory} in game args if present
  const nativesDirReplaced = gameArgs.map(a => a.replace('${natives_directory}', nativesDir));

  const fullArgs = [...jvmArgs, '-cp', classpath, mainClass, ...nativesDirReplaced];

  onLog(`[Celery] Launching ${mcVersion} (${loader||'Vanilla'}) as ${safeAccount.username}\n`);
  onLog(`[Celery] Java ${javaVer} | RAM: ${ram}GB | Natives: ${nativesDir}\n`);

  const proc = spawn(javaPath, fullArgs, {
    cwd: instanceDir, detached: true, stdio: ['ignore','pipe','pipe']
  });

  proc.stdout.on('data', d => onLog(d.toString()));
  proc.stderr.on('data', d => onLog(d.toString()));
  proc.on('close', code => { onLog(`\n[Celery] Game exited (code ${code})\n`); onClose(code); });
  proc.on('error', err  => { onLog(`\n[Celery] Failed to start: ${err.message}\n`); onClose(-1); });
  proc.unref();
  return proc;
}

function buildClasspath(manifest, fabricProfile, versionsDir, librariesDir, mcVersion) {
  const sep   = process.platform === 'win32' ? ';' : ':';
  const paths = new Set();

  for (const lib of [...(manifest.libraries||[]), ...(fabricProfile?.libraries||[])]) {
    if (lib.rules) {
      const ok = lib.rules.every(r => {
        const os = r.os?.name;
        if (r.action==='allow')    return !os || os==='windows';
        if (r.action==='disallow') return !os || os!=='windows';
        return true;
      });
      if (!ok) continue;
    }
    // Skip native-only jars from classpath — they go in natives dir, not classpath
    if (lib.natives) continue;
    if (lib.name?.includes(':natives-')) continue;

    if (lib.downloads?.artifact) {
      const p = path.join(librariesDir, lib.downloads.artifact.path);
      if (fs.existsSync(p)) paths.add(p);
    } else if (lib.name) {
      const [g,a,v] = lib.name.split(':');
      if (v) {
        const full = path.join(librariesDir, `${g.replace(/\./g,'/')}/${a}/${v}/${a}-${v}.jar`);
        if (fs.existsSync(full)) paths.add(full);
      }
    }
  }

  const clientJar = path.join(versionsDir, mcVersion, `${mcVersion}.jar`);
  if (fs.existsSync(clientJar)) paths.add(clientJar);
  return [...paths].join(sep);
}

function buildGameArgs(manifest, account, gameDir, assetIndex, assetsDir, mcVersion) {
  const rep = {
    '${auth_player_name}':  account.username,
    '${version_name}':      mcVersion,
    '${game_directory}':    gameDir,
    '${assets_root}':       assetsDir,
    '${assets_index_name}': assetIndex,
    '${auth_uuid}':         account.uuid,
    '${auth_access_token}': account.mcToken,
    '${user_type}':         'msa',
    '${version_type}':      'release',
    '${resolution_width}':  '854',
    '${resolution_height}': '480'
  };
  const args = [];
  for (const arg of manifest.arguments?.game || manifest.minecraftArguments?.split(' ') || []) {
    if (typeof arg === 'string') {
      let r = arg;
      for (const [k,v] of Object.entries(rep)) r = r.replaceAll(k,v);
      args.push(r);
    } else if (arg?.rules) {
      const ok = arg.rules.every(r => r.action!=='allow'||!r.features);
      if (ok && arg.value) {
        const vals = Array.isArray(arg.value)?arg.value:[arg.value];
        for (let v of vals) {
          for (const [k,rv] of Object.entries(rep)) v=v.replaceAll(k,rv);
          args.push(v);
        }
      }
    }
  }
  return args;
}

function detectJavaVersion(javaPath) {
  try {
    const { execSync } = require('child_process');
    const out = execSync(`"${javaPath}" -version 2>&1`, { timeout:3000 }).toString();
    const m   = out.match(/version "(\d+)/);
    if (m) { const v=parseInt(m[1]); return v===1?parseInt(out.match(/version "1\.(\d+)/)?.[1]||'8'):v; }
  } catch {}
  return 21;
}

function findJava() {
  const envHome = process.env.JAVA_HOME;
  if (envHome) { const e=path.join(envHome,'bin','java.exe'); if(fs.existsSync(e)) return e; }
  const adoptBase = 'C:\\Program Files\\Eclipse Adoptium';
  if (fs.existsSync(adoptBase)) {
    for (const dir of fs.readdirSync(adoptBase).reverse()) {
      const e = path.join(adoptBase, dir, 'bin', 'java.exe');
      if (fs.existsSync(e)) return e;
    }
  }
  for (const c of [
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.6.7-hotspot\\bin\\java.exe',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe',
    'C:\\Program Files\\Microsoft\\jdk-21\\bin\\java.exe',
    'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
    'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
  ]) if (fs.existsSync(c)) return c;
  return 'java';
}

module.exports = { launchMinecraft };
