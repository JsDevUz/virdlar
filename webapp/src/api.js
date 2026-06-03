const tg = window.Telegram?.WebApp;

function getInitData() {
  return tg?.initData || '';
}

function getGroupSlug() {
  return new URLSearchParams(window.location.search).get('g') || '';
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-init-data': getInitData(),
      'x-group-slug': getGroupSlug(),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getVirdlar: (date) => apiFetch(`/api/virdlar?date=${date}`),
  postVird: (body)   => apiFetch('/api/virdlar', { method: 'POST', body: JSON.stringify(body) }),
  getVirdlarConfig: () => apiFetch('/api/virdlar/config'),

  getUsers: ()       => apiFetch('/api/admin/users'),
  updateUser: (id, body) => apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getAdminVirdlar: (params) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v)));
    return apiFetch(`/api/admin/virdlar?${q}`);
  },
  getVirdlarConfigAdmin: () => apiFetch('/api/admin/virdlar-config'),
  addVirdConfig: (label) => apiFetch('/api/admin/virdlar-config', { method: 'POST', body: JSON.stringify({ label }) }),
  updateVirdConfig: (id, body) => apiFetch(`/api/admin/virdlar-config/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  moveVirdConfig: (id, direction) => apiFetch(`/api/admin/virdlar-config/${id}/move`, { method: 'POST', body: JSON.stringify({ direction }) }),

  updateGroupAdmins: (adminIds) => apiFetch('/api/admin/group-admins', { method: 'PATCH', body: JSON.stringify({ admin_ids: adminIds }) }),

  getGroups: () => apiFetch('/api/groups'),
  createGroup: (body) => apiFetch('/api/groups', { method: 'POST', body: JSON.stringify(body) }),
  updateGroup: (id, body) => apiFetch(`/api/groups/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
