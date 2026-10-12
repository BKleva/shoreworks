import { store, getConfig, getDay, openSlots, publicConfig, validDate, json, fmtTime } from './_lib.mjs';

// GET /api/services                       -> public service list + hours
// GET /api/availability?date=&service=    -> open start times for that day
export default async (req) => {
  const url = new URL(req.url);
  const s = store();
  const config = await getConfig(s);

  if (url.pathname.endsWith('/services')) return json(publicConfig(config));

  const date = url.searchParams.get('date');
  const service = config.services.find((x) => x.id === url.searchParams.get('service') && x.active);
  if (!validDate(date) || !service) return json({ error: 'Pick a service and a date.' }, 400);

  const day = await getDay(date, s);
  const slots = openSlots(config, day, date, service.duration);
  return json({ date, slots: slots.map((t) => ({ t, label: fmtTime(t) })) });
};

export const config = { path: ['/api/services', '/api/availability'] };
