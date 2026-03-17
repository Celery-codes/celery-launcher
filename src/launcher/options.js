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
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        return { id: f.replace('.json', ''), ...data };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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

function findOptionsFile(instanceId) {
  const { INSTANCES_DIR } = global.paths;
  const instanceDir = path.join(INSTANCES_DIR, instanceId);

  // Minecraft writes options.txt to the game directory (the instance folder itself)
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
  const { INSTANCES_DIR } = global.paths;
  const instanceDir = path.join(INSTANCES_DIR, instanceId);
  const result = { options: null, keybinds: null, optionsPath: null };

  const optPath = findOptionsFile(instanceId);
  if (optPath) {
    result.options = fs.readFileSync(optPath, 'utf8');
    result.optionsPath = optPath;
  }

  // options_keys.txt only exists in very old versions; keybinds are in options.txt otherwise
  const keybindPath = path.join(instanceDir, 'options_keys.txt');
  if (fs.existsSync(keybindPath)) {
    result.keybinds = fs.readFileSync(keybindPath, 'utf8');
  }

  return result;
}

function applyProfileToInstance(instanceId, profile) {
  const { INSTANCES_DIR } = global.paths;
  const instanceDir = path.join(INSTANCES_DIR, instanceId);
  if (!fs.existsSync(instanceDir)) fs.mkdirSync(instanceDir, { recursive: true });

  if (profile.options) {
    // Write to wherever options.txt already lives, or default location
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
  const current = readInstanceOptions(instanceId);

  if (!current.options) {
    // List what IS in the folder to help debug
    const { INSTANCES_DIR } = global.paths;
    const dir = path.join(INSTANCES_DIR, instanceId);
    const found = fs.existsSync(dir) ? fs.readdirSync(dir).slice(0, 10).join(', ') : 'folder not found';
    throw new Error(`options.txt not found in instance folder.\nFiles found: ${found}\nMake sure you launched the game at least once.`);
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
