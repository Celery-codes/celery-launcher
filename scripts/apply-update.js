const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const PROJECT = path.resolve(__dirname, '..');

console.log('\n=== Celery Launcher Updater ===\n');
console.log('Project:', PROJECT);
console.log('');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Paste the full path to celery-launcher.zip then press Enter:\n> ', (zipPath) => {
  rl.close();

  zipPath = zipPath.trim().replace(/^"|"$/g, '');

  if (!fs.existsSync(zipPath)) {
    console.error('\nERROR: File not found:', zipPath);
    console.log('\nPress Enter to exit...');
    process.stdin.resume();
    process.stdin.once('data', () => process.exit(1));
    return;
  }

  console.log('\nFound zip. Extracting...');

  const tmp = path.join(PROJECT, '.update-tmp');
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true });
  fs.mkdirSync(tmp);

  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tmp.replace(/'/g, "''")}' -Force"`, { stdio: 'inherit' });
  } catch(e) {
    console.error('\nERROR: Extraction failed:', e.message);
    waitExit();
    return;
  }

  let src = path.join(tmp, 'celery-launcher');
  if (!fs.existsSync(src)) src = tmp;

  console.log('\nCopying files...\n');

  const PRESERVE = ['src/auth/microsoft.js'];

  let count = 0;
  copyDir(src, PROJECT, '');
  console.log('\n' + count + ' files updated.');
  fs.rmSync(tmp, { recursive: true });
  console.log('\n=== Done! Run START.bat to launch. ===\n');
  waitExit();

  function copyDir(from, to, rel) {
    if (!fs.existsSync(from)) return;
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      if (entry.name.startsWith('.update-tmp')) continue;
      const relPath = rel ? rel + '/' + entry.name : entry.name;
      const srcPath = path.join(from, entry.name);
      const dstPath = path.join(to, entry.name);
      if (entry.isDirectory()) {
        if (!fs.existsSync(dstPath)) fs.mkdirSync(dstPath, { recursive: true });
        copyDir(srcPath, dstPath, relPath);
      } else {
        if (PRESERVE.includes(relPath) && fs.existsSync(dstPath)) {
          console.log('  KEPT   ' + relPath);
          continue;
        }
        fs.mkdirSync(path.dirname(dstPath), { recursive: true });
        fs.copyFileSync(srcPath, dstPath);
        console.log('  copied ' + relPath);
        count++;
      }
    }
  }
});

function waitExit() {
  console.log('Press Enter to close...');
  const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl2.question('', () => { rl2.close(); process.exit(0); });
}
