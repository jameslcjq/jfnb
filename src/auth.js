const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = '123456';

let currentUser = null;

function normalizeUsername(username) {
  return String(username || '').trim();
}

function login(username, password) {
  const normalizedUsername = normalizeUsername(username);
  if (normalizedUsername === DEFAULT_USERNAME && String(password || '') === DEFAULT_PASSWORD) {
    currentUser = {
      username: DEFAULT_USERNAME,
      displayName: '管理员',
      role: 'admin',
      loggedInAt: new Date().toISOString(),
    };
    return { ok: true, user: currentUser };
  }

  return { ok: false, message: '用户名或密码错误' };
}

function logout() {
  currentUser = null;
  return { ok: true };
}

function isLoggedIn() {
  return Boolean(currentUser);
}

function getStatus() {
  return {
    ok: true,
    loggedIn: isLoggedIn(),
    user: currentUser,
  };
}

module.exports = {
  login,
  logout,
  isLoggedIn,
  getStatus,
};
