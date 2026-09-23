const { configured, fail, send, supabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed', 'POSTのみ利用できます。');
  if (!configured()) return fail(res, 503, 'not_configured', 'Supabaseが未設定です。');
  const input = req.body || {};
  const items = input.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 20 ||
      items.some(item => !/^[a-z0-9-]{1,40}$/.test(item?.product_id || '') ||
        !Number.isInteger(item?.quantity) || item.quantity < 1 || item.quantity > 10)) {
    return fail(res, 400, 'invalid_items', '商品と数量を確認してください。');
  }
  if (new Set(items.map(item => item.product_id)).size !== items.length) {
    return fail(res, 400, 'duplicate_items', '同じ商品が重複しています。');
  }
  if (typeof input.customer_name !== 'string' || input.customer_name.trim().length < 1 || input.customer_name.length > 80 ||
      typeof input.customer_email !== 'string' || !/^[^\s@]+@example\.(com|test)$/.test(input.customer_email) ||
      typeof input.delivery_address !== 'string' || !input.delivery_address.trim().startsWith('架空') || input.delivery_address.length > 300 ||
      typeof input.order_key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.order_key)) {
    return fail(res, 400, 'invalid_customer', '架空住所とexample.comのテスト用メールを入力してください。');
  }
  try {
    const result = await supabase('/rest/v1/rpc/create_demo_order', {
      method: 'POST',
      body: {
        p_order_key: input.order_key,
        p_customer_name: input.customer_name.trim(),
        p_customer_email: input.customer_email.trim(),
        p_delivery_address: input.delivery_address.trim(),
        p_items: items.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
      },
    });
    res.setHeader('Cache-Control', 'no-store');
    send(res, 201, { order: result });
  } catch (error) {
    if (/invalid|inactive|quantity|product|demo/i.test(error.message || '')) {
      return fail(res, 400, 'order_rejected', '商品または数量を確認してください。');
    }
    fail(res, 502, 'order_save_failed', 'テスト注文を保存できませんでした。再試行してください。');
  }
};


