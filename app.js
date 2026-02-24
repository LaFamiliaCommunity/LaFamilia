const TOKEN_KEY = 'lafamilia_token';
const LS_USERS_KEY = 'lafamilia_users_fallback';
const LS_SESSION_KEY = 'lafamilia_session_fallback';
const LS_GALLERY_KEY = 'lafamilia_gallery_fallback';
const ADMIN_USERS = ['admin', 'giovanni', 'giovanni_mogito'];

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

let backendAvailable = true;

const api = async (path, method = 'GET', body) => {
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = res.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await res.json() : {};

    if (!res.ok) throw new Error(payload.error || 'Fehler');
    backendAvailable = true;
    return payload;
  } catch (err) {
    backendAvailable = false;
    throw err;
  }
};

function fallbackRegister({ username, password, origin, state }) {
  const users = readJSON(LS_USERS_KEY, []);
  if (users.some((u) => u.username.toLowerCase() === String(username).toLowerCase())) {
    throw new Error('Username ist schon vergeben.');
  }
  const user = { username: String(username).trim(), password: String(password), origin: String(origin).trim(), state: String(state).trim() };
  users.push(user);
  writeJSON(LS_USERS_KEY, users);
  const session = { mode: 'user', username: user.username };
  writeJSON(LS_SESSION_KEY, session);
  setToken(`fallback:${user.username}`);
  return { token: getToken(), username: user.username, mode: 'user' };
}

function fallbackLogin({ username, password }) {
  const users = readJSON(LS_USERS_KEY, []);
  const found = users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!found) throw new Error('Konto existiert nicht.');
  if (found.password !== String(password)) throw new Error('Code/Passwort ist falsch.');
  const session = { mode: 'user', username: found.username };
  writeJSON(LS_SESSION_KEY, session);
  setToken(`fallback:${found.username}`);
  return { token: getToken(), username: found.username, mode: 'user' };
}

function fallbackGuest() {
  const session = { mode: 'guest', username: 'guest' };
  writeJSON(LS_SESSION_KEY, session);
  setToken('fallback:guest');
  return { token: 'fallback:guest', username: 'guest', mode: 'guest' };
}

function fallbackSession() {
  return readJSON(LS_SESSION_KEY, null);
}

function fallbackLogout() {
  localStorage.removeItem(LS_SESSION_KEY);
  clearToken();
}

function fallbackGalleryList(session) {
  const items = readJSON(LS_GALLERY_KEY, []);
  const isAdmin = !!session && session.mode === 'user' && ADMIN_USERS.includes(String(session.username).toLowerCase());
  return { items, isAdmin };
}

function fallbackGalleryUpload(session, fileName) {
  if (!session || session.mode !== 'user') throw new Error('Bitte anmelden.');
  const items = readJSON(LS_GALLERY_KEY, []);
  items.unshift({ id: Date.now(), username: session.username, file_name: fileName, status: 'pending' });
  writeJSON(LS_GALLERY_KEY, items);
}

function fallbackGalleryModerate(session, id, status) {
  const isAdmin = !!session && session.mode === 'user' && ADMIN_USERS.includes(String(session.username).toLowerCase());
  if (!isAdmin) throw new Error('Nur Admins.');
  const items = readJSON(LS_GALLERY_KEY, []).map((i) => (i.id === id ? { ...i, status } : i));
  writeJSON(LS_GALLERY_KEY, items);
}

function setupNav() {
  const menu = document.getElementById('menu-toggle');
  const nav = document.getElementById('site-nav');
  const logout = document.getElementById('logout-btn');

  if (menu && nav) menu.onclick = () => nav.classList.toggle('open');

  if (logout) {
    logout.onclick = async () => {
      if (backendAvailable) {
        try {
          await api('/api/logout', 'POST', { token: getToken() });
        } catch {
          fallbackLogout();
        }
      } else {
        fallbackLogout();
      }
      clearToken();
      location.href = 'auth.html';
    };
  }
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

  document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
    btn.onclick = () => setTab(btn.dataset.authTab);
  });

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    const payload = { username: d.get('username'), password: d.get('password') };

    try {
      let data;
      if (backendAvailable) {
        try {
          data = await api('/api/login', 'POST', payload);
        } catch (err) {
          if (String(err.message).includes('Failed to fetch') || String(err.message) === 'Fehler') {
            data = fallbackLogin(payload);
          } else {
            throw err;
          }
        }
      } else {
        data = fallbackLogin(payload);
      }
      setToken(data.token);
      location.href = 'index.html';
    } catch (err) {
      msg.textContent = err.message;
    }
  };

  document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    const payload = {
      username: d.get('username'),
      password: d.get('password'),
      origin: d.get('origin'),
      state: d.get('state'),
    };

    try {
      let data;
      if (backendAvailable) {
        try {
          data = await api('/api/register', 'POST', payload);
        } catch (err) {
          if (String(err.message).includes('Failed to fetch') || String(err.message) === 'Fehler') {
            data = fallbackRegister(payload);
          } else {
            throw err;
          }
        }
      } else {
        data = fallbackRegister(payload);
      }
      setToken(data.token);
      location.href = 'index.html';
    } catch (err) {
      msg.textContent = err.message;
    }
  };

  document.getElementById('continue-guest').onclick = async () => {
    try {
      let data;
      if (backendAvailable) {
        try {
          data = await api('/api/guest', 'POST', {});
        } catch (err) {
          if (String(err.message).includes('Failed to fetch') || String(err.message) === 'Fehler') {
            data = fallbackGuest();
          } else {
            throw err;
          }
        }
      } else {
        data = fallbackGuest();
      }
      setToken(data.token);
      location.href = 'index.html';
    } catch (err) {
      msg.textContent = err.message;
    }
  };
}

