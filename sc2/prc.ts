import fs from 'fs';
import path from 'path';

const resultsRoot = 'results';
const merged = 'allure-final';

if (fs.existsSync(merged)) fs.rmSync(merged, { recursive: true, force: true });
fs.mkdirSync(merged);

const runs = fs.readdirSync(resultsRoot).filter(d => d.startsWith('run-'));
for (const run of runs) {
  const folder = path.join(resultsRoot, run, 'allure-results');
  if (!fs.existsSync(folder)) continue;

  const files = fs.readdirSync(folder);
  for (const f of files) {
    const src = path.join(folder, f);
    let dest = path.join(merged, f);

    if (fs.existsSync(dest)) {
      const ext = path.extname(f);
      const base = path.basename(f, ext);
      dest = path.join(merged, `${base}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    }

    fs.copyFileSync(src, dest);
  }
}

console.log('✅ Allure results merged into', merged);
