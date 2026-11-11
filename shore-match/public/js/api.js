export class ApiError extends Error {
  constructor(status, body) {
    super(body.error || 'Request failed');
    this.status = status;
    this.fields = body.fields || null;
    this.body = body;
  }
}

export async function api(method, url, body) {
  let res;
  try {
    res = await fetch('/api' + url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new ApiError(0, { error: 'Network problem. Check your connection and try again.' });
  }
  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const get = (u) => api('GET', u);
export const post = (u, b) => api('POST', u, b || {});
export const put = (u, b) => api('PUT', u, b || {});
export const del = (u) => api('DELETE', u);
