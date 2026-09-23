const { configured, send, PUBLISHABLE_KEY } = require('../lib/supabase');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  res.setHeader('Cache-Control', 'no-store');
  send(res, 200, {
    configured: configured(),
    url: configured() ? process.env.SUPABASE_URL : null,
    publishableKey: configured() ? PUBLISHABLE_KEY : null,
  });
};


