const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const exportDir = path.join(root, 'dist', 'web-demo');
const publicDemoDir = path.join(root, 'website', 'public', 'demo');

if (!fs.existsSync(path.join(exportDir, 'index.html'))) {
  if (!fs.existsSync(path.join(publicDemoDir, 'index.html'))) {
    console.warn(
      'Web demo not found. Run "node scripts/export-web-demo.cjs" from the project root to build it.',
    );
  }
  process.exit(0);
}

fs.rmSync(publicDemoDir, { recursive: true, force: true });
fs.cpSync(exportDir, publicDemoDir, { recursive: true });
console.log(`Synced web demo to ${path.relative(root, publicDemoDir)}`);
