const TOKEN_KEY = 'lafamilia_token';
const LS_USERS_KEY = 'lafamilia_users_fallback';
const LS_SESSION_KEY = 'lafamilia_session_fallback';
const LS_GALLERY_KEY = 'lafamilia_gallery_fallback';
const ADMIN_USERS = ['admin', 'giovanni', 'giovanni_mogito'];

let backendAvailable = true;

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
const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const api = async (path, method = 'GET', body) => {
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || 'Fehler');
    backendAvailable = true;
    return data;
  } catch (err) {
    backendAvailable = false;
    throw err;
  }
};

function fallbackRegister(payload) {
  const users = readJSON(LS_USERS_KEY, []);
  if (users.some((u) => u.username.toLowerCase() === String(payload.username).toLowerCase())) {
    throw new Error('Username ist schon vergeben.');
  }
  const user = {
    username: String(payload.username).trim(),
    password: String(payload.password),
    origin: String(payload.origin).trim(),
    state: String(payload.state).trim(),
  };
  users.push(user);
  writeJSON(LS_USERS_KEY, users);
  writeJSON(LS_SESSION_KEY, { mode: 'user', username: user.username, origin: user.origin, state: user.state });
  const token = `fallback:${user.username}`;
  setToken(token);
  return { token };
}

function fallbackLogin(payload) {
  const users = readJSON(LS_USERS_KEY, []);
  const found = users.find((u) => u.username.toLowerCase() === String(payload.username).toLowerCase());
  if (!found) throw new Error('Konto existiert nicht.');
  if (found.password !== String(payload.password)) throw new Error('Code/Passwort ist falsch.');
  writeJSON(LS_SESSION_KEY, { mode: 'user', username: found.username, origin: found.origin, state: found.state });
  const token = `fallback:${found.username}`;
  setToken(token);
  return { token };
}

function fallbackGuest() {
  writeJSON(LS_SESSION_KEY, { mode: 'guest', username: 'guest' });
  const token = 'fallback:guest';
  setToken(token);
  return { token };
}

function fallbackSession() {
  return readJSON(LS_SESSION_KEY, null);
}

function fallbackLogout() {
  localStorage.removeItem(LS_SESSION_KEY);
  clearToken();
}

function fallbackUpdateProfile(session, { origin, state, password }) {
  const users = readJSON(LS_USERS_KEY, []);
  const idx = users.findIndex((u) => u.username === session.username);
  if (idx < 0) throw new Error('User nicht gefunden.');
  users[idx].origin = origin;
  users[idx].state = state;
  if (password) users[idx].password = password;
  writeJSON(LS_USERS_KEY, users);
  writeJSON(LS_SESSION_KEY, { ...session, origin, state });
}

function fallbackGalleryList(session) {
  const items = readJSON(LS_GALLERY_KEY, []);
  const isAdmin = session?.mode === 'user' && ADMIN_USERS.includes(String(session.username).toLowerCase());
  return { items, isAdmin };
}

function fallbackGalleryUpload(session, fileName) {
  const items = readJSON(LS_GALLERY_KEY, []);
  items.unshift({ id: Date.now(), username: session.username, file_name: fileName, status: 'pending' });
  writeJSON(LS_GALLERY_KEY, items);
}

