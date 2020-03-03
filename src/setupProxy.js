const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
   app.use(
      '/files',
      createProxyMiddleware({
         target: 'http://localhost:3001',
         changeOrigin: true,
      })
   );
   app.use(
      "/books",
      createProxyMiddleware({
         target: 'http://localhost:3001',
         changeOrigin: true,
      })
   );
   app.use(
      "/auth",
      createProxyMiddleware({
         target: "http://localhost:3001",
         changeOrigin: true,
      })
   )
};