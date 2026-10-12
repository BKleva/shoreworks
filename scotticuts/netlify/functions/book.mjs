import {
  store, getConfig, mutateDay, openSlots, validDate, newId, manageToken, json, clean,
  sendMail, notifyTo, fmtTime, prettyDate, SHOP,
} from './_lib.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }

  // Honeypot — real people leave this empty.
  if (b.website) return json({ ok: true });

  const s = store();
  const config = await getConfig(s);
  const service = config.services.find((x) => x.id === b.serviceId && x.active);
  const date = b.date;
  const start = Number(b.start);
  const name = clean(b.name, 80);
  const phone = clean(b.phone, 25);
  const email = clean(b.email, 120);
  const notes = clean(b.notes, 300);

  if (!service || !validDate(date) || !Number.isInteger(start)) return json({ error: 'Please choose a service, date and time.' }, 400);
  if (name.length < 2) return json({ error: 'Please enter your name.' }, 400);
  if (phone.replace(/\D/g, '').length < 10) return json({ error: 'Please enter a phone number we can reach you at.' }, 400);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'That email address doesn’t look right.' }, 400);

  const id = newId(date);
  const out = await mutateDay(date, (day) => {
    // Re-check against the freshest copy of the day so a slot can't be double-booked.
    if (!openSlots(config, day, date, service.duration).includes(start)) {
      return { error: 'Sorry — that time was just taken. Please pick another.', status: 409 };
    }
    day.bookings.push({
      id, serviceId: service.id, serviceName: service.name, priceLabel: service.priceLabel,
      start, duration: service.duration, name, phone, email, notes,
      status: 'booked', source: 'online', created: new Date().toISOString(),
    });
    return { id };
  }, s);
  if (out.error) return json({ error: out.error }, out.status || 400);

  const when = `${prettyDate(date)} at ${fmtTime(start)}`;
  const origin = new URL(req.url).origin;
  const manageUrl = `${origin}/manage?id=${id}&t=${manageToken(id)}`;

  const summary = `${service.name} (${service.priceLabel}) — ${when}`;
  await Promise.all([
    sendMail({
      to: notifyTo(),
      subject: `New booking: ${name} — ${when}`,
      text: `${name} booked ${summary}\nPhone: ${phone}\nEmail: ${email || '—'}\nNotes: ${notes || '—'}`,
    }),
    sendMail({
      to: email,
      subject: `You're booked at ${SHOP.name} — ${when}`,
      text: `Hi ${name},\n\nYou're booked: ${summary}.\n${SHOP.name} · ${SHOP.address} · ${SHOP.phone}\n\nNeed to cancel? ${manageUrl}\n`,
    }),
  ]);

  return json({
    ok: true,
    booking: { id, serviceName: service.name, priceLabel: service.priceLabel, date, start, duration: service.duration, name },
    manageUrl,
  });
};

export const config = { path: '/api/book' };
