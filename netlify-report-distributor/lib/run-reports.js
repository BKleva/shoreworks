const { listClients } = require('./client-store');
const { getSiteMetrics } = require('./netlify-analytics');
const { buildReportEmail } = require('./email-template');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Prior calendar month in UTC, e.g. run on Oct 1 -> reports September.
function priorMonthRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    fromMs: start.getTime(),
    toMs: end.getTime(),
    label: `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`
  };
}

async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Your Website Traffic Report <reports@shoreworksnj.com>',
      to: [to],
      subject,
      html
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}

// Pass clientId to send only that one client's report; omit to send to everyone.
async function runReports(now = new Date(), clientId = null) {
  const { fromMs, toMs, label } = priorMonthRange(now);
  let clients = await listClients();
  if (clientId) {
    clients = clients.filter((c) => c.id === clientId);
    if (!clients.length) {
      throw new Error('Client not found');
    }
  }
  const results = [];

  for (const client of clients) {
    try {
      const metrics = await getSiteMetrics(client.site_id, fromMs, toMs);
      const { subject, html } = buildReportEmail(client, metrics, label);
      await sendEmail(client.email, subject, html);
      results.push({ client: client.name, ok: true });
    } catch (err) {
      results.push({ client: client.name, ok: false, error: err.message });
    }
  }

  return { period: label, results };
}

module.exports = { runReports, priorMonthRange };
