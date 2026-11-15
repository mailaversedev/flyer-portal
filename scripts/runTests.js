const { spawnSync } = require('node:child_process');

const npm = process.env.npm_execpath;
if (!npm) {
  console.error('Run this script through npm test.');
  process.exit(1);
}

function runSuite(args) {
  const result = spawnSync(process.execPath, [npm, 'run', ...args], { stdio: 'inherit' });
  if (result.error) {
    console.error('Failed to start test suite:', result.error);
  } else if (result.signal) {
    console.error(`Test suite terminated by ${result.signal}.`);
  }
  return result.status === 0;
}

const serverPassed = runSuite(['test:server']);
const frontendPassed = runSuite(['test:frontend', '--', '--watchAll=false', ...process.argv.slice(2)]);

process.exit(serverPassed && frontendPassed ? 0 : 1);
