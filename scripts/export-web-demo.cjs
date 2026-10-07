const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const exportDir = path.join(root, 'dist', 'web-demo');
const publicDemoDir = path.join(root, 'website', 'public', 'demo');

function syncDemoToWebsitePublic() {
  fs.rmSync(publicDemoDir, { recursive: true, force: true });
  fs.cpSync(exportDir, publicDemoDir, { recursive: true });
  console.log(`Copied web demo to ${path.relative(root, publicDemoDir)}`);
}

const env = {
  ...process.env,
  EXPO_PUBLIC_DEMO: 'true',
  EXPO_PUBLIC_DEV: 'false',
  EXPO_PUBLIC_SUPABASE_URL: 'https://demo.invalid',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'demo-public-anon-key',
};

const result = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist/web-demo'], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!fs.existsSync(path.join(exportDir, 'index.html'))) {
  console.error('Web demo export did not write index.html');
  process.exit(1);
}

syncDemoToWebsitePublic();
