import json
import os
import secrets
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

DB_PATH = os.path.join(os.path.dirname(__file__), 'lafamilia.db')
ADMIN_USERS = {'admin', 'giovanni_mogito', 'giovanni'}


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            origin TEXT NOT NULL,
            state TEXT NOT NULL
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            mode TEXT NOT NULL
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS gallery (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            file_name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
        )
        '''
    )
    conn.commit()
    conn.close()


class Handler(SimpleHTTPRequestHandler):
    def _json(self, code, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get('Content-Length', '0'))
        raw = self.rfile.read(length) if length else b'{}'
        try:
            return json.loads(raw.decode('utf-8'))
        except json.JSONDecodeError:
            return {}

    def _session(self, token):
        if not token:
            return None
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(
            '''
            SELECT s.token, s.username, s.mode, u.origin, u.state
            FROM sessions s
            LEFT JOIN users u ON u.username = s.username
            WHERE s.token = ?
            ''',
            (token,),
        )
        row = cur.fetchone()
        conn.close()
        return dict(row) if row else None

    def do_POST(self):
        if self.path == '/api/register':
            data = self._read_json()
            username = (data.get('username') or '').strip()
            password = (data.get('password') or '').strip()
            origin = (data.get('origin') or '').strip()
            state = (data.get('state') or '').strip()
            if not all([username, password, origin, state]):
                return self._json(400, {'error': 'Bitte alle Felder ausfüllen.'})

            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute('SELECT 1 FROM users WHERE lower(username) = lower(?)', (username,))
            if cur.fetchone():
                conn.close()
                return self._json(409, {'error': 'Username ist schon vergeben.'})

            cur.execute(
                'INSERT INTO users (username, password, origin, state) VALUES (?, ?, ?, ?)',
                (username, password, origin, state),
            )
            token = secrets.token_urlsafe(24)
            cur.execute('INSERT INTO sessions (token, username, mode) VALUES (?, ?, ?)', (token, username, 'user'))
            conn.commit()
            conn.close()
            return self._json(200, {'token': token, 'username': username, 'mode': 'user'})

        if self.path == '/api/login':
            data = self._read_json()
            username = (data.get('username') or '').strip()
            password = (data.get('password') or '').strip()

            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute('SELECT username, password FROM users WHERE lower(username) = lower(?)', (username,))
            row = cur.fetchone()
            if not row:
                conn.close()
                return self._json(404, {'error': 'Konto existiert nicht.'})
            if row['password'] != password:
                conn.close()
                return self._json(401, {'error': 'Code/Passwort ist falsch.'})

            token = secrets.token_urlsafe(24)
            cur.execute('INSERT INTO sessions (token, username, mode) VALUES (?, ?, ?)', (token, row['username'], 'user'))
            conn.commit()
            conn.close()
            return self._json(200, {'token': token, 'username': row['username'], 'mode': 'user'})

        if self.path == '/api/guest':
            token = secrets.token_urlsafe(24)
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute('INSERT INTO sessions (token, username, mode) VALUES (?, ?, ?)', (token, 'guest', 'guest'))
            conn.commit()
            conn.close()
            return self._json(200, {'token': token, 'username': 'guest', 'mode': 'guest'})

        if self.path == '/api/logout':
            token = self._read_json().get('token')
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute('DELETE FROM sessions WHERE token = ?', (token,))
            conn.commit()
            conn.close()
            return self._json(200, {'ok': True})

        if self.path == '/api/profile':
            data = self._read_json()
            session = self._session(data.get('token'))
            if not session or session['mode'] != 'user':
                return self._json(403, {'error': 'Bitte anmelden.'})

            origin = (data.get('origin') or '').strip()
            state = (data.get('state') or '').strip()
            password = (data.get('password') or '').strip()
            if not all([origin, state]):
                return self._json(400, {'error': 'Herkunft und Bundesland sind erforderlich.'})

            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            if password:
                cur.execute('UPDATE users SET origin=?, state=?, password=? WHERE username=?', (origin, state, password, session['username']))
            else:
                cur.execute('UPDATE users SET origin=?, state=? WHERE username=?', (origin, state, session['username']))
            conn.commit()
            conn.close()
            return self._json(200, {'ok': True})

        if self.path == '/api/gallery/upload':
            data = self._read_json()
            session = self._session(data.get('token'))
            if not session or session['mode'] != 'user':
                return self._json(403, {'error': 'Bitte anmelden.'})
            file_name = (data.get('fileName') or '').strip()
            if not file_name:
                return self._json(400, {'error': 'Dateiname fehlt.'})
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute('INSERT INTO gallery (username, file_name, status) VALUES (?, ?, ?)', (session['username'], file_name, 'pending'))
            conn.commit()
            conn.close()
            return self._json(200, {'ok': True})

        if self.path == '/api/gallery/moderate':
            data = self._read_json()
            session = self._session(data.get('token'))
            if not session or session['mode'] != 'user' or session['username'].lower() not in ADMIN_USERS:
                return self._json(403, {'error': 'Nur Admins.'})
            item_id = data.get('id')
            status = data.get('status')
            if status not in {'approved', 'rejected'}:
                return self._json(400, {'error': 'Ungültiger Status.'})
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute('UPDATE gallery SET status = ? WHERE id = ?', (status, item_id))
            conn.commit()
            conn.close()
            return self._json(200, {'ok': True})

        return self._json(404, {'error': 'Not found'})

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/session':
            token = parse_qs(parsed.query).get('token', [None])[0]
            session = self._session(token)
            return self._json(200, {'session': session})

        if parsed.path == '/api/gallery':
            token = parse_qs(parsed.query).get('token', [None])[0]
            session = self._session(token)
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute('SELECT id, username, file_name, status FROM gallery ORDER BY id DESC')
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return self._json(
                200,
                {
                    'items': rows,
                    'isAdmin': bool(session and session['mode'] == 'user' and session['username'].lower() in ADMIN_USERS),
                },
            )

        return super().do_GET()


if __name__ == '__main__':
    init_db()
    server = ThreadingHTTPServer(('0.0.0.0', 4173), Handler)
    print('Server running on http://0.0.0.0:4173')
    server.serve_forever()
