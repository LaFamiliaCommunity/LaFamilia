const USERS_KEY = 'lafamilia_users';
const SESSION_KEY = 'lafamilia_session';
const GALLERY_KEY = 'lafamilia_gallery';
const ADMIN_USERS = ['admin', 'giovanni_mogito', 'giovanni'];

const authScreen = document.getElementById('auth-screen');
const authMessage = document.getElementById('auth-message');
const siteNav = document.getElementById('site-nav');
const menuToggle = document.getElementById('menu-toggle');
const logoutBtn = document.getElementById('logout-btn');
const openAuthButtons = document.querySelectorAll('.open-auth');

let mapInitialized = false;

const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const users = () => readJSON(USERS_KEY, []);
const gallery = () => readJSON(GALLERY_KEY, []);

const setSession = (session) => writeJSON(SESSION_KEY, session);
const getSession = () => readJSON(SESSION_KEY, null);

function setAuthTab(tab) {
  document.querySelectorAll('[data-auth-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.authTab === tab));
  document.querySelectorAll('.auth-form').forEach((form) => form.classList.remove('active'));
  if (tab === 'login') document.getElementById('login-form').classList.add('active');
  if (tab === 'register') document.getElementById('register-form').classList.add('active');
  if (tab === 'guest') document.getElementById('guest-pane').classList.add('active');
  authMessage.textContent = '';
}

function applyAccessMode() {
  const session = getSession();
  const isGuest = !session || session.mode === 'guest';
  document.body.classList.toggle('is-guest', isGuest);
  authScreen.classList.add('hidden');
  if (!mapInitialized) initMap();
  renderGallery();
}

function showAuth(message = '') {
  authScreen.classList.remove('hidden');
  if (message) authMessage.textContent = message;
}

function initMap() {
  mapInitialized = true;
  const map = L.map('map', { zoomControl: true, minZoom: 5, maxZoom: 12 }).setView([51.2, 10.45], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap-Mitwirkende' }).addTo(map);
  const events = [
    { city: 'Berlin', coords: [52.52, 13.405], title: 'Reggaeton Night Berlin', details: 'Freitag, 22:00 · Kreuzberg' },
    { city: 'Hamburg', coords: [53.5511, 9.9937], title: 'Salsa Social Hamburg', details: 'Samstag, 20:00 · St. Pauli' },
    { city: 'Köln', coords: [50.9375, 6.9603], title: 'Latin Street Food & Music', details: 'Sonntag, 14:00 · Innenstadt' },
    { city: 'Frankfurt', coords: [50.1109, 8.6821], title: 'Bachata Workshop', details: 'Mittwoch, 19:30 · Sachsenhausen' },
  ];
  events.forEach((event) => L.marker(event.coords).addTo(map).bindPopup(`<strong>${event.title}</strong><br>${event.city}<br>${event.details}`));
}

function renderGallery() {
  const items = gallery();
  const approvedList = document.getElementById('approved-list');
  const pendingList = document.getElementById('pending-list');
  const adminReview = document.getElementById('admin-review');
  const session = getSession();
  const isAdmin = session?.mode === 'user' && ADMIN_USERS.includes(session.username.toLowerCase());

  approvedList.innerHTML = '';
  pendingList.innerHTML = '';
  adminReview.innerHTML = '';

  items.filter((i) => i.status === 'approved').forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.fileName} – von @${item.username}`;
    approvedList.appendChild(li);
  });

  items.filter((i) => i.status === 'pending').forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.fileName} – wartet auf Prüfung`;
    pendingList.appendChild(li);

    if (isAdmin) {
      const block = document.createElement('div');
      block.className = 'admin-item';
      block.innerHTML = `<strong>${item.fileName}</strong> von @${item.username}`;
      const approveBtn = document.createElement('button');
      approveBtn.className = 'btn tiny';
      approveBtn.textContent = 'Freigeben';
      approveBtn.onclick = () => updateGalleryItem(item.id, 'approved');
      const rejectBtn = document.createElement('button');
      rejectBtn.className = 'btn tiny ghost';
      rejectBtn.textContent = 'Ablehnen';
      rejectBtn.onclick = () => updateGalleryItem(item.id, 'rejected');
      block.append(approveBtn, rejectBtn);
      adminReview.appendChild(block);
    }
  });

  if (!approvedList.children.length) approvedList.innerHTML = '<li>Noch keine freigegebenen Bilder.</li>';
  if (!pendingList.children.length) pendingList.innerHTML = '<li>Keine offenen Uploads.</li>';
}

function updateGalleryItem(id, status) {
  const items = gallery().map((item) => (item.id === id ? { ...item, status } : item));
  writeJSON(GALLERY_KEY, items);
  renderGallery();
}

document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
  btn.addEventListener('click', () => setAuthTab(btn.dataset.authTab));
});

document.getElementById('login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const username = formData.get('username').toString().trim();
  const password = formData.get('password').toString();
  const found = users().find((user) => user.username.toLowerCase() === username.toLowerCase());
  if (!found) {
    authMessage.textContent = 'Konto existiert nicht.';
    return;
  }
  if (found.password !== password) {
    authMessage.textContent = 'Code/Passwort ist falsch.';
    return;
  }
  setSession({ mode: 'user', username: found.username });
  applyAccessMode();
});

document.getElementById('register-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const newUser = {
    username: formData.get('username').toString().trim(),
    password: formData.get('password').toString(),
    origin: formData.get('origin').toString().trim(),
    state: formData.get('state').toString().trim(),
  };
  if (users().some((u) => u.username.toLowerCase() === newUser.username.toLowerCase())) {
    authMessage.textContent = 'Username ist schon vergeben.';
    return;
  }
  writeJSON(USERS_KEY, [...users(), newUser]);
  setSession({ mode: 'user', username: newUser.username });
  applyAccessMode();
});

document.getElementById('continue-guest').addEventListener('click', () => {
  setSession({ mode: 'guest' });
  applyAccessMode();
});

document.getElementById('gallery-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const session = getSession();
  if (!session || session.mode === 'guest') {
    showAuth('Bitte zuerst anmelden.');
    return;
  }
  const fileInput = event.target.querySelector('input[name="image"]');
  const file = fileInput.files?.[0];
  if (!file) return;
  const newItem = {
    id: crypto.randomUUID(),
    username: session.username,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
    status: 'pending',
  };
  writeJSON(GALLERY_KEY, [...gallery(), newItem]);
  event.target.reset();
  renderGallery();
});

openAuthButtons.forEach((btn) => btn.addEventListener('click', () => {
  showAuth();
  setAuthTab('login');
}));

menuToggle.addEventListener('click', () => siteNav.classList.toggle('open'));
siteNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => siteNav.classList.remove('open')));
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(SESSION_KEY);
  showAuth();
  setAuthTab('login');
  document.body.classList.remove('is-guest');
});

if (getSession()) {
  applyAccessMode();
} else {
  showAuth();
  setAuthTab('login');
}
