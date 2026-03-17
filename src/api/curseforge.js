const fetch = require('node-fetch');

const BASE = 'https://api.curseforge.com/v1';

// CurseForge class IDs
const CLASS_IDS = {
  mod: 6,
  resourcepack: 12,
  modpack: 4471,
  shader: 6552
};

async function searchCurseForge({ query = '', version = '', category = '', classId, type = 'mod', limit = 20, key = '' }) {
  if (!key) {
    return { error: 'no_key', hits: [], total: 0 };
  }

  const headers = {
    'x-api-key': key,
    'Accept': 'application/json'
  };

  const params = new URLSearchParams({
    gameId: '432',
    classId: String(classId || CLASS_IDS[type] || 6),
    pageSize: String(limit),
    sortField: query ? '1' : '2',
    sortOrder: 'desc'
  });

  if (query) params.set('searchFilter', query);
  if (version) params.set('gameVersion', version);
  if (category) params.set('categoryId', String(category));

  const res = await fetch(`${BASE}/mods/search?${params}`, { headers });
  if (!res.ok) {
    if (res.status === 403) return { error: 'invalid_key', hits: [], total: 0 };
    throw new Error(`CurseForge API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    hits: (data.data || []).map(normalizeCFProject),
    total: data.pagination?.totalCount || 0
  };
}

async function getCFProjectVersions(modId, mcVersion, key) {
  if (!key) return [];
  const headers = { 'x-api-key': key, 'Accept': 'application/json' };
  const params = new URLSearchParams({ gameVersion: mcVersion });
  const res = await fetch(`${BASE}/mods/${modId}/files?${params}`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).slice(0, 5).map(f => ({
    id: String(f.id),
    name: f.displayName,
    filename: f.fileName,
    downloadUrl: f.downloadUrl,
    gameVersions: f.gameVersions,
    fileSize: f.fileLength,
    releaseType: f.releaseType,
    dateCreated: f.fileDate
  }));
}

function normalizeCFProject(p) {
  const logo = p.logo?.thumbnailUrl || p.logo?.url || null;
  return {
    id: String(p.id),
    slug: p.slug,
    title: p.name,
    description: p.summary,
    iconUrl: logo,
    downloads: p.downloadCount,
    follows: p.thumbsUpCount,
    categories: (p.categories || []).map(c => c.name),
    gameVersions: (p.latestFilesIndexes || []).map(f => f.gameVersion).filter(Boolean),
    source: 'curseforge',
    type: p.classId === 12 ? 'resourcepack' : p.classId === 4471 ? 'modpack' : 'mod',
    author: p.authors?.[0]?.name || '',
    websiteUrl: p.links?.websiteUrl || '',
    cfId: p.id
  };
}

module.exports = { searchCurseForge, getCFProjectVersions };
