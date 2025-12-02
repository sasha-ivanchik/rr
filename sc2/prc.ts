const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function timestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-');
}

const runDir = path.join('results', `run-${timestamp()}`);
fs.mkdirSync(runDir, { recursive: true });

const passedArgs = process.argv.slice(2).join(' ');

console.log(`📂 Writing results into: ${runDir}`);

execSync(`npx playwright test ${passedArgs} --output=${runDir}`, { stdio: 'inherit' });
