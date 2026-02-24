const TOKEN_KEY = 'lafamilia_token';

const api = async (path, method = 'GET', body) => {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Fehler');
  return data;
};

const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

function setupNav() {
  const menu = document.getElementById('menu-toggle');
  const nav = document.getElementById('site-nav');
  const logout = document.getElementById('logout-btn');
  if (menu && nav) menu.onclick = () => nav.classList.toggle('open');
  if (logout) logout.onclick = async () => {
    try { await api('/api/logout', 'POST', { token: getToken() }); } catch {}
    clearToken();
    location.href = 'auth.html';
  };
}

function setupAuthPage() {
  const msg = document.getElementById('auth-message');
  if (!msg) return;

  const setTab = (tab) => {
    document.querySelectorAll('[data-auth-tab]').forEach((b) => b.classList.toggle('active', b.dataset.authTab === tab));
    document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('active'));
    if (tab === 'login') document.getElementById('login-form').classList.add('active');
    if (tab === 'register') document.getElementById('register-form').classList.add('active');
    if (tab === 'guest') document.getElementById('guest-pane').classList.add('active');
    msg.textContent = '';
  };

  document.querySelectorAll('[data-auth-tab]').forEach((btn) => btn.onclick = () => setTab(btn.dataset.authTab));

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    try {
      const data = await api('/api/login', 'POST', { username: d.get('username'), password: d.get('password') });
      setToken(data.token); location.href = 'index.html';
    } catch (err) { msg.textContent = err.message; }
  };

  document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    try {
      const data = await api('/api/register', 'POST', {
        username: d.get('username'), password: d.get('password'), origin: d.get('origin'), state: d.get('state'),
      });
      setToken(data.token); location.href = 'index.html';
    } catch (err) { msg.textContent = err.message; }
  };

  document.getElementById('continue-guest').onclick = async () => {
    const data = await api('/api/guest', 'POST', {});
    setToken(data.token); location.href = 'index.html';
  };
}

async function enforceSession() {
  if (location.pathname.endsWith('auth.html') || location.pathname === '/auth.html') return;
  const token = getToken();
  if (!token) { location.href = 'auth.html'; return null; }
  const { session } = await api(`/api/session?token=${encodeURIComponent(token)}`);
  if (!session) { clearToken(); location.href = 'auth.html'; return null; }
  document.body.classList.toggle('is-guest', session.mode === 'guest');
  return session;
}

function initMap(session) {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  const map = L.map('map', { scrollWheelZoom: false, zoomControl: true, minZoom: 5, maxZoom: 12 }).setView([51.2, 10.45], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
  [
    ['Berlin', [52.52, 13.405], 'Reggaeton Night'],
    ['Hamburg', [53.5511, 9.9937], 'Salsa Social'],
    ['Köln', [50.9375, 6.9603], 'Latin Street Food']
  ].forEach(([city, coords, title]) => L.marker(coords).addTo(map).bindPopup(`<strong>${title}</strong><br>${city}`));
  if (session.mode === 'guest') map.dragging.disable();
}

async function initGallery(session) {
  const form = document.getElementById('gallery-form');
  if (!form) return;
  const approved = document.getElementById('approved-list');
  const pending = document.getElementById('pending-list');
  const review = document.getElementById('admin-review');

  const render = async () => {
    const { items, isAdmin } = await api(`/api/gallery?token=${encodeURIComponent(getToken())}`);
    approved.innerHTML = ''; pending.innerHTML = ''; review.innerHTML = '';
    items.filter(i => i.status === 'approved').forEach(i => { const li = document.createElement('li'); li.textContent = `${i.file_name} – @${i.username}`; approved.appendChild(li); });
    items.filter(i => i.status === 'pending').forEach(i => {
      const li = document.createElement('li'); li.textContent = `${i.file_name} – wartet`; pending.appendChild(li);
      if (isAdmin) {
        const d = document.createElement('div'); d.className = 'admin-item'; d.innerHTML = `<strong>${i.file_name}</strong> von @${i.username}`;
        const a = document.createElement('button'); a.className = 'btn tiny'; a.textContent = 'Freigeben'; a.onclick = async () => { await api('/api/gallery/moderate', 'POST', { token: getToken(), id: i.id, status: 'approved' }); render(); };
        const r = document.createElement('button'); r.className = 'btn tiny ghost'; r.textContent = 'Ablehnen'; r.onclick = async () => { await api('/api/gallery/moderate', 'POST', { token: getToken(), id: i.id, status: 'rejected' }); render(); };
        d.append(a, r); review.appendChild(d);
      }
    });
    if (!approved.children.length) approved.innerHTML = '<li>Noch keine freigegebenen Bilder.</li>';
    if (!pending.children.length) pending.innerHTML = '<li>Keine offenen Uploads.</li>';
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (session.mode === 'guest') return;
    const file = form.querySelector('input[name="image"]').files?.[0];
    if (!file) return;
    await api('/api/gallery/upload', 'POST', { token: getToken(), fileName: file.name });
    form.reset();
    render();
  };

  render();
}

(async function init() {
  setupNav();
  setupAuthPage();
  const session = await enforceSession();
  if (!session) return;
  initMap(session);
  initGallery(session);
})();
