const tg = window.Telegram?.WebApp;

function getInitData() {
  return tg?.initData || '';
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-init-data': getInitData(),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getVirdlar: (date) => apiFetch(`/api/virdlar?date=${date}`),
  postVird: (body)   => apiFetch('/api/virdlar', { method: 'POST', body: JSON.stringify(body) }),
  getUsers: ()       => apiFetch('/api/admin/users'),
  updateUser: (id, body) => apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getAdminVirdlar: (params) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v)));
    return apiFetch(`/api/admin/virdlar?${q}`);
  },
};
