const SQUARE_ENV = process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
const SQUARE_BASE =
  SQUARE_ENV === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';

function headers() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN env var is not set');
  return {
    'Square-Version': process.env.SQUARE_API_VERSION || '2025-01-23',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function squareFetch(path, options = {}) {
  const res = await fetch(`${SQUARE_BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data.errors && data.errors[0] && data.errors[0].detail) || `Square API error (${res.status})`;
    console.error('Square API error', res.status, JSON.stringify(data));
    const err = new Error(message);
    err.statusCode = res.status;
    throw err;
  }
  return data;
}

module.exports = { squareFetch, SQUARE_ENV };
