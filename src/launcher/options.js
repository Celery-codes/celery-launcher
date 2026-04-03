const fs   = require('fs');
const path = require('path');

function getProfilesDir() { return path.join(global.paths.DATA_DIR, 'option-profiles'); }

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
      try { return { id: f.replace('.json', ''), ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }; }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function saveProfile(profile) {
  const { id, ...data } = profile;
  fs.writeFileSync(path.join(ensureProfilesDir(), `${id}.json`), JSON.stringify(data, null, 2));
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
  for (const c of [path.join(instanceDir, 'options.txt'), path.join(instanceDir, '.minecraft', 'options.txt')]) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function captureProfileFromInstance(instanceId, profileName) {
  const { v4: uuidv4 } = require('uuid');
  const { INSTANCES_DIR } = global.paths;
  const instanceDir = path.join(INSTANCES_DIR, instanceId);

  let options = null, keybinds = null;
  const optPath = findOptionsFile(instanceId);
  if (optPath) options = fs.readFileSync(optPath, 'utf8');
  const kbPath = path.join(instanceDir, 'options_keys.txt');
  if (fs.existsSync(kbPath)) keybinds = fs.readFileSync(kbPath, 'utf8');

  // NEVER throw — always save the profile regardless of whether options.txt exists
  const profile = {
    id: uuidv4(),
    name: profileName,
    createdAt: new Date().toISOString(),
    options: options || '',
    keybinds: keybinds || '',
    hasOptions: !!options,
    capturedFrom: instanceId
  };
  saveProfile(profile);
  return profile;
}

function applyProfileToInstance(instanceId, profile) {
  const { INSTANCES_DIR } = global.paths;
  const instanceDir = path.join(INSTANCES_DIR, instanceId);
  if (!fs.existsSync(instanceDir)) fs.mkdirSync(instanceDir, { recursive: true });
  if (profile.options) {
    const existing = findOptionsFile(instanceId);
    fs.writeFileSync(existing || path.join(instanceDir, 'options.txt'), profile.options);
  }
  if (profile.keybinds) fs.writeFileSync(path.join(instanceDir, 'options_keys.txt'), profile.keybinds);
  return { success: true };
}

module.exports = { listProfiles, saveProfile, deleteProfile, captureProfileFromInstance, applyProfileToInstance };
