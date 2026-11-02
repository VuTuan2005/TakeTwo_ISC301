const app = require('../server');

module.exports = (req, res) => {
  // If Vercel stripped the /api prefix during rewrites, restore it so Express routes match
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};

