/**
 * api.js — thin fetch wrapper for the developer portal backend
 */

const API = {
  async request(method, path, body) {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`/api${path}`, opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw { status: res.status, ...data };
    return data;
  },

  get:    (path)       => API.request('GET',    path),
  post:   (path, body) => API.request('POST',   path, body),
  patch:  (path, body) => API.request('PATCH',  path, body),
  delete: (path)       => API.request('DELETE', path),

  // Auth
  register: (d) => API.post('/auth/register', d),
  login:    (d) => API.post('/auth/login', d),
  me:       ()  => API.get('/auth/me'),
  logout:   ()  => API.post('/auth/logout'),

  // Apps
  listApps:      ()       => API.get('/apps'),
  createApp:     (d)      => API.post('/apps', d),
  getApp:        (id)     => API.get(`/apps/${id}`),
  updateApp:     (id, d)  => API.patch(`/apps/${id}`, d),
  deleteApp:     (id)     => API.delete(`/apps/${id}`),
  rotateSecret:  (id)     => API.post(`/apps/${id}/rotate-secret`),
  getSdkConfig:  (id)     => API.get(`/apps/${id}/sdk-config`),
};
