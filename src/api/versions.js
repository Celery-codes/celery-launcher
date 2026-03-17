const fetch = require('node-fetch');

const MC_MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC_META = 'https://meta.fabricmc.net/v2/versions/loader';
const FABRIC_GAME = 'https://meta.fabricmc.net/v2/versions/game';
const FORGE_MAVEN = 'https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json';
const NEOFORGE_META = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge';

async function fetchMcVersions() {
  const res = await fetch(MC_MANIFEST);
  const data = await res.json();
  const releases = data.versions.filter(v => v.type === 'release');
  const snapshots = data.versions.filter(v => v.type === 'snapshot').slice(0, 5);
  return {
    latest: data.latest.release,
    latestSnapshot: data.latest.snapshot,
    releases: releases.map(v => ({ id: v.id, type: v.type, url: v.url, releaseTime: v.releaseTime })),
    snapshots: snapshots.map(v => ({ id: v.id, type: v.type, url: v.url }))
  };
}

async function fetchFabricVersions(mcVersion) {
  const [loaderRes, gameRes] = await Promise.all([
    fetch(FABRIC_META),
    fetch(FABRIC_GAME)
  ]);
  const loaderData = await loaderRes.json();
  const gameData = await gameRes.json();

  const stableLoaders = loaderData.filter(v => v.stable).map(v => v.version);
  const allLoaders = loaderData.slice(0, 20).map(v => ({
    version: v.version,
    stable: v.stable
  }));

  const compatibleVersions = gameData.filter(v => v.stable).map(v => v.version);

  return {
    loaders: allLoaders,
    stableLoader: stableLoaders[0],
    compatibleGameVersions: compatibleVersions
  };
}

async function fetchForgeVersions(mcVersion) {
  try {
    const res = await fetch(FORGE_MAVEN);
    const data = await res.json();
    const versions = data[mcVersion] || [];
    return {
      versions: versions.slice(0, 10),
      recommended: versions[0] || null
    };
  } catch {
    return { versions: [], recommended: null };
  }
}

async function fetchNeoForgeVersions() {
  try {
    const res = await fetch(NEOFORGE_META);
    const data = await res.json();
    const versions = (data.versions || []).reverse().slice(0, 15);
    return { versions, latest: versions[0] || null };
  } catch {
    return { versions: [], latest: null };
  }
}

async function getVersionManifest(versionId) {
  const res = await fetch(MC_MANIFEST);
  const manifest = await res.json();
  const version = manifest.versions.find(v => v.id === versionId);
  if (!version) throw new Error(`Version ${versionId} not found`);
  const vRes = await fetch(version.url);
  return await vRes.json();
}

module.exports = { fetchMcVersions, fetchFabricVersions, fetchForgeVersions, fetchNeoForgeVersions, getVersionManifest };