async function resolveSession() {
  if (location.pathname.endsWith('auth.html') || location.pathname === '/auth.html') return null;

  const token = getToken();
  if (!token) {
    location.href = 'auth.html';
    return null;
  }

  if (!token.startsWith('fallback:')) {
    try {
      const { session } = await api(`/api/session?token=${encodeURIComponent(token)}`);
      if (session) return session;
    } catch {
      // Backend not reachable -> try fallback session
    }
  }

  const session = fallbackSession();
  if (!session) {
    clearToken();
    location.href = 'auth.html';
    return null;
  }

  return session;
}

function initMap(session) {
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map('map', {
    scrollWheelZoom: false,
    zoomControl: true,
    minZoom: 5,
    maxZoom: 12,
  }).setView([51.2, 10.45], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);

  [
    ['Berlin', [52.52, 13.405], 'Reggaeton Night'],
    ['Hamburg', [53.5511, 9.9937], 'Salsa Social'],
    ['Köln', [50.9375, 6.9603], 'Latin Street Food'],
  ].forEach(([city, coords, title]) => {
    L.marker(coords).addTo(map).bindPopup(`<strong>${title}</strong><br>${city}`);
  });

  if (session.mode === 'guest') {
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
  }
}

async function loadGalleryData(session) {
  if (!backendAvailable || getToken()?.startsWith('fallback:')) {
    return fallbackGalleryList(session);
  }
  try {
    return await api(`/api/gallery?token=${encodeURIComponent(getToken())}`);
  } catch {
    return fallbackGalleryList(session);
  }
}

async function initGallery(session) {
  const form = document.getElementById('gallery-form');
  if (!form) return;

  const approved = document.getElementById('approved-list');
  const pending = document.getElementById('pending-list');
  const review = document.getElementById('admin-review');

  const render = async () => {
    const { items, isAdmin } = await loadGalleryData(session);
    approved.innerHTML = '';
    pending.innerHTML = '';
    review.innerHTML = '';

    items.filter((i) => i.status === 'approved').forEach((i) => {
      const li = document.createElement('li');
      li.textContent = `${i.file_name} – @${i.username}`;
      approved.appendChild(li);
    });

    items.filter((i) => i.status === 'pending').forEach((i) => {
      const li = document.createElement('li');
      li.textContent = `${i.file_name} – wartet`;
      pending.appendChild(li);

      if (isAdmin) {
        const block = document.createElement('div');
        block.className = 'admin-item';
        block.innerHTML = `<strong>${i.file_name}</strong> von @${i.username}`;

        const approve = document.createElement('button');
        approve.className = 'btn tiny';
        approve.textContent = 'Freigeben';
        approve.onclick = async () => {
          try {
            if (!backendAvailable || getToken()?.startsWith('fallback:')) {
              fallbackGalleryModerate(session, i.id, 'approved');
            } else {
              await api('/api/gallery/moderate', 'POST', { token: getToken(), id: i.id, status: 'approved' });
            }
          } catch {
            fallbackGalleryModerate(session, i.id, 'approved');
          }
          render();
        };

        const reject = document.createElement('button');
        reject.className = 'btn tiny ghost';
        reject.textContent = 'Ablehnen';
        reject.onclick = async () => {
          try {
            if (!backendAvailable || getToken()?.startsWith('fallback:')) {
              fallbackGalleryModerate(session, i.id, 'rejected');
            } else {
              await api('/api/gallery/moderate', 'POST', { token: getToken(), id: i.id, status: 'rejected' });
            }
          } catch {
            fallbackGalleryModerate(session, i.id, 'rejected');
          }
          render();
        };

        block.append(approve, reject);
        review.appendChild(block);
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

    try {
      if (!backendAvailable || getToken()?.startsWith('fallback:')) {
        fallbackGalleryUpload(session, file.name);
      } else {
        await api('/api/gallery/upload', 'POST', { token: getToken(), fileName: file.name });
      }
    } catch {
      fallbackGalleryUpload(session, file.name);
    }

    form.reset();
    render();
  };

  render();
}

(async function init() {
  setupNav();
  setupAuthPage();

  const session = await resolveSession();
  if (!session) return;

  document.body.classList.toggle('is-guest', session.mode === 'guest');

  initMap(session);
  initGallery(session);
})();
