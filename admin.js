(() => {
  const el = id => document.getElementById(id);
  const safe = text => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const yen = amount => `¥${Number(amount).toLocaleString('ja-JP')}`;
  const labels = { pending: '未対応', accepted: '注文受付', rejected: '注文お断り', shipped: '発送完了' };
  let config = null;
  let token = null;

  async function setup() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('config');
      config = await response.json();
      if (!config.configured) throw new Error('config');
      el('setup-notice').textContent = '店側ログイン後、架空注文のみ表示します。';
    } catch {
      el('setup-notice').textContent = 'Supabaseの接続前です。アカウントとテスト用プロジェクトを設定するとログインできます。';
      el('login-button').disabled = true;
    }
  }

  el('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!config?.configured) return;
    const message = el('login-message'); message.textContent = '';
    const button = el('login-button'); button.disabled = true;
    try {
      const form = event.currentTarget;
      const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.elements.namedItem('email').value, password: form.elements.namedItem('password').value }),
      });
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error('メールアドレスまたはパスワードを確認してください。');
      token = data.access_token;
      await loadOrders();
      el('login-panel').classList.add('hidden');
      el('orders-panel').classList.remove('hidden');
      form.reset();
    } catch (error) {
      token = null;
      message.textContent = error.message || 'ログインに失敗しました。';
    } finally { button.disabled = false; }
  });

  async function loadOrders() {
    const response = await fetch('/api/admin-orders', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '注文を読み込めませんでした。');
    el('orders-message').textContent = '';
    el('orders-list').innerHTML = data.orders.length ? data.orders.map(order => {
      const actions = order.status === 'pending'
        ? `<button class="action" data-id="${safe(order.id)}" data-status="accepted">注文受付</button><button class="action danger" data-id="${safe(order.id)}" data-status="rejected">注文お断り</button>`
        : order.status === 'accepted'
          ? `<button class="action" data-id="${safe(order.id)}" data-status="shipped">発送完了</button>` : '';
      const items = (order.order_items || []).map(item => `<div><span>${safe(item.product_id)} × ${Number(item.quantity)}</span><b>${yen(item.unit_price_yen * item.quantity)}</b></div>`).join('');
      return `<article class="order"><div class="order-head"><div><div class="order-id">注文 ${safe(order.id)}</div><small>${safe(new Date(order.created_at).toLocaleString('ja-JP'))}</small></div><span class="status ${safe(order.status)}">${safe(labels[order.status] || order.status)}</span></div><div class="order-meta"><span>テスト名義：${safe(order.customer_name)}</span><span>合計：<b>${yen(order.total_yen)}</b></span></div><details><summary>注文内容と架空の届け先</summary><p>${safe(order.customer_email)}<br>${safe(order.delivery_address)}</p><div class="order-items">${items}</div></details><div class="order-actions">${actions}</div></article>`;
    }).join('') : '<p class="empty">まだ架空注文はありません。</p>';
  }

  el('orders-list').addEventListener('click', async event => {
    const button = event.target.closest('button[data-status]');
    if (!button || !token) return;
    const status = button.dataset.status;
    if (status === 'rejected' && !window.confirm('この架空注文を「お断り」に変更しますか？')) return;
    button.disabled = true;
    try {
      const response = await fetch('/api/admin-orders', {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: button.dataset.id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '変更できませんでした。');
      await loadOrders();
    } catch (error) {
      el('orders-message').textContent = error.message;
      button.disabled = false;
    }
  });
  el('refresh-button').addEventListener('click', () => loadOrders().catch(error => { el('orders-message').textContent = error.message; }));
  el('logout-button').addEventListener('click', () => {
    token = null;
    el('orders-panel').classList.add('hidden');
    el('login-panel').classList.remove('hidden');
    el('orders-list').replaceChildren();
    el('login-message').textContent = '';
  });
  setup();
})();
