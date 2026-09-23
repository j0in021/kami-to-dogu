(() => {
  const fallback = [
    { id: 'notebook', name: '方眼ノート', price_yen: 680, image_path: 'assets/notebook.jpg' },
    { id: 'pen', name: '細字ペン', price_yen: 420, image_path: 'assets/pen.jpg' },
    { id: 'pouch', name: '布製ポーチ', price_yen: 1480, image_path: 'assets/pouch.jpg' },
  ];
  const state = { products: fallback, cart: {}, connected: false, orderKey: null, busy: false };
  const yen = value => `¥${Number(value).toLocaleString('ja-JP')}`;
  const safe = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const byId = id => document.getElementById(id);
  try {
    const saved = JSON.parse(localStorage.getItem('paper-tools-cart-v1') || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [id, quantity] of Object.entries(saved)) {
        if (fallback.some(product => product.id === id) && Number.isInteger(quantity) && quantity > 0 && quantity <= 10) state.cart[id] = quantity;
      }
    }
  } catch {}

  const style = document.createElement('style');
  style.textContent = `
    button{cursor:pointer}.cart-drawer[hidden],.checkout-dialog[hidden]{display:none}
    .cart-drawer,.checkout-dialog{position:fixed;inset:0;z-index:900;background:#161a20b8;display:flex;justify-content:flex-end}
    .cart-panel{width:min(440px,100%);height:100%;overflow:auto;background:#fff;padding:28px;box-shadow:-12px 0 28px #0002}
    .cart-top,.cart-entry,.cart-sum{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .cart-top h2{margin:0;font-size:27px}.plain-icon{border:0;background:transparent;font-size:27px;line-height:1}
    .cart-entry{border-bottom:1px solid #ddd;padding:20px 0}.cart-entry img{width:68px;height:80px}.cart-entry>div{flex:1}.cart-entry strong{display:block}.cart-entry small{color:#555}
    .cart-qty{display:flex;align-items:center;gap:10px;margin-top:8px}.cart-qty button{border:1px solid #222;background:#fff;border-radius:50%;width:28px;height:28px}.cart-remove{border:0;background:transparent;text-decoration:underline;font-size:12px}
    .cart-sum{padding:22px 0;font-size:20px;font-weight:850}.wide-action{width:100%;justify-content:center;text-align:center;cursor:pointer}
    .checkout-dialog{align-items:center;justify-content:center;padding:16px;z-index:1100}.checkout-panel{width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border:2px solid #171a1f;padding:clamp(24px,4vw,42px);box-shadow:10px 10px 0 #171a1f}
    .checkout-panel h2{font-size:30px;margin:0 0 16px}.checkout-panel label{display:block;font-size:13px;font-weight:800;margin:15px 0 5px}.checkout-panel input,.checkout-panel textarea{display:block;width:100%;border:1.5px solid #777;padding:12px;font:inherit;border-radius:0}.checkout-panel textarea{min-height:74px;resize:vertical}.checkout-panel .cta{background:#ff6500;color:#161a20}
    .demo-alert{background:#fff1df;padding:12px;font-size:13px;font-weight:700}.checkout-lines{border-top:1px solid #ddd;border-bottom:1px solid #ddd;margin:20px 0;padding:10px 0}.checkout-lines div{display:flex;justify-content:space-between;padding:5px 0}.checkout-error{color:#a12e27;font-weight:700;min-height:1.5em}.checkout-success{background:#e8f7e9;padding:16px;line-height:1.7}.drawer-footer{margin-top:20px}.cart-open{cursor:pointer}
    @media(max-width:600px){.cart-panel{padding:20px}.checkout-panel{padding:22px;box-shadow:5px 5px 0 #171a1f}}
  `;
  document.head.append(style);

  const drawer = document.createElement('div');
  drawer.className = 'cart-drawer'; drawer.id = 'cart-drawer'; drawer.hidden = true;
  drawer.innerHTML = '<div class="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div class="cart-top"><h2 id="cart-title">お買い物かご</h2><button class="plain-icon" id="cart-close" type="button" aria-label="カートを閉じる">×</button></div><div id="cart-entries"></div><div class="drawer-footer"><div class="cart-sum"><span>小計</span><span id="cart-total">¥0</span></div><button type="button" class="cta wide-action" id="cart-checkout">決済確認へ</button></div></div>';
  document.body.append(drawer);
  const dialog = document.createElement('div');
  dialog.className = 'checkout-dialog'; dialog.id = 'checkout-dialog'; dialog.hidden = true;
  dialog.innerHTML = '<div class="checkout-panel" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><div class="cart-top"><h2 id="checkout-title">決済確認</h2><button class="plain-icon" id="checkout-close" type="button" aria-label="確認画面を閉じる">×</button></div><p class="demo-alert">これは学習用の模擬決済です。実際の課金や発送はありません。架空の氏名・住所だけを入力してください。</p><form id="demo-order-form"><label for="demo-name">お名前（架空）</label><input id="demo-name" name="name" required maxlength="80" autocomplete="off" placeholder="山田 花子"><label for="demo-email">メールアドレス（テスト用）</label><input id="demo-email" name="email" type="email" required maxlength="254" autocomplete="off" placeholder="hanako@example.com"><label for="demo-address">お届け先（架空）</label><textarea id="demo-address" name="address" required minlength="3" maxlength="300" placeholder="架空の住所を入力"></textarea><div class="checkout-lines" id="checkout-lines"></div><div class="cart-sum"><span>模擬決済額</span><span id="checkout-total">¥0</span></div><p class="checkout-error" id="checkout-error" role="alert"></p><button type="submit" class="cta wide-action" id="pay-demo">決済する（デモ）</button></form><div id="checkout-result" hidden></div></div>';
  document.body.append(dialog);

  function rows() { return Object.entries(state.cart).map(([id, quantity]) => ({ product: state.products.find(item => item.id === id), quantity })).filter(row => row.product); }
  function total() { return rows().reduce((sum, row) => sum + row.product.price_yen * row.quantity, 0); }
  function persist() { try { localStorage.setItem('paper-tools-cart-v1', JSON.stringify(state.cart)); } catch {} }
  function render() {
    const list = rows();
    byId('cart-entries').innerHTML = list.length ? list.map(({ product, quantity }) => `<div class="cart-entry"><img src="${safe(product.image_path)}" alt=""><div><strong>${safe(product.name)}</strong><small>${yen(product.price_yen)} × ${quantity}</small><div class="cart-qty"><button type="button" data-change="${safe(product.id)}" data-delta="-1" aria-label="${safe(product.name)}を減らす">−</button><span>${quantity}</span><button type="button" data-change="${safe(product.id)}" data-delta="1" aria-label="${safe(product.name)}を増やす">＋</button><button class="cart-remove" type="button" data-remove="${safe(product.id)}">削除</button></div></div><b>${yen(product.price_yen * quantity)}</b></div>`).join('') : '<p>カートは空です。商品を選んでください。</p>';
    byId('cart-total').textContent = yen(total());
    byId('cart-checkout').disabled = !list.length;
    byId('checkout-lines').innerHTML = list.map(({ product, quantity }) => `<div><span>${safe(product.name)} × ${quantity}</span><b>${yen(product.price_yen * quantity)}</b></div>`).join('');
    byId('checkout-total').textContent = yen(total());
    const count = list.reduce((n, row) => n + row.quantity, 0);
    document.querySelectorAll('.count').forEach(node => node.textContent = count);
    document.querySelectorAll('.order-total span:last-child').forEach(node => node.textContent = yen(total()));
  }
  function change(id, delta) {
    const current = state.cart[id] || 0;
    const next = current + delta;
    if (next <= 0) delete state.cart[id];
    else state.cart[id] = Math.min(next, 10);
    state.orderKey = null;
    persist(); render();
  }
  function show(element) { element.hidden = false; document.body.style.overflow = 'hidden'; element.querySelector('button')?.focus(); }
  function hide(element) { element.hidden = true; document.body.style.overflow = ''; }
  drawer.addEventListener('click', event => {
    const changeButton = event.target.closest('[data-change]');
    const removeButton = event.target.closest('[data-remove]');
    if (changeButton) change(changeButton.dataset.change, Number(changeButton.dataset.delta));
    if (removeButton) { delete state.cart[removeButton.dataset.remove]; state.orderKey = null; persist(); render(); }
    if (event.target === drawer || event.target.closest('#cart-close')) hide(drawer);
  });
  function openCheckout() {
    if (!rows().length) { show(drawer); return; }
    hide(drawer); render();
    byId('demo-order-form').hidden = false;
    byId('checkout-result').hidden = true;
    show(dialog);
  }
  byId('cart-checkout').addEventListener('click', openCheckout);
  byId('checkout-close').addEventListener('click', () => hide(dialog));
  dialog.addEventListener('click', event => { if (event.target === dialog) hide(dialog); });
  document.querySelectorAll('.product .add').forEach((button, index) => {
    button.addEventListener('click', () => { change(fallback[index].id, 1); show(drawer); });
  });
  document.querySelector('.detail-info .buy-row .cta')?.addEventListener('click', () => { change('notebook', 1); show(drawer); });
  document.querySelectorAll('.nav-actions .round').forEach(node => {
    if (node.getAttribute('aria-label') === 'カート') {
      node.setAttribute('role', 'button'); node.setAttribute('tabindex', '0'); node.classList.add('cart-open');
      node.addEventListener('click', () => show(drawer));
      node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show(drawer); } });
    }
  });
  document.querySelector('.checkout-preview .order-card .cta')?.addEventListener('click', openCheckout);

  byId('demo-order-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (state.busy || !rows().length) return;
    const error = byId('checkout-error'); error.textContent = '';
    if (!state.connected) { error.textContent = 'Supabase接続前のため保存できません。カートと確認画面だけ試せます。'; return; }
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    state.orderKey ||= crypto.randomUUID();
    const email = form.elements.namedItem('email').value.trim();
    const address = form.elements.namedItem('address').value.trim();
    if (!/^[^\s@]+@example\.(com|test)$/.test(email) || !address.startsWith('架空')) {
      error.textContent = 'メールはexample.com、住所は「架空」で始まるテスト値を入力してください。';
      return;
    }
    const payload = { order_key: state.orderKey, customer_name: form.elements.namedItem('name').value,
      customer_email: email, delivery_address: address,
      items: rows().map(({ product, quantity }) => ({ product_id: product.id, quantity })) };
    const button = byId('pay-demo'); state.busy = true; button.disabled = true; button.textContent = '保存中…';
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'テスト注文を保存できませんでした。');
      byId('demo-order-form').hidden = true;
      const box = byId('checkout-result'); box.hidden = false;
      box.className = 'checkout-success';
      box.textContent = `模擬決済が完了しました。実際の課金はありません。注文番号：${result.order.id}／合計：${yen(result.order.total_yen)}。店側管理画面で受付できます。`;
      state.cart = {}; state.orderKey = null; persist(); render();
    } catch (cause) { error.textContent = cause.message; }
    finally { state.busy = false; button.disabled = false; button.textContent = '決済する（デモ）'; }
  });

  async function loadProducts() {
    if (location.protocol === 'file:') { render(); return; }
    try {
      const response = await fetch('/api/products', { cache: 'no-store' });
      if (!response.ok) throw new Error('products');
      const data = await response.json();
      if (!Array.isArray(data.products)) throw new Error('products');
      state.products = data.products; state.connected = true;
      document.querySelectorAll('.product').forEach((card, index) => {
        const product = state.products.find(item => item.id === fallback[index].id);
        if (!product) { card.hidden = true; return; }
        card.querySelector('.product-name').textContent = product.name;
        card.querySelector('.price').textContent = yen(product.price_yen);
        card.querySelector('.product-img img').src = product.image_path;
      });
    } catch {
      state.connected = false;
      const notice = document.createElement('p'); notice.className = 'demo-alert';
      notice.textContent = '現在は見本表示です。Supabaseが未設定のため、テスト注文は保存されません。';
      document.querySelector('#products .wrap')?.prepend(notice);
    }
    render();
  }
  loadProducts();
})();
