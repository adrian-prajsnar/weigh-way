import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

/** Vite dev server does not resolve public/demo/index.html for /demo/ requests. */
function demoIndexDevPlugin() {
  return {
    name: 'demo-index-dev',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [pathname, search = ''] = (req.url ?? '').split('?');
        const suffix = search ? `?${search}` : '';
        if (pathname === '/demo' || pathname === '/demo/') {
          req.url = `/demo/index.html${suffix}`;
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
