const crypto = require('crypto');
const { listClients, saveClients } = require('../../lib/client-store');

function checkAuth(event) {
  const provided = event.headers['x-admin-password'] || '';
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.handler = async function (event) {
  if (!checkAuth(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (event.httpMethod === 'GET') {
    const clients = await listClients();
    return { statusCode: 200, body: JSON.stringify({ clients }) };
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    const { name, email, site_id, site_name } = body;
    if (!name || !email || !site_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'name, email, and site_id are required' }) };
    }
    const clients = await listClients();
    clients.push({
      id: crypto.randomUUID(),
      name,
      email,
      site_id,
      site_name: site_name || name
    });
    await saveClients(clients);
    return { statusCode: 200, body: JSON.stringify({ clients }) };
  }

  if (event.httpMethod === 'PUT') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    const { id, name, email, site_id, site_name } = body;
    if (!id || !name || !email || !site_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'id, name, email, and site_id are required' }) };
    }
    const clients = await listClients();
    const idx = clients.findIndex((c) => c.id === id);
    if (idx === -1) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };
    }
    clients[idx] = { id, name, email, site_id, site_name: site_name || name };
    await saveClients(clients);
    return { statusCode: 200, body: JSON.stringify({ clients }) };
  }

  if (event.httpMethod === 'DELETE') {
    const id = (event.queryStringParameters || {}).id;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };
    const clients = await listClients();
    const next = clients.filter((c) => c.id !== id);
    await saveClients(next);
    return { statusCode: 200, body: JSON.stringify({ clients: next }) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
