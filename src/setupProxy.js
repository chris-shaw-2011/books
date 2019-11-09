const proxy = require('http-proxy-middleware');

module.exports = function (app) {
   app.use(
      '/files',
      proxy({
         target: 'http://localhost:3001',
         changeOrigin: true,
      })
   );
   app.use(
      "/books",
      proxy({
         target: 'http://localhost:3001',
         changeOrigin: true,
      })
   )
};