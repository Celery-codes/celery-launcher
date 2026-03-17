const fetch = require('node-fetch');

const BASE = 'https://api.modrinth.com/v2';
const HEADERS = {
  'User-Agent': 'CeleryLauncher/2.0.0 (contact@celerylauncher.app)'
};

async function searchModrinth({ query = '', version = '', category = '', type = 'mod', limit = 20, offset = 0 }) {
  const facets = [];

  const typeMap = {
    mod: 'mod',
    resourcepack: 'resourcepack',
    modpack: 'modpack',
    shader: 'shader',
    datapack: 'datapack'
  };

  facets.push([`project_type:${typeMap[type] || 'mod'}`]);
  if (version) facets.push([`versions:${version}`]);
  if (category) facets.push([`categories:${category}`]);

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    index: query ? 'relevance' : 'downloads',
    facets: JSON.stringify(facets)
  });
  if (query) params.set('query', query);

  const res = await fetch(`${BASE}/search?${params}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Modrinth API error: ${res.status}`);
  const data = await res.json();

  return {
    hits: (data.hits || []).map(normalizeModrinthProject),
    total: data.total_hits,
    offset: data.offset,
    limit: data.limit
  };
}

async function getModrinthProject(id) {
  const res = await fetch(`${BASE}/project/${id}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Project not found: ${id}`);
  return normalizeModrinthProject(await res.json());
}

async function getModrinthVersions(projectId, mcVersion, loader) {
  const params = new URLSearchParams();
  if (mcVersion) params.set('game_versions', JSON.stringify([mcVersion]));
  if (loader) params.set('loaders', JSON.stringify([loader.toLowerCase()]));

  const res = await fetch(`${BASE}/project/${projectId}/version?${params}`, { headers: HEADERS });
  if (!res.ok) return [];
  const versions = await res.json();
  return versions.map(v => ({
    id: v.id,
    name: v.name,
    versionNumber: v.version_number,
    changelog: v.changelog,
    gameVersions: v.game_versions,
    loaders: v.loaders,
    datePublished: v.date_published,
    downloads: v.downloads,
    files: v.files.map(f => ({ url: f.url, filename: f.filename, primary: f.primary, size: f.size }))
  }));
}

async function getModrinthCategories() {
  const res = await fetch(`${BASE}/tag/category`, { headers: HEADERS });
  if (!res.ok) return [];
  return await res.json();
}

function normalizeModrinthProject(p) {
  return {
    id: p.project_id || p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    iconUrl: p.icon_url,
    downloads: p.downloads,
    follows: p.follows,
    categories: p.categories || [],
    versions: p.versions || [],
    gameVersions: p.game_versions || [],
    latestVersion: p.latest_version,
    license: p.license,
    source: 'modrinth',
    type: p.project_type,
    author: p.author,
    dateCreated: p.date_created,
    dateModified: p.date_modified,
    color: p.color
  };
}

module.exports = { searchModrinth, getModrinthProject, getModrinthVersions, getModrinthCategories };
