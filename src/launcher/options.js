const fs   = require('fs');
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
      try { const d=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')); return {id:f.replace('.json',''),...d}; }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
}

function saveProfile(profile) {
  const dir = ensureProfilesDir();
  const { id, ...data } = profile;
  fs.writeFileSync(path.join(dir,`${id}.json`), JSON.stringify(data,null,2));
  return { success: true };
}

function deleteProfile(id) {
  const file = path.join(ensureProfilesDir(),`${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return { success: true };
}

function findOptionsFile(instanceId) {
  const { INSTANCES_DIR } = global.paths;
  const instanceDir = path.join(INSTANCES_DIR, instanceId);
  for (const c of [
    path.join(instanceDir, 'options.txt'),
    path.join(instanceDir, '.minecraft', 'options.txt'),
  ]) { if (fs.existsSync(c)) return c; }
  return null;
}

function readInstanceOptions(instanceId) {
  const { INSTANCES_DIR } = global.paths;
  const instanceDir = path.join(INSTANCES_DIR, instanceId);
  const result = { options: null, keybinds: null, optionsPath: null };
  const optPath = findOptionsFile(instanceId);
  if (optPath) { result.options=fs.readFileSync(optPath,'utf8'); result.optionsPath=optPath; }
  const keybindPath = path.join(instanceDir,'options_keys.txt');
  if (fs.existsSync(keybindPath)) result.keybinds = fs.readFileSync(keybindPath,'utf8');
  return result;
}

function captureProfileFromInstance(instanceId, profileName) {
  const { v4: uuidv4 } = require('uuid');
  const current = readInstanceOptions(instanceId);

  // Instead of throwing, save whatever we have — even a blank profile is valid
  // The user can use it as a template or apply it later
  const profile = {
    id: uuidv4(),
    name: profileName,
    createdAt: new Date().toISOString(),
    options:  current.options  || '',
    keybinds: current.keybinds || '',
    capturedFrom: instanceId,
    hasOptions: !!current.options
  };

  saveProfile(profile);
  return profile;
}

function applyProfileToInstance(instanceId, profile) {
  const { INSTANCES_DIR } = global.paths;
  const instanceDir = path.join(INSTANCES_DIR, instanceId);
  if (!fs.existsSync(instanceDir)) fs.mkdirSync(instanceDir,{recursive:true});

  if (profile.options) {
    const existing = findOptionsFile(instanceId);
    const dest = existing || path.join(instanceDir,'options.txt');
    fs.writeFileSync(dest, profile.options);
  }
  if (profile.keybinds) {
    fs.writeFileSync(path.join(instanceDir,'options_keys.txt'), profile.keybinds);
  }
  return { success: true };
}

module.exports = {
  listProfiles, saveProfile, deleteProfile,
  readInstanceOptions, applyProfileToInstance, captureProfileFromInstance
};
