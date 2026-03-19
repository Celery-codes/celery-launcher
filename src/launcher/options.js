const fs = require('fs');
const path = require('path');

function getProfilesDir() {
  return path.join(global.paths.DATA_DIR, 'option-profiles');
}

function ensureProfilesDir() {
  const dir = getProfilesDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listProfiles() {
  const dir = ensureProfilesDir();
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return { id: f.replace('.json',''), ...JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')) }; }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function saveProfile(profile) {
  const dir = ensureProfilesDir();
  const { id, ...data } = profile;
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(data, null, 2));
  return { success: true };
}

function deleteProfile(id) {
  const file = path.join(ensureProfilesDir(), `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return { success: true };
}

// Get the actual folder path for an instance — uses name-based folder if it exists,
// falls back to ID-based folder for backwards compatibility
function getInstanceDir(instanceId) {
  const { INSTANCES_DIR } = global.paths;
  const Store = require('electron-store');
  const store = new Store();
  const instances = store.get('instances', []);
  const inst = instances.find(i => i.id === instanceId);

  if (inst) {
    const safe = inst.name.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_').slice(0, 50);
    const nameDir = path.join(INSTANCES_DIR, safe || inst.id);
    if (fs.existsSync(nameDir)) return nameDir;
  }

  // Fall back to ID-based folder
  return path.join(INSTANCES_DIR, instanceId);
}

function findOptionsFile(instanceId) {
  const instanceDir = getInstanceDir(instanceId);
  const candidates = [
    path.join(instanceDir, 'options.txt'),
    path.join(instanceDir, '.minecraft', 'options.txt'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function readInstanceOptions(instanceId) {
  const instanceDir = getInstanceDir(instanceId);
  const result = { options: null, keybinds: null, optionsPath: null };

  const optPath = findOptionsFile(instanceId);
  if (optPath) {
    result.options = fs.readFileSync(optPath, 'utf8');
    result.optionsPath = optPath;
  }

  const keybindPath = path.join(instanceDir, 'options_keys.txt');
  if (fs.existsSync(keybindPath)) {
    result.keybinds = fs.readFileSync(keybindPath, 'utf8');
  }

  return result;
}

function applyProfileToInstance(instanceId, profile) {
  const instanceDir = getInstanceDir(instanceId);
  if (!fs.existsSync(instanceDir)) fs.mkdirSync(instanceDir, { recursive: true });

  if (profile.options) {
    const existing = findOptionsFile(instanceId);
    const dest = existing || path.join(instanceDir, 'options.txt');
    fs.writeFileSync(dest, profile.options);
  }
  if (profile.keybinds) {
    fs.writeFileSync(path.join(instanceDir, 'options_keys.txt'), profile.keybinds);
  }
  return { success: true };
}

function captureProfileFromInstance(instanceId, profileName) {
  const { v4: uuidv4 } = require('uuid');
  const instanceDir = getInstanceDir(instanceId);
  const current = readInstanceOptions(instanceId);

  if (!current.options) {
    const found = fs.existsSync(instanceDir)
      ? fs.readdirSync(instanceDir).slice(0, 10).join(', ')
      : 'folder not found';
    throw new Error(`options.txt not found.\nFiles found: ${found}\nLaunch the game at least once first.`);
  }

  const profile = {
    id: uuidv4(),
    name: profileName,
    createdAt: new Date().toISOString(),
    options: current.options || '',
    keybinds: current.keybinds || '',
    capturedFrom: instanceId
  };
  saveProfile(profile);
  return profile;
}

module.exports = {
  listProfiles, saveProfile, deleteProfile,
  readInstanceOptions, applyProfileToInstance, captureProfileFromInstance
};
