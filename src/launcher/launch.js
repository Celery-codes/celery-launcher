const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const AIKAR_FLAGS = [
  '-XX:+UseG1GC','-XX:+ParallelRefProcEnabled','-XX:MaxGCPauseMillis=200',
  '-XX:+UnlockExperimentalVMOptions','-XX:+DisableExplicitGC','-XX:+AlwaysPreTouch',
  '-XX:G1NewSizePercent=30','-XX:G1MaxNewSizePercent=40','-XX:G1HeapRegionSize=8M',
  '-XX:G1ReservePercent=20','-XX:G1HeapWastePercent=5','-XX:G1MixedGCCountTarget=4',
  '-XX:InitiatingHeapOccupancyPercent=15','-XX:G1MixedGCLiveThresholdPercent=90',
  '-XX:G1RSetUpdatingPauseTimePercent=5','-XX:SurvivorRatio=32',
  '-XX:+PerfDisableSharedMem','-XX:MaxTenuringThreshold=1',
  '-Dusing.aikars.flags=https://mcflags.emc.gs','-Daikars.new.flags=true'
];

async function launchMinecraft(instance, account, settings, onLog, onClose) {
  const { VERSIONS_DIR, ASSETS_DIR, LIBRARIES_DIR, INSTANCES_DIR } = global.paths;
  const { mcVersion, loader, loaderVersion, id: instanceId } = instance;

  // Always use instanceId as folder name — simple and consistent
  const instanceDir = path.join(INSTANCES_DIR, instanceId);
  const modsDir     = path.join(instanceDir, 'mods');
  const nativesDir  = path.join(instanceDir, 'natives');

  [instanceDir, modsDir, nativesDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const versionJson = path.join(VERSIONS_DIR, mcVersion, `${mcVersion}.json`);
  if (!fs.existsSync(versionJson)) throw new Error(`Version ${mcVersion} not downloaded.`);
  const manifest = JSON.parse(fs.readFileSync(versionJson, 'utf8'));

  let fabricProfile = null;
  if ((loader === 'Fabric' || loader === 'Quilt') && loaderVersion) {
    const fabricId   = `${mcVersion}-fabric-${loaderVersion}`;
    const fabricJson = path.join(VERSIONS_DIR, fabricId, `${fabricId}.json`);
    if (fs.existsSync(fabricJson)) fabricProfile = JSON.parse(fs.readFileSync(fabricJson, 'utf8'));
  }

  const classpath = buildClasspath(manifest, fabricProfile, VERSIONS_DIR, LIBRARIES_DIR, mcVersion);
  await extractNatives(manifest.libraries, LIBRARIES_DIR, nativesDir);

  const mainClass  = fabricProfile?.mainClass || manifest.mainClass;
  const assetIndex = manifest.assetIndex.id;
  const ram        = settings.ram || 4;
  const javaPath   = (settings.javaPath && settings.javaPath.trim()) || findJava();
  const javaVer    = detectJavaVersion(javaPath);

  // Ensure UUID has dashes — required by Minecraft session servers
  const { formatUuid } = require('../auth/microsoft');
  const safeAccount = { ...account, uuid: formatUuid(account.uuid) };

  const jvmArgs = [`-Xmx${ram}G`, `-Xms${ram}G`];
  if (settings.pvpFlags !== false) {
    jvmArgs.push(...AIKAR_FLAGS);
    if (javaVer < 20) jvmArgs.push('-XX:+AggressiveHeap');
    jvmArgs.push('-XX:+UseStringDeduplication','-XX:+OptimizeStringConcat',
      '-Dlog4j2.formatMsgNoLookups=true','-Dfml.ignorePatchDiscrepancies=true',
      '-Dfml.ignoreInvalidMinecraftCertificates=true');
  }
  jvmArgs.push(
    `-Djava.library.path=${nativesDir}`,
    `-Dminecraft.launcher.brand=CeleryLauncher`,
    `-Dminecraft.launcher.version=2.1.0`,
    `-Dfile.encoding=UTF-8`
  );
  if (settings.customJvmArgs) jvmArgs.push(...settings.customJvmArgs.split(/\s+/).filter(Boolean));

  const gameArgs = buildGameArgs(manifest, safeAccount, instanceDir, assetIndex, ASSETS_DIR, mcVersion);
  const fullArgs = [...jvmArgs, '-cp', classpath, mainClass, ...gameArgs];

  onLog(`[Celery] Launching ${mcVersion} (${loader||'Vanilla'}) as ${safeAccount.username}\n`);
  onLog(`[Celery] Java: ${javaPath} (v${javaVer}) | RAM: ${ram}GB\n`);

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
  const sep = process.platform === 'win32' ? ';' : ':';
  const paths = new Set();
  for (const lib of [...(manifest.libraries||[]),...(fabricProfile?.libraries||[])]) {
    if (lib.rules) {
      const ok = lib.rules.every(r => { const os=r.os?.name; if(r.action==='allow') return !os||os==='windows'; if(r.action==='disallow') return !os||os!=='windows'; return true; });
      if (!ok) continue;
    }
    if (lib.downloads?.artifact) { const p=path.join(librariesDir,lib.downloads.artifact.path); if(fs.existsSync(p)) paths.add(p); }
    else if (lib.name) {
      const [g,a,v]=lib.name.split(':');
      if(v){const full=path.join(librariesDir,`${g.replace(/\./g,'/')}/${a}/${v}/${a}-${v}.jar`);if(fs.existsSync(full))paths.add(full);}
    }
  }
  const clientJar=path.join(versionsDir,mcVersion,`${mcVersion}.jar`);
  if(fs.existsSync(clientJar))paths.add(clientJar);
  return [...paths].join(sep);
}

async function extractNatives(libraries, librariesDir, nativesDir) {
  const extract = require('extract-zip');
  for (const lib of libraries) {
    if (!lib.natives) continue;
    const classifier = lib.natives['windows']||lib.natives['windows-64'];
    if (!classifier) continue;
    const artifact = lib.downloads?.classifiers?.[classifier];
    if (!artifact) continue;
    const libPath = path.join(librariesDir, artifact.path);
    if (!fs.existsSync(libPath)) continue;
    try { await extract(libPath,{dir:nativesDir,onEntry:e=>{if(e.fileName.includes('META-INF'))e.autodrain();}}); } catch {}
  }
}

function buildGameArgs(manifest, account, gameDir, assetIndex, assetsDir, mcVersion) {
  const rep = {
    '${auth_player_name}':account.username,'${version_name}':mcVersion,
    '${game_directory}':gameDir,'${assets_root}':assetsDir,
    '${assets_index_name}':assetIndex,'${auth_uuid}':account.uuid,
    '${auth_access_token}':account.mcToken,'${user_type}':'msa',
    '${version_type}':'release','${resolution_width}':'854','${resolution_height}':'480'
  };
  const args=[];
  for (const arg of manifest.arguments?.game||manifest.minecraftArguments?.split(' ')||[]) {
    if(typeof arg==='string'){let r=arg;for(const[k,v]of Object.entries(rep))r=r.replaceAll(k,v);args.push(r);}
    else if(arg?.rules){const ok=arg.rules.every(r=>r.action!=='allow'||!r.features);if(ok&&arg.value){const vals=Array.isArray(arg.value)?arg.value:[arg.value];for(let v of vals){for(const[k,rv]of Object.entries(rep))v=v.replaceAll(k,rv);args.push(v);}}}
  }
  return args;
}

function detectJavaVersion(javaPath) {
  try {
    const {execSync}=require('child_process');
    const out=execSync(`"${javaPath}" -version 2>&1`,{timeout:3000}).toString();
    const m=out.match(/version "(\d+)/);
    if(m){const v=parseInt(m[1]);return v===1?parseInt(out.match(/version "1\.(\d+)/)?.[1]||'8'):v;}
  } catch {}
  return 21;
}

function findJava() {
  const envHome=process.env.JAVA_HOME;
  if(envHome){const e=path.join(envHome,'bin','java.exe');if(fs.existsSync(e))return e;}
  const adoptBase='C:\\Program Files\\Eclipse Adoptium';
  if(fs.existsSync(adoptBase)){
    for(const dir of fs.readdirSync(adoptBase).reverse()){
      const e=path.join(adoptBase,dir,'bin','java.exe');if(fs.existsSync(e))return e;
    }
  }
  for(const c of[
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.6.7-hotspot\\bin\\java.exe',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe',
    'C:\\Program Files\\Microsoft\\jdk-21\\bin\\java.exe',
    'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
    'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
  ])if(fs.existsSync(c))return c;
  return 'java';
}

module.exports = { launchMinecraft };
