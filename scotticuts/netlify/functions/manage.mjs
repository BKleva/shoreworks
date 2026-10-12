import { store, getDay, mutateDay, manageToken, safeEqual, validDate, nowNJ, json, sendMail, notifyTo, fmtTime, prettyDate } from './_lib.mjs';

// Customer self-service: view / cancel a booking from the link in their confirmation.
export default async (req) => {
  const url = new URL(req.url);
  let id, t, action;
  if (req.method === 'POST') {
    let b = {};
    try { b = await req.json(); } catch { /* fall through */ }
    ({ id, t, action } = b);
  } else {
    id = url.searchParams.get('id');
    t = url.searchParams.get('t');
  }

  const date = String(id || '').slice(0, 10);
  if (!validDate(date) || !safeEqual(t, manageToken(String(id)))) return json({ error: 'This link isn’t valid.' }, 404);

  const s = store();
  const day = await getDay(date, s);
  const found = day.bookings.find((b) => b.id === id);
  if (!found) return json({ error: 'We couldn’t find that booking.' }, 404);

  const view = (b) => ({
    id: b.id, date, start: b.start, duration: b.duration, serviceName: b.serviceName,
    priceLabel: b.priceLabel, name: b.name, status: b.status,
  });

  if (req.method === 'GET') return json({ booking: view(found) });

  if (action !== 'cancel') return json({ error: 'Unknown action.' }, 400);
  const now = nowNJ();
  if (date < now.date || (date === now.date && found.start <= now.minutes)) {
    return json({ error: 'That appointment has already passed.' }, 400);
  }
  const out = await mutateDay(date, (d) => {
    const b = d.bookings.find((x) => x.id === id);
    if (!b) return { error: 'Booking not found.', status: 404 };
    b.status = 'cancelled';
    b.cancelledBy = 'customer';
    return { booking: view(b) };
  }, s);
  if (out.error) return json({ error: out.error }, out.status || 400);

  await sendMail({
    to: notifyTo(),
    subject: `Cancelled: ${found.name} — ${prettyDate(date)} ${fmtTime(found.start)}`,
    text: `${found.name} cancelled their ${found.serviceName} on ${prettyDate(date)} at ${fmtTime(found.start)}.\nPhone: ${found.phone}`,
  });
  return json({ ok: true, booking: out.booking });
};

export const config = { path: '/api/manage' };