function fallbackGalleryModerate(session, id, status) {
  const isAdmin = session?.mode === 'user' && ADMIN_USERS.includes(String(session.username).toLowerCase());
  if (!isAdmin) throw new Error('Nur Admins.');
  const items = readJSON(LS_GALLERY_KEY, []).map((i) => (i.id === id ? { ...i, status } : i));
  writeJSON(LS_GALLERY_KEY, items);
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
  document.querySelectorAll('[data-auth-tab]').forEach((btn) => (btn.onclick = () => setTab(btn.dataset.authTab)));

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    const payload = { username: d.get('username'), password: d.get('password') };
    try {
      let data;
      try {
        data = await api('/api/login', 'POST', payload);
      } catch (err) {
        if (String(err.message).includes('Failed to fetch') || String(err.message) === 'Fehler') data = fallbackLogin(payload);
        else throw err;
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
    const payload = { username: d.get('username'), password: d.get('password'), origin: d.get('origin'), state: d.get('state') };
    try {
      let data;
      try {
        data = await api('/api/register', 'POST', payload);
      } catch (err) {
        if (String(err.message).includes('Failed to fetch') || String(err.message) === 'Fehler') data = fallbackRegister(payload);
        else throw err;
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
      try {
        data = await api('/api/guest', 'POST', {});
      } catch {
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
      // fallback below
    }
  }

  const local = fallbackSession();
  if (!local) {
    clearToken();
    location.href = 'auth.html';
    return null;
  }
  return local;
}

function setupNavAndProfile(session) {
  const menu = document.getElementById('menu-toggle');
  const nav = document.getElementById('site-nav');
  if (menu && nav) menu.onclick = () => nav.classList.toggle('open');

  const profileTrigger = document.getElementById('profile-trigger');
  const profileDropdown = document.getElementById('profile-dropdown');
  const profileName = document.getElementById('profile-name');
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (profileName) profileName.textContent = session.mode === 'guest' ? 'Gast' : `@${session.username}`;

  if (profileTrigger && profileDropdown) {
    profileTrigger.onclick = () => profileDropdown.classList.toggle('open');
    document.addEventListener('click', (e) => {
      if (!profileDropdown.contains(e.target) && !profileTrigger.contains(e.target)) profileDropdown.classList.remove('open');
    });
  }

  if (editProfileBtn) {
    editProfileBtn.style.display = session.mode === 'guest' ? 'none' : 'block';
    editProfileBtn.onclick = async () => {
      const newOrigin = prompt('Neue Herkunft:', session.origin || '');
      if (newOrigin === null) return;
      const newState = prompt('Neues Bundesland:', session.state || '');
      if (newState === null) return;
      const newPassword = prompt('Neues Passwort (leer lassen = unverändert):', '');

      try {
        if (!getToken()?.startsWith('fallback:')) {
          await api('/api/profile', 'POST', {
            token: getToken(),
            origin: newOrigin.trim(),
            state: newState.trim(),
            password: (newPassword || '').trim(),
          });
        } else {
          fallbackUpdateProfile(session, { origin: newOrigin.trim(), state: newState.trim(), password: (newPassword || '').trim() });
        }
        alert('Profil gespeichert.');
      } catch (err) {
        try {
          fallbackUpdateProfile(session, { origin: newOrigin.trim(), state: newState.trim(), password: (newPassword || '').trim() });
          alert('Profil lokal gespeichert (Fallback).');
        } catch {
          alert(err.message || 'Profil konnte nicht gespeichert werden.');
        }
      }
    };
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try {
        if (!getToken()?.startsWith('fallback:')) await api('/api/logout', 'POST', { token: getToken() });
      } catch {
        // ignore and fallback
      }
      fallbackLogout();
      location.href = 'auth.html';
    };
  }
}

function initMap(session) {
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map('map', { scrollWheelZoom: false, minZoom: 5, maxZoom: 12 }).setView([51.2, 10.45], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
  [
    ['Berlin', [52.52, 13.405], 'Reggaeton Night'],
    ['Hamburg', [53.5511, 9.9937], 'Salsa Social'],
    ['Köln', [50.9375, 6.9603], 'Latin Street Food'],
  ].forEach(([city, coords, title]) => L.marker(coords).addTo(map).bindPopup(`<strong>${title}</strong><br>${city}`));

  if (session.mode === 'guest') {
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
  }
}

async function initGallery(session) {
  const form = document.getElementById('gallery-form');
  if (!form) return;

  const approved = document.getElementById('approved-list');
  const pending = document.getElementById('pending-list');
  const review = document.getElementById('admin-review');

  const getData = async () => {
    if (getToken()?.startsWith('fallback:')) return fallbackGalleryList(session);
    try {
      return await api(`/api/gallery?token=${encodeURIComponent(getToken())}`);
    } catch {
      return fallbackGalleryList(session);
    }
  };

  const render = async () => {
    const { items, isAdmin } = await getData();
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
        approve.className = 'btn';
        approve.textContent = 'Freigeben';
        approve.onclick = async () => {
          if (getToken()?.startsWith('fallback:')) fallbackGalleryModerate(session, i.id, 'approved');
          else await api('/api/gallery/moderate', 'POST', { token: getToken(), id: i.id, status: 'approved' });
          render();
        };

        const reject = document.createElement('button');
        reject.className = 'btn ghost';
        reject.textContent = 'Ablehnen';
        reject.onclick = async () => {
          if (getToken()?.startsWith('fallback:')) fallbackGalleryModerate(session, i.id, 'rejected');
          else await api('/api/gallery/moderate', 'POST', { token: getToken(), id: i.id, status: 'rejected' });
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

    if (getToken()?.startsWith('fallback:')) fallbackGalleryUpload(session, file.name);
    else await api('/api/gallery/upload', 'POST', { token: getToken(), fileName: file.name });

    form.reset();
    render();
  };

  render();
}

(async function init() {
  setupAuthPage();

  const session = await resolveSession();
  if (!session) return;

  document.body.classList.toggle('is-guest', session.mode === 'guest');
  setupNavAndProfile(session);
  initMap(session);
  initGallery(session);
})();
