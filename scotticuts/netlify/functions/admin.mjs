import { randomBytes } from 'node:crypto';
import {
  store, getConfig, getDay, mutateDay, verifyAdmin, validDate, addDays, newId, json, clean, DEFAULT_CONFIG,
  listEmployees, publicEmployee, hashPassword, teamKey, validId,
} from './_lib.mjs';

const STATUSES = ['booked', 'completed', 'noshow', 'cancelled'];

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!verifyAdmin(req)) return json({ error: 'Please log in again.' }, 401);

  let b = {};
  try { b = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const s = store();
  const done = (out) => (out.error ? json({ error: out.error }, out.status || 400) : json({ ok: true, day: out.day }));

  switch (b.action) {
    case 'config':
      return json({ config: await getConfig(s) });

    // Every day between from..to (max 42 days) with its bookings and blocks.
    case 'range': {
      if (!validDate(b.from) || !validDate(b.to) || b.to < b.from) return json({ error: 'Bad date range.' }, 400);
      const dates = [];
      for (let d = b.from; d <= b.to && dates.length < 42; d = addDays(d, 1)) dates.push(d);
      const days = await Promise.all(dates.map((d) => getDay(d, s)));
      return json({ days: Object.fromEntries(dates.map((d, i) => [d, days[i]])) });
    }

    case 'addBooking': {
      const config = await getConfig(s);
      const service = config.services.find((x) => x.id === b.serviceId);
      const start = Number(b.start);
      const name = clean(b.name, 80);
      if (!service || !validDate(b.date) || !Number.isInteger(start) || start < 0 || start >= 1440) return json({ error: 'Service, date and time are required.' }, 400);
      if (!name) return json({ error: 'Customer name is required.' }, 400);
      const duration = Number.isInteger(Number(b.duration)) && b.duration > 0 ? Number(b.duration) : service.duration;
      return done(await mutateDay(b.date, (day) => {
        day.bookings.push({
          id: newId(b.date), serviceId: service.id, serviceName: service.name, priceLabel: service.priceLabel,
          start, duration, name, phone: clean(b.phone, 25), email: clean(b.email, 120), notes: clean(b.notes, 300),
          status: 'booked', source: 'admin', created: new Date().toISOString(),
        });
      }, s));
    }

    case 'setStatus': {
      if (!validDate(b.date) || !STATUSES.includes(b.status)) return json({ error: 'Bad request.' }, 400);
      return done(await mutateDay(b.date, (day) => {
        const x = day.bookings.find((y) => y.id === b.id);
        if (!x) return { error: 'Booking not found.', status: 404 };
        x.status = b.status;
        if (b.status === 'cancelled') x.cancelledBy = 'shop';
      }, s));
    }

    case 'deleteBooking': {
      if (!validDate(b.date)) return json({ error: 'Bad request.' }, 400);
      return done(await mutateDay(b.date, (day) => { day.bookings = day.bookings.filter((y) => y.id !== b.id); }, s));
    }

    case 'addBlock': {
      const start = Number(b.start), end = Number(b.end);
      if (!validDate(b.date) || !(start >= 0 && end > start && end <= 1440)) return json({ error: 'Pick a valid start and end time.' }, 400);
      return done(await mutateDay(b.date, (day) => {
        day.blocks.push({ id: newId(b.date), start, end, note: clean(b.note, 80) });
      }, s));
    }

    case 'removeBlock':
      if (!validDate(b.date)) return json({ error: 'Bad request.' }, 400);
      return done(await mutateDay(b.date, (day) => { day.blocks = day.blocks.filter((y) => y.id !== b.id); }, s));

    case 'setClosed':
      if (!validDate(b.date)) return json({ error: 'Bad request.' }, 400);
      return done(await mutateDay(b.date, (day) => { day.closed = !!b.closed; day.closedNote = clean(b.note, 80); }, s));

    case 'saveConfig': {
      const c = b.config || {};
      const next = { ...DEFAULT_CONFIG };
      const int = (v, lo, hi, fallback) => (Number.isInteger(Number(v)) && v !== '' && Number(v) >= lo && Number(v) <= hi ? Number(v) : fallback);
      next.chairs = int(c.chairs, 1, 10, DEFAULT_CONFIG.chairs);
      next.step = [15, 20, 30, 60].includes(Number(c.step)) ? Number(c.step) : DEFAULT_CONFIG.step;
      next.leadMinutes = int(c.leadMinutes, 0, 1440, DEFAULT_CONFIG.leadMinutes);
      next.maxDays = int(c.maxDays, 1, 180, DEFAULT_CONFIG.maxDays);

      next.hours = {};
      for (let i = 0; i < 7; i++) {
        const h = c.hours?.[i];
        const ok = Array.isArray(h) && h[0] >= 0 && h[1] > h[0] && h[1] <= 1440;
        next.hours[i] = ok ? [Number(h[0]), Number(h[1])] : null;
      }

      const seen = new Set();
      next.services = (Array.isArray(c.services) ? c.services : []).slice(0, 30).map((x) => {
        let id = clean(x.id, 40).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
        const name = clean(x.name, 60);
        if (!id) id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'service';
        while (seen.has(id)) id += '-2';
        seen.add(id);
        return { id, name, priceLabel: clean(x.priceLabel, 20), duration: int(x.duration, 5, 480, 30), desc: clean(x.desc, 200), active: x.active !== false };
      }).filter((x) => x.name);
      if (!next.services.length) return json({ error: 'Keep at least one service.' }, 400);

      await s.setJSON('config', next);
      return json({ ok: true, config: next });
    }

    /* ---- barbers ---- */
    case 'listEmployees': {
      const list = await listEmployees(s);
      return json({ employees: list.map((e) => ({ ...publicEmployee(e), username: e.username })) });
    }

    case 'createEmployee': {
      const name = clean(b.name, 60);
      const username = clean(b.username, 30).toLowerCase();
      if (name.length < 2) return json({ error: 'Please enter a name.' }, 400);
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) return json({ error: 'Username: 3–30 letters, numbers, dots or dashes.' }, 400);
      if (String(b.password || '').length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      if ((await listEmployees(s)).some((e) => e.username === username)) return json({ error: 'That username is taken.' }, 409);
      const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'barber'}-${randomBytes(2).toString('hex')}`;
      const doc = {
        id, name, username, title: clean(b.title, 60), bio: String(b.bio ?? '').trim().slice(0, 800),
        passHash: hashPassword(b.password), photo: null, portfolio: [], created: new Date().toISOString(),
      };
      await s.setJSON(teamKey(id), doc);
      return json({ ok: true, employee: { ...publicEmployee(doc), username } });
    }

    case 'deleteEmployee': {
      if (!validId(b.id)) return json({ error: 'Bad request.' }, 400);
      const { blobs } = await s.list({ prefix: `img/${b.id}/` });
      await Promise.all(blobs.map((x) => s.delete(x.key)));
      await s.delete(teamKey(b.id));
      return json({ ok: true });
    }

    default:
      return json({ error: 'Unknown action.' }, 400);
  }
};

export const config = { path: '/api/admin' };
