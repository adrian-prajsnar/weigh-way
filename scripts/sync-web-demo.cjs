const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const exportDir = path.join(root, 'dist', 'web-demo');
const publicDemoDir = path.join(root, 'website', 'public', 'demo');
const hasPolishDemo = (dir) => fs.existsSync(path.join(dir, 'pl', 'index.html'));

if (!fs.existsSync(path.join(exportDir, 'index.html'))) {
  if (!fs.existsSync(path.join(publicDemoDir, 'index.html'))) {
    console.warn(
      'Web demo not found. Run "node scripts/export-web-demo.cjs" from the project root to build it.',
    );
  }
  process.exit(0);
}

if (!hasPolishDemo(exportDir)) {
  console.warn('The web demo export is missing its Polish entry. Run "npm run export-web-demo" from the project root to refresh it.');
  if (hasPolishDemo(publicDemoDir)) {
    process.exit(0);
  }
}

fs.rmSync(publicDemoDir, { recursive: true, force: true });
fs.cpSync(exportDir, publicDemoDir, { recursive: true });
console.log(`Synced web demo to ${path.relative(root, publicDemoDir)}`);
