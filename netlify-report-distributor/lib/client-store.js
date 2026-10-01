const { getStore } = require('@netlify/blobs');

const KEY = 'clients.json';

function store() {
  // CLI-deployed functions don't always get the automatic Blobs context
  // injected, so fall back to explicit siteID/token (NETLIFY_PAT doubles
  // as the Blobs auth token).
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_PAT) {
    return getStore({
      name: 'report-clients',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_PAT
    });
  }
  return getStore('report-clients');
}

async function listClients() {
  const data = await store().get(KEY, { type: 'json' });
  return data || [];
}

async function saveClients(clients) {
  await store().setJSON(KEY, clients);
}

module.exports = { listClients, saveClients };
