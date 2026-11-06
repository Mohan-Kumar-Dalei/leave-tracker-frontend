// Session tokens live in httpOnly cookies, so this file never touches them.
// A 401 triggers one shared refresh, then the original request is retried.

export class ApiError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

let refreshing = null;

export function refreshSession() {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

const NO_REFRESH = ['/auth/login', '/auth/refresh'];

async function request(path, { method = 'GET', body } = {}, canRetry = true) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }

  const skipRefresh = NO_REFRESH.includes(path);

  if (response.status === 401 && canRetry && !skipRefresh) {
    if (await refreshSession()) return request(path, { method, body }, false);
    if (path !== '/auth/me') window.dispatchEvent(new Event('session-expired'));
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.message ?? 'Something went wrong. Please try again.',
      data?.field,
    );
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body = {}) => request(path, { method: 'POST', body }),
  patch: (path, body = {}) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export function toQuery(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
}
