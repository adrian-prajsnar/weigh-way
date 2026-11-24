import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

/** Vite dev server does not resolve directory indexes from public/demo. */
function demoIndexDevPlugin() {
  return {
    name: 'demo-index-dev',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [pathname, search = ''] = (req.url ?? '').split('?');
        const suffix = search ? `?${search}` : '';
        const demoPath = pathname.match(/^\/demo(?:\/pl)?\/?$/)?.[0];
        if (demoPath) {
          req.url = `${demoPath.replace(/\/$/, '')}/index.html${suffix}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  site: 'https://adrian-prajsnar.github.io',
  base: '/weigh-way',
  trailingSlash: 'always',
  integrations: [sitemap()],
  vite: {
    plugins: [demoIndexDevPlugin()],
  },
});
