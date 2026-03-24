const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Register before SPA history fallback so GET /api/... (e.g. images opened in the
 * address bar) is proxied to Django instead of returning index.html.
 */
module.exports = function setupProxy(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
    })
  );
};
