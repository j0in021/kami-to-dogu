const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://demo.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'server-test-secret';
process.env.SUPABASE_PUBLISHABLE_KEY = 'public-test-key';

const placeOrder = require('../api/orders');
const adminOrders = require('../api/admin-orders');

function response() {
  return { statusCode: 200, headers: {}, body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(value) { this.body = value; return this; } };
}
function remote(value, status = 200) {
  return { ok: status >= 200 && status < 300, status,
    text: async () => JSON.stringify(value), json: async () => value };
}

test('order endpoint sends item IDs and quantities to database, never client price', async () => {
  let rpcBody;
  global.fetch = async (url, options) => {
    assert.match(url, /create_demo_order$/);
    rpcBody = JSON.parse(options.body);
    assert.equal(options.headers.apikey, 'server-test-secret');
    return remote({ id: 'order-1', total_yen: 680, status: 'pending' });
  };
  const res = response();
  await placeOrder({ method: 'POST', body: {
    order_key: '123e4567-e89b-42d3-a456-426614174000',
    customer_name: '山田 花子', customer_email: 'hanako@example.com',
    delivery_address: '架空県架空市一丁目',
    items: [{ product_id: 'notebook', quantity: 1, price_yen: 1 }],
  } }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(rpcBody.p_items, [{ product_id: 'notebook', quantity: 1 }]);
  assert.equal(res.body.order.total_yen, 680);
});

test('admin order list rejects a signed-in user without admin membership', async () => {
  global.fetch = async url => {
    if (url.endsWith('/auth/v1/user')) return remote({ id: 'user-1' });
    if (url.includes('/admin_users?')) return remote([]);
    throw new Error(`unexpected: ${url}`);
  };
  const res = response();
  await adminOrders({ method: 'GET', headers: { authorization: 'Bearer valid-token' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'admin_only');
});

test('admin status action requires membership and calls the transition function', async () => {
  let transition;
  global.fetch = async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return remote({ id: 'user-1' });
    if (url.includes('/admin_users?')) return remote([{ user_id: 'user-1' }]);
    if (url.endsWith('/set_demo_order_status')) {
      transition = JSON.parse(options.body);
      return remote({ id: transition.p_order_id, status: transition.p_new_status });
    }
    throw new Error(`unexpected: ${url}`);
  };
  const res = response();
  await adminOrders({ method: 'PATCH', headers: { authorization: 'Bearer valid-token' },
    body: { order_id: '123e4567-e89b-42d3-a456-426614174000', status: 'accepted' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(transition.p_new_status, 'accepted');
});

