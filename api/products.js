const { configured, fail, send, supabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'method_not_allowed', 'GETのみ利用できます。');
  if (!configured()) return fail(res, 503, 'not_configured', 'Supabaseが未設定です。');
  try {
    const products = await supabase('/rest/v1/products?select=id,name,price_yen,image_path,is_active&is_active=eq.true&order=sort_order.asc');
    res.setHeader('Cache-Control', 'no-store');
    send(res, 200, { products });
  } catch {
    fail(res, 502, 'product_load_failed', '商品を読み込めませんでした。');
  }
};


