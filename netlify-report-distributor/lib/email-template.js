function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function rankingRows(rows, emptyLabel) {
  if (!rows || !rows.length) {
    return `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">${emptyLabel}</td></tr>`;
  }
  return rows
    .map(
      (r) => `<tr>
        <td style="padding:6px 0;font-size:13px;color:#1a1a1a">${r.resource}</td>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;text-align:right">${fmt(r.count)}</td>
      </tr>`
    )
    .join('');
}

// client: { name, site_name }
// metrics: { pageviews, visitors, topPages, topReferrers }
// periodLabel: e.g. "September 2026"
function buildReportEmail(client, metrics, periodLabel) {
  const navy = '#0D3D54';
  const teal = '#4BB8B8';
  const subject = `${client.site_name || client.name} — ${periodLabel} Traffic Report`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;color:#1a1a1a;margin:0 auto">
    <div style="background:${navy};border-radius:12px 12px 0 0;padding:28px 32px">
      <h2 style="color:#fff;margin:0;font-size:20px">${client.site_name || client.name}</h2>
      <p style="color:${teal};margin:4px 0 0;font-size:13px;font-weight:600">${periodLabel} Traffic Report</p>
    </div>
    <div style="background:#fff;border:1px solid #eee;border-top:none;padding:28px 32px">
      <div style="display:flex;gap:16px;margin-bottom:24px">
        <div style="flex:1;background:#FAF8F4;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:26px;font-weight:700;color:${navy}">${fmt(metrics.pageviews)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">Pageviews</div>
        </div>
        <div style="flex:1;background:#FAF8F4;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:26px;font-weight:700;color:${navy}">${fmt(metrics.visitors)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">Unique Visitors</div>
        </div>
      </div>

      <h3 style="font-size:14px;margin:0 0 8px;color:${navy}">Top Pages</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">${rankingRows(metrics.topPages, 'No page data for this period.')}</table>

      <h3 style="font-size:14px;margin:0 0 8px;color:${navy}">Top Referrers</h3>
      <table style="width:100%;border-collapse:collapse">${rankingRows(metrics.topReferrers, 'No referrer data for this period.')}</table>

      <p style="font-size:12px;color:#9ca3af;margin-top:28px">Automated monthly report. Questions about your site's traffic? Just reply to this email.</p>
    </div>
  </div>`;

  return { subject, html };
}

module.exports = { buildReportEmail };
