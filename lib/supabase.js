const PROJECT_URL = process.env.SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

function configured() {
  return Boolean(PROJECT_URL && SECRET_KEY && PUBLISHABLE_KEY);
}

function send(res, status, body) {
  res.status(status).json(body);
}

function fail(res, status, code, message) {
  send(res, status, { error: code, message });
}

async function supabase(path, { method = 'GET', body, jwt, prefer } = {}) {
  if (!configured()) throw new Error('Supabase is not configured');
  const headers = { apikey: SECRET_KEY, Accept: 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${PROJECT_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.error_description || `Supabase HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function requireAdmin(req, res) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!match) { fail(res, 401, 'login_required', '店側のログインが必要です。'); return null; }
  if (!configured()) { fail(res, 503, 'not_configured', 'Supabaseが未設定です。'); return null; }
  try {
    const userResponse = await fetch(`${PROJECT_URL}/auth/v1/user`, {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${match[1]}` },
    });
    if (!userResponse.ok) { fail(res, 401, 'invalid_session', 'ログインし直してください。'); return null; }
    const user = await userResponse.json();
    if (!user?.id) { fail(res, 401, 'invalid_session', 'ログインし直してください。'); return null; }
    const admins = await supabase(`/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
    if (!Array.isArray(admins) || admins.length === 0) {
      fail(res, 403, 'admin_only', 'このアカウントには管理権限がありません。');
      return null;
    }
    return user;
  } catch {
    fail(res, 502, 'auth_unavailable', '認証の確認に失敗しました。');
    return null;
  }
}

module.exports = { configured, fail, requireAdmin, send, supabase, PUBLISHABLE_KEY };

