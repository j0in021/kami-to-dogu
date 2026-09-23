const { configured, fail, requireAdmin, send, supabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (!configured()) return fail(res, 503, 'not_configured', 'Supabaseが未設定です。');
  if (!(await requireAdmin(req, res))) return;
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const orders = await supabase('/rest/v1/orders?select=id,created_at,status,total_yen,customer_name,customer_email,delivery_address,order_items(product_id,quantity,unit_price_yen)&order=created_at.desc&limit=100');
      return send(res, 200, { orders });
    }
    if (req.method === 'PATCH') {
      const { order_id, status } = req.body || {};
      if (typeof order_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(order_id) ||
          !['accepted', 'rejected', 'shipped'].includes(status)) {
        return fail(res, 400, 'invalid_change', '注文と変更先を確認してください。');
      }
      const result = await supabase('/rest/v1/rpc/set_demo_order_status', {
        method: 'POST', body: { p_order_id: order_id, p_new_status: status },
      });
      return send(res, 200, { order: result });
    }
    return fail(res, 405, 'method_not_allowed', 'GETまたはPATCHのみ利用できます。');
  } catch (error) {
    if (/transition|not found/i.test(error.message || '')) {
      return fail(res, 409, 'invalid_transition', '注文の状態が変わっています。再読み込みしてください。');
    }
    return fail(res, 502, 'admin_request_failed', '注文情報を更新できませんでした。');
  }
};


