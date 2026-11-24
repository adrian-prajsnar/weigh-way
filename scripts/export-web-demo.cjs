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

const indexPath = path.join(exportDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('Web demo export did not write index.html');
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');
const noscript = /<noscript>[\s\S]*?<\/noscript>/;
if (!html.includes('</head>')) {
  throw new Error('Web demo export is missing the closing head tag');
}
if (!noscript.test(html) || !html.includes('<html lang="en">')) {
  throw new Error('Web demo export is missing the expected language or noscript markup');
}

function renderDemoPage(lang, fallback) {
  return html
    .replace('<html lang="en">', `<html lang="${lang}">`)
    .replace(noscript, `<noscript><main>${fallback}</main></noscript>`)
    .replace(
      '</head>',
      '<meta name="robots" content="noindex" /><noscript><style>body { overflow: auto; } #root { display: none; }</style></noscript></head>',
    );
}

fs.writeFileSync(
  indexPath,
  renderDemoPage('en', `
    <h1>WeighWay demo</h1>
    <p>Enable JavaScript to use the interactive demo.</p>
    <p><a href="../">Back to WeighWay</a></p>
    <p><a href="pl/" lang="pl" hreflang="pl">Polski</a></p>
  `),
);

const polishDir = path.join(exportDir, 'pl');
fs.mkdirSync(polishDir, { recursive: true });
fs.writeFileSync(
  path.join(polishDir, 'index.html'),
  renderDemoPage('pl', `
    <h1>Demo WeighWay</h1>
    <p>Włącz JavaScript, aby skorzystać z interaktywnego demo.</p>
    <p><a href="../../pl/">Wróć na stronę WeighWay</a></p>
    <p><a href="../?lang=en" lang="en" hreflang="en">English</a></p>
  `),
);

syncDemoToWebsitePublic();
